"use server";

import { getRequest, postRequest, patchRequest } from "@/lib/http/fetcher";
import { APP_BASE_URL, PROPOSAL_EXPIRY_DAYS, PROPOSAL_NAME, PROPOSAL_STATUS, DEAL_STAGE_QUOTE_SUBMITTED_ID } from "@/lib/env";
import { getStepUrl, getServiceType } from "@/lib/config/service-routing";

type DirectusItemResponse<T> = { data: T };

export type QuoteCreateInput = {
	deal: string | number;
	contact: string | number;
	property: string | number;
	service: number;
	service_code: string;
	property_category: "residential" | "commercial";
	amount: number;
	inspection_amount?: number;
	currency?: string;
	note?: string | null;
	stage_prices?: unknown | null;
	status?: string;
};

export type QuoteRecord = QuoteCreateInput & { id: string | number };

export async function createQuote(data: QuoteCreateInput): Promise<QuoteRecord> {
	const payload: Record<string, unknown> = {
		...data,
		currency: data.currency || "AUD",
		status: data.status || "generated",
		inspection_amount: data.inspection_amount ?? data.amount,
	};

	const res = await postRequest<DirectusItemResponse<QuoteRecord>>(
		"/items/os_quotes",
		payload
	);
	return (res as any)?.data as QuoteRecord;
}

export type ProposalRecord = {
	id: string | number;
	name: string;
	deal: string | number;
	contact?: string | number;
	status: string;
	expiration_date: string;
	note?: string | null;
	quote_amount: number;
	quote_id?: string;
};

function generateQuoteId(): string {
	const random = Math.floor(100000 + Math.random() * 900000);
	return String(random);
}

