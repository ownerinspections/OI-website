import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import ReceiptPageClient from "@/components/receipts/ReceiptPageClient";
import { closeDealFromInvoice } from "@/lib/actions/deals/closeDealFromInvoice";
import { updateQuoteStatusToPaid } from "@/lib/actions/quotes/updateQuoteStatus";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY, APP_BASE_URL, DIRECTUS_APP_URL, APP_DASHBOARD_URL, DEAL_STAGE_PAYMENT_SUBMITTED_ID, DEAL_STAGE_PAYMENT_FAILURE_ID, FAILED_REASON_REQUIRES_CONFIRMATION, FAILED_REASON_REQUIRES_ACTION, FAILED_REASON_PROCESSING, FAILED_REASON_REQUIRES_CAPTURE } from "@/lib/env";
import { fetchCompanyInfo, fetchCustomerInfo, fetchPropertyInfo, CustomerInfo, CompanyInfo, PropertyInfo } from "@/lib/actions/invoices/createInvoice";
import FormHeader from "@/components/ui/FormHeader";
import { getReceiptNote } from "@/lib/actions/globals/getGlobal";
import NoteBox from "@/components/ui/messages/NoteBox";
import { redirect } from "next/navigation";

// Utility function to format Australian phone numbers (same as step 5)
function formatAustralianPhone(phone: string): string {
	if (!phone) return phone;
	
	// Remove all non-digit characters
	const digits = phone.replace(/\D/g, '');
	
	// Handle different input formats
	if (digits.startsWith('61')) {
		// Already has country code
		const withoutCountry = digits.substring(2);
		if (withoutCountry.startsWith('4') && withoutCountry.length === 9) {
			// Mobile number: 4XX XXX XXX
			return `+61 ${withoutCountry.substring(0, 3)} ${withoutCountry.substring(3, 6)} ${withoutCountry.substring(6)}`;
		}
	} else if (digits.startsWith('0')) {
		// Australian format with leading 0
		const withoutZero = digits.substring(1);
		if (withoutZero.startsWith('4') && withoutZero.length === 9) {
			// Mobile number: 4XX XXX XXX
			return `+61 ${withoutZero.substring(0, 3)} ${withoutZero.substring(3, 6)} ${withoutZero.substring(6)}`;
		}
	} else if (digits.startsWith('4') && digits.length === 9) {
		// Just the mobile number without country code or leading 0
		return `+61 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
	}
	
	// If we can't format it properly, return the original
	return phone;
}

export default async function InsuranceReportReceiptStep({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
    const params = (await searchParams) ?? {};
    const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
    const sessionId = typeof params.session_id === "string" ? params.session_id : undefined;
    const paymentIntentIdParam = typeof params.payment_intent === "string" ? params.payment_intent : undefined;
    const paymentIntentClientSecret = typeof params.payment_intent_client_secret === "string" ? params.payment_intent_client_secret : undefined;
    const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
    const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
    const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
    const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
    const paymentIdParam = typeof params.paymentId === "string" ? params.paymentId : undefined;
    const userId = typeof params.userId === "string" ? params.userId : undefined;

    // If Stripe PI params present, update existing os_payment (by paymentId from URL or Stripe metadata) BEFORE cleaning the URL, then PRG redirect
    if (paymentIntentIdParam || paymentIntentClientSecret) {
        let createdPaymentIdLocal: string | undefined = undefined;
        let createdPaymentUuid: string | undefined = undefined;
        let creationFailed = false;
        let paymentAmountAud: number | undefined = undefined;
        let isSucceeded = false;
        let isFailureStatus = false;
        let failureReason: string | undefined = undefined;
        try {
            if (STRIPE_SECRET_KEY) {
                const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2025-07-30.basil" });
                let paymentIntentId = paymentIntentIdParam;
                if (!paymentIntentId && paymentIntentClientSecret && paymentIntentClientSecret.startsWith("pi_")) {
                    const idx = paymentIntentClientSecret.indexOf("_secret");
                    if (idx > 0) paymentIntentId = paymentIntentClientSecret.substring(0, idx);
                }
                if (paymentIntentId) {
                    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
                    // Track settled amount
                    paymentAmountAud = (typeof pi.amount_received === "number" ? pi.amount_received : (typeof pi.amount === "number" ? pi.amount : 0)) / 100;
                    isSucceeded = pi.status === "succeeded" || (typeof pi.amount_received === "number" && pi.amount_received > 0);
                    isFailureStatus = (
                        pi.status === "requires_payment_method" ||
                        pi.status === "requires_confirmation" ||
                        pi.status === "requires_action" ||
                        pi.status === "processing" ||
                        pi.status === "requires_capture"
                    );
                    if (isFailureStatus) {
                        if (pi.status === "requires_payment_method") {
                            const lpe = pi.last_payment_error;
                            const declineCode = (lpe && (lpe as any).decline_code) ? String((lpe as any).decline_code) : undefined;
                            const code = lpe?.code ? String(lpe.code) : undefined;
                            failureReason = [declineCode, code].filter(Boolean).join(" | ") || undefined;
                        } else if (pi.status === "requires_confirmation") {
                            failureReason = FAILED_REASON_REQUIRES_CONFIRMATION;
                        } else if (pi.status === "requires_action") {
                            failureReason = FAILED_REASON_REQUIRES_ACTION;
                        } else if (pi.status === "processing") {
                            failureReason = FAILED_REASON_PROCESSING;
                        } else if (pi.status === "requires_capture") {
                            failureReason = FAILED_REASON_REQUIRES_CAPTURE;
                        }
                    }
                    // Attempt to fetch receipt and card details
                    let receiptUrl: string | undefined = undefined;
                    let paymentDateIso: string = new Date((pi.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
                    let chargeId: string | undefined = undefined;
                    let cardBrand: string | undefined = undefined;
                    let cardLast4: string | undefined = undefined;
                    let expMonth: number | undefined = undefined;
                    let expYear: number | undefined = undefined;
                    try {
                        const charges = await stripe.charges.list({ payment_intent: pi.id, limit: 1 });
                        const charge = charges.data?.[0];
                        if (charge) {
                            receiptUrl = charge.receipt_url ?? undefined;
                            if (charge.created) paymentDateIso = new Date(charge.created * 1000).toISOString();
                            chargeId = charge.id;
                            const card = charge.payment_method_details?.card;
                            if (card) {
                                cardBrand = card.brand || undefined;
                                cardLast4 = card.last4 || undefined;
                                expMonth = card.exp_month || undefined;
                                expYear = card.exp_year || undefined;
                            }
                        }
                    } catch {}

                    const amountNum = isSucceeded ? (pi.amount_received ?? pi.amount ?? 0) / 100 : 0;
                    const methodType = (pi.payment_method_types && pi.payment_method_types[0]) || undefined;
                    const amountCapturable = typeof pi.amount_capturable === "number" ? (pi.amount_capturable / 100) : undefined;

                    // Resolve target existing os_payment to UPDATE using URL param as Directus UUID id
                    let targetPaymentId: string | undefined = paymentIdParam ? String(paymentIdParam) : undefined;
                    // Fallback: latest for invoice if URL param missing
                    if (!targetPaymentId && invoiceId) {
                        try {
                            const byInv = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
                            const rec = Array.isArray((byInv as any)?.data) && (byInv as any).data.length > 0 ? (byInv as any).data[0] : null;
                            if (rec?.id) targetPaymentId = String(rec.id);
                        } catch {}
                    }

                    const updateBody: Record<string, unknown> = {
                        status: isSucceeded ? "success" : (isFailureStatus ? "failure" : "failed"),
                        payment_date: paymentDateIso,
                        amount: amountNum,
                        amount_capturable: amountCapturable,
                        stripe_payment_id: pi.id,
                        transaction_id: chargeId,
                        card_type: cardBrand,
                        card_number: cardLast4,
                        exp_month: expMonth,
                        exp_year: expYear,
                        payment_method_type: methodType,
                        receipt_url: receiptUrl,
                    };
                    if (failureReason) (updateBody as any).failure_reason = failureReason;

                    try {
                        if (targetPaymentId) {
                            await patchRequest(`/items/os_payments/${encodeURIComponent(String(targetPaymentId))}`, updateBody);
                            createdPaymentUuid = String(targetPaymentId);
                        } else if (invoiceId) {
                            // Worst-case fallback: patch latest record by invoice
                            const byInv = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
                            const rec = Array.isArray((byInv as any)?.data) && (byInv as any).data.length > 0 ? (byInv as any).data[0] : null;
                            if (rec?.id) {
                                await patchRequest(`/items/os_payments/${encodeURIComponent(String(rec.id))}`, updateBody);
                                createdPaymentUuid = String(rec.id);
                            }
                        }
                    } catch (_e) {
                        creationFailed = true;
                    }
                }
            }
        } catch {}

        // On success, mark invoice paid and close deal; on failure statuses, do not touch invoice
        if (invoiceId && isSucceeded && typeof paymentAmountAud === "number" && Number.isFinite(paymentAmountAud) && paymentAmountAud > 0) {
            try { console.log("[invoice][insurance-report-receipt-ssr-prg] Marking invoice paid", { invoiceId, amountPaid: paymentAmountAud }); } catch {}
            try {
                await patchRequest(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}`, { status: "paid", amount_paid: paymentAmountAud });
            } catch {}
            try {
                await updateQuoteStatusToPaid(String(invoiceId));
            } catch {}
            try {
                await closeDealFromInvoice(String(invoiceId));
            } catch {}
        }
        // Update deal stage to failure if applicable
        try {
            if (dealId && isFailureStatus && DEAL_STAGE_PAYMENT_FAILURE_ID) {
                await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealId))}`, { deal_stage: DEAL_STAGE_PAYMENT_FAILURE_ID });
            }
        } catch {}
        const sp = new URLSearchParams();
        // Standard order: userId > contactId > dealId > propertyId > quoteId > invoiceId
        if (userId) sp.set("userId", String(userId));
        if (contactId) sp.set("contactId", String(contactId));
        if (dealId) sp.set("dealId", String(dealId));
        if (propertyId) sp.set("propertyId", String(propertyId));
        if (quoteId) sp.set("quoteId", String(quoteId));
        if (invoiceId) sp.set("invoiceId", String(invoiceId));
        // Prefer the Directus payment UUID we just created; fallback to incoming param
        if (createdPaymentUuid) sp.set("paymentId", String(createdPaymentUuid));
        else if (paymentIdParam) sp.set("paymentId", String(paymentIdParam));
        if (sessionId) sp.set("session_id", String(sessionId));
        // If we failed to create a payment record, keep payment_intent so SSR can still resolve details
        if (!createdPaymentUuid && creationFailed && paymentIntentIdParam) {
            sp.set("payment_intent", String(paymentIntentIdParam));
        }
        // Patch oi_receipt_url on the target payment with this internal receipt URL
        try {
            const rawBase = (APP_BASE_URL || "").trim() || "http://localhost:8030";
            const baseNoSlash = rawBase.replace(/\/$/, "");
            const targetPaymentId = createdPaymentUuid || paymentIdParam;
            if (targetPaymentId) {
                const oiReceiptUrl = `${baseNoSlash}/steps/07-receipt/insurance-report?${sp.toString()}`;
                await patchRequest(`/items/os_payments/${encodeURIComponent(String(targetPaymentId))}`, { oi_receipt_url: oiReceiptUrl });
            }
        } catch {}
        redirect(`/steps/07-receipt/insurance-report?${sp.toString()}`);
    }

    if (!invoiceId) {
        redirect('/not-found');
    }

    // Load invoice (SSR via Directus through Kong)
    let invoice: any = null;
    try {
        const res = await getRequest<{ data: any }>(`/items/os_invoices/${encodeURIComponent(invoiceId)}`);
        invoice = (res as any)?.data ?? null;
    } catch {}

    // Ensure payment record stores the internal receipt URL for later viewing
    try {
        if (paymentIdParam) {
            const rawBase = (APP_BASE_URL || "").trim() || "http://localhost:8030";
            const baseNoSlash = rawBase.replace(/\/$/, "");
            const spSelf = new URLSearchParams();
            if (userId) spSelf.set("userId", String(userId));
            if (contactId) spSelf.set("contactId", String(contactId));
            if (dealId) spSelf.set("dealId", String(dealId));
            if (propertyId) spSelf.set("propertyId", String(propertyId));
            if (quoteId) spSelf.set("quoteId", String(quoteId));
            if (invoiceId) spSelf.set("invoiceId", String(invoiceId));
            spSelf.set("paymentId", String(paymentIdParam));
            const oiReceiptUrl = `${baseNoSlash}/steps/07-receipt/insurance-report?${spSelf.toString()}`;
            await patchRequest(`/items/os_payments/${encodeURIComponent(String(paymentIdParam))}`, { oi_receipt_url: oiReceiptUrl });
        }
    } catch {}

    // Fetch additional data for the receipt display (same pattern as step 5)
    const [companyInfo, customerInfo, propertyInfo] = await Promise.allSettled([
        fetchCompanyInfo(),
        contactId ? fetchCustomerInfo(contactId) : (invoice?.contact ? fetchCustomerInfo(String(invoice.contact)) : null),
        propertyId ? fetchPropertyInfo(propertyId) : null,
    ]);

    // Extract results from Promise.allSettled
    const company = companyInfo.status === 'fulfilled' ? companyInfo.value : null;
    const customer = customerInfo.status === 'fulfilled' ? customerInfo.value : null;
    const property = propertyInfo.status === 'fulfilled' ? propertyInfo.value : null;

    // Prefer payment info from Directus os_payments
    let paidAmount: number | null = null;
    let paymentMethodSummary: string | null = null;
    let isPaid = false;
    let paymentIntentId: string | undefined = paymentIntentIdParam;

    // Attempt to load a specific os_payment if paymentId is provided
    let paymentRecord: any = null;
    let paymentIdLocal: string | undefined = undefined;
    if (paymentIdParam) {
        try {
            const byId = await getRequest<{ data: any }>(`/items/os_payments/${encodeURIComponent(String(paymentIdParam))}`);
            paymentRecord = (byId as any)?.data ?? null;
        } catch {}
    }
    // Attempt to load latest os_payment for this invoice if not found above
    if (!paymentRecord && invoiceId) {
        try {
            const payRes = await getRequest<{ data: any[] }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1`);
            paymentRecord = Array.isArray((payRes as any)?.data) && (payRes as any).data.length > 0 ? (payRes as any).data[0] : null;
        } catch {}
    }

    if (paymentRecord) {
        const amtNum = Number(paymentRecord.amount ?? 0);
        paidAmount = Number.isFinite(amtNum) ? amtNum : null;
        const statusStr = String(paymentRecord.status || "").toLowerCase();
        isPaid = statusStr === "paid" || statusStr === "success" || (paidAmount ?? 0) > 0;
        if (paymentRecord.card_type && paymentRecord.card_number) {
            paymentMethodSummary = `${String(paymentRecord.card_type).toUpperCase()} •••• ${String(paymentRecord.card_number)}`;
        } else if (paymentRecord.payment_method_type) {
            paymentMethodSummary = String(paymentRecord.payment_method_type).toUpperCase();
        }
    }
    if (paymentRecord) {
        if (!paymentIntentId) paymentIntentId = paymentRecord.stripe_payment_id;
        if (!paymentIdLocal) paymentIdLocal = paymentRecord.payment_id || undefined;
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

                        const amountNum = isPaid ? (pi.amount_received ?? pi.amount ?? 0) / 100 : 0;
                        const methodType = (pi.payment_method_types && pi.payment_method_types[0]) || (paymentMethodSummary ? "card" : undefined);

                        // Build internal receipt link
                        const base = (APP_BASE_URL || "").trim() || "http://localhost:8030";
                        const baseNoSlash = base.replace(/\/$/, "");
                        const buildReceiptLink = (paymentIdArg?: string) => {
                            const sp = new URLSearchParams();
                            // Standard order: userId > contactId > dealId > propertyId > quoteId > invoiceId
                            if (userId) sp.set("userId", String(userId));
                            if (contactId) sp.set("contactId", String(contactId));
                            if (dealId) sp.set("dealId", String(dealId));
                            if (propertyId) sp.set("propertyId", String(propertyId));
                            if (quoteId) sp.set("quoteId", String(quoteId));
                            if (invoice?.id) sp.set("invoiceId", String(invoice.id));
                            if (paymentIdArg) sp.set("paymentId", String(paymentIdArg));
                            return `${baseNoSlash}/steps/07-receipt/insurance-report?${sp.toString()}`;
                        };
                        const receiptLink = buildReceiptLink(paymentIdLocal);

                        // Prefer payment_id from Stripe metadata, otherwise derive from payment record numeric id after creation
                        const paymentIdFromMeta = typeof pi.metadata?.payment_id === "string" && pi.metadata.payment_id.trim() ? String(pi.metadata.payment_id).trim() : undefined;

                        const createBody: Record<string, unknown> = {
                            status: isPaid ? "paid" : "failed",
                            payment_date: paymentDateIso,
                            amount: amountNum,
                            stripe_payment_id: piId,
                            contact: invoice?.contact ?? undefined,
                            invoice: invoice?.id,
                            payment_method_type: methodType,
                            receipt_url: receiptUrl,
                            stripe_receipt_url: receiptLink,
                            metadata: { source: "insurance-report-receipt-ssr" },
                        };

                        if (paymentIdFromMeta) {
                            (createBody as any).payment_id = paymentIdFromMeta;
                            paymentIdLocal = paymentIdFromMeta;
                        }

                        const createdPay = await postRequest<{ data: any }>(`/items/os_payments`, createBody);
                        const createdPayment = (createdPay as any)?.data;
                        // After payment creation, change deal stage to PAYMENT_SUBMITTED if dealId available
                        try {
                            if (dealId && DEAL_STAGE_PAYMENT_SUBMITTED_ID) {
                                await patchRequest(`/items/os_deals/${encodeURIComponent(String(dealId))}`, {
                                    deal_stage: DEAL_STAGE_PAYMENT_SUBMITTED_ID,
                                });
                            }
                        } catch (err) {
                            try { console.warn('[insurance-report-receipt-ssr] failed to update deal stage to PAYMENT_SUBMITTED', err); } catch {}
                        }
                        if (!paymentIdFromMeta && createdPayment?.id) {
                            const baseNum = Number(createdPayment.id);
                            const derived = Number.isFinite(baseNum) ? String(100000 + baseNum) : undefined;
                            if (derived) {
                                try {
                                    await patchRequest(`/items/os_payments/${encodeURIComponent(String(createdPayment.id))}`, { payment_id: derived, stripe_receipt_url: buildReceiptLink(derived) });
                                    paymentIdLocal = derived;
                                } catch {}
                            }
                        }
                        // Reflect in-memory state to match Directus record
                        if (!paymentRecord) {
                            paymentRecord = {
                                status: "paid",
                                amount: amountNum,
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
        try { console.log("[invoice][insurance-report-receipt-ssr] Marking invoice paid (fallback)", { invoiceId, amountPaid: paidAmount }); } catch {}
        try {
            await patchRequest(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}`, { status: "paid", amount_paid: paidAmount ?? undefined });
        } catch {}
        try {
            await updateQuoteStatusToPaid(String(invoiceId));
        } catch {}
        try {
            await closeDealFromInvoice(String(invoiceId));
        } catch {}
    }

    const currency = "AUD";
    const total = Number(invoice?.total || 0);
    const amountPaid = paidAmount ?? Number(invoice?.amount_paid || (isPaid ? total : 0));

    const receiptNote = await getReceiptNote();

    return (
        <ReceiptPageClient
            invoiceId={String(invoice?.id)}
            propertyId={propertyId}
            userId={userId}
            contactId={contactId}
            dealId={dealId}
            quoteId={quoteId}
            serviceType="insurance_report"
        >
            <div className="container">
            <div className="card">
                <FormHeader
                    rightTitle="Receipt"
                    rightSubtitle="Insurance Report Inspection"
                    rightMeta={[
                        { label: "Invoice #", value: (invoice as any)?.invoice_id },
                        { label: "Date", value: new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date()) },
                    ]}
                />
                {receiptNote ? (
                    <NoteBox style={{ marginBottom: 16 }}>
                        {receiptNote}
                    </NoteBox>
                ) : null}
                {/* Removed secondary details under the header per request */}

                {/* Customer and Property Details (same style as step 5) */}
                <div className="receipt-details-section">
                    <div style={{ background: "var(--color-pale-gray)", padding: 16, borderRadius: 8 }}>
                        <h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)" }}>Bill To:</h3>
                        {customer ? (
                            <div style={{ lineHeight: 1.5 }}>
                                <div style={{ fontWeight: 600 }}>
                                    {customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Customer'}
                                </div>
                                {customer.email && <div>{customer.email}</div>}
                                {customer.phone && <div>{formatAustralianPhone(customer.phone)}</div>}
                                {customer.address && <div>{customer.address}</div>}
                            </div>
                        ) : (
                            <div style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>Customer information not available</div>
                        )}
                    </div>
                    <div style={{ background: "var(--color-pale-gray)", padding: 16, borderRadius: 8 }}>
                        <h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)" }}>Property Details:</h3>
                        <div style={{ lineHeight: 1.5 }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>Transaction ID</div>
                            <div style={{ color: "var(--color-text-secondary)" }}>
                                {paymentRecord?.transaction_id || paymentRecord?.stripe_payment_id || paymentIntentId || "-"}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Property Details - Full Width */}
                <div style={{ background: "var(--color-pale-gray)", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)" }}>Property Details:</h3>
                    {property ? (
                        <div style={{ lineHeight: 1.5 }}>
                            {/* Full Address - Single Column */}
                            <div style={{ marginBottom: 16 }}>
                                {(() => {
                                    const addressParts = [];
                                    if (property.street_address) addressParts.push(property.street_address);
                                    if (property.suburb) addressParts.push(property.suburb);
                                    if (property.state) addressParts.push(property.state);
                                    if (property.post_code) addressParts.push(property.post_code);
                                    return addressParts.join(', ');
                                })()}
                            </div>
                            {/* Property Details - Two Columns */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    {property.property_type && <div>Type: {property.property_type}</div>}
                                    {property.number_of_bedrooms && <div>Bedrooms: {property.number_of_bedrooms}</div>}
                                    {property.number_of_levels && <div>Levels: {property.number_of_levels}</div>}
                                </div>
                                <div>
                                    {property.property_category && <div>Category: {property.property_category}</div>}
                                    {property.number_of_bathrooms && <div>Bathrooms: {property.number_of_bathrooms}</div>}
                                    {property.basement && <div>Basement: Yes</div>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>Property information not available</div>
                    )}
                </div>

                {/* Receipt Section */}
                {paymentRecord?.receipt_url && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontWeight: 600 }}>Receipt</div>
                        <div>
                            <a href={String(paymentRecord.receipt_url)} target="_blank" rel="noreferrer" style={{ color: "var(--color-link)" }}>View Stripe Receipt</a>
                        </div>
                    </div>
                )}

                <div style={{ borderTop: "1px solid var(--color-light-gray)", paddingTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <span style={{ color: "var(--color-text-secondary)" }}>Amount Paid</span>
                        <span style={{ fontWeight: 600, color: "var(--color-success)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency }).format(amountPaid)}</span>
                    </div>
                    {/* Status row removed from totals */}
                </div>
            </div>
        </ReceiptPageClient>
    );
}


