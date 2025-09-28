"use server";

import { getRequest } from "@/lib/http/fetcher";
import { ensureBooking } from "./createBooking";

export type CreateBookingFromReceiptResult = {
	success?: boolean;
	errors?: Record<string, string>;
	message?: string;
	debug?: unknown[];
	bookingId?: string;
	nextUrl?: string;
};

export async function createBookingFromReceipt(
	prevState: CreateBookingFromReceiptResult,
	formData: FormData
): Promise<CreateBookingFromReceiptResult> {
	const debug: unknown[] = [];
	
	try {
		console.log("🚀 [CREATE BOOKING FROM RECEIPT] Starting booking creation");
		debug.push({ tag: "start", timestamp: new Date().toISOString() });
		
		const invoiceId = String(formData.get("invoiceId") ?? "");
		const propertyId = String(formData.get("propertyId") ?? "");
		const userId = String(formData.get("userId") ?? "");
		const contactId = String(formData.get("contactId") ?? "");
		const dealId = String(formData.get("dealId") ?? "");
		const quoteId = String(formData.get("quoteId") ?? "");
		const serviceType = String(formData.get("serviceType") ?? "");
		
		console.log("🚀 [CREATE BOOKING FROM RECEIPT] Form data:", {
			invoiceId,
			propertyId,
			userId,
			contactId,
			dealId,
			quoteId
		});
		debug.push({ 
			tag: "form_data", 
			invoiceId,
			propertyId,
			userId,
			contactId,
			dealId,
			quoteId
		});
		
		if (!invoiceId) {
			return {
				success: false,
				message: "Invoice ID is required",
				debug
			};
		}
		
		// Resolve propertyId: prefer URL param; fallback via deal -> property
		let propertyIdEffective: string | undefined = propertyId ? String(propertyId) : undefined;
		if (!propertyIdEffective && dealId) {
			try {
				const dealRes = await getRequest<{ data: { properties?: Array<string | number> } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=properties`);
				const propsArr = (dealRes as any)?.data?.properties;
				const p = Array.isArray(propsArr) && propsArr.length > 0 ? propsArr[0] : undefined;
				if (p !== undefined && p !== null) propertyIdEffective = String(p);
			} catch {}
		}
		if (!propertyIdEffective && invoiceId) {
			try {
				// Try infer from invoice -> proposal -> deal -> property chain if available
				const invRes = await getRequest<{ data: { proposal?: (string | number)[] } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=proposal`);
				const propArr = (invRes as any)?.data?.proposal;
				const firstProposalId = Array.isArray(propArr) && propArr.length > 0 ? String(propArr[0]) : undefined;
				if (firstProposalId) {
					const propRes = await getRequest<{ data: { deal?: string | number } }>(`/items/os_proposals/${encodeURIComponent(firstProposalId)}?fields=deal`);
					const d = (propRes as any)?.data?.deal;
					if (d) {
						const dealRes2 = await getRequest<{ data: { properties?: Array<string | number> } }>(`/items/os_deals/${encodeURIComponent(String(d))}?fields=properties`);
						const propsArr2 = (dealRes2 as any)?.data?.properties;
						const p2 = Array.isArray(propsArr2) && propsArr2.length > 0 ? propsArr2[0] : undefined;
						if (p2 !== undefined && p2 !== null) propertyIdEffective = String(p2);
					}
				}
			} catch {}
		}
		
		if (!propertyIdEffective) {
			return {
				success: false,
				message: "Property ID could not be resolved",
				debug
			};
		}
		
		console.log("🔧 [CREATE BOOKING FROM RECEIPT] Creating booking with resolved propertyId:", propertyIdEffective);
		debug.push({ tag: "resolved_property", propertyIdEffective });
		
		// Get invoice to resolve contact if needed
		let resolvedContactId = contactId;
		if (!resolvedContactId && invoiceId) {
			try {
				const invoiceRes = await getRequest<{ data: { contact?: string | number } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=contact`);
				const invoiceContact = (invoiceRes as any)?.data?.contact;
				if (invoiceContact) {
					resolvedContactId = String(invoiceContact);
				}
			} catch {}
		}
		
		const booking = await ensureBooking({
			invoiceId: String(invoiceId),
			propertyId: propertyIdEffective,
			userId: userId ? String(userId) : undefined,
			contactId: resolvedContactId ? String(resolvedContactId) : undefined,
			dealId: dealId ? String(dealId) : undefined,
			quoteId: quoteId ? String(quoteId) : undefined,
		});
		
		console.log("✅ [CREATE BOOKING FROM RECEIPT] Booking created successfully:", booking?.id);
		debug.push({ tag: "booking_created", bookingId: booking?.id });
		
		// Build next URL
		const sp = new URLSearchParams();
		if (userId) sp.set("userId", String(userId));
		if (resolvedContactId) sp.set("contactId", String(resolvedContactId));
		if (dealId) sp.set("dealId", String(dealId));
		if (propertyIdEffective) sp.set("propertyId", String(propertyIdEffective));
		if (quoteId) sp.set("quoteId", String(quoteId));
		if (invoiceId) sp.set("invoiceId", String(invoiceId));
		if (booking?.id) sp.set("bookingId", String(booking.id));
		
		// Determine service-specific booking URL
		let nextUrl = `/steps/08-booking?${sp.toString()}`;
		if (serviceType) {
			// Map service types to their specific booking pages
			const serviceTypeMap: Record<string, string> = {
				'defects_investigation': 'defects-investigation',
				'expert_witness_report': 'expert-witness-report',
				'insurance_report': 'insurance-report'
			};
			const serviceRoute = serviceTypeMap[serviceType];
			if (serviceRoute) {
				nextUrl = `/steps/08-booking/${serviceRoute}?${sp.toString()}`;
			}
		}
		
		console.log("🎯 [CREATE BOOKING FROM RECEIPT] Next URL:", nextUrl);
		debug.push({ tag: "next_url", nextUrl });
		
		return {
			success: true,
			bookingId: String(booking?.id),
			nextUrl,
			debug
		};
		
	} catch (error) {
		console.error("❌ [CREATE BOOKING FROM RECEIPT] Error:", error);
		debug.push({ tag: "error", error: String(error) });
		
		return {
			success: false,
			message: "Failed to create booking",
			debug
		};
	}
}
