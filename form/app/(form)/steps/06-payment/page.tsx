import { getRequest, postRequest, patchRequest } from "@/lib/http/fetcher";
import StripePaymentForm from "@/components/payments/StripePaymentForm";
import { createPaymentIntent } from "@/lib/actions/payments/stripe/createPaymentIntent";
import { APP_BASE_URL, STRIPE_PUBLISHABLE_KEY, DEAL_STAGE_PAYMENT_SUBMITTED_ID } from "@/lib/env";
import FormHeader from "@/components/ui/FormHeader";
import { getPaymentNote } from "@/lib/actions/globals/getGlobal";
import NoteBox from "@/components/ui/messages/NoteBox";
import SuccessBox from "@/components/ui/messages/SuccessBox";
import { redirect } from "next/navigation";

export default async function StepPayment({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const paymentIdParam = typeof params.paymentId === "string" ? params.paymentId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const userId = typeof params.userId === "string" ? params.userId : undefined;

	if (!invoiceId) {
		redirect('/not-found');
	}

	let invoice: any = null;
	try {
		const res = await getRequest<{ data: any }>(`/items/os_invoices/${encodeURIComponent(invoiceId)}`);
		invoice = (res as any)?.data ?? null;
		try { console.log("[invoice][step6] Loaded invoice", { invoiceId, status: invoice?.status, amount_due: invoice?.amount_due, total: invoice?.total }); } catch {}
	} catch {}

	if (!invoice) {
		redirect('/not-found');
	}

	// Resolve amount to charge, robust to string values or missing totals
	const resolveAmount = (inv: any): number => {
		const raw = inv?.amount_due ?? inv?.total ?? inv?.subtotal ?? 0; // prioritize amount_due
		if (typeof raw === "number") return raw;
		const parsed = parseFloat(String(raw));
		return Number.isFinite(parsed) ? parsed : 0;
	};
	let amountTotal = resolveAmount(invoice);
	if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
		// Fallback to latest pending os_payment amount if available
		try {
			const payRes = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
			const rec = Array.isArray((payRes as any)?.data) && (payRes as any).data.length > 0 ? (payRes as any).data[0] : null;
			if (rec && rec.amount != null) {
				const parsed = typeof rec.amount === "number" ? rec.amount : parseFloat(String(rec.amount));
				if (Number.isFinite(parsed) && parsed > 0) amountTotal = parsed;
			}
		} catch {}
	}
	try { console.log("[payment][step6] Using amount", { amountTotal, invoiceTotal: invoice?.total, amount_due: invoice?.amount_due, subtotal: invoice?.subtotal }); } catch {}
	if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
		redirect('/not-found');
	}

	// Use same id for payment_id as invoice_id if available; otherwise derive deterministically from numeric invoice id
	const paymentIdLocal = (() => {
		if (paymentIdParam) return String(paymentIdParam);
		const invPublicId = String((invoice as any)?.invoice_id || "").trim();
		if (invPublicId) return invPublicId;
		const baseNum = Number((invoice as any)?.id);
		return Number.isFinite(baseNum) ? String(100000 + baseNum) : String(Math.floor(100000 + Math.random() * 900000));
	})();

	// Ensure a payment record exists for this invoice before creating PI
	let directusPaymentId: string | undefined = undefined;
	try {
		// First, check if we have a specific paymentId from URL params
		if (paymentIdParam) {
			try {
				const specificRes = await getRequest<{ data: any }>(`/items/os_payments/${encodeURIComponent(String(paymentIdParam))}`);
				if ((specificRes as any)?.data) {
					directusPaymentId = String(paymentIdParam);
					const currentStatus = String((specificRes as any)?.data?.status || "");
					// Only update to "submitted" if not already in a final state
					if (currentStatus !== "success" && currentStatus !== "failure") {
						const updateBody: Record<string, unknown> = {
							status: "submitted",
							amount: amountTotal,
							...(userId ? { user: String(userId) } : {}),
						};
						try { console.log("[os_payments][step6] Updating existing payment from URL", { paymentId: directusPaymentId, updateBody }); } catch {}
						await patchRequest(`/items/os_payments/${encodeURIComponent(String(paymentIdParam))}`, updateBody);
						try { console.log("[os_payments][step6] Updated existing payment", { paymentId: directusPaymentId }); } catch {}
					}
				}
			} catch {
				// Specific payment doesn't exist, fall back to general check
			}
		}
		
		// If no specific payment found, check for any existing payment for this invoice
		if (!directusPaymentId) {
			const existingRes = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&limit=1&sort=-date_created`);
			const hasAnyPayment = Array.isArray((existingRes as any)?.data) && (existingRes as any).data.length > 0;
			if (hasAnyPayment) {
				const latest = (existingRes as any).data[0];
				if (latest?.id) {
					directusPaymentId = String(latest.id);
					const currentStatus = String(latest?.status || "");
					// Only update to "submitted" if not already in a final state
					if (currentStatus !== "success" && currentStatus !== "failure") {
						const updateBody: Record<string, unknown> = {
							status: "submitted",
							amount: amountTotal,
							...(userId ? { user: String(userId) } : {}),
						};
						try { console.log("[os_payments][step6] Updating latest existing payment", { paymentId: directusPaymentId, updateBody }); } catch {}
						await patchRequest(`/items/os_payments/${encodeURIComponent(String(latest.id))}`, updateBody);
						try { console.log("[os_payments][step6] Updated latest existing payment", { paymentId: directusPaymentId }); } catch {}
					}
				}
			}
		}
		
		// Only create new payment if none exists
		if (!directusPaymentId) {
			const body: Record<string, unknown> = {
				status: "submitted",
				invoice: String(invoiceId),
				contact: (contactId || (invoice as any)?.contact) ? String(contactId || (invoice as any)?.contact) : undefined,
				amount: amountTotal,
				...(userId ? { user: String(userId) } : {}),
			};
			try { console.log("[os_payments][step6] Creating new payment", body); } catch {}
			const createdResp = await postRequest<{ data: any }>(`/items/os_payments`, body);
			try { console.log("[os_payments][step6] Created response", createdResp); } catch {}
			try { directusPaymentId = String((createdResp as any)?.data?.id || ""); } catch {}
		}
		
		// Update deal stage to PAYMENT_SUBMITTED if dealId available (only once)
		if (dealId && DEAL_STAGE_PAYMENT_SUBMITTED_ID) {
			try {
				await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealId))}`, {
					deal_stage: DEAL_STAGE_PAYMENT_SUBMITTED_ID,
				});
				try { console.log("[os_payments][step6] Updated deal stage to PAYMENT_SUBMITTED", { dealId }); } catch {}
			} catch (err) {
				try { console.warn('[step6] failed to update deal stage to PAYMENT_SUBMITTED', err); } catch {}
			}
		}
	} catch {}

	try { console.log("[invoice][step6] Before creating PaymentIntent", { invoiceId, status: (invoice as any)?.status, amountTotal }); } catch {}
	const pi = await createPaymentIntent({
		amount: amountTotal,
		currency: "aud",
		metadata: { invoice_id: String(invoiceId), payment_id: paymentIdLocal },
	});
	try { console.log("[invoice][step6] After creating PaymentIntent", { invoiceId, status: (invoice as any)?.status }); } catch {}

	const clientSecret = (pi as any)?.client_secret || "";
	if (!clientSecret) {
		redirect('/not-found');
	}

	const base = (APP_BASE_URL || "").trim() || "http://localhost:8030";
	const receiptParams = new URLSearchParams();
	// Standard order: userId > contactId > dealId > propertyId > quoteId > invoiceId
	if (userId) receiptParams.set("userId", String(userId));
	if (contactId) receiptParams.set("contactId", String(contactId));
	if (dealId) receiptParams.set("dealId", String(dealId));
	if (propertyId) receiptParams.set("propertyId", String(propertyId));
	if (quoteId) receiptParams.set("quoteId", String(quoteId));
	receiptParams.set("invoiceId", String(invoiceId));
	// Include a stable paymentId derived from invoice for the receipt URL
	receiptParams.set("paymentId", String(paymentIdLocal));
	const receiptHref = `${base.replace(/\/$/, "")}/steps/07-receipt?${receiptParams.toString()}`;
	const returnUrl = receiptHref;

	// Build Previous href back to Invoice step, preserving params
	const prevParams = new URLSearchParams();
	// Standard order: userId > contactId > dealId > propertyId > quoteId > invoiceId > paymentId
	if (userId) prevParams.set("userId", String(userId));
	if (contactId) prevParams.set("contactId", String(contactId));
	if (dealId) prevParams.set("dealId", String(dealId));
	if (propertyId) prevParams.set("propertyId", String(propertyId));
	if (quoteId) prevParams.set("quoteId", String(quoteId));
	prevParams.set("invoiceId", String(invoiceId));
	// Include paymentId when going back to step 5
	prevParams.set("paymentId", String(paymentIdLocal));
	const prevHref = `/steps/05-invoice?${prevParams.toString()}`;

	// Fetch payment status to determine if paid
	let paymentStatus: string = "submitted"; // default to submitted
	try {
		if (directusPaymentId) {
			const paymentRes = await getRequest<{ data: any }>(`/items/os_payments/${encodeURIComponent(String(directusPaymentId))}`);
			paymentStatus = String((paymentRes as any)?.data?.status || "submitted");
		}
	} catch {}

	const isPaid = String(paymentStatus || "").toLowerCase() === "success";
	const invoiceNumber = String((invoice as any)?.invoice_id || invoiceId || "");

	// Get service type from deal
	let serviceType: string = "Service";
	try {
		if (dealId) {
			const dealRes = await getRequest<{ data: { service?: number } }>(`/items/os_deals/${encodeURIComponent(String(dealId))}?fields=service`);
			const serviceId = (dealRes as any)?.data?.service || null;
			
			if (serviceId) {
				const serviceRes = await getRequest<{ data: { service_name?: string; service_type?: string } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=service_name,service_type`);
				const service = (serviceRes as any)?.data || {};
				serviceType = service.service_name || service.service_type || serviceType;
			}
		}
	} catch (error) {
		console.error('Failed to fetch service type:', error);
	}

	// Format service type for display
	const formatServiceType = (type: string): string => {
		return type
			.replace(/_/g, ' ')
			.replace(/-/g, ' ')
			.split(' ')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ');
	};
	const formattedServiceType = formatServiceType(serviceType);

	const paymentNote = await getPaymentNote();

	// Debug: Log the rightMeta data to see what's being passed
	console.log("[DEBUG] Payment amount data:", {
		amountTotal,
		formattedAmount: new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amountTotal),
		invoiceNumber,
		rightMeta: [
			{ label: "Invoice #", value: invoiceNumber },
			{ label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
			{ label: "Amount", value: new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amountTotal) },
		]
	});

	return (
		<div className="container">
			<div className="card">
				<FormHeader
					rightTitle="Payment"
					rightSubtitle={<>{formattedServiceType}</>}
					rightMeta={[
						{ label: "Invoice #", value: invoiceNumber },
						{ label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
						{ label: "Amount", value: new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amountTotal) },
					]}
				/>
				{paymentNote ? (
					<NoteBox style={{ marginBottom: 16 }}>
						{paymentNote}
					</NoteBox>
				) : null}
				
				{/* Payment Amount Display */}
				<div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
					<div style={{ 
						fontSize: "16px", 
						fontWeight: "600", 
						color: "var(--color-charcoal)"
					}}>
						Payment Amount: <span style={{ color: "var(--color-primary)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amountTotal)}</span>
					</div>
				</div>
				
				{isPaid ? (
					/* Payment Already Completed */
					<SuccessBox style={{ 
						textAlign: "center",
						fontSize: "16px",
						fontWeight: "600",
						padding: 16
					}}>
						Payment Completed Successfully
					</SuccessBox>
				) : (
					/* Payment Form */
					<StripePaymentForm clientSecret={clientSecret} invoiceId={String(invoiceId)} receiptHref={receiptHref} publishableKey={STRIPE_PUBLISHABLE_KEY} returnUrl={returnUrl} prevHref={prevHref} paymentId={directusPaymentId || ""} />
				)}
			</div>
		</div>
	);
}