export async function createProposal(params: {
	dealId: string | number;
	contactId?: string | number;
	propertyId?: string | number;
	amount: number;
	note?: string | null;
	userId?: string | number;
}): Promise<ProposalRecord> {
	// Change deal stage to "Quote Submitted" before any other actions
	try {
		if (DEAL_STAGE_QUOTE_SUBMITTED_ID) {
			await patchRequest(`/items/os_deals/${encodeURIComponent(String(params.dealId))}`, {
				deal_stage: DEAL_STAGE_QUOTE_SUBMITTED_ID,
			});
		}
	} catch (err) {
		try { console.warn("[createProposal] failed to update deal stage to QUOTE_SUBMITTED", err); } catch {}
	}

	// For dilapidation services, update deal with individual property prices (excluding GST)
	try {
		console.log("[createProposal] Checking for dilapidation service", { propertyId: params.propertyId });
		if (params.propertyId) {
			// Check if this is a dilapidation service
			const dealRes = await getRequest<{ data: { service?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(params.dealId))}?fields=service`);
			const serviceId = (dealRes as any)?.data?.service;
			console.log("[createProposal] Deal service ID:", serviceId);
			
			if (serviceId) {
				const serviceRes = await getRequest<{ data: { service_type?: string } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=service_type`);
				const serviceType = (serviceRes as any)?.data?.service_type;
				console.log("[createProposal] Service type:", serviceType);
				
				if (serviceType === "dilapidation") {
					console.log("[createProposal] Processing dilapidation property prices");
					
					// Get property IDs
					const propertyIds = String(params.propertyId).split(",").filter((id: string) => id.trim());
					
					// Get individual property estimates and calculate prices
					const propertyPriceUpdates: Record<string, string> = {};
					
					for (let i = 0; i < propertyIds.length; i++) {
						const propId = propertyIds[i].trim();
						const priceField = i === 0 ? 'price' : `price${i + 1}`;
						
						try {
							// Get property details for estimation
							const propRes = await getRequest<{ data: any }>(`/items/property/${encodeURIComponent(propId)}`);
							const property = (propRes as any)?.data;
							
							if (property) {
								// Call estimation API (same as in quote generation)
								const estimatePayload = {
									service: "dilapidation",
									property_category: property.property_category || "residential",
									bedrooms: property.number_of_bedrooms || 0,
									bathrooms: property.number_of_bathrooms || 0,
									levels: property.number_of_levels || 0,
									basement: Boolean(property.basement)
								};
								
								// Make estimation call to get individual property price
								const estimateRes = await postRequest<{ quote_price?: number }>("/api/v1/quotes/estimate", estimatePayload);
								const propertyPrice = Number(estimateRes?.quote_price || 0);
								
								if (propertyPrice > 0) {
									propertyPriceUpdates[priceField] = `${propertyPrice} (excluding GST)`;
									console.log(`[createProposal] ${priceField} = ${propertyPrice} (excluding GST, from ratesheet engine)`);
								}
							}
						} catch (propError) {
							console.warn(`[createProposal] Failed to get price for property ${propId}:`, propError);
						}
					}
					
					// Update deal with property prices
					if (Object.keys(propertyPriceUpdates).length > 0) {
						await patchRequest(`/items/os_deals/${encodeURIComponent(String(params.dealId))}`, propertyPriceUpdates);
						console.log("[createProposal] Successfully updated deal with property prices:", propertyPriceUpdates);
					}
				}
			}
		}
	} catch (error) {
		console.error('[createProposal] Failed to update deal with property prices:', error);
		// Don't fail the proposal creation if property price update fails
	}
	const now = new Date();
	const expiry = new Date(now.getTime() + Math.max(1, PROPOSAL_EXPIRY_DAYS || 7) * 24 * 60 * 60 * 1000);
	let contactIdStr: string | undefined = params.contactId !== undefined ? String(params.contactId) : undefined;
	if (!contactIdStr) {
		try {
			const dealRes = await getRequest<{ data: { contact?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(params.dealId))}?fields=contact`);
			const dContact = (dealRes as any)?.data?.contact;
			if (dContact) contactIdStr = String(dContact);
		} catch {}
	}

	console.log("[createProposal] Input params", {
		dealId: params.dealId,
		contactId: contactIdStr || params.contactId,
		propertyId: params.propertyId,
		amount: params.amount,
		note: params.note,
		userId: params.userId,
	});
	const payload = {
		name: PROPOSAL_NAME,
		deal: String(params.dealId),
		...(contactIdStr ? { contact: contactIdStr } : {}),
		...(params.userId !== undefined ? { user: String(params.userId) } : {}),
		status: PROPOSAL_STATUS,
		expiration_date: expiry.toISOString(),
		note: params.note || "Proposal subject to confirmation. Final terms will be outlined in the agreement.",
		quote_amount: params.amount,
		inspection_amount: params.amount,
	};
	console.log("[createProposal] POST /items/os_proposals payload", payload);
	const res = await postRequest<{ data: ProposalRecord }>("/items/os_proposals", payload);
	const created = (res as any)?.data as ProposalRecord;
	console.log("[createProposal] Created proposal response", created);

	// After creation, patch the proposal with a full quote URL (quote_link)
	try {
		const base = (() => {
			const envUrl = (APP_BASE_URL || "").trim();
			if (envUrl) return envUrl.replace(/\/$/, "");
			const vercelUrl = (process.env.VERCEL_URL || "").trim();
			if (vercelUrl) return `https://${vercelUrl.replace(/\/$/, "")}`;
			const host = (process.env.HOST || "localhost").trim();
			const port = (process.env.PORT || "3000").trim();
			const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
			return `${protocol}://${host}${port ? `:${port}` : ""}`.replace(/\/$/, "");
		})();
		
		// Get service type for service-specific routing
		let serviceType = "generic";
		try {
			const dealRes = await getRequest<{ data: { service?: string | number } }>(`/items/os_deals/${encodeURIComponent(String(params.dealId))}?fields=service`);
			if (dealRes?.data?.service) {
				serviceType = getServiceType(Number(dealRes.data.service));
			}
		} catch (e) {
			console.warn("[createProposal] Failed to get service type for routing", e);
		}
		
		const urlParams = new URLSearchParams();
		// Standard order for step 4 links: contactId, dealId, propertyId, quoteId
		if (params.contactId !== undefined) urlParams.set("contactId", String(params.contactId));
		if (params.dealId !== undefined) urlParams.set("dealId", String(params.dealId));
		if (params.propertyId !== undefined) urlParams.set("propertyId", String(params.propertyId));
		urlParams.set("quoteId", String(created.id));
		
		// Add userId if available
		if (params.userId !== undefined) urlParams.set("userId", String(params.userId));
		
		// Add serviceType for proper routing
		urlParams.set("serviceType", serviceType);
		
		// Use service-specific routing for the quote URL
		const quotePath = getStepUrl(4, serviceType);
		const fullUrl = `${base}${quotePath}?${urlParams.toString()}`;
		const baseId = Number(created.id);
		const sequentialId = Number.isFinite(baseId) ? String(100000 + baseId) : String(Math.floor(100000 + Math.random() * 900000));
		
		await patchRequest(`/items/os_proposals/${encodeURIComponent(String(created.id))}`, { quote_link: fullUrl, quote_id: sequentialId });
	} catch (_e) {
		console.error("[createProposal] Error in URL generation or patching:", _e);
		// Ignore patch failures; proposal was created successfully
	}

	return created;
}
