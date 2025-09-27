import FormHeader from "@/components/ui/FormHeader";
import NoteBox from "@/components/ui/messages/NoteBox";
import { getRequest } from "@/lib/http/fetcher";
import { getThankYouNote } from "@/lib/actions/globals/getGlobal";
import ViewBookingButton from "@/components/ui/ViewBookingButton";
import ClosePageButton from "@/components/ui/ClosePageButton";

export default async function StepThankYou({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const params = (await searchParams) ?? {};
    const bookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
    const userId = typeof params.userId === "string" ? params.userId : undefined;
    const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
    const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
    const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
    const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
    const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
    let bookingHumanId: string | number | undefined = undefined;
    let bookingStatus: string | undefined = undefined;
    if (bookingId) {
        try {
            const res = await getRequest<{ data: { booking_id?: string | number; status?: string } }>(
                `/items/bookings/${encodeURIComponent(String(bookingId))}?fields=booking_id,status`
            );
            bookingHumanId = (res as any)?.data?.booking_id;
            bookingStatus = (res as any)?.data?.status;
        } catch {}
    }
    const headerMeta = [
        { label: "Booking #", value: bookingHumanId || bookingId },
        { label: "Status", value: bookingStatus || "—" },
        { label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
    ];

    const thankYouNote = await getThankYouNote();

    return (
        <div className="container">
            <div className="card">
                <FormHeader rightTitle="Thank you" rightMeta={headerMeta as any} />
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
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}


