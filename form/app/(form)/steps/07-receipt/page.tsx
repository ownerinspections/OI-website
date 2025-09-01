import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { closeDealFromInvoice } from "@/lib/actions/deals/closeDealFromInvoice";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY, APP_BASE_URL, DIRECTUS_APP_URL, APP_DASHBOARD_URL } from "@/lib/env";
import { fetchCompanyInfo, CustomerInfo, CompanyInfo } from "@/lib/actions/invoices/createInvoice";
import FormHeader from "@/components/ui/FormHeader";
import { getReceiptNote } from "@/lib/actions/globals/getGlobal";

export default async function StepReceipt({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const params = (await searchParams) ?? {};
    const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
    const sessionId = typeof params.session_id === "string" ? params.session_id : undefined;
    const paymentIntentIdParam = typeof params.payment_intent === "string" ? params.payment_intent : undefined;
    const paymentIntentClientSecret = typeof params.payment_intent_client_secret === "string" ? params.payment_intent_client_secret : undefined;

    if (!invoiceId) {
        return <div className="container"><div className="card">Missing invoice</div></div>;
    }

    // Load invoice (SSR via Directus through Kong)
    let invoice: any = null;
    try {
        const res = await getRequest<{ data: any }>(`/items/os_invoices/${encodeURIComponent(invoiceId)}`);
        invoice = (res as any)?.data ?? null;
    } catch {}

    // Optional: fetch contact for display
    let customer: CustomerInfo | null = null;
    if (invoice?.contact) {
        try {
            const contactRes = await getRequest<{ data: CustomerInfo }>(`/items/contacts/${encodeURIComponent(String(invoice.contact))}`);
            customer = (contactRes as any)?.data ?? null;
        } catch {}
    }

    const company: CompanyInfo | null = await fetchCompanyInfo();

    // Prefer payment info from Directus os_payments
    let paidAmount: number | null = null;
    let paymentMethodSummary: string | null = null;
    let isPaid = false;
    let paymentIntentId: string | undefined = paymentIntentIdParam;

    // Attempt to load latest os_payment for this invoice
    let paymentRecord: any = null;
    let paymentIdLocal: string | undefined = undefined;
    if (invoiceId) {
        try {
            const payRes = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
            paymentRecord = Array.isArray((payRes as any)?.data) && (payRes as any).data.length > 0 ? (payRes as any).data[0] : null;
        } catch {}
    }

    if (paymentRecord) {
        const amtNum = Number(paymentRecord.amount ?? 0);
        paidAmount = Number.isFinite(amtNum) ? amtNum : null;
        isPaid = String(paymentRecord.status || "").toLowerCase() === "paid" || (paidAmount ?? 0) > 0;
        if (paymentRecord.payment_method_type) {
            paymentMethodSummary = String(paymentRecord.payment_method_type).toUpperCase();
        }
    }
    if (!paymentIntentId && paymentIntentClientSecret && paymentIntentClientSecret.startsWith("pi_")) {
        const idx = paymentIntentClientSecret.indexOf("_secret");
        if (idx > 0) paymentIntentId = paymentIntentClientSecret.substring(0, idx);
    }

    if (!paymentRecord && (sessionId || paymentIntentId) && STRIPE_SECRET_KEY) {
        const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });
        try {
            let pi: Stripe.Response<Stripe.PaymentIntent> | null = null;
            if (sessionId) {
                const session = await stripe.checkout.sessions.retrieve(sessionId);
                if (typeof session.payment_intent === "string") {
                    pi = await stripe.paymentIntents.retrieve(session.payment_intent);
                }
            }
            if (!pi && paymentIntentId) {
                pi = await stripe.paymentIntents.retrieve(paymentIntentId);
            }
            if (pi) {
                paidAmount = (pi.amount_received ?? pi.amount ?? 0) / 100;
                isPaid = pi.status === "succeeded" || (pi.amount_received ?? 0) > 0;
                const pmId = typeof pi.payment_method === "string" ? pi.payment_method : null;
                if (pmId) {
                    const pm = await stripe.paymentMethods.retrieve(pmId);
                    if (pm.card) {
                        paymentMethodSummary = `${pm.card.brand?.toUpperCase()} •••• ${pm.card.last4}`;
                    }
                }

                // Ensure os_payments exists in Directus (idempotent check by stripe_payment_id)
                try {
                    const piId = pi.id;
                    const existing = await getRequest<{ data: Array<{ id: string }> }>(`/items/os_payments?filter[stripe_payment_id][_eq]=${encodeURIComponent(String(piId))}&limit=1`);
                    const alreadyExists = Array.isArray((existing as any)?.data) && (existing as any).data.length > 0;
                    if (!alreadyExists && invoice?.id) {
                        // Retrieve latest charge for receipt URL and payment date
                        let receiptUrl: string | undefined = undefined;
                        let paymentDateIso: string = new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
                        try {
                            const charges = await stripe.charges.list({ payment_intent: piId, limit: 1 });
                            const charge = charges.data?.[0];
                            if (charge) {
                                receiptUrl = charge.receipt_url ?? undefined;
                                if (charge.created) paymentDateIso = new Date(charge.created * 1000).toISOString();
                            }
                        } catch {}

                        const amountStr = ((pi.amount_received ?? pi.amount ?? 0) / 100).toFixed(2);
                        const methodType = (pi.payment_method_types && pi.payment_method_types[0]) || (paymentMethodSummary ? "card" : undefined);

                        // Build internal receipt link
                        const base = (APP_BASE_URL || "").trim() || "http://localhost:8030";
                        const baseNoSlash = base.replace(/\/$/, "");
                        const receiptLink = invoice?.id
                            ? `${baseNoSlash}/steps/07-receipt?invoiceId=${encodeURIComponent(String(invoice.id))}&payment_intent=${encodeURIComponent(String(piId))}`
                            : `${baseNoSlash}/steps/07-receipt`;

                        // Prefer payment_id from Stripe metadata, otherwise derive from payment record numeric id after creation
                        const paymentIdFromMeta = typeof pi.metadata?.payment_id === "string" && pi.metadata.payment_id.trim() ? String(pi.metadata.payment_id).trim() : undefined;

                        const createBody: Record<string, unknown> = {
                            status: "paid",
                            payment_date: paymentDateIso,
                            amount: amountStr,
                            stripe_payment_id: piId,
                            contact: invoice?.contact ?? undefined,
                            invoice: invoice?.id,
                            payment_method_type: methodType,
                            receipt_url: receiptUrl,
                            receipt_link: receiptLink,
                            metadata: { source: "receipt-ssr" },
                        };

                        if (paymentIdFromMeta) {
                            (createBody as any).payment_id = paymentIdFromMeta;
                            paymentIdLocal = paymentIdFromMeta;
                        }

                        const createdPay = await postRequest<{ data: any }>(`/items/os_payments`, createBody);
                        const createdPayment = (createdPay as any)?.data;
                        if (!paymentIdFromMeta && createdPayment?.id) {
                            const baseNum = Number(createdPayment.id);
                            const derived = Number.isFinite(baseNum) ? String(100000 + baseNum) : undefined;
                            if (derived) {
                                try {
                                    await patchRequest(`/items/os_payments/${encodeURIComponent(String(createdPayment.id))}`, { payment_id: derived });
                                    paymentIdLocal = derived;
                                } catch {}
                            }
                        }
                        // Reflect in-memory state to match Directus record
                        if (!paymentRecord) {
                            paymentRecord = {
                                status: "paid",
                                amount: amountStr,
                                payment_method_type: methodType,
                                receipt_url: receiptUrl,
                            };
                        }
                    }
                } catch {}
            }
        } catch {}
    }

    // Fallback: ensure invoice status is marked paid in Directus if payment succeeded
    if (invoiceId && isPaid) {
        try {
            await patchRequest(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}`, { status: "paid", amount_paid: paidAmount ?? undefined });
        } catch {}
        try {
            await closeDealFromInvoice(String(invoiceId));
        } catch {}
    }

    const currency = "AUD";
    const total = Number(invoice?.total || 0);
    const amountPaid = paidAmount ?? Number(invoice?.amount_paid || total);

    const receiptNote = await getReceiptNote();

    return (
        <div className="container">
            <div className="card">
                <FormHeader
                    rightTitle="Receipt"
                    rightSubtitle={<><strong>Status:</strong> {isPaid ? "Paid" : "Not paid"}</>}
                    rightMeta={[
                        { label: "Invoice #", value: (invoice as any)?.invoice_id || (invoice as any)?.invoice_number },
                        { label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
                    ]}
                />
                {receiptNote ? (
                    <div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
                        <div>{receiptNote}</div>
                    </div>
                ) : null}
                {/* Removed secondary details under the header per request */}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
                    <div>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Billed To</div>
                        <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
                            {customer?.company_name || `${customer?.first_name || ""} ${customer?.last_name || ""}`.trim() || "Customer"}
                            {customer?.email && (<div>{customer.email}</div>)}
                            {customer?.phone && (<div>{customer.phone}</div>)}
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>Payment method</div>
                        <div style={{ color: "var(--color-text-secondary)", fontSize: 14 }}>
                            {paymentMethodSummary || "Paid via Stripe"}
                        </div>
                        <div style={{ color: "var(--color-text-secondary)", fontSize: 14, marginTop: 2 }}>
                            Transaction ID: {paymentRecord?.stripe_payment_id || paymentIntentId || "-"}
                        </div>
                    </div>
                </div>

                <div style={{ borderTop: "1px solid var(--color-light-gray)", paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ color: "var(--color-text-secondary)" }}>Amount Paid</span>
                        <span style={{ fontWeight: 600, color: "var(--color-success)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amountPaid)}</span>
                    </div>
                    {/* Status row removed from totals */}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                    <a
                        className="button-primary"
                        href={`${(APP_DASHBOARD_URL || "http://localhost:8040").replace(/\/$/, "")}/login`}
                    >
                        Book Now
                    </a>
                </div>
            </div>
        </div>
    );
}


