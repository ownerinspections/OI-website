"use client";

import { useRouter } from "next/navigation";

interface ViewBookingButtonProps {
    bookingId?: string;
    userId?: string;
    contactId?: string;
    dealId?: string;
    propertyId?: string;
    quoteId?: string;
    invoiceId?: string;
}

export default function ViewBookingButton({ 
    bookingId, 
    userId, 
    contactId, 
    dealId, 
    propertyId, 
    quoteId, 
    invoiceId 
}: ViewBookingButtonProps) {
    const router = useRouter();

    const handleViewBooking = () => {
        const params = new URLSearchParams();
        if (bookingId) params.set("bookingId", bookingId);
        if (userId) params.set("userId", userId);
        if (contactId) params.set("contactId", contactId);
        if (dealId) params.set("dealId", dealId);
        if (propertyId) params.set("propertyId", propertyId);
        if (quoteId) params.set("quoteId", quoteId);
        if (invoiceId) params.set("invoiceId", invoiceId);
        
        router.push(`/steps/08-booking?${params.toString()}`);
    };

    return (
        <button 
            type="button" 
            className="button-primary" 
            onClick={handleViewBooking}
        >
            View Booking
        </button>
    );
}
