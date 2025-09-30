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
import { estimatePreSalesQuote, estimateQuoteByServiceType, type PropertyDetails } from "@/lib/actions/quotes/estimateQuote";
import { updateDeal } from "@/lib/actions/deals/updateDeal";
import { updateProperty } from "@/lib/actions/properties/updateProperty";

export default async function StepQuote({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;
	const serviceType = typeof params.serviceType === "string" ? params.serviceType : undefined;

	if (!dealId || !contactId || !propertyId || !userId) {
		redirect('/not-found');
	}

	// Server-side trace for debugging user linkage
	console.log("[StepQuote] Params parsed", { userId, quoteId, dealId, contactId, propertyId, invoiceId, serviceType });

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

	// ALWAYS treat every visit as a fresh quote - call estimate API and update everything
	if (dealId) {
		try {
			console.log("[StepQuote] Treating visit as fresh quote - fetching latest data and updating estimates", { 
				quoteId, 
				dealId, 
				hasProposal: !!proposal,
				proposalAmount: proposal?.quote_amount 
			});
			
			// Fetch latest deal, service, and property data
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
				
				console.log("[StepQuote] Calling estimate API for fresh quote calculation", { 
					quoteId, 
					dealId, 
					serviceType: service.service_type,
					propertyDetails 
				});
				
				// Always call the estimate API to get fresh pricing
				const estimate = await estimateQuoteByServiceType(service.service_type, propertyDetails);
				
				console.log("[StepQuote] Estimate API response", { 
					estimate, 
					hasEstimate: !!estimate, 
					quotePrice: estimate?.quote_price,
					note: estimate?.note 
				});
				
				if (estimate && estimate.quote_price > 0) {
					// Update the deal with current property details and fresh estimate
					try {
						const dealUpdateData: any = {
							deal_value: estimate.quote_price,
						};
						
						// Update deal with fresh estimate
						console.log("[StepQuote] Updating deal with fresh estimate", { dealId, dealValue: estimate.quote_price });
						await updateDeal(dealId, dealUpdateData);
						console.log("[StepQuote] Deal updated successfully with fresh estimate");
					} catch (dealUpdateError) {
						console.warn("[StepQuote] Failed to update deal with fresh estimate:", dealUpdateError);
					}
					
					// Update the property with any missing details
					if (propId) {
						try {
							const propertyUpdateData: any = {};
							
							// Ensure property has all the details we're using for estimation
							if (!property?.property_category) {
								propertyUpdateData.property_category = propertyDetails.property_category;
							}
							if (!property?.number_of_bedrooms && (propertyDetails.bedrooms ?? 0) > 0) {
								propertyUpdateData.number_of_bedrooms = propertyDetails.bedrooms;
							}
							if (!property?.number_of_bathrooms && (propertyDetails.bathrooms ?? 0) > 0) {
								propertyUpdateData.number_of_bathrooms = propertyDetails.bathrooms;
							}
							if (!property?.number_of_levels && (propertyDetails.levels ?? 0) > 0) {
								propertyUpdateData.number_of_levels = propertyDetails.levels;
							}
							if (property?.basement === undefined && propertyDetails.basement !== undefined) {
								propertyUpdateData.basement = propertyDetails.basement;
							}
							
							if (Object.keys(propertyUpdateData).length > 0) {
								console.log("[StepQuote] Updating property with missing details", { propId, propertyUpdateData });
								await updateProperty(propId, propertyUpdateData);
								console.log("[StepQuote] Property updated successfully");
							}
						} catch (propertyUpdateError) {
							console.warn("[StepQuote] Failed to update property:", propertyUpdateError);
						}
					}
					
					// Update the proposal/quote with the new base estimate
					if (quoteId) {
						const proposalUpdateData: any = {
							quote_amount: estimate.quote_price,
							inspection_amount: estimate.quote_price, // Also update inspection_amount in Directus
						};
						
						if (estimate.note) {
							proposalUpdateData.note = estimate.note;
						}
						
						console.log("[StepQuote] Updating proposal with fresh base estimate", { quoteId, baseAmount: estimate.quote_price });
						try {
							await patchRequest(`/items/os_proposals/${encodeURIComponent(String(quoteId))}`, proposalUpdateData);
							console.log("[StepQuote] Proposal updated successfully with fresh base estimate");
							
							// Update the local proposal object with new values if it exists
							if (proposal) {
								console.log("[StepQuote] Updating local proposal object", { 
									before: { quote_amount: proposal.quote_amount, inspection_amount: (proposal as any)?.inspection_amount, note: proposal.note },
									after: { quote_amount: estimate.quote_price, inspection_amount: estimate.quote_price, note: estimate.note }
								});
								proposal.quote_amount = estimate.quote_price;
								(proposal as any).inspection_amount = estimate.quote_price;
								if (estimate.note) {
									proposal.note = estimate.note;
								}
								console.log("[StepQuote] Local proposal object updated", { 
									quote_amount: proposal.quote_amount, 
									inspection_amount: (proposal as any)?.inspection_amount,
									note: proposal.note 
								});
							} else {
								// If we didn't have a proposal initially, fetch it now after updating
								try {
									const res = await getRequest<{ data: any }>(`/items/os_proposals/${quoteId}`);
									proposal = (res as any)?.data ?? null;
									console.log("[StepQuote] Fetched updated proposal after estimate update", { 
										proposal: proposal,
										quote_amount: proposal?.quote_amount,
										note: proposal?.note
									});
								} catch (fetchError) {
									console.warn("[StepQuote] Failed to fetch updated proposal:", fetchError);
								}
							}
						} catch (proposalUpdateError) {
							console.warn("[StepQuote] Failed to update proposal with fresh base estimate:", proposalUpdateError);
							// Still update the local proposal object so the UI shows the new base price
							if (proposal) {
								proposal.quote_amount = estimate.quote_price;
								(proposal as any).inspection_amount = estimate.quote_price;
								if (estimate.note) {
									proposal.note = estimate.note;
								}
							}
						}
					}
				} else {
					console.warn("[StepQuote] Estimate API returned invalid or zero price", { estimate });
				}
			} else {
				console.warn("[StepQuote] Missing required data for fresh quote calculation", { 
					hasService: !!service, 
					hasProperty: !!property,
					serviceType: service?.service_type 
				});
			}
		} catch (error) {
			console.warn("[StepQuote] Failed to process fresh quote calculation:", error);
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
		let amount = 0;
		let note: string | undefined = undefined;
		
		// Use service-specific quote estimation for pre-sales
		const propertyDetails: PropertyDetails = {
			property_category,
			bedrooms: (property as any)?.number_of_bedrooms || 0,
			bathrooms: (property as any)?.number_of_bathrooms || 0,
			levels: (property as any)?.number_of_levels || 0,
			basement: Boolean((property as any)?.basement),
		};
		
		try {
			const estimate = await estimatePreSalesQuote(propertyDetails);
			amount = estimate?.quote_price ?? 0;
			note = estimate?.note || undefined;
		} catch (error) {
			console.warn("[StepQuote] Pre-sales quote estimation failed:", error);
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
		// Add service type information
		if (service?.service_type) {
			paramsOut.set("serviceType", service.service_type);
		}
		redirect(`/steps/04-quote/02-pre-sales?${paramsOut.toString()}`);
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
		// Add service type information from URL parameter or fetch from deal
		if (serviceType) {
			paramsOut.set("serviceType", serviceType);
		} else {
			// Fallback: fetch service type from deal
			try {
				const deal = await getDeal(dealId);
				if (deal?.service) {
					const service = await getServiceById(deal.service);
					if (service?.service_type) {
						paramsOut.set("serviceType", service.service_type);
					}
				}
			} catch (e) {
				console.warn("[StepQuote] Failed to fetch service type for fallback redirect", e);
			}
		}
		redirect(`/steps/04-quote/02-pre-sales?${paramsOut.toString()}`);
	}

	let serviceLabel: string | undefined = undefined;
	let serviceId: number | undefined = undefined;
	let dealPropertyId: string | undefined = undefined;
	let preselectedAddonIds: number[] = [];
	if (dealId) {
		try {
			console.log("[StepQuote] Fetching deal for service resolution", { dealId });
			const deal = await getDeal(dealId);
			console.log("[StepQuote] Deal data", { dealId, deal, dealService: deal?.service });
			
			if (deal?.service) {
				serviceId = Number(deal.service);
				console.log("[StepQuote] Resolved serviceId from deal", { dealId, serviceId });
				
				const service = await getServiceById(deal.service);
				console.log("[StepQuote] Service data", { serviceId, service });
				serviceLabel = service?.service_name || service?.service_type || undefined;
			} else {
				console.log("[StepQuote] No service found in deal", { dealId, deal });
			}
			
			if (deal?.property) {
				dealPropertyId = String(deal.property);
			}
			// Extract any previously selected addons on the deal for pre-selection
			if (Array.isArray((deal as any)?.addons)) {
				preselectedAddonIds = ((deal as any).addons as any[])
					.map((x) => Number(x))
					.filter((n) => Number.isFinite(n));
				console.log("[StepQuote] Deal preselected addons", { dealId, preselectedAddonIds });
			}
		} catch (error) {
			console.error("[StepQuote] Failed to fetch deal for service resolution", { dealId, error });
		}
	} else {
		console.log("[StepQuote] No dealId available for service resolution");
	}

	// If we have a proposal, also check for addons on the proposal itself
	if (proposal && Array.isArray((proposal as any)?.addons)) {
		const proposalAddonIds = ((proposal as any).addons as any[])
			.map((x) => Number(x))
			.filter((n) => Number.isFinite(n));
		// Merge proposal addons with deal addons (proposal takes precedence)
		preselectedAddonIds = [...new Set([...preselectedAddonIds, ...proposalAddonIds])];
	}

	// Fetch ALL addons that are activated for this service
	let addons: Array<{ id: number; name: string; price: number }> = [];
	if (serviceId) {
		try {
			console.log("[StepQuote] Fetching service addons", { serviceId });
			const svcRes = await getRequest<{ data: { id: number; service_name: string; addons?: number[] } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=id,service_name,addons`);
			console.log("[StepQuote] Service response", { serviceId, serviceData: (svcRes as any)?.data });
			
			const addonIds = Array.isArray((svcRes as any)?.data?.addons) ? ((svcRes as any).data.addons as number[]) : [];
			console.log("[StepQuote] Service addon IDs", { serviceId, addonIds });
			
			if (addonIds.length > 0) {
				const idsCsv = addonIds.join(",");
				const apiUrl = `/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}`;
				console.log("[StepQuote] Fetching addon details", { addonIds, idsCsv, apiUrl });
				
				// Try the filtered API call first
				const addonsRes = await getRequest<{ data: any[] }>(apiUrl);
				console.log("[StepQuote] Addons response", { addonsData: (addonsRes as any)?.data, fullResponse: addonsRes });
				
				// If no addons found, try fetching all addons to see what's available
				if (!(addonsRes as any)?.data || (addonsRes as any).data.length === 0) {
					console.log("[StepQuote] No addons found with filter, trying to fetch all addons");
					try {
						const allAddonsRes = await getRequest<{ data: any[] }>(`/items/addons?limit=50`);
						console.log("[StepQuote] All addons response", { allAddonsData: (allAddonsRes as any)?.data });
						
						// Filter the addons manually
						const allAddons = (allAddonsRes as any)?.data ?? [];
						const filteredAddons = allAddons.filter((a: any) => addonIds.includes(Number(a.id)));
						console.log("[StepQuote] Manually filtered addons", { filteredAddons });
						
						// If still no addons found, use available published addons as fallback
						if (filteredAddons.length === 0) {
							console.log("[StepQuote] No addons found with configured IDs, using available published addons as fallback");
							const publishedAddons = allAddons.filter((a: any) => a.status === 'published');
							console.log("[StepQuote] Available published addons", { publishedAddons });
							
							addons = publishedAddons.map((a: any) => ({
								id: Number(a.id),
								name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
								price: Number(a.price ?? a.amount ?? 0),
							}));
						} else {
							addons = filteredAddons.map((a: any) => ({
								id: Number(a.id),
								name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
								price: Number(a.price ?? a.amount ?? 0),
							}));
						}
					} catch (allAddonsError) {
						console.error("[StepQuote] Failed to fetch all addons", { allAddonsError });
					}
				} else {
					addons = ((addonsRes as any)?.data ?? []).map((a: any) => ({
						id: Number(a.id),
						name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
						price: Number(a.price ?? a.amount ?? 0),
					}));
				}
				console.log("[StepQuote] Final mapped addons", { addons });
			} else {
				console.log("[StepQuote] No addon IDs found for service", { serviceId });
			}
		} catch (error) {
			console.error("[StepQuote] Failed to fetch addons", { serviceId, error });
		}
	} else {
		console.log("[StepQuote] No serviceId available for addon loading");
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
				const amount = Number(proposal.quote_amount ?? proposal.amount ?? 0);
				
				console.log("[StepQuote] Creating viewModel", {
					proposalQuoteAmount: proposal.quote_amount,
					proposalAmount: proposal.amount,
					calculatedAmount: amount,
					proposalNote: proposal.note
				});
				
				return {
					id: proposal.id,
					quote_id: proposal.quote_id,
					amount: amount,
					inspection_amount: Number((proposal as any)?.inspection_amount ?? proposal.amount ?? 0),
					currency: "AUD",
					note: proposal.note,
					service_label: serviceLabel,
					date_created: createdAt ? createdAt.toISOString() : undefined,
					date_expires: expiresAt ? expiresAt.toISOString() : undefined,
				};
			})()
		: null;

	console.log("[StepQuote] Final viewModel being passed to QuotesForm", { viewModel });

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
					rightSubtitle={serviceLabel || "Pre-Sales Inspection"}
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
