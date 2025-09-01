"use server";

import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "@/lib/env";

type CreatePaymentIntentInput = {
	amount: number;
	currency?: string;
	metadata?: Record<string, string>;
};

export async function createPaymentIntent(input: CreatePaymentIntentInput) {
	if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
	const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });
	const amountInCents = Math.round(input.amount * 100);
	return stripe.paymentIntents.create({
		amount: amountInCents,
		currency: input.currency ?? "aud",
		metadata: input.metadata,
		automatic_payment_methods: { enabled: true },
	});
}
