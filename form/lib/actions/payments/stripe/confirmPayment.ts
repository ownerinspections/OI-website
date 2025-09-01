"use server";

import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "@/lib/env";

export async function confirmPayment(paymentIntentId: string) {
	if (!STRIPE_SECRET_KEY) throw new Error("Missing STRIPE_SECRET_KEY");
	if (!paymentIntentId) throw new Error("Missing paymentIntentId");
	const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });
	return stripe.paymentIntents.retrieve(paymentIntentId);
}
