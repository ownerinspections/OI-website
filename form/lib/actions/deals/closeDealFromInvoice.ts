"use server";

import { getRequest } from "@/lib/http/fetcher";
import { updateDeal } from "@/lib/actions/deals/updateDeal";
import { DEAL_STAGE_CLOSED_WON_ID } from "@/lib/env";

type DirectusItemResponse<T> = { data: T };

type InvoiceRecord = {
    id: string | number;
    proposal?: Array<string | number> | null;
};

type ProposalRecord = {
    id: string | number;
    deal?: string | number | null;
};

/**
 * Given an invoice id, find related proposal(s) and update their linked deal(s)
 * to have deal_stage = "Closed - Won".
 *
 * Safe to call multiple times; it simply patches the target stage.
 */
export async function closeDealFromInvoice(invoiceId: string | number): Promise<void> {
    if (!invoiceId) return;

    // Fetch the invoice with proposal ids
    let invoice: InvoiceRecord | null = null;
    try {
        const res = await getRequest<DirectusItemResponse<InvoiceRecord>>(`/items/os_invoices/${encodeURIComponent(String(invoiceId))}?fields=id,proposal`);
        invoice = (res as any)?.data ?? null;
    } catch {
        invoice = null;
    }
    if (!invoice) return;

    const proposalIds: Array<string | number> = Array.isArray(invoice.proposal) ? invoice.proposal : [];
    if (!proposalIds.length) return;

    // For each proposal, retrieve its linked deal and patch the stage
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

            try {
                await updateDeal(dealId, { deal_stage: String(stageId) });
            } catch {
                // swallow to keep idempotent behavior
            }
        })
    );
}


