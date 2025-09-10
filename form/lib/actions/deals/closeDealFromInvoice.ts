"use server";

import { getRequest } from "@/lib/http/fetcher";
import { updateDeal } from "@/lib/actions/deals/updateDeal";
import { DEAL_STAGE_CLOSED_WON_ID } from "@/lib/env";

type DirectusItemResponse<T> = { data: T };

type InvoiceRecord = {
    id: string | number;
    proposal?: Array<string | number> | null;
    total?: number;
    amount_paid?: number;
};

type ProposalRecord = {
    id: string | number;
    deal?: string | number | null;
};

/**
 * Given an invoice id, find related proposal(s) and update their linked deal(s)
 * to have deal_stage = "Closed - Won", deal_value = invoice total, and close_date = payment date.
 *
 * Safe to call multiple times; it simply patches the target stage and values.
 */
export async function closeDealFromInvoice(invoiceId: string | number): Promise<void> {
    if (!invoiceId) return;

    // Fetch the invoice with proposal ids, total, and amount_paid
    let invoice: InvoiceRecord | null = null;
    try {
        const res = await getRequest<DirectusItemResponse<InvoiceRecord>>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=id,proposal,total,amount_paid`);
        invoice = (res as any)?.data ?? null;
    } catch {
        invoice = null;
    }
    if (!invoice) return;

    const proposalIds: Array<string | number> = Array.isArray(invoice.proposal) ? invoice.proposal : [];
    if (!proposalIds.length) return;

    // Get payment date from the latest successful payment for this invoice
    let paymentDate: string | undefined = undefined;
    try {
        // First try to get successful payments
        const paymentRes = await getRequest<{ data: Array<{ payment_date?: string; status?: string }> }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&filter[status][_eq]=success&sort=-date_created&limit=1&fields=payment_date,status`);
        const payments = Array.isArray((paymentRes as any)?.data) ? (paymentRes as any).data : [];
        
        if (payments.length > 0 && payments[0].payment_date) {
            paymentDate = payments[0].payment_date;
        } else {
            // Fallback: get any payment record for this invoice
            const anyPaymentRes = await getRequest<{ data: Array<{ payment_date?: string; status?: string }> }>(`/items/os_payments?filter[invoice][_eq]=${encodeURIComponent(String(invoiceId))}&sort=-date_created&limit=1&fields=payment_date,status`);
            const anyPayments = Array.isArray((anyPaymentRes as any)?.data) ? (anyPaymentRes as any).data : [];
            
            if (anyPayments.length > 0 && anyPayments[0].payment_date) {
                paymentDate = anyPayments[0].payment_date;
            }
        }
    } catch (err) {
        console.log("[closeDealFromInvoice] Error fetching payment date:", err);
        // If we can't get payment date, use current date as fallback
        paymentDate = new Date().toISOString();
    }

    // Determine deal value from invoice total or amount_paid
    const rawDealValue = invoice.amount_paid && invoice.amount_paid > 0 ? invoice.amount_paid : invoice.total;
    // Convert to number, handling string values
    const dealValue = typeof rawDealValue === 'string' ? parseFloat(rawDealValue) : Number(rawDealValue);
    console.log("[closeDealFromInvoice] Processing invoice:", { 
        invoiceId, 
        dealValue, 
        paymentDate 
    });

    // For each proposal, retrieve its linked deal and patch the stage, value, and close date
    await Promise.all(
        proposalIds.map(async (pid) => {
            if (!pid) return;
            let proposal: ProposalRecord | null = null;
            try {
                const res = await getRequest<DirectusItemResponse<ProposalRecord>>(`/items/os_proposals/${encodeURIComponent(String(pid))}?fields=id,deal`);
                proposal = (res as any)?.data ?? null;
            } catch {
                proposal = null;
            }
            const dealId = proposal?.deal;
            if (!dealId) return;
            // Resolve stage id: prefer env override; else query stage by name
            let stageId: string | number | null = DEAL_STAGE_CLOSED_WON_ID || null;
            if (!stageId) {
                try {
                    const stageRes = await getRequest<{ data: Array<{ id: string | number; name?: string }> }>(`/items/os_deal_stages?filter[name][_eq]=${encodeURIComponent("Closed - Won")}&limit=1&fields=id,name`);
                    const list = Array.isArray((stageRes as any)?.data) ? (stageRes as any).data : [];
                    if (list.length > 0) stageId = list[0].id;
                } catch {}
            }
            // Fallback: if still no id, do nothing to avoid 500
            if (!stageId) return;

            // Prepare deal update data
            const dealUpdateData: any = { deal_stage: String(stageId) };
            
            // Add deal_value if we have a valid amount
            if (dealValue && Number.isFinite(dealValue) && dealValue > 0) {
                dealUpdateData.deal_value = dealValue;
            }
            
            // Add close_date if we have a payment date
            if (paymentDate) {
                dealUpdateData.close_date = paymentDate;
            }

            console.log("[closeDealFromInvoice] Updating deal:", { dealId, dealUpdateData });

            try {
                await updateDeal(dealId, dealUpdateData);
            } catch (err) {
                console.log("[closeDealFromInvoice] Error updating deal:", err);
                // swallow to keep idempotent behavior
            }
        })
    );
}


