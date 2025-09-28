import { getRequest } from "@/lib/http/fetcher";
import { getThankYouNote } from "@/lib/actions/globals/getGlobal";
import { fetchCompanyInfo } from "@/lib/actions/invoices/createInvoice";
import ThankYouPageClient from "@/components/thank-you/ThankYouPageClient";

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

    const [thankYouNote, company] = await Promise.all([
        getThankYouNote(),
        fetchCompanyInfo()
    ]);

    return (
        <ThankYouPageClient
            bookingId={bookingId}
            userId={userId}
            contactId={contactId}
            dealId={dealId}
            propertyId={propertyId}
            quoteId={quoteId}
            invoiceId={invoiceId}
            bookingHumanId={bookingHumanId}
            bookingStatus={bookingStatus}
            thankYouNote={thankYouNote}
            company={company}
        />
    );
}


