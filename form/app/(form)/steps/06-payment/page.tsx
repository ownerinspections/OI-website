import { getRequest, postRequest, patchRequest } from "@/lib/http/fetcher";
import StripePaymentForm from "@/components/payments/StripePaymentForm";
import { createPaymentIntent } from "@/lib/actions/payments/stripe/createPaymentIntent";
import { APP_BASE_URL, STRIPE_PUBLISHABLE_KEY, DEAL_STAGE_PAYMENT_SUBMITTED_ID } from "@/lib/env";
import FormHeader from "@/components/ui/FormHeader";
import { getPaymentNote, getFormTermsLink } from "@/lib/actions/globals/getGlobal";
import FormFooter from "@/components/ui/FormFooter";

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
		return <div className="container"><div className="card">Missing invoice</div></div>;
	}

	let invoice: any = null;
	try {
		const res = await getRequest<{ data: any }>(`/items/os_invoices/${encodeURIComponent(invoiceId)}`);
		invoice = (res as any)?.data ?? null;
		try { console.log("[invoice][step6] Loaded invoice", { invoiceId, status: invoice?.status, amount_due: invoice?.amount_due, total: invoice?.total }); } catch {}
	} catch {}

	if (!invoice) {
		return <div className="container"><div className="card">Invoice not found</div></div>;
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
		return <div className="container"><div className="card">Invalid invoice amount</div></div>;
	}

	// Use same id for payment_id as invoice_id if available; otherwise derive deterministically from numeric invoice id
	const paymentIdLocal = (() => {
		if (paymentIdParam) return String(paymentIdParam);
		const invPublicId = String((invoice as any)?.invoice_id || "").trim();
		if (invPublicId) return invPublicId;
		const baseNum = Number((invoice as any)?.id);
		return Number.isFinite(baseNum) ? String(100000 + baseNum) : String(Math.floor(100000 + Math.random() * 900000));
	})();

	// Fallback: ensure a payment record exists for this invoice before creating PI
	let directusPaymentId: string | undefined = undefined;
	try {
		// Skip if any payment already exists for this invoice (submitted/pending/etc.)
		const existingRes = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&limit=1&sort=-date_created`);
		const hasAnyPayment = Array.isArray((existingRes as any)?.data) && (existingRes as any).data.length > 0;
		if (hasAnyPayment) {
			const latest = (existingRes as any).data[0];
			if (latest?.id) directusPaymentId = String(latest.id);
		}
		if (!hasAnyPayment) {
			const body: Record<string, unknown> = {
				status: "submitted",
				invoice: String(invoiceId),
				contact: (contactId || (invoice as any)?.contact) ? String(contactId || (invoice as any)?.contact) : undefined,
				amount: amountTotal,
				...(userId ? { user: String(userId) } : {}),
			};
			try { console.log("[os_payments][step6] Creating submitted payment (fallback)", body); } catch {}
			const createdResp = await postRequest<{ data: any }>(`/items/os_payments`, body);
			try { console.log("[os_payments][step6] Created response", createdResp); } catch {}
			try { directusPaymentId = String((createdResp as any)?.data?.id || ""); } catch {}
			// After payment creation, change deal stage to PAYMENT_SUBMITTED if dealId available
			try {
				if (dealId && DEAL_STAGE_PAYMENT_SUBMITTED_ID) {
					await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealId))}`, {
						deal_stage: DEAL_STAGE_PAYMENT_SUBMITTED_ID,
					});
				}
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
		return <div className="container"><div className="card">Failed to initialize payment</div></div>;
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
	// Standard order: userId > contactId > dealId > propertyId > quoteId > invoiceId
	if (userId) prevParams.set("userId", String(userId));
	prevParams.set("invoiceId", String(invoiceId));
	if (contactId) prevParams.set("contactId", String(contactId));
	if (dealId) prevParams.set("dealId", String(dealId));
	if (propertyId) prevParams.set("propertyId", String(propertyId));
	if (quoteId) prevParams.set("quoteId", String(quoteId));
	const prevHref = `/steps/05-invoice?${prevParams.toString()}`;

	const isPaid = String((invoice as any)?.status || "").toLowerCase() === "paid";
	const statusLabel = isPaid ? "Paid" : "Unpaid";
	const invoiceNumber = String((invoice as any)?.invoice_id || (invoice as any)?.invoice_number || invoiceId || "");

	const paymentNote = await getPaymentNote();

	return (
		<div className="container">
			<div className="card">
				<FormHeader
					rightTitle="Payment"
					rightSubtitle={<><strong>Status:</strong> {statusLabel}</>}
					rightMeta={[
						{ label: "Invoice #", value: invoiceNumber },
						{ label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
						{ label: "Amount", value: new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amountTotal) },
					]}
				/>
				{paymentNote ? (
					<div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
						<div>{paymentNote}</div>
					</div>
				) : null}
				<StripePaymentForm clientSecret={clientSecret} invoiceId={String(invoiceId)} receiptHref={receiptHref} publishableKey={STRIPE_PUBLISHABLE_KEY} returnUrl={returnUrl} prevHref={prevHref} paymentId={directusPaymentId || ""} />
			</div>
		</div>
	);
}
