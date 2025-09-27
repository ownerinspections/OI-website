"use server";

import { getRequest, patchRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

type InvoiceRecord = {
    id: string | number;
    proposal?: Array<string | number> | null;
};

/**
 * Updates the status of all proposals/quotes linked to an invoice to "paid"
 * This should be called when an invoice is marked as paid to ensure quote status is also updated
 * 
 * @param invoiceId - The ID of the invoice that was paid
 */
export async function updateQuoteStatusToPaid(invoiceId: string | number): Promise<void> {
    if (!invoiceId) return;

    try {
        // Fetch the invoice with proposal ids
        const res = await getRequest<DirectusItemResponse<InvoiceRecord>>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=id,proposal`);
        const invoice = (res as any)?.data ?? null;
        
        if (!invoice) {
            console.warn("[updateQuoteStatusToPaid] Invoice not found:", invoiceId);
            return;
        }

        const proposalIds: Array<string | number> = Array.isArray(invoice.proposal) ? invoice.proposal : [];
        
        if (!proposalIds.length) {
            console.log("[updateQuoteStatusToPaid] No proposals linked to invoice:", invoiceId);
            return;
        }

        // Update each proposal status to "paid"
        await Promise.all(
            proposalIds.map(async (proposalId) => {
                if (!proposalId) return;
                
                try {
                    console.log("[updateQuoteStatusToPaid] Updating proposal status to paid:", { proposalId, invoiceId });
                    await patchRequest(`/items/os_proposals/${encodeURIComponent(String(proposalId))}`, { 
                        status: "paid" 
                    });
                } catch (err) {
                    console.error("[updateQuoteStatusToPaid] Error updating proposal:", { proposalId, error: err });
                    // Continue with other proposals even if one fails
                }
            })
        );

        console.log("[updateQuoteStatusToPaid] Successfully updated proposal statuses for invoice:", invoiceId);
    } catch (err) {
        console.error("[updateQuoteStatusToPaid] Error processing invoice:", { invoiceId, error: err });
        // Don't throw - this should be a non-critical operation that doesn't break payment flow
    }
}
