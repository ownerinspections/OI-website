import { getRequest } from "@/lib/http/fetcher";
import StripePaymentForm from "@/components/payments/StripePaymentForm";
import { createPaymentIntent } from "@/lib/actions/payments/stripe/createPaymentIntent";
import { APP_BASE_URL, STRIPE_PUBLISHABLE_KEY } from "@/lib/env";
import FormHeader from "@/components/ui/FormHeader";
import { getPaymentNote, getFormTermsLink } from "@/lib/actions/globals/getGlobal";
import FormFooter from "@/components/ui/FormFooter";

export default async function StepPayment({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;

	if (!invoiceId) {
		return <div className="container"><div className="card">Missing invoice</div></div>;
	}

	let invoice: any = null;
	try {
		const res = await getRequest<{ data: any }>(`/items/os_invoices/${encodeURIComponent(invoiceId)}`);
		invoice = (res as any)?.data ?? null;
	} catch {}

	if (!invoice) {
		return <div className="container"><div className="card">Invoice not found</div></div>;
	}

	const amountTotal = Number(invoice.total || 0);
	if (!Number.isFinite(amountTotal) || amountTotal <= 0) {
		return <div className="container"><div className="card">Invalid invoice amount</div></div>;
	}

	// Use same id for payment_id as invoice_id if available; otherwise derive deterministically from numeric invoice id
	const paymentIdLocal = (() => {
		const invPublicId = String((invoice as any)?.invoice_id || "").trim();
		if (invPublicId) return invPublicId;
		const baseNum = Number((invoice as any)?.id);
		return Number.isFinite(baseNum) ? String(100000 + baseNum) : String(Math.floor(100000 + Math.random() * 900000));
	})();

	const pi = await createPaymentIntent({
		amount: amountTotal,
		currency: "aud",
		metadata: { invoice_id: String(invoiceId), payment_id: paymentIdLocal },
	});

	const clientSecret = (pi as any)?.client_secret || "";
	if (!clientSecret) {
		return <div className="container"><div className="card">Failed to initialize payment</div></div>;
	}

	const base = (APP_BASE_URL || "").trim() || "http://localhost:8030";
	const receiptParams = new URLSearchParams();
	receiptParams.set("invoiceId", String(invoiceId));
	if (dealId) receiptParams.set("dealId", String(dealId));
	if (contactId) receiptParams.set("contactId", String(contactId));
	if (propertyId) receiptParams.set("propertyId", String(propertyId));
	if (quoteId) receiptParams.set("quoteId", String(quoteId));
	const receiptHref = `${base.replace(/\/$/, "")}/steps/07-receipt?${receiptParams.toString()}`;
	const returnUrl = receiptHref;

	// Build Previous href back to Invoice step, preserving params
	const prevParams = new URLSearchParams();
	prevParams.set("invoiceId", String(invoiceId));
	if (dealId) prevParams.set("dealId", String(dealId));
	if (contactId) prevParams.set("contactId", String(contactId));
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
				<StripePaymentForm clientSecret={clientSecret} invoiceId={String(invoiceId)} receiptHref={receiptHref} publishableKey={STRIPE_PUBLISHABLE_KEY} returnUrl={returnUrl} prevHref={prevHref} />
			</div>
		</div>
	);
}
