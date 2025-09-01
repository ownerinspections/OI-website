"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import PreviousButton from "@/components/ui/controls/PreviousButton";

type Props = {
    clientSecret: string;
    invoiceId: string;
    receiptHref: string;
    publishableKey: string;
    returnUrl?: string;
    prevHref?: string;
};

function InlineForm({ receiptHref, returnUrl, clientSecret, prevHref }: { receiptHref: string; returnUrl?: string; clientSecret: string; prevHref?: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        if (!stripe || !elements) return;
        setSubmitting(true);
        try {
            const { error } = await stripe.confirmPayment({
                elements,
                confirmParams: returnUrl ? { return_url: returnUrl } : {},
                redirect: "if_required",
            });
            if (error) {
                setErrorMessage(error.message || "Payment failed. Please try again.");
                return;
            }
            // Retrieve PaymentIntent to include identifiers in redirect query for SSR receipt patching
            try {
                const retrieved = await stripe.retrievePaymentIntent(clientSecret);
                const pi = retrieved.paymentIntent;
                if (pi && pi.id) {
                    const url = new URL(receiptHref, window.location.origin);
                    url.searchParams.set("payment_intent", pi.id);
                    if (typeof pi.client_secret === "string") {
                        url.searchParams.set("payment_intent_client_secret", pi.client_secret);
                    }
                    window.location.href = url.toString();
                    return;
                }
            } catch {}
            window.location.href = receiptHref;
        } finally {
            setSubmitting(false);
        }
    }, [stripe, elements, receiptHref, clientSecret, returnUrl]);

    return (
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
            <PaymentElement options={{ layout: "tabs" }} onReady={() => setIsReady(true)} />
            {errorMessage && (
                <div style={{ color: "var(--color-error)", fontSize: 14 }}>{errorMessage}</div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
                <PreviousButton href={prevHref} />
                <button type="submit" className="button-primary" disabled={!stripe || submitting || !isReady}>
                    {submitting ? "Processing..." : "Pay Now"}
                </button>
            </div>
        </form>
    );
}

export default function StripePaymentForm({ clientSecret, invoiceId, receiptHref, publishableKey, returnUrl, prevHref }: Props) {
    const stripePromise = useMemo(() => {
        const key = (publishableKey || "").trim();
        if (!key) return null;
        return loadStripe(key);
    }, [publishableKey]);

    if (!stripePromise) {
        return <div style={{ color: "var(--color-error)" }}>Stripe is not configured.</div>;
    }

    const options: StripeElementsOptions = useMemo(() => ({
        clientSecret,
        appearance: {
            theme: "flat",
            variables: {
                colorPrimary: "#0b487b",
                colorText: "#262626",
                colorTextSecondary: "#595959",
                colorDanger: "#ef4444",
                borderRadius: "6px",
            },
        },
        loader: "auto",
    }), [clientSecret]);

    return (
        <Elements stripe={stripePromise} options={options}>
            <InlineForm receiptHref={receiptHref} returnUrl={returnUrl} clientSecret={clientSecret} prevHref={prevHref} />
        </Elements>
    );
}
