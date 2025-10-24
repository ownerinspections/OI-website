import { redirect } from "next/navigation";
import { getRequest } from "@/lib/http/fetcher";
import { getRouteTypeFromServiceType } from "@/lib/config/service-routing";

export default async function BookingStep({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;
	const bookingId = typeof params.bookingId === "string" ? params.bookingId : undefined;
	const paymentIntent = typeof params.payment_intent === "string" ? params.payment_intent : undefined;
	const paymentIntentClientSecret = typeof params.payment_intent_client_secret === "string" ? params.payment_intent_client_secret : undefined;

	if (!dealId || !contactId || !propertyId || !userId) {
		redirect('/not-found');
	}

	// Get the deal to determine service type
	let serviceType: string | null = null;
	try {
		const dealRes = await getRequest<{ data: { service?: number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service`);
		const serviceId = (dealRes as any)?.data?.service || null;
		
		if (serviceId) {
			// Get service type from service record
			const serviceRes = await getRequest<{ data: { service_type?: string } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=service_type`);
			serviceType = (serviceRes as any)?.data?.service_type || null;
		}
	} catch (error) {
		console.error('Failed to fetch deal service:', error);
		redirect('/not-found');
	}

	if (!serviceType) {
		redirect('/not-found');
	}

	// Get the service type route (this will map to the old folder names for now)
	const serviceRoute = getRouteTypeFromServiceType(serviceType);
	
	// Map the new numbered format to old folder names (until we rename the folders)
	const oldFolderMapping: Record<string, string> = {
		"01-pre-purchase": "pre-purchase",
		"02-pre-sales": "pre-sales",
		"03-dilapidation": "dilapidation",
		"04-apartment-pre-settlement": "apartment-pre-settlement",
		"05-new-construction-stages": "new-construction-stages",
		"06-insurance-report": "insurance-report",
		"07-expert-witness-report": "expert-witness-report",
		"08-defects-investigation": "defects-investigation",
	};

	const bookingFolder = oldFolderMapping[serviceRoute] || serviceRoute;
	
	// Build the URL parameters for the service-specific booking page
	const bookingParams = new URLSearchParams();
	if (userId) bookingParams.set("userId", String(userId));
	if (contactId) bookingParams.set("contactId", String(contactId));
	if (dealId) bookingParams.set("dealId", String(dealId));
	if (propertyId) bookingParams.set("propertyId", String(propertyId));
	if (quoteId) bookingParams.set("quoteId", String(quoteId));
	if (invoiceId) bookingParams.set("invoiceId", String(invoiceId));
	if (paymentId) bookingParams.set("paymentId", String(paymentId));
	if (bookingId) bookingParams.set("bookingId", String(bookingId));
	if (paymentIntent) bookingParams.set("payment_intent", String(paymentIntent));
	if (paymentIntentClientSecret) bookingParams.set("payment_intent_client_secret", String(paymentIntentClientSecret));

	// Redirect to the service-specific booking page
	const targetUrl = `/steps/08-booking/${bookingFolder}?${bookingParams.toString()}`;
	redirect(targetUrl);
}
