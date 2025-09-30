"use client";

import { useEffect, useState } from "react";
import FormHeaderClient from "@/components/ui/FormHeaderClient";
import NoteBox from "@/components/ui/messages/NoteBox";
import ViewBookingButton from "@/components/ui/ViewBookingButton";
import ClosePageButton from "@/components/ui/ClosePageButton";
import { ThankYouSkeleton, BookingFormSkeleton } from "@/components/ui/SkeletonLoader";

type CompanyInfo = {
    phone?: string;
    email?: string;
    url?: string;
};

type Props = {
    bookingId?: string;
    userId?: string;
    contactId?: string;
    dealId?: string;
    propertyId?: string;
    quoteId?: string;
    invoiceId?: string;
    bookingHumanId?: string | number;
    bookingStatus?: string;
    thankYouNote?: string;
    company?: CompanyInfo | null;
};

export default function ThankYouPageClient({
    bookingId,
    userId,
    contactId,
    dealId,
    propertyId,
    quoteId,
    invoiceId,
    bookingHumanId,
    bookingStatus,
    thankYouNote,
    company
}: Props) {
    const [isLoading, setIsLoading] = useState(true);
    const [isNavigating, setIsNavigating] = useState(false);

    useEffect(() => {
        // Simulate loading time for skeleton effect
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 800); // 800ms skeleton loading

        return () => clearTimeout(timer);
    }, []);

    // Show skeleton loading while data is being processed
    if (isLoading) {
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
                        <ThankYouSkeleton />
                    </div>
                </div>
            </div>
        );
    }

    // Show booking form skeleton when navigating to booking page
    if (isNavigating) {
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

    const headerMeta = [
        { label: "Booking #", value: bookingHumanId || bookingId },
        { label: "Status", value: bookingStatus || "—" },
        { label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
    ];

    return (
        <div className="container">
            <div className="card">
                <FormHeaderClient rightTitle="Thank you" rightMeta={headerMeta as any} />
                {thankYouNote ? (
                    <NoteBox style={{ marginBottom: 16 }}>
                        {thankYouNote}
                    </NoteBox>
                ) : null}
                <div style={{ textAlign: "center" }}>
                    <h1 style={{ margin: 0, fontSize: 24, color: "var(--color-primary)" }}>Thank you for booking with us!</h1>
                    <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>
                        <strong>Your inspection booking has been successfully received. Our team will contact you shortly to confirm the inspection details and date/time.</strong>
                    </p>
                    <div style={{ marginTop: 16, color: "var(--color-dark-gray)", fontSize: 14 }}>
                        You may close this page now.
                    </div>
                    <div className="button-container" style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 16 }}>
                        <ClosePageButton />
                        <ViewBookingButton 
                            bookingId={bookingId}
                            userId={userId}
                            contactId={contactId}
                            dealId={dealId}
                            propertyId={propertyId}
                            quoteId={quoteId}
                            invoiceId={invoiceId}
                            onNavigate={() => setIsNavigating(true)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
