"use server";

import { getRequest, postRequest } from "@/lib/http/fetcher";
import { INVOICE_DUE_DAYS, APP_BASE_URL, INVOICE_STATUS } from "@/lib/env";
import { updateInvoice } from "@/lib/actions/invoices/updateInvoice";

type DirectusItemResponse<T> = { data: T };

export type InvoiceCreateInput = {
	contact: string;
	proposal: string;
	subtotal: number;
	total_tax: number;
	total: number;
	due_date?: string;
	issue_date?: string;
	invoice_id?: string;
	status?: string;
	line_items?: Array<{
		name: string;
		description?: string | null;
		quantity: number;
		unit_price: number;
		total: number;
	}>;
};

export type InvoiceRecord = InvoiceCreateInput & { id: string };

export type CompanyInfo = {
	title: string;
	street_address: string;
	address_locality: string;
	address_region: string;
	postal_code: string;
	address_country: string;
	phone: string;
	email: string;
	url: string;
};

export type CustomerInfo = {
	id: string;
	first_name?: string;
	last_name?: string;
	company_name?: string;
	email?: string;
	phone?: string;
	address?: string;
};

export type PropertyInfo = {
	id: string;
	street_address?: string;
	suburb?: string;
	state?: string;
	post_code?: string;
	property_type?: string;
	number_of_bedrooms?: number;
	number_of_bathrooms?: number;
	number_of_levels?: number;
	basement?: boolean;
	property_category?: string;
	termite_risk?: string;
	termite_risk_reason?: string;
};

function generateInvoiceNumber(): string {
	const random = Math.floor(100000 + Math.random() * 900000);
	return String(random);
}

export async function fetchGstRate(): Promise<number> {
	try {
		const res = await getRequest<{ data: Array<{ rate: string | number }> }>("/items/os_tax_rates?sort=-date_updated&limit=1");
		const rateStr = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0].rate : 10;
		const rate = Number(rateStr);
		return Number.isFinite(rate) ? rate : 10;
	} catch {
		return 10;
	}
}

export async function fetchCompanyInfo(): Promise<CompanyInfo | null> {
	try {
		const res = await getRequest<{ data: CompanyInfo }>("/items/globals");
		return (res as any)?.data ?? null;
	} catch {
		return null;
	}
}

export async function fetchCustomerInfo(contactId: string): Promise<CustomerInfo | null> {
	try {
		const res = await getRequest<{ data: CustomerInfo }>(`/items/contacts/${encodeURIComponent(contactId)}`);
		const customer = (res as any)?.data;
		if (!customer) return null;
		
		// Ensure we have at least a name or company name
		const hasName = customer.first_name || customer.last_name || customer.company_name;
		if (!hasName) return null;
		
		return customer;
	} catch (error) {
		console.error('Error fetching customer info from contacts:', error);
		return null;
	}
}

export async function fetchPropertyInfo(propertyId: string): Promise<PropertyInfo | null> {
	try {
		const res = await getRequest<{ data: PropertyInfo }>(`/items/property/${encodeURIComponent(propertyId)}`);
		const property = (res as any)?.data;
		if (!property) return null;
		
		return property;
	} catch (error) {
		console.error('Error fetching property info:', error);
		return null;
	}
}

export async function fetchMultiplePropertiesInfo(propertyIds: string): Promise<PropertyInfo[]> {
	try {
		// Handle comma-separated property IDs
		const ids = propertyIds.split(',').map(id => id.trim()).filter(Boolean);
		if (ids.length === 0) return [];
		
		// If only one ID, use the existing function
		if (ids.length === 1) {
			const property = await fetchPropertyInfo(ids[0]);
			return property ? [property] : [];
		}
		
		// For multiple IDs, fetch them all in parallel
		const promises = ids.map(id => fetchPropertyInfo(id));
		const results = await Promise.allSettled(promises);
		
		return results
			.filter((result): result is PromiseFulfilledResult<PropertyInfo | null> => 
				result.status === 'fulfilled' && result.value !== null
			)
			.map(result => result.value as PropertyInfo);
	} catch (error) {
		console.error('Error fetching multiple properties info:', error);
		return [];
	}
}

