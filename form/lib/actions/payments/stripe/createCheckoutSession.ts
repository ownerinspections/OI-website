"use server";

import Stripe from "stripe";
import { APP_BASE_URL, STRIPE_SECRET_KEY } from "@/lib/env";

type CreateCheckoutSessionInput = {
    invoiceId: string;
    amount: number;
    customerEmail?: string | null;
    currency?: string;
    description?: string;
};

export async function createCheckoutSession(input: CreateCheckoutSessionInput) {
    if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
    const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });

    const amountInCents = Math.round(input.amount * 100);

    // Derive base URL for redirects
    const baseUrl = APP_BASE_URL || (process?.env?.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:8030");

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
        },
        success_url: `${baseUrl}/steps/07-receipt?invoiceId=${encodeURIComponent(input.invoiceId)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/steps/05-invoice?invoiceId=${encodeURIComponent(input.invoiceId)}&status=cancel`,
    });

    return session;
}


