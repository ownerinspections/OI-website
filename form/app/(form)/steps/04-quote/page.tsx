import QuotesForm from "@/components/quotes/QuotesForm";
import { getQuote } from "@/lib/actions/quotes/getQuote";
import { getRequest } from "@/lib/http/fetcher";
import { patchRequest } from "@/lib/http/fetcher";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getServiceById } from "@/lib/actions/services/getService";
import { getProperty } from "@/lib/actions/properties/getProperty";
import { createProposal } from "@/lib/actions/quotes/createQuote";
import { postRequest } from "@/lib/http/fetcher";
import { redirect } from "next/navigation";
import { getQuoteNote } from "@/lib/actions/globals/getGlobal";
import { PROPOSAL_EXPIRY_DAYS } from "@/lib/env";
import FormHeader from "@/components/ui/FormHeader";
import { fetchGstRate } from "@/lib/actions/invoices/createInvoice";
import { getStepUrl, getServiceType, getRouteTypeFromServiceType } from "@/lib/config/service-routing";
import { estimateQuoteByServiceType, type PropertyDetails } from "@/lib/actions/quotes/estimateQuote";

export default async function StepQuote({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;

	if (!dealId || !contactId || !propertyId || !userId) {
		redirect('/not-found');
	}

	// Note: Service-specific routing is now handled by the phone verification step
	// This page is only used as a fallback for generic services or when accessed directly

	// Server-side trace for debugging user linkage
	console.log("[StepQuote] Params parsed", { userId, quoteId, dealId, contactId, propertyId, invoiceId });

	let proposal: any = null;
	if (quoteId) {
		try {
			const res = await getRequest<{ data: any }>(`/items/os_proposals/${quoteId}`);
			proposal = (res as any)?.data ?? null;
		} catch (_e) {
			proposal = null;
		}
	} else if (dealId) {
		// Fallback: fetch latest proposal for this deal
		try {
			const encodedDeal = encodeURIComponent(String(dealId));
			const res = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodedDeal}&sort=-date_created&limit=1`);
			proposal = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
		} catch (_e) {
			proposal = null;
		}
	} else if (contactId && !dealId) {
		// Last resort: resolve most recent deal by contact
		try {
			const encodedContact = encodeURIComponent(String(contactId));
			const res = await getRequest<{ data: any[] }>(`/items/os_deals?filter%5Bcontact%5D%5B_eq%5D=${encodedContact}&sort=-date_created&limit=1`);
			const latestDeal = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
			if (latestDeal?.id) {
				const encodedDeal = encodeURIComponent(String(latestDeal.id));
				const resProp = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodedDeal}&sort=-date_created&limit=1`);
				proposal = Array.isArray((resProp as any)?.data) && (resProp as any).data.length > 0 ? (resProp as any).data[0] : null;
			}
		} catch (_e) {
			proposal = null;
		}
	}

	// If we have a proposal loaded and a userId in URL but proposal.user is missing, patch it now
	if (proposal && userId && !(proposal as any)?.user) {
		try {
			console.log("[StepQuote] Patching proposal user", { proposalId: (proposal as any)?.id, userId });
			await patchRequest(`/items/os_proposals/${encodeURIComponent(String((proposal as any).id))}`, { user: String(userId) });
			console.log("[StepQuote] Patched proposal user successfully");
		} catch (err) {
			console.warn("[StepQuote] Failed to patch proposal user", err);
		}
	}

	// If quoteId exists in URL, call estimate API to get updated pricing
	if (quoteId && proposal && dealId) {
		try {
			const deal = await getDeal(dealId);
			const svcId = deal?.service as any;
			const service = svcId ? await getServiceById(svcId) : null;
			const propId = propertyId || (deal?.property ? String(deal.property) : undefined);
			const property = propId ? await getProperty(propId) : null;
			
			if (service?.service_type && property) {
				const propertyDetails: PropertyDetails = {
					property_category: (property?.property_category as any) || "residential",
					bedrooms: (property as any)?.number_of_bedrooms || 0,
					bathrooms: (property as any)?.number_of_bathrooms || 0,
					levels: (property as any)?.number_of_levels || 0,
					basement: Boolean((property as any)?.basement),
					stages: (property as any)?.stages || [],
					area_sq: (property as any)?.area_sq || 0,
					estimated_damage_loss: (property as any)?.estimated_damage_loss || 0,
				};
				
				console.log("[StepQuote] Calling estimate API for existing quote", { quoteId, serviceType: service.service_type });
				const estimate = await estimateQuoteByServiceType(service.service_type, propertyDetails);
				
				if (estimate && estimate.quote_price > 0) {
					// For existing quotes, we don't update the proposal amount as QuotesForm handles addon calculations
					// We only update the note if provided
					if (estimate.note) {
						console.log("[StepQuote] Updating proposal note with new estimate", { quoteId, note: estimate.note });
						try {
							await patchRequest(`/items/os_proposals/${encodeURIComponent(String(quoteId))}`, { note: estimate.note });
							console.log("[StepQuote] Proposal note updated successfully");
							proposal.note = estimate.note;
						} catch (updateError) {
							console.warn("[StepQuote] Failed to update proposal note:", updateError);
						}
					}
					
					// Store the base estimate for QuotesForm to use in calculations
					// The QuotesForm component will handle addon calculations dynamically
					console.log("[StepQuote] Base estimate received", { quoteId, baseAmount: estimate.quote_price });
				}
			}
		} catch (error) {
			console.warn("[StepQuote] Failed to estimate quote for existing proposal:", error);
		}
	}

	// If still no proposal, attempt to create one now using rate estimate
	if (!proposal && dealId) {
		const deal = await getDeal(dealId);
		const svcId = deal?.service as any;
		const service = svcId ? await getServiceById(svcId) : null;
		const propId = propertyId || (deal?.property ? String(deal.property) : undefined);
		const property = propId ? await getProperty(propId) : null;
		const property_category = (property?.property_category as any) || "residential";
		const service_code = service ? (service.service_type || service.service_name || "").toString() : "";
		let amount = 0;
		let note: string | undefined = undefined;
		if (service_code) {
			const payload = {
				service: service_code,
				property_category,
				bedrooms: (property as any)?.number_of_bedrooms || 0,
				bathrooms: (property as any)?.number_of_bathrooms || 0,
				levels: (property as any)?.number_of_levels || 0,
				basement: Boolean((property as any)?.basement),
			};
			try {
				const estimate = await postRequest<{ stage_prices: any; quote_price: number; note?: string }>("/api/v1/quotes/estimate", payload);
				amount = estimate?.quote_price ?? 0;
				note = estimate?.note || undefined;
			} catch {}
		}
		console.log("[StepQuote] Creating proposal with", { dealId, contactId, propertyId, amount, note, userId });
		const created = await createProposal({ dealId, contactId, propertyId, amount, note, userId });
		console.log("[StepQuote] Proposal created", { id: (created as any)?.id, created });
		// After creating the proposal (quote), redirect to include quoteId in URL
		const paramsOut = new URLSearchParams();
		// Standard order: userId, contactId, dealId, propertyId, quoteId
		if (userId) paramsOut.set("userId", String(userId));
		if (contactId) paramsOut.set("contactId", String(contactId));
		if (dealId) paramsOut.set("dealId", String(dealId));
		if (propertyId) paramsOut.set("propertyId", String(propertyId));
		paramsOut.set("quoteId", String(created.id));
		redirect(`/steps/04-quote?${paramsOut.toString()}`);
	}

	// Final fallback: if still no proposal and we have a deal, create a minimal proposal
	if (!proposal && dealId) {
		console.log("[StepQuote] Creating minimal proposal with", { dealId, contactId, propertyId, userId });
		const created = await createProposal({ dealId, contactId, propertyId, amount: 0, note: undefined, userId });
		console.log("[StepQuote] Minimal proposal created", { id: (created as any)?.id, created });
		const paramsOut = new URLSearchParams();
		// Standard order: userId, contactId, dealId, propertyId, quoteId
		if (userId) paramsOut.set("userId", String(userId));
		if (contactId) paramsOut.set("contactId", String(contactId));
		paramsOut.set("dealId", String(dealId));
		if (propertyId) paramsOut.set("propertyId", String(propertyId));
		paramsOut.set("quoteId", String(created.id));
		redirect(`/steps/04-quote?${paramsOut.toString()}`);
	}

	let serviceLabel: string | undefined = undefined;
	let serviceId: number | undefined = undefined;
	let dealPropertyId: string | undefined = undefined;
	let preselectedAddonIds: number[] = [];
	if (dealId) {
		try {
			const deal = await getDeal(dealId);
			if (deal?.service) {
				serviceId = Number(deal.service);
				const service = await getServiceById(deal.service);
				serviceLabel = service?.service_name || service?.service_type || undefined;
			}
			if (deal?.property) {
				dealPropertyId = String(deal.property);
			}
			// Extract any previously selected addons on the deal for pre-selection
			if (Array.isArray((deal as any)?.addons)) {
				preselectedAddonIds = ((deal as any).addons as any[])
					.map((x) => Number(x))
					.filter((n) => Number.isFinite(n));
			}
		} catch {
			// ignore
		}
	}

	// If we have a proposal, also check for addons on the proposal itself
	if (proposal && Array.isArray((proposal as any)?.addons)) {
		const proposalAddonIds = ((proposal as any).addons as any[])
			.map((x) => Number(x))
			.filter((n) => Number.isFinite(n));
		// Merge proposal addons with deal addons (proposal takes precedence)
		preselectedAddonIds = [...new Set([...preselectedAddonIds, ...proposalAddonIds])];
	}

	// Fetch service addons (ids) then resolve addon details (name, price)
	let addons: Array<{ id: number; name: string; price: number }> = [];
	if (serviceId) {
		try {
			const svcRes = await getRequest<{ data: { id: number; service_name: string; addons?: number[] } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=id,service_name,addons`);
			const addonIds = Array.isArray((svcRes as any)?.data?.addons) ? ((svcRes as any).data.addons as number[]) : [];
			if (addonIds.length > 0) {
				const idsCsv = addonIds.join(",");
				const addonsRes = await getRequest<{ data: any[] }>(`/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}`);
				addons = ((addonsRes as any)?.data ?? []).map((a: any) => ({
					id: Number(a.id),
					name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
					price: Number(a.price ?? a.amount ?? 0),
				}));
			}
		} catch {
			// ignore addons on failure
		}
	}

	// Debug logging for addon loading
	console.log("[StepQuote] Addon loading debug", {
		serviceId,
		addonsCount: addons.length,
		preselectedAddonIds,
		dealId,
		quoteId,
		hasProposal: !!proposal
	});

	// Resolve property termite risk (from query param or deal property)
	let termiteRisk: string | undefined = undefined;
	let termiteRiskReason: string | undefined = undefined;
	const resolvedPropertyId = propertyId || dealPropertyId;
	if (resolvedPropertyId) {
		try {
			const prop = await getProperty(resolvedPropertyId);
			termiteRisk = (prop as any)?.termite_risk || undefined;
			termiteRiskReason = (prop as any)?.termite_risk_reason || undefined;
		} catch {
			// ignore termite
		}
	}

	const viewModel = proposal
		? (() => {
				const createdAt: Date | undefined = proposal?.date_created ? new Date(proposal.date_created) : undefined;
				const expiresAt: Date | undefined = createdAt ? new Date(createdAt.getTime() + PROPOSAL_EXPIRY_DAYS * 24 * 60 * 60 * 1000) : undefined;
				return {
					id: proposal.id,
					quote_id: proposal.quote_id,
					amount: Number(proposal.quote_amount ?? proposal.amount ?? 0),
					inspection_amount: Number((proposal as any)?.inspection_amount ?? proposal.amount ?? 0),
					currency: "AUD",
					note: proposal.note,
					service_label: serviceLabel,
					date_created: createdAt ? createdAt.toISOString() : undefined,
					date_expires: expiresAt ? expiresAt.toISOString() : undefined,
				};
			})()
		: null;

	const [quoteNote, gstRate] = await Promise.all([
		getQuoteNote(),
		fetchGstRate(),
	]);

	// Prepare header details
	const statusRaw: string | undefined = (proposal as any)?.status || undefined;
	const statusLabel = statusRaw ? String(statusRaw).toString() : "";
	const issueDateFmt = (() => {
		try {
			return viewModel?.date_created ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(viewModel.date_created)) : undefined;
		} catch { return undefined; }
	})();
	const expiryDateFmt = (() => {
		try {
			return viewModel?.date_expires ? new Intl.DateTimeFormat("en-AU", { dateStyle: "medium" }).format(new Date(viewModel.date_expires)) : undefined;
		} catch { return undefined; }
	})();

	return (
		<div className="container" data-quote-page>
			<div className="card">
				<FormHeader
					rightTitle="Quote"
					rightSubtitle={serviceLabel || "General Service"}
					rightMeta={[
						{ label: "Quote #", value: (viewModel as any)?.quote_id || (viewModel as any)?.id },
						{ label: "Issue Date", value: issueDateFmt },
						{ label: "Expiry Date", value: expiryDateFmt },
					]}
				/>
				<QuotesForm quote={viewModel as any} dealId={dealId} contactId={contactId} propertyId={propertyId} invoiceId={invoiceId} paymentId={paymentId} quoteNote={quoteNote} addons={addons} termiteRisk={termiteRisk} termiteRiskReason={termiteRiskReason} preselectedAddonIds={preselectedAddonIds} userId={userId} gstRate={gstRate} proposalStatus={statusRaw} />
			</div>
		</div>
	);
}
