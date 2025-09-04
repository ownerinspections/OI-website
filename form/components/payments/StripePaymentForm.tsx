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
    paymentId?: string;
};

function InlineForm({ receiptHref, returnUrl, clientSecret, prevHref, invoiceId, paymentId }: { receiptHref: string; returnUrl?: string; clientSecret: string; prevHref?: string; invoiceId: string; paymentId?: string }) {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isReady, setIsReady] = useState(false);

    const postUpdate = async (payload: Record<string, unknown>) => {
        try {
            await fetch("/api/payments/update-from-pi", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ invoiceId, paymentId, ...payload }),
            });
        } catch {}
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);
        if (!stripe || !elements) return;
        setSubmitting(true);
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                confirmParams: returnUrl ? { return_url: returnUrl } : {},
                redirect: "if_required",
            });
            if (error) {
                setErrorMessage(error.message || "Payment failed. Please try again.");
                // On failure, prefer error.payment_intent for most recent attempt state; fallback to retrieve
                try {
                    const anyErr = error as any;
                    const piFromError = anyErr?.payment_intent as { id?: string; client_secret?: string } | undefined;
                    if (piFromError && piFromError.id) {
                        await postUpdate({ payment_intent_id: piFromError.id, client_secret: piFromError.client_secret || clientSecret });
                    } else {
                        // If PI not present, still update the payment with error details
                        await postUpdate({
                            error_code: anyErr?.code,
                            error_decline_code: anyErr?.decline_code,
                            error_message: error.message,
                        });
                    }
                } catch {}
                return;
            }
            // Retrieve PaymentIntent to include identifiers in redirect query for SSR receipt patching
            try {
                // Prefer the paymentIntent returned by confirmPayment if available; otherwise retrieve
                const pi = paymentIntent || (await stripe.retrievePaymentIntent(clientSecret)).paymentIntent;
                if (pi && (pi as any).id) {
                    // Also post an update to ensure any non-success state is stored before redirect
                    try { await postUpdate({ payment_intent_id: (pi as any).id, client_secret: clientSecret }); } catch {}
                    const url = new URL(receiptHref, window.location.origin);
                    url.searchParams.set("payment_intent", (pi as any).id);
                    if (typeof (pi as any).client_secret === "string") {
                        url.searchParams.set("payment_intent_client_secret", (pi as any).client_secret);
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

export default function StripePaymentForm({ clientSecret, invoiceId, receiptHref, publishableKey, returnUrl, prevHref, paymentId }: Props) {
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
            <InlineForm receiptHref={receiptHref} returnUrl={returnUrl} clientSecret={clientSecret} prevHref={prevHref} invoiceId={invoiceId} paymentId={paymentId} />
        </Elements>
    );
}
