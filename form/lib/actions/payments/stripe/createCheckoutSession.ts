"use server";

import Stripe from "stripe";
import { APP_BASE_URL, STRIPE_SECRET_KEY } from "@/lib/env";
import { getRequest } from "@/lib/http/fetcher";

type CreateCheckoutSessionInput = {
    invoiceId: string;
    amount: number;
    customerEmail?: string | null;
    currency?: string;
    description?: string;
    dealId?: string;
    contactId?: string;
    propertyId?: string;
    quoteId?: string;
};

export async function createCheckoutSession(input: CreateCheckoutSessionInput) {
    if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });

    const amountInCents = Math.round(input.amount * 100);

    // Derive base URL for redirects
    const baseUrl = APP_BASE_URL || (process?.env?.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:8030");

    // Compute a stable public payment id similar to Step 06
    let paymentIdLocal: string | undefined = undefined;
    try {
        const inv = await getRequest<{ data: { id: string | number; invoice_id?: string | number } }>(`/items/os_invoices/${encodeURIComponent(String(input.invoiceId))}?fields=id,invoice_id`);
        const invData = (inv as any)?.data || {};
        const invPublicId = String(invData?.invoice_id || "").trim();
        if (invPublicId) paymentIdLocal = invPublicId;
        else {
            const baseNum = Number(invData?.id);
            paymentIdLocal = Number.isFinite(baseNum) ? String(100000 + baseNum) : undefined;
        }
    } catch {}

    const successParams = new URLSearchParams();
    // Standard order: contactId > dealId > propertyId > quoteId > invoiceId
    if (input.contactId) successParams.set("contactId", String(input.contactId));
    if (input.dealId) successParams.set("dealId", String(input.dealId));
    if (input.propertyId) successParams.set("propertyId", String(input.propertyId));
    if (input.quoteId) successParams.set("quoteId", String(input.quoteId));
    successParams.set("invoiceId", String(input.invoiceId));
    if (paymentIdLocal) successParams.set("paymentId", String(paymentIdLocal));

    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
            {
                quantity: 1,
                price_data: {
                    currency: input.currency ?? "aud",
                    product_data: {
                        name: input.description || `Invoice ${input.invoiceId}`,
                    },
                    unit_amount: amountInCents,
                },
            },
        ],
        customer_email: input.customerEmail || undefined,
        metadata: {
            invoice_id: input.invoiceId,
            ...(paymentIdLocal ? { payment_id: paymentIdLocal } : {}),
        },
        success_url: `${baseUrl}/steps/07-receipt?${successParams.toString()}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/steps/05-invoice?invoiceId=${encodeURIComponent(input.invoiceId)}&status=cancel`,
    });

    return session;
}


