import { NextResponse } from "next/server";
import { patchRequest, getRequest } from "@/lib/http/fetcher";
import { DEAL_STAGE_INVOICE_SUBMITTED_ID } from "@/lib/env";
import { createInvoice, fetchGstRate } from "@/lib/actions/invoices/createInvoice";

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { quoteId, dealId, contactId, propertyId, totalAmount, invoiceId: providedInvoiceId, userId } = body;

		// Change deal stage to "Invoice Submitted" before any other actions
		try {
			if (dealId && DEAL_STAGE_INVOICE_SUBMITTED_ID) {
				await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealId))}`, {
					deal_stage: DEAL_STAGE_INVOICE_SUBMITTED_ID,
				});
			}
		} catch (err) {
			try { console.warn('[approve-and-create-invoice] failed to update deal stage to INVOICE_SUBMITTED', err); } catch {}
		}

		if (!quoteId) {
			return NextResponse.json({ error: "Missing quoteId" }, { status: 400 });
		}

		// Approve the proposal
		try {
			await patchRequest(`/items/os_proposals/${encodeURIComponent(String(quoteId))}`, { status: "approved" });
		} catch (error) {
			console.error('Failed to approve proposal:', error);
		}

		// If invoiceId provided from URL, prefer it
		let invoiceId: string | undefined = providedInvoiceId ? String(providedInvoiceId) : undefined;
		try {
			if (!invoiceId) {
				// Filter by related proposal id in Directus (many-to-many relation)
				const existing = await getRequest<{ data: any[] }>(`/items/os_invoices?filter[proposal][id][_eq]=${encodeURIComponent(String(quoteId))}&sort=-date_created&limit=1`);
				if (Array.isArray((existing as any)?.data) && (existing as any).data.length > 0) {
					invoiceId = String((existing as any).data[0].id);
					console.log('Found existing invoice:', invoiceId);
				}
			}
		} catch (error) {
			console.error('Failed to check existing invoices:', error);
		}

		// Create invoice only if one doesn't exist
		if (!invoiceId && contactId) {
			try {
				const invoice = await createInvoice({ 
					contactId, 
					proposalId: String(quoteId), 
					amountExcludingGst: Number(totalAmount || 0),
					userId: userId ? String(userId) : undefined,
				});
				invoiceId = String(invoice.id);
				console.log('Invoice created successfully:', invoiceId);
			} catch (error) {
				console.error('Failed to create invoice:', error);
				// Don't fail the request, just log the error
			}
		}

		// If we have an invoiceId now, update it with the latest totals (without removing other fields)
		if (invoiceId) {
			try {
				const gstRate = await fetchGstRate();
				const subtotal = Math.max(0, Number(totalAmount || 0));
				const total_tax = +(subtotal * (gstRate / 100)).toFixed(2);
				const total = +(subtotal + total_tax).toFixed(2);
				let amount_paid = 0;
				try {
					const current = await getRequest<{ data: { amount_paid?: number } }>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=amount_paid`);
					amount_paid = Number(((current as any)?.data?.amount_paid) || 0);
				} catch {}
				const amount_due = Math.max(0, +(total - amount_paid).toFixed(2));
				await patchRequest(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}`, {
					subtotal,
					total_tax,
					total,
					amount_due,
					// ensure proposal linkage exists
					proposal: [String(quoteId)],
				});
			} catch (err) {
				console.error('Failed to update existing invoice totals:', err);
			}
		}

		return NextResponse.json({ 
			success: true, 
			invoiceId: invoiceId || null 
		});
	} catch (error) {
		console.error('Error in approve-and-create-invoice:', error);
		return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
	}
}
