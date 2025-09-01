"use server";

import { postFormRequest } from "@/lib/http/fetcher";
import { VERIFY_SERVICE_SID, VERIFY_SANDBOX_ENABLED, VERIFY_SANDBOX_CODE } from "@/lib/env";
import { updateContact } from "@/lib/actions/contacts/updateContact";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getProperty } from "@/lib/actions/properties/getProperty";
import { getServiceById } from "@/lib/actions/services/getService";
import { postRequest } from "@/lib/http/fetcher";
import { getRequest } from "@/lib/http/fetcher";
import { createProposal } from "@/lib/actions/quotes/createQuote";

export type VerifyCodeResult = {
	success?: boolean;
	errors?: { code?: string; phone?: string };
	message?: string;
	next?: { step?: string; quoteId?: string | number; propertyId?: string | number; service_code?: string; amount?: number };
};

export async function submitVerifyCode(_prev: VerifyCodeResult, formData: FormData): Promise<VerifyCodeResult> {
	const phone = String(formData.get("phone") ?? "").trim();
	const code = String(formData.get("code") ?? "").trim();
	const contact_id = String(formData.get("contact_id") ?? "").trim();
	const deal_id = String(formData.get("deal_id") ?? "").trim();
	const property_id = String(formData.get("property_id") ?? "").trim();

	console.log("[submitVerifyCode] input", { phone, code_len: code.length, has_contact: !!contact_id, deal_id, property_id, sandbox: VERIFY_SANDBOX_ENABLED });
	if (!phone || !/^\+61\d{9}$/.test(phone)) return { success: false, errors: { phone: "Phone is not valid" } };
	if (!code || !/^\d{4,8}$/.test(code)) return { success: false, errors: { code: "Enter the code we sent you" } };

	// Sandbox path: accept configured code and skip network
	if (VERIFY_SANDBOX_ENABLED) {
		if (code === VERIFY_SANDBOX_CODE) {
			console.log("[submitVerifyCode] sandbox approved");
			const result = await handlePostVerification({ contact_id, deal_id, property_id });
			console.log("[submitVerifyCode] post verification result", result);
			return result;
		}
		return { success: false, errors: { code: "Invalid or expired code" } };
	}

	if (!VERIFY_SERVICE_SID) return { success: false, errors: { code: "Missing VERIFY_SERVICE_SID" } };
	try {
		const path = `/verify/Services/${encodeURIComponent(VERIFY_SERVICE_SID)}/VerificationCheck`;
		const res = await postFormRequest<{ status?: string; valid?: boolean }>(path, { To: phone, Code: code });
		console.log("[submitVerifyCode] twilio response", res);
		if (res && (res.valid === true || res.status === "approved")) {
			const result = await handlePostVerification({ contact_id, deal_id, property_id });
			console.log("[submitVerifyCode] post verification result", result);
			return result;
		}
		return { success: false, errors: { code: "Invalid or expired code" } };
	} catch (_e) {
		console.error("[submitVerifyCode] error", _e);
		return { success: false, errors: { code: "Invalid or expired code" } };
	}
}

type PostVerifyContext = { contact_id?: string; deal_id?: string; property_id?: string };

async function handlePostVerification({ contact_id, deal_id, property_id }: PostVerifyContext): Promise<VerifyCodeResult> {
	try {
		if (contact_id) {
			console.log("[handlePostVerification] publishing contact", { contact_id });
			await updateContact(contact_id, { status: "published" });
		}

		// Ensure we have a deal id; if missing, try to resolve latest by contact
		let effectiveDealId: string | undefined = deal_id || undefined;
		if (!effectiveDealId && contact_id) {
			try {
				const encodedContact = encodeURIComponent(String(contact_id));
				const res = await getRequest<{ data: any[] }>(`/items/os_deals?filter%5Bcontact%5D%5B_eq%5D=${encodedContact}&sort=-date_created&limit=1`);
				const latestDeal = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
				effectiveDealId = latestDeal?.id ? String(latestDeal.id) : undefined;
				if (effectiveDealId) console.log("[handlePostVerification] resolved latest deal by contact", { effectiveDealId });
			} catch (err) {
				console.warn("[handlePostVerification] failed to resolve deal by contact", err);
			}
		}

		// Proceed as long as we have a deal id; property/service enrich estimate but are not mandatory to create proposal
		if (!effectiveDealId) {
			console.warn("[handlePostVerification] missing deal id; cannot create proposal");
			return { success: true };
		}

		const deal = await getDeal(effectiveDealId);
		const serviceId = (deal?.service as unknown as number) || undefined;

		const effectivePropertyId: string | undefined = property_id || (deal?.property ? String((deal as any).property) : undefined);
		const property = effectivePropertyId ? await getProperty(effectivePropertyId) : null;
		const service = serviceId ? await getServiceById(serviceId) : null;

		const property_category = ((property as any)?.property_category as "residential" | "commercial") || "residential";

		// Map service -> service_code for rate engine
		const service_code = service ? (service.service_type || service.service_name || "").toString() : "";

		// Prepare payload for rate engine
		const estimatePayload: Record<string, unknown> = {
			service: service_code,
			property_category,
			bedrooms: (property as any)?.number_of_bedrooms || 0,
			bathrooms: (property as any)?.number_of_bathrooms || 0,
			levels: (property as any)?.number_of_levels || 0,
			basement: Boolean((property as any)?.basement),
		};

		type EstimateResponse = { stage_prices: unknown | null; quote_price: number; note?: string | null };
		let estimate: EstimateResponse | null = null;
		try {
			if (service_code) {
				console.log("[handlePostVerification] estimating", estimatePayload);
				estimate = await postRequest<EstimateResponse>("/api/v1/quotes/estimate", estimatePayload);
				console.log("[handlePostVerification] estimate response", estimate);
			} else {
				console.warn("[handlePostVerification] skipping estimate due to missing service_code");
			}
		} catch (err) {
			console.error("[handlePostVerification] estimate failed", err);
		}

		// Skip creating os_quotes due to permissions; proposals are created below

		// Always create proposal using the best available amount
		let proposal: any = null;
		try {
			proposal = await createProposal({
				dealId: String(effectiveDealId),
				contactId: contact_id,
				propertyId: effectivePropertyId,
				amount: (estimate?.quote_price ?? 0) as number,
				note: (estimate?.note as string) || undefined,
			});
			console.log("[handlePostVerification] created proposal", { id: proposal?.id, amount: proposal?.quote_amount });
		} catch (err) {
			console.error("[handlePostVerification] proposal creation failed, attempting to fetch latest", err);
		}

		// Ensure we have a proposal id; if missing, fetch latest for the deal
		if (!proposal || !proposal.id) {
			try {
				const encodedDeal = encodeURIComponent(String(effectiveDealId));
				const res = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodedDeal}&sort=-date_created&limit=1`);
				proposal = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
				if (proposal) console.log("[handlePostVerification] using latest proposal", { id: proposal?.id });
			} catch (inner) {
				console.error("[handlePostVerification] failed to fetch latest proposal", inner);
			}
		}

		return { success: true, next: { step: "04-quote", quoteId: proposal?.id, propertyId: effectivePropertyId, service_code, amount: estimate?.quote_price ?? 0 } };
	} catch (_e) {
		console.error("[handlePostVerification] error", _e);
		try {
			if (deal_id) {
				const encodedDeal = encodeURIComponent(String(deal_id));
				const res = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodedDeal}&sort=-date_created&limit=1`);
				const latest = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
				if (latest) return { success: true, next: { step: "04-quote", quoteId: latest.id } };
			}
		} catch {}
		return { success: true };
	}
}