export async function createInvoice(input: {
	contactId: string;
	proposalId: string;
	amountExcludingGst: number;
	userId?: string;
	lineItems?: InvoiceCreateInput["line_items"];
}): Promise<InvoiceRecord> {
	const now = new Date();
	const issueDate = now.toISOString();
	const due = new Date(now.getTime() + Math.max(1, INVOICE_DUE_DAYS || 7) * 24 * 60 * 60 * 1000).toISOString();
	const gstRatePct = await fetchGstRate();
	// Normalize incoming amount: handle values provided in cents as integers
	const rawSubtotal = Math.max(0, Number(input.amountExcludingGst || 0));
	const looksLikeCents = Number.isFinite(rawSubtotal) && Number.isInteger(rawSubtotal) && rawSubtotal >= 1000;
	const subtotal = looksLikeCents ? +(rawSubtotal / 100).toFixed(2) : +rawSubtotal.toFixed(2);
	const totalTax = +(subtotal * (gstRatePct / 100)).toFixed(2);
	const total = +(subtotal + totalTax).toFixed(2);

	// Attempt to reuse the proposal's quote_id as invoice_id; if unavailable, derive from invoice numeric id after create
	let invoiceNumber: string | undefined = undefined;
	let dealId: string | undefined = undefined;
	try {
		const propRes = await getRequest<{ data: { quote_id?: string; deal?: string | number } }>(`/items/os_proposals/${encodeURIComponent(String(input.proposalId))}?fields=quote_id,deal`);
		const qid = (propRes as any)?.data?.quote_id;
		if (qid && String(qid).trim()) invoiceNumber = String(qid).trim();
		const d = (propRes as any)?.data?.deal;
		if (d) dealId = String(d);
	} catch {}

	const payload = {
		contact: input.contactId,
		proposal: [input.proposalId], // Directus expects an array for many-to-many relationships
		subtotal,
		total_tax: totalTax,
		total,
		issue_date: issueDate,
		due_date: due,
		invoice_id: invoiceNumber || undefined,
		status: INVOICE_STATUS,
		organization: null,
		line_items: [],
		amount_paid: 0,
		amount_due: total,
		...(input.userId ? { user: String(input.userId) } : {}),
	};

	try {
		const res = await postRequest<DirectusItemResponse<InvoiceRecord>>("/items/os_invoices", payload);
		const created = (res as any).data as InvoiceRecord;

		// If invoice_id was not provided via quote_id, derive deterministically from created invoice's numeric id
		try {
			if (!created.invoice_id && created.id) {
				const baseId = Number(created.id);
				const seq = Number.isFinite(baseId) ? String(100000 + baseId) : generateInvoiceNumber();
				await updateInvoice(String(created.id), { invoice_id: seq });
				(created as any).invoice_id = seq;
			}
		} catch {}

		// Build an absolute invoice link and patch the created invoice with it without removing other fields
		try {
			const rawBase = (APP_BASE_URL || "").trim() || "http://localhost:8030";
			// If APP_BASE_URL mistakenly points to Directus admin (e.g., http://localhost:8055/admin), strip the /admin suffix
			const base = rawBase.replace(/\/admin(?:\/.*)?$/i, "");
			const baseNoSlash = base.replace(/\/$/, "");
			// Resolve propertyId from deal if available
			let propertyId: string | undefined = undefined;
			try {
				if (dealId) {
					const dealRes = await getRequest<{ data: { properties?: Array<string | number> } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=properties`);
					const propsArr = (dealRes as any)?.data?.properties;
					const p = Array.isArray(propsArr) && propsArr.length > 0 ? propsArr[0] : undefined;
					if (p !== undefined && p !== null) propertyId = String(p);
				}
			} catch {}
			const queryParts: string[] = [];
			// Match the Step 05 canonical order: userId, contactId, dealId, propertyId, quoteId, invoiceId
			if (input.userId) queryParts.push(`userId=${encodeURIComponent(String(input.userId))}`);
			if (input.contactId) queryParts.push(`contactId=${encodeURIComponent(String(input.contactId))}`);
			if (dealId) queryParts.push(`dealId=${encodeURIComponent(String(dealId))}`);
			if (propertyId) queryParts.push(`propertyId=${encodeURIComponent(String(propertyId))}`);
			if (input.proposalId) queryParts.push(`quoteId=${encodeURIComponent(String(input.proposalId))}`);
			queryParts.push(`invoiceId=${encodeURIComponent(String(created.id))}`);
			const invoiceLink = `${baseNoSlash}/steps/05-invoice?${queryParts.join("&")}`;

			await updateInvoice(String(created.id), { invoice_link: invoiceLink });
		} catch (linkErr) {
			console.error("Failed to set invoice_link on invoice", linkErr);
		}

		return created;
	} catch (error) {
		console.error('Invoice creation failed with payload:', JSON.stringify(payload, null, 2));
		if (error instanceof Error) {
			console.error('Error details:', error.message);
		}
		throw error;
	}
}
