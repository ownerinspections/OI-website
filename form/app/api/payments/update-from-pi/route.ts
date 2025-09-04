import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { 
    STRIPE_SECRET_KEY,
    DEAL_STAGE_PAYMENT_FAILURE_ID,
    FAILED_REASON_REQUIRES_CONFIRMATION,
    FAILED_REASON_REQUIRES_ACTION,
    FAILED_REASON_PROCESSING,
    FAILED_REASON_REQUIRES_CAPTURE,
} from "@/lib/env";
import { getRequest, patchRequest } from "@/lib/http/fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    if (!STRIPE_SECRET_KEY) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    try {
        const body = await req.json();
        const invoiceId: string | undefined = body?.invoiceId ? String(body.invoiceId) : undefined;
        let paymentIntentId: string | undefined = body?.payment_intent_id ? String(body.payment_intent_id) : undefined;
        const errorCode: string | undefined = body?.error_code ? String(body.error_code) : undefined;
        const errorDeclineCode: string | undefined = body?.error_decline_code ? String(body.error_decline_code) : undefined;
        const errorMessage: string | undefined = body?.error_message ? String(body.error_message) : undefined;
        const directusPaymentId: string | undefined = body?.paymentId ? String(body.paymentId) : undefined;
        const clientSecret: string | undefined = body?.client_secret ? String(body.client_secret) : undefined;

        try { console.log("[payments.update-from-pi] incoming", { invoiceId, directusPaymentId, hasClientSecret: Boolean(clientSecret), hasPaymentIntentId: Boolean(paymentIntentId), errorCode, errorDeclineCode }); } catch {}

        if (!paymentIntentId && clientSecret && clientSecret.startsWith("pi_")) {
            const idx = clientSecret.indexOf("_secret");
            if (idx > 0) paymentIntentId = clientSecret.substring(0, idx);
        }

        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });
        let pi: Stripe.PaymentIntent | null = null;
        if (paymentIntentId) {
            try {
                pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            } catch (e) {
                try { console.warn("[payments.update-from-pi] failed to retrieve PI", { paymentIntentId, error: (e as Error)?.message }); } catch {}
            }
        }

        try { console.log("[payments.update-from-pi] stripe PI", { id: pi?.id, status: pi?.status }); } catch {}

        // Map failure statuses
        const isFailureStatus = pi ? (
            pi.status === "requires_payment_method" ||
            pi.status === "requires_confirmation" ||
            pi.status === "requires_action" ||
            pi.status === "processing" ||
            pi.status === "requires_capture"
        ) : Boolean(errorCode || errorDeclineCode || errorMessage);

        let failureReason: string | undefined = undefined;
        if (isFailureStatus && pi) {
            if (pi.status === "requires_payment_method") {
                const lpe = pi.last_payment_error as any;
                const declineCode = lpe?.decline_code ? String(lpe.decline_code) : undefined;
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
        if (!failureReason && (errorCode || errorDeclineCode)) {
            failureReason = [errorDeclineCode, errorCode].filter(Boolean).join(" | ") || errorMessage;
        }

        try { console.log("[payments.update-from-pi] mapping", { isFailureStatus, failureReason }); } catch {}

        // Try to extract charge info for receipt and card details
        let receiptUrl: string | undefined = undefined;
        let paymentDateIso: string = new Date().toISOString();
        let chargeId: string | undefined = undefined;
        let cardBrand: string | undefined = undefined;
        let cardLast4: string | undefined = undefined;
        let expMonth: number | undefined = undefined;
        let expYear: number | undefined = undefined;
        if (pi) {
            paymentDateIso = new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
            try {
                const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
                const charge = charges.data?.[0];
                if (charge) {
                    receiptUrl = charge.receipt_url ?? undefined;
                    if (charge.created) paymentDateIso = new Date(charge.created * 1000).toISOString();
                    chargeId = charge.id;
                    const card = charge.payment_method_details?.card;
                    if (card) {
                        cardBrand = card.brand || undefined;
                        cardLast4 = card.last4 || undefined;
                        expMonth = card.exp_month || undefined;
                        expYear = card.exp_year || undefined;
                    }
                }
            } catch {}
        }

        // Resolve existing os_payment to update (no creation)
        let targetPaymentId: string | undefined = undefined;
        if (directusPaymentId) {
            targetPaymentId = directusPaymentId;
        }
        if (!targetPaymentId) {
            try {
                const byPi = pi ? await getRequest<{ data: Array<{ id: string }> }>(`/items/os_payments?filter[stripe_payment_id][_eq]=${encodeURIComponent(String(pi.id))}&limit=1`) : { data: [] };
                if (Array.isArray((byPi as any)?.data) && (byPi as any).data.length > 0) {
                    targetPaymentId = String((byPi as any).data[0].id);
                }
            } catch {}
        }
        if (!targetPaymentId && invoiceId) {
            try {
                const byInv = await getRequest<{ data: Array<{ id: string }> }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
                if (Array.isArray((byInv as any)?.data) && (byInv as any).data.length > 0) {
                    targetPaymentId = String((byInv as any).data[0].id);
                }
            } catch {}
        }

        try { console.log("[payments.update-from-pi] resolved target payment", { targetPaymentId }); } catch {}

        if (!targetPaymentId) {
            // Nothing to update
            return NextResponse.json({ updated: false, reason: "no_payment_record" });
        }

        const amountNum = pi ? (typeof pi.amount_received === "number" ? pi.amount_received : (typeof pi.amount === "number" ? pi.amount : 0)) / 100 : 0;
        const amountCapturable = pi && typeof pi.amount_capturable === "number" ? (pi.amount_capturable / 100) : undefined;
        const methodType = pi && (pi.payment_method_types && pi.payment_method_types[0]) || undefined;

        const updateBody: Record<string, unknown> = {
            status: isFailureStatus ? "failure" : (pi && pi.status === "succeeded" ? "success" : "failed"),
            failure_reason: failureReason,
            payment_date: paymentDateIso,
            amount: isFailureStatus ? amountNum : amountNum,
            amount_capturable: amountCapturable,
            stripe_payment_id: pi ? pi.id : undefined,
            transaction_id: chargeId,
            card_type: cardBrand,
            card_number: cardLast4,
            exp_month: expMonth,
            exp_year: expYear,
            payment_method_type: methodType,
            receipt_url: receiptUrl,
        };

        try { console.log("[payments.update-from-pi] patching payment", { targetPaymentId, status: updateBody.status, failure_reason: updateBody.failure_reason, stripe_payment_id: updateBody.stripe_payment_id, amount: updateBody.amount }); } catch {}
        await patchRequest(`/items/os_payments/${encodeURIComponent(String(targetPaymentId))}`, updateBody);
        try { console.log("[payments.update-from-pi] patched successfully", { targetPaymentId }); } catch {}

        // Update deal stage to failure if we can resolve deal from invoice
        if (DEAL_STAGE_PAYMENT_FAILURE_ID && invoiceId) {
            try {
                // Resolve deal via invoice -> proposal -> deal
                let quoteId: string | undefined = undefined;
                let dealIdResolved: string | undefined = undefined;
                try {
                    const invPropRes = await getRequest<{ data: { proposal?: any } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=proposal.id`);
                    const proposals = (invPropRes as any)?.data?.proposal;
                    const firstProposalId = Array.isArray(proposals) && proposals.length > 0 ? proposals[0]?.id : (proposals?.id ?? undefined);
                    if (firstProposalId) quoteId = String(firstProposalId);
                } catch {}
                if (quoteId) {
                    try {
                        const propRes = await getRequest<{ data: { deal?: string | number } }>(`/items/os_proposals/${encodeURIComponent(String(quoteId))}?fields=deal`);
                        const d = (propRes as any)?.data?.deal;
                        if (d) dealIdResolved = String(d);
                    } catch {}
                }
                if (dealIdResolved) {
                    try { console.log("[payments.update-from-pi] updating deal stage to FAILURE", { dealId: dealIdResolved }); } catch {}
                    await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealIdResolved))}`, { deal_stage: DEAL_STAGE_PAYMENT_FAILURE_ID });
                }
            } catch {}
        }

        return NextResponse.json({ updated: true });
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 });
    }
}


