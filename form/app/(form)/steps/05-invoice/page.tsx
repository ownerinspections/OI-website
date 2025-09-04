import InvoicesForm from "@/components/invoices/InvoicesForm";
import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { DEAL_STAGE_PAYMENT_SUBMITTED_ID } from "@/lib/env";
import { createInvoice, fetchGstRate, fetchCompanyInfo, fetchCustomerInfo, fetchPropertyInfo, InvoiceRecord } from "@/lib/actions/invoices/createInvoice";
import { updateInvoice } from "@/lib/actions/invoices/updateInvoice";
import { redirect } from "next/navigation";
import FormHeader from "@/components/ui/FormHeader";
import FormFooter from "@/components/ui/FormFooter";
import { getInvoiceNote, getFormTermsLink } from "@/lib/actions/globals/getGlobal";

export default async function StepInvoice({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactParamId = typeof params.contactId === "string" ? params.contactId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const userId = typeof params.userId === "string" ? params.userId : undefined;

	let proposal: any = null;
	if (quoteId) {
		try {
			const res = await getRequest<{ data: any }>(`/items/os_proposals/${encodeURIComponent(String(quoteId))}?fields=id,deal,contact,quote_amount,status,date_created`);
			proposal = (res as any)?.data ?? null;
		} catch {
			proposal = null;
		}
	}

	// Resolve a proposal if not provided explicitly
	if (!proposal && dealId) {
		try {
			const res = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodeURIComponent(String(dealId))}&sort=-date_created&limit=1`);
			proposal = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
		} catch {
			proposal = null;
		}
	}

	if (!proposal) {
		return <div className="container"><div className="card">No proposal found.</div></div>;
	}

	const proposalId = String(proposal.id);
	let contactId: string | undefined = contactParamId || (proposal?.contact ? String(proposal.contact) : undefined);
	if (!contactId && dealId) {
		try {
			const res = await getRequest<{ data: { contact?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=contact`);
			const c = (res as any)?.data?.contact;
			if (c) contactId = String(c);
		} catch {}
	}

	// Compute subtotal from proposal quote_amount (this was saved on step 04 total update)
	const subtotal = Math.max(0, Number(proposal?.quote_amount || 0));

	// Check if we have a specific invoice ID to use
	let invoice: InvoiceRecord | null = null;
	if (invoiceId) {
		try {
			const res = await getRequest<{ data: InvoiceRecord }>(`/items/os_invoices/${encodeURIComponent(invoiceId)}`);
			invoice = (res as any)?.data ?? null;
		} catch {
			invoice = null;
		}
	}

	// If no specific invoice ID or it failed, try to reuse an existing invoice for this proposal
	if (!invoice) {
		try {
			// Filter by related proposal id in Directus (many-to-many relation)
			const existing = await getRequest<{ data: InvoiceRecord[] }>(`/items/os_invoices?filter[proposal][id][_eq]=${encodeURIComponent(proposalId)}&sort=-date_created&limit=1`);
			invoice = Array.isArray((existing as any)?.data) && (existing as any).data.length > 0 ? (existing as any).data[0] : null;
		} catch {
			invoice = null;
		}
	}

	// Only create a new invoice if we don't have one and we have contact info
	if (!invoice && contactId) {
		try {
			invoice = await createInvoice({ contactId, proposalId, amountExcludingGst: subtotal, userId });
		} catch (error) {
			return <div className="container"><div className="card">Failed to create invoice. Please try again.</div></div>;
		}
	}

	if (!invoice) {
		return <div className="container"><div className="card">Failed to load invoice.</div></div>;
	}

    // invoice_link is set during the accept-quote API flow to avoid SSR-time PATCH here.

	// Build display line items from deal (service name + selected addons) without altering totals
	let displayLineItems: Array<{ name: string; description?: string; quantity: number; unit_price: number; total: number }> = [];
	try {
		if (dealId) {
			// Fetch service id and addon ids from deal
			const dealRes = await getRequest<{ data: { service?: string | number; addons?: number[] } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service,addons`);
			const deal = (dealRes as any)?.data || {};
			// Resolve service name
			let serviceName: string = "Service";
			if (deal?.service) {
				try {
					const serviceRes = await getRequest<{ data: { service_name?: string; service_type?: string } }>(`/items/services/${encodeURIComponent(String(deal.service))}?fields=service_name,service_type`);
					const svc = (serviceRes as any)?.data || {};
					serviceName = svc.service_name || svc.service_type || serviceName;
				} catch {}
			}
			// First line: service, using quote subtotal
			displayLineItems.push({ name: serviceName, description: "Quote amount", quantity: 1, unit_price: subtotal, total: subtotal });
			// Resolve addons
			const addonIds: number[] = Array.isArray(deal?.addons) ? deal.addons : [];
			if (addonIds.length > 0) {
				const idsCsv = addonIds.join(",");
				try {
					const addonsRes = await getRequest<{ data: any[] }>(`/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}`);
					const addons = ((addonsRes as any)?.data ?? []) as any[];
					for (const a of addons) {
						const price = Number(a.price ?? a.amount ?? 0);
						displayLineItems.push({ name: a.name || a.addon_name || a.title || `Addon ${a.id}`, description: "Addon", quantity: 1, unit_price: price, total: price });
					}
				} catch {}
			}
		}
	} catch {}

	// Fetch additional data for the invoice display
	const [gstRate, companyInfo, customerInfo, propertyInfo] = await Promise.allSettled([
		fetchGstRate(),
		fetchCompanyInfo(),
		contactId ? fetchCustomerInfo(contactId) : null,
		propertyId ? fetchPropertyInfo(propertyId) : null,
	]);

	// Extract results from Promise.allSettled
	const gstRateResult = gstRate.status === 'fulfilled' ? gstRate.value : 10;
	const companyInfoResult = companyInfo.status === 'fulfilled' ? companyInfo.value : null;
	const customerInfoResult = customerInfo.status === 'fulfilled' ? customerInfo.value : null;
	const propertyInfoResult = propertyInfo.status === 'fulfilled' ? propertyInfo.value : null;

	// Prepare header details (same style as Quote step)
	const invoiceNumber = (invoice as any)?.invoice_id || (invoice as any)?.invoice_number;
	const issueDateFmt = (() => {
		try { return (invoice as any)?.issue_date ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date((invoice as any).issue_date)) : undefined; } catch { return undefined; }
	})();
	const dueDateFmt = (() => {
		try { return (invoice as any)?.due_date ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date((invoice as any).due_date)) : undefined; } catch { return undefined; }
	})();


	// Prepare server action for "Pay Now": approve invoice then go to inline payment step
	async function payNowAction() {
		"use server";
		const currentInvoiceId = String((invoice as any).id);
		// Derive a stable paymentId to append to Step 06 URL
		const paymentIdLocal = (() => {
			try {
				const invPublicId = String((invoice as any)?.invoice_id || "").trim();
				if (invPublicId) return invPublicId;
				const baseNum = Number((invoice as any)?.id);
				return Number.isFinite(baseNum) ? String(100000 + baseNum) : String(Math.floor(100000 + Math.random() * 900000));
			} catch {
				return String(Math.floor(100000 + Math.random() * 900000));
			}
		})();
		// Will capture UUID from Directus os_payments creation response
		let paymentIdFromCreation: string | undefined = undefined;
		// Create a pending os_payment record immediately on click (non-blocking)
		try {
			const invRes = await getRequest<{ data: any }>(`/items/os_invoices/${encodeURIComponent(currentInvoiceId)}?fields=id,amount_due,total,subtotal,contact,invoice_id`);
			const invData = (invRes as any)?.data ?? {};
			const amountTotal = (() => {
				const primary = invData?.amount_due;
				if (typeof primary === "number") return primary;
				if (typeof primary === "string") {
					const parsed = parseFloat(primary);
					if (Number.isFinite(parsed)) return parsed;
				}
				const fallback = invData?.total ?? invData?.subtotal ?? 0;
				return typeof fallback === "number" ? fallback : (Number.isFinite(parseFloat(String(fallback))) ? parseFloat(String(fallback)) : 0);
			})();

			const body: Record<string, unknown> = {
				status: "submitted",
				invoice: currentInvoiceId,
				contact: (contactId || invData?.contact) ? String(contactId || invData.contact) : undefined,
				amount: Number.isFinite(amountTotal) ? amountTotal : undefined,
				...(userId ? { user: String(userId) } : {}),
			};
			try { console.log("[os_payments][step5] Creating submitted payment", body); } catch {}
			const createdResp = await postRequest(`/items/os_payments`, body);
			try { console.log("[os_payments][step5] Created response", createdResp); } catch {}
			// After payment creation, change deal stage to PAYMENT_SUBMITTED if dealId available
			try {
				if (dealId && DEAL_STAGE_PAYMENT_SUBMITTED_ID) {
					await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealId))}`, {
						deal_stage: DEAL_STAGE_PAYMENT_SUBMITTED_ID,
					});
				}
			} catch (err) {
				try { console.warn('[step5] failed to update deal stage to PAYMENT_SUBMITTED', err); } catch {}
			}
			// Prefer the Directus os_payment UUID if available
			try {
				const createdId = (createdResp as any)?.data?.id ?? (createdResp as any)?.id;
				if (createdId) {
					paymentIdFromCreation = String(createdId);
				}
			} catch {}
		} catch {}

		// Only change: set invoice status to approved
		try { console.log("[invoice][pay-now] Setting invoice status to approved", { invoiceId: currentInvoiceId }); } catch {}
		await updateInvoice(currentInvoiceId, { status: "approved" });
		try { console.log("[invoice][pay-now] Invoice status set to approved", { invoiceId: currentInvoiceId }); } catch {}

		const sp = new URLSearchParams();
		// Ensure order: userId first, then contactId > dealId > propertyId > quoteId > invoiceId
		if (userId) sp.set("userId", String(userId));
		if (contactId) sp.set("contactId", String(contactId));
		if (dealId) sp.set("dealId", String(dealId));
		if (propertyId) sp.set("propertyId", String(propertyId));
		if (quoteId) sp.set("quoteId", String(quoteId));
		sp.set("invoiceId", encodeURIComponent(currentInvoiceId));
		// Append paymentId at the end, preferring the Directus-created UUID
		const paymentIdToUse = paymentIdFromCreation || paymentIdLocal;
		sp.set("paymentId", String(paymentIdToUse));
		redirect(`/steps/06-payment?${sp.toString()}`);
	}

	const [invoiceNote, termsLink] = await Promise.all([
		getInvoiceNote(),
		getFormTermsLink(),
	]);

	return (
		<div className="container">
			<div className="card">
				<FormHeader
					rightTitle="Invoice"
					rightSubtitle={<><strong>Status:</strong> {String((invoice as any)?.status || "-")}</>}
					rightMeta={[
						{ label: "Invoice #", value: invoiceNumber },
						{ label: "Issue Date", value: issueDateFmt },
						{ label: "Due Date", value: dueDateFmt },
					]}
				/>
				{invoiceNote ? (
					<div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
						<div>{invoiceNote}</div>
					</div>
				) : null}
				<InvoicesForm invoice={{
					id: String(invoice.id),
					invoice_number: (invoice as any).invoice_id,
					status: (invoice as any).status,
					issue_date: (invoice as any).issue_date,
					due_date: (invoice as any).due_date,
					subtotal: Number((invoice as any).subtotal || 0),
					total_tax: Number((invoice as any).total_tax || 0),
					total: Number((invoice as any).total || 0),
					contact: contactId || (invoice as any).contact,
					proposal: proposalId,
					gst_rate: gstRateResult,
					line_items: displayLineItems.length > 0 ? displayLineItems : ((invoice as any).line_items || []),
					property: propertyInfoResult || undefined,
				}} companyInfo={companyInfoResult} customerInfo={customerInfoResult} prevHref={`/steps/04-quote?contactId=${encodeURIComponent(String(contactId || ""))}&dealId=${encodeURIComponent(String(dealId || ""))}&propertyId=${encodeURIComponent(String(propertyId || ""))}&quoteId=${encodeURIComponent(String(quoteId || ""))}&invoiceId=${encodeURIComponent(String(invoiceId || ""))}${userId ? `&userId=${encodeURIComponent(String(userId))}` : ""}`} payNowAction={payNowAction} />
				<FormFooter termsLink={termsLink} />
			</div>
		</div>
	);
}
