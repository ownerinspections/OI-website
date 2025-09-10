import FormHeader from "@/components/ui/FormHeader";
import { getRequest } from "@/lib/http/fetcher";
import { getThankYouNote } from "@/lib/actions/globals/getGlobal";

export default async function StepThankYou({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const params = (await searchParams) ?? {};
    const bookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
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
                    <div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                        <div>{thankYouNote}</div>
                    </div>
                ) : null}
                <div style={{ textAlign: "center" }}>
                    <h1 style={{ margin: 0, fontSize: 24, color: "var(--color-primary)" }}>Your Inspection has been booked</h1>
                    <p style={{ color: "var(--color-text-secondary)", marginTop: 8 }}>
                        We've received your booking. Our team will contact you shortly to confirm the details and inspection date/time.
                    </p>
                    <div style={{ marginTop: 16, color: "var(--color-dark-gray)", fontSize: 14 }}>
                        A confirmation has been recorded. You may close this page now.
                    </div>
                </div>
            </div>
        </div>
    );
}


