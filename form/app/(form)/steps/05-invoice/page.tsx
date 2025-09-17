import { redirect } from "next/navigation";
import { getRequest } from "@/lib/http/fetcher";
import { getServiceType } from "@/lib/config/service-routing";

export default async function InvoiceStep({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;

	if (!dealId || !contactId || !propertyId || !userId) {
		redirect('/not-found');
	}

	// Get the deal to determine service type
	let serviceId: number | null = null;
	try {
		const dealRes = await getRequest<{ data: { service?: number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service`);
		serviceId = (dealRes as any)?.data?.service || null;
	} catch (error) {
		console.error('Failed to fetch deal service:', error);
		redirect('/not-found');
	}

	if (!serviceId) {
		redirect('/not-found');
	}

	// Get the service type route
	const serviceRoute = getServiceType(serviceId);
	
	// Build the URL parameters for the service-specific invoice page
	const invoiceParams = new URLSearchParams();
	if (userId) invoiceParams.set("userId", String(userId));
	if (contactId) invoiceParams.set("contactId", String(contactId));
	if (dealId) invoiceParams.set("dealId", String(dealId));
	if (propertyId) invoiceParams.set("propertyId", String(propertyId));
	if (quoteId) invoiceParams.set("quoteId", String(quoteId));
	if (invoiceId) invoiceParams.set("invoiceId", String(invoiceId));
	if (paymentId) invoiceParams.set("paymentId", String(paymentId));

	// Redirect to the service-specific invoice page
	const targetUrl = `/steps/05-invoice/${serviceRoute}?${invoiceParams.toString()}`;
	redirect(targetUrl);
}
