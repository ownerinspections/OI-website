import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_BASE_URL } from "@/lib/env";
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
    // Idempotency: skip if a payment already exists for this Stripe PI id
    try {
        const existing = await getRequest<{ data: Array<{ id: string }> }>(`/items/os_payments?filter[stripe_payment_id][_eq]=${encodeURIComponent(String(pi.id))}&limit=1`);
        if (Array.isArray(existing?.data) && existing.data.length > 0) {
            return; // already created
        }
    } catch {}

    // Try to extract charge for receipt URL and method
    let latestCharge: Stripe.Charge | null = null;
    try {
        const chargesList = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
        latestCharge = chargesList.data?.[0] ?? null;
    } catch {}

    const receiptUrl = latestCharge?.receipt_url ?? undefined;
    const methodType = latestCharge?.payment_method_details?.type ?? (pi.payment_method_types?.[0] ?? undefined);
    const paymentDateIso = new Date(((latestCharge?.created ?? pi.created) || Math.floor(Date.now() / 1000)) * 1000).toISOString();
    const amountStr = formatAud(pi.amount_received ?? pi.amount ?? null);

    // Determine invoice and contact
    const invoiceId = (pi.metadata && (pi.metadata as any)["invoice_id"]) || "";
    let contactId: string | undefined = undefined;
    if (invoiceId) {
        try {
            const invRes = await getRequest<{ data: { id: string; contact?: string } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}`);
            contactId = (invRes as any)?.data?.contact ?? undefined;
        } catch {}
    }

    const metadata: Record<string, unknown> = {
        source: "stripe-webhook",
        stripe_event_id: event.id,
        client_secret_present: Boolean(pi.client_secret),
    };

    // Build internal receipt link to our SSR receipt page
    const base = (APP_BASE_URL || "").trim() || "http://localhost:8030";
    const baseNoSlash = base.replace(/\/$/, "");
    const receiptLink = invoiceId
        ? `${baseNoSlash}/steps/07-receipt?invoiceId=${encodeURIComponent(String(invoiceId))}&payment_intent=${encodeURIComponent(String(pi.id))}`
        : `${baseNoSlash}/steps/07-receipt`;

    const body: Record<string, unknown> = {
        status: "paid",
        payment_date: paymentDateIso,
        amount: amountStr,
        stripe_payment_id: pi.id,
        contact: contactId,
        invoice: invoiceId || undefined,
        payment_method_type: methodType,
        receipt_url: receiptUrl,
        receipt_link: receiptLink,
        metadata,
    };

    // Include payment_id from Stripe metadata if provided; otherwise, derive after create
    if (typeof pi.metadata?.payment_id === "string" && pi.metadata.payment_id.trim()) {
        (body as any).payment_id = String(pi.metadata.payment_id).trim();
    }

    // Create os_payment
    const created = await postRequest<{ data: any }>(`/items/os_payments`, body);
    const createdPayment = (created as any)?.data;
    if (!(body as any).payment_id && createdPayment?.id) {
        const baseNum = Number(createdPayment.id);
        const derived = Number.isFinite(baseNum) ? String(100000 + baseNum) : undefined;
        if (derived) {
            try {
                await patchRequest(`/items/os_payments/${encodeURIComponent(String(createdPayment.id))}`, { payment_id: derived });
            } catch {}
        }
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
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            const invoiceId = (session.metadata && session.metadata["invoice_id"]) || "";

            // Determine the amount paid (prefer amount_total from session; fallback to PaymentIntent.amount_received)
            let amountPaidAud: number | undefined = undefined;
            if (typeof session.amount_total === "number") {
                amountPaidAud = Number(session.amount_total) / 100;
            }

            // Always retrieve PaymentIntent if present to extract method/receipt and create os_payment
            if (typeof session.payment_intent === "string") {
                const pi = await stripe.paymentIntents.retrieve(session.payment_intent);
                if (!Number.isFinite(amountPaidAud as number)) {
                    if (typeof pi.amount_received === "number") {
                        amountPaidAud = Number(pi.amount_received) / 100;
                    } else if (typeof pi.amount === "number") {
                        amountPaidAud = Number(pi.amount) / 100;
                    }
                }
                await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
            }

            if (invoiceId) {
                const payload: Record<string, unknown> = { status: "paid" };
                if (Number.isFinite(amountPaidAud as number)) {
                    payload["amount_paid"] = amountPaidAud;
                }
                await patchRequest(`/items/os_invoices/${encodeURIComponent(invoiceId)}`, payload);
                try {
                    await closeDealFromInvoice(String(invoiceId));
                } catch {}
            }
        }

        if (event.type === "payment_intent.succeeded") {
            const pi = event.data.object as Stripe.PaymentIntent;
            const invoiceId = (pi.metadata && (pi.metadata as any)["invoice_id"]) || "";
            const amountPaidAud = typeof pi.amount_received === "number" ? Number(pi.amount_received) / 100 : (typeof pi.amount === "number" ? Number(pi.amount) / 100 : undefined);
            // Create os_payment from PI (idempotent check inside)
            await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
            if (invoiceId) {
                const payload: Record<string, unknown> = { status: "paid" };
                if (Number.isFinite(amountPaidAud as number)) {
                    payload["amount_paid"] = amountPaidAud;
                }
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
                await ensureOsPaymentFromPaymentIntent(event, stripe, pi);
            }
        }

        if (event.type === "charge.succeeded") {
            const charge = event.data.object as Stripe.Charge;
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


