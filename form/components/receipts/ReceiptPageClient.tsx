"use client";

import { useEffect, useActionState } from "react";
import { createBookingFromReceipt } from "@/lib/actions/bookings/createBookingFromReceipt";
import { BookingFormSkeleton } from "@/components/ui/SkeletonLoader";
import NextButton from "@/components/ui/controls/NextButton";
import type { CreateBookingFromReceiptResult } from "@/lib/actions/bookings/createBookingFromReceipt";

type Props = {
    invoiceId: string;
    propertyId?: string;
    userId?: string;
    contactId?: string;
    dealId?: string;
    quoteId?: string;
    serviceType?: string;
    children: React.ReactNode;
};

export default function ReceiptPageClient({
    invoiceId,
    propertyId,
    userId,
    contactId,
    dealId,
    quoteId,
    serviceType,
    children
}: Props) {
    // Form state for booking creation
    const initialState: CreateBookingFromReceiptResult = {};
    const [state, formAction] = useActionState<CreateBookingFromReceiptResult, FormData>(createBookingFromReceipt, initialState);

    // Handle form submission and navigation
    useEffect(() => {
        if (state?.debug) {
            try {
                console.group("[ReceiptPageClient] createBookingFromReceipt debug");
                for (const entry of state.debug as any[]) {
                    console.log(entry?.tag || "entry", entry);
                }
                console.groupEnd();
            } catch (_e) {
                console.warn("[ReceiptPageClient] failed to log debug", _e);
            }
        }
    }, [state?.debug]);

    useEffect(() => {
        if (state?.success && state?.nextUrl) {
            // Use window.location.assign for immediate navigation
            window.location.assign(state.nextUrl);
        }
    }, [state?.success, state?.nextUrl]);

    // Show skeleton loading while booking is being created (until redirect to step 8)
    if (state?.success) {
        return (
            <div style={{ 
                position: "fixed", 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                background: "var(--color-pale-gray)", 
                zIndex: 9999,
                overflow: "auto"
            }}>
                <div className="container">
                    <div className="card">
                        <BookingFormSkeleton />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {children}
            <form action={formAction}>
                <input type="hidden" name="invoiceId" value={invoiceId} />
                {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
                {userId && <input type="hidden" name="userId" value={userId} />}
                {contactId && <input type="hidden" name="contactId" value={contactId} />}
                {dealId && <input type="hidden" name="dealId" value={dealId} />}
                {quoteId && <input type="hidden" name="quoteId" value={quoteId} />}
                {serviceType && <input type="hidden" name="serviceType" value={serviceType} />}
                
                <div className="button-container" style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <NextButton label="Book Now" />
                </div>
            </form>
        </>
    );
}
