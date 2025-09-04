import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_BASE_URL, DEAL_STAGE_PAYMENT_SUBMITTED_ID, DEAL_STAGE_PAYMENT_FAILURE_ID, FAILED_REASON_REQUIRES_CONFIRMATION, FAILED_REASON_REQUIRES_ACTION, FAILED_REASON_PROCESSING, FAILED_REASON_REQUIRES_CAPTURE } from "@/lib/env";
import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { closeDealFromInvoice } from "@/lib/actions/deals/closeDealFromInvoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRawBody(req: NextRequest): Promise<Buffer> {
    // NextRequest provides arrayBuffer for raw body
    return req.arrayBuffer().then((ab) => Buffer.from(ab));
}

function formatAud(amountCents: number | null | undefined): string | undefined {
    if (typeof amountCents !== "number" || !Number.isFinite(amountCents)) return undefined;
    const dollars = amountCents / 100;
    return dollars.toFixed(2);
}

async function ensureOsPaymentFromPaymentIntent(event: Stripe.Event, stripe: Stripe, pi: Stripe.PaymentIntent) {
    // Try to extract charge for receipt URL and method and card details
    let latestCharge: Stripe.Charge | null = null;
    try {
        const chargesList = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
        latestCharge = chargesList.data?.[0] ?? null;
    } catch {}

    const receiptUrl = latestCharge?.receipt_url ?? undefined;
    const methodType = latestCharge?.payment_method_details?.type ?? (pi.payment_method_types?.[0] ?? undefined);
    const paymentDateIso = new Date(((latestCharge?.created ?? pi.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const amountAud = typeof pi.amount_received === "number" ? (pi.amount_received / 100) : (pi.status === "succeeded" ? (pi.amount ?? 0) / 100 : 0);
    const amountCapturableAud = typeof pi.amount_capturable === "number" ? (pi.amount_capturable / 100) : undefined;
    const chargeId = latestCharge?.id;
    const card = latestCharge?.payment_method_details?.card ?? null;
    const cardBrand = card?.brand;
    const cardLast4 = card?.last4;
    const expMonth = card?.exp_month;
    const expYear = card?.exp_year;

    // Determine invoice and related entities
    const invoiceId = (pi.metadata && (pi.metadata as any)["invoice_id"]) || "";
    let contactId: string | undefined = undefined;
    let quoteId: string | undefined = undefined;
    let dealIdResolved: string | undefined = undefined;
    let propertyId: string | undefined = undefined;

    if (invoiceId) {
        try {
            const invContactRes = await getRequest<{ data: { contact?: string } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=contact`);
            contactId = (invContactRes as any)?.data?.contact ?? undefined;
        } catch {}
        try {
            const invPropRes = await getRequest<{ data: { proposal?: any } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=proposal.id`);
            const proposals = (invPropRes as any)?.data?.proposal;
            const firstProposalId = Array.isArray(proposals) && proposals.length > 0 ? proposals[0]?.id : (proposals?.id ?? undefined);
            if (firstProposalId) quoteId = String(firstProposalId);
        } catch {}
    }
    if (quoteId) {
        try {
            const propRes = await getRequest<{ data: { deal?: string | number } }>(`/items/os_proposals/${encodeURIComponent(String(quoteId))}?fields=deal`);
            const d = (propRes as any)?.data?.deal;
            if (d) dealIdResolved = String(d);
        } catch {}
    }
    if (dealIdResolved) {
        try {
            const dealRes = await getRequest<{ data: { property?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(dealIdResolved))}?fields=property`);
            const p = (dealRes as any)?.data?.property;
            if (p) propertyId = String(p);
        } catch {}
    }

    const metadata: Record<string, unknown> = {
        source: "stripe-webhook",
        stripe_event_id: event.id,
        client_secret_present: Boolean(pi.client_secret),
    };

    // Attempt to find an existing os_payment to update
    let targetPaymentId: string | undefined = undefined;
    // 1) by stripe_payment_id idempotency
    try {
        const existing = await getRequest<{ data: Array<{ id: string }> }>(`/items/os_payments?filter[stripe_payment_id][_eq]=${encodeURIComponent(String(pi.id))}&limit=1`);
        if (Array.isArray(existing?.data) && existing.data.length > 0) {
            targetPaymentId = String(existing.data[0].id);
        }
    } catch {}
    // 2) do not query by public payment_id (permission restricted)
    // 3) latest by invoice
    if (!targetPaymentId && invoiceId) {
        try {
            const byInv = await getRequest<{ data: Array<{ id: string }> }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
            if (Array.isArray(byInv?.data) && byInv.data.length > 0) {
                targetPaymentId = String(byInv.data[0].id);
            }
        } catch {}
    }

    const isFailureStatus = (
        pi.status === "requires_payment_method" ||
        pi.status === "requires_confirmation" ||
        pi.status === "requires_action" ||
        pi.status === "processing" ||
        pi.status === "requires_capture"
    );

    let failureReason: string | undefined = undefined;
    if (isFailureStatus) {
        if (pi.status === "requires_payment_method") {
            const lpe = pi.last_payment_error;
            const declineCode = (lpe && (lpe as any).decline_code) ? String((lpe as any).decline_code) : undefined;
            const code = lpe?.code ? String(lpe.code) : undefined;
            failureReason = [declineCode, code].filter(Boolean).join(" | ") || undefined;
        } else if (pi.status === "requires_confirmation") {
            failureReason = FAILED_REASON_REQUIRES_CONFIRMATION;
        } else if (pi.status === "requires_action") {
            failureReason = FAILED_REASON_REQUIRES_ACTION;
        } else if (pi.status === "processing") {
            failureReason = FAILED_REASON_PROCESSING;
        } else if (pi.status === "requires_capture") {
            failureReason = FAILED_REASON_REQUIRES_CAPTURE;
        }
    }

    const updateBody: Record<string, unknown> = {
        status: pi.status === "succeeded" ? "success" : (isFailureStatus ? "failure" : "failed"),
        payment_date: paymentDateIso,
        amount: amountAud,
        amount_capturable: amountCapturableAud,
        stripe_payment_id: pi.id,
        transaction_id: chargeId,
        card_type: cardBrand,
        card_number: cardLast4,
        exp_month: expMonth,
        exp_year: expYear,
        contact: contactId,
        invoice: invoiceId || undefined,
        payment_method_type: methodType,
        receipt_url: receiptUrl,
        metadata,
    };
    const failureReasonFinal = isFailureStatus ? (failureReason ?? undefined) : (pi.status === "succeeded" ? "" : undefined);
    if (failureReasonFinal !== undefined) (updateBody as any).failure_reason = failureReasonFinal;

    if (targetPaymentId) {
        await patchRequest(`/items/os_payments/${encodeURIComponent(String(targetPaymentId))}`, updateBody);
    } else if (!isFailureStatus) {
        // Only create a new payment record for non-failure statuses
        const created = await postRequest<{ data: any }>(`/items/os_payments`, updateBody);
        targetPaymentId = String((created as any)?.data?.id || "");
    }

    // Update deal stage depending on outcome
    try {
        if (dealIdResolved) {
            if (isFailureStatus && DEAL_STAGE_PAYMENT_FAILURE_ID) {
                await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealIdResolved))}`, {
                    deal_stage: DEAL_STAGE_PAYMENT_FAILURE_ID,
                });
            } else if (!isFailureStatus && pi.status === "succeeded" && DEAL_STAGE_PAYMENT_SUBMITTED_ID) {
                await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealIdResolved))}`, {
                    deal_stage: DEAL_STAGE_PAYMENT_SUBMITTED_ID,
                });
            }
        }
    } catch (err) {
        try { console.warn('[stripe-webhook] failed to update deal stage', err); } catch {}
    }
}

export async function POST(req: NextRequest) {
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });

    const sig = req.headers.get("stripe-signature");
    if (!sig) {
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        const rawBody = await getRawBody(req);
        event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return NextResponse.json({ error: (err as Error).message }, { status: 400 });
    }

    try {
        try { console.log("[stripe-webhook] received", { ts: Date.now() }); } catch {}
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            try { console.log("[stripe-webhook] checkout.session.completed", { session_id: session.id, payment_intent: session.payment_intent, amount_total: session.amount_total }); } catch {}
            const invoiceId = (session.metadata && session.metadata["invoice_id"]) || "";

            // Determine the amount paid (prefer amount_total from session; fallback to PaymentIntent.amount_received)
            let amountPaidAud: number | undefined = undefined;
            if (typeof session.amount_total === "number") {
                amountPaidAud = Number(session.amount_total) / 100;
            }

            // Always retrieve PaymentIntent if present to extract method/receipt and create/update os_payment
            if (typeof session.payment_intent === "string") {
                const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
                try { console.log("[stripe-webhook] session->PI", { id: pi.id, status: pi.status, amount_received: pi.amount_received }); } catch {}
                if (!Number.isFinite(amountPaidAud as number)) {
                    if (typeof pi.amount_received === "number") {
                        amountPaidAud = Number(pi.amount_received) / 100;
                    } else if (typeof pi.amount === "number") {
                        amountPaidAud = Number(pi.amount) / 100;
                    }
                }
                await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
                // Only mark invoice paid if PI succeeded
                if (invoiceId && (pi.status === "succeeded" || (typeof pi.amount_received === "number" && pi.amount_received > 0))) {
                    try { console.log("[invoice][webhook] Marking invoice paid from checkout.session.completed", { invoiceId, amountPaidAud }); } catch {}
                    const payload: Record<string, unknown> = { status: "paid" };
                    if (Number.isFinite(amountPaidAud as number)) {
                        payload["amount_paid"] = amountPaidAud;
                    }
                    try { console.log("[stripe-webhook] patch invoice to paid", { invoiceId, payload }); } catch {}
                    await patchRequest(`/items/os_invoices/${encodeURIComponent(invoiceId)}`, payload);
                    try {
                        await closeDealFromInvoice(String(invoiceId));
                    } catch {}
                }
            }
        }

        if (event.type === "payment_intent.succeeded") {
            const pi = event.data.object as Stripe.PaymentIntent;
            try { console.log("[stripe-webhook] payment_intent.succeeded", { id: pi.id, status: pi.status, amount_received: pi.amount_received }); } catch {}
            const invoiceId = (pi.metadata && (pi.metadata as any)["invoice_id"]) || "";
            const amountPaidAud = typeof pi.amount_received === "number" ? Number(pi.amount_received) / 100 : (typeof pi.amount === "number" ? Number(pi.amount) / 100 : undefined);
            // Create os_payment from PI (idempotent check inside)
            await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
            if (invoiceId) {
                try { console.log("[invoice][webhook] Marking invoice paid from payment_intent.succeeded", { invoiceId, amountPaidAud }); } catch {}
                const payload: Record<string, unknown> = { status: "paid" };
                if (Number.isFinite(amountPaidAud as number)) {
                    payload["amount_paid"] = amountPaidAud;
                }
                try { console.log("[stripe-webhook] patch invoice to paid", { invoiceId, payload }); } catch {}
                await patchRequest(`/items/os_invoices/${encodeURIComponent(invoiceId)}`, payload);
                try {
                    await closeDealFromInvoice(String(invoiceId));
                } catch {}
            }
        }

        if (event.type === "checkout.session.async_payment_succeeded") {
            const session = event.data.object as Stripe.Checkout.Session;
            if (typeof session.payment_intent === "string") {
                const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
                try { console.log("[stripe-webhook] async_payment_succeeded -> PI", { id: pi.id, status: pi.status }); } catch {}
                await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
            }
        }

        if (event.type === "charge.succeeded") {
            const charge = event.data.object as Stripe.Charge;
            try { console.log("[stripe-webhook] charge.succeeded", { id: charge.id, pi: charge.payment_intent }); } catch {}
            const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : undefined;
            if (piId) {
                const pi = await stripe.paymentIntents.retrieve(piId);
                await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
            }
        }

        return NextResponse.json({ received: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}


