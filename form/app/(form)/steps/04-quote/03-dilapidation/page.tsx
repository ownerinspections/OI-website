import DilapidationQuotesForm from "@/components/quotes/DilapidationQuotesForm";
import { getQuote } from "@/lib/actions/quotes/getQuote";
import { getRequest } from "@/lib/http/fetcher";
import { patchRequest } from "@/lib/http/fetcher";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getServiceById } from "@/lib/actions/services/getService";
import { getProperty } from "@/lib/actions/properties/getProperty";
import { getPropertiesByDeal } from "@/lib/actions/properties/getPropertiesByDeal";
import { createProposal } from "@/lib/actions/quotes/createQuote";
import { postRequest } from "@/lib/http/fetcher";
import { redirect } from "next/navigation";
import { getQuoteNote } from "@/lib/actions/globals/getGlobal";
import { PROPOSAL_EXPIRY_DAYS } from "@/lib/env";
import FormHeader from "@/components/ui/FormHeader";
import { fetchGstRate } from "@/lib/actions/invoices/createInvoice";
import { estimateDilapidationQuote, estimateQuoteByServiceType, type PropertyDetails } from "@/lib/actions/quotes/estimateQuote";
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

	if (!dealId || !contactId || !userId) {
		redirect('/not-found');
	}

	// Server-side trace for debugging user linkage
	console.log("[StepQuote] Params parsed", { userId, quoteId, dealId, contactId, propertyId, invoiceId });

	// For dilapidation, we need to handle multiple properties
	let properties: any[] = [];
	if (propertyId) {
		// Parse comma-separated property IDs
		const idsArray = propertyId.split(",").filter(id => id.trim());
		const propertyResults = await Promise.all(
			idsArray.map(id => getProperty(id))
		);
		properties = propertyResults.filter(property => property !== null && property !== undefined);
	} else {
		// Fallback: get all properties associated with the deal
		properties = await getPropertiesByDeal(dealId);
	}

	console.log("[StepQuote] Found properties for dilapidation", { propertyCount: properties.length, propertyIds: properties.map(p => p.id) });

	// Store individual property quotes for display
	let individualPropertyQuotes: Array<{ property: any; estimate: any }> = [];

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

	// ALWAYS treat every visit as a fresh quote - call estimate API for each property and update everything
	if (dealId && properties.length > 0) {
		try {
			console.log("[StepQuote] Treating visit as fresh quote - fetching latest data and updating estimates for each property", { 
				quoteId, 
				dealId, 
				hasProposal: !!proposal,
				proposalAmount: proposal?.quote_amount,
				propertyCount: properties.length
			});
			
			// Fetch latest deal and service data
			const deal = await getDeal(dealId);
			const svcId = deal?.service as any;
			const service = svcId ? await getServiceById(svcId) : null;
			
			if (service?.service_type === "dilapidation") {
				let totalEstimateAmount = 0;
				let allPropertyEstimates: Array<{ property: any; estimate: any; amount: number }> = [];

				// Process each property individually
				for (const property of properties) {
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
					
					console.log("[StepQuote] Calling estimate API for property", { 
						propertyId: property.id,
						propertyAddress: property.full_address,
						propertyDetails 
					});
					
					// Call estimate API for this individual property
					const estimate = await estimateDilapidationQuote(propertyDetails);
					
					console.log("[StepQuote] Property estimate response", { 
						propertyId: property.id,
						estimate, 
						hasEstimate: !!estimate, 
						quotePrice: estimate?.quote_price,
						note: estimate?.note 
					});
					
					if (estimate && estimate.quote_price > 0) {
						totalEstimateAmount += estimate.quote_price;
						allPropertyEstimates.push({ property, estimate, amount: estimate.quote_price });
						individualPropertyQuotes.push({ property, estimate });
					}
				}

				console.log("[StepQuote] All property estimates calculated", { 
					totalEstimateAmount, 
					propertyCount: allPropertyEstimates.length,
					individualEstimates: allPropertyEstimates.map(e => ({ 
						propertyId: e.property.id, 
						address: e.property.full_address, 
						amount: e.amount 
					}))
				});

				if (totalEstimateAmount > 0) {
					// Update the deal with total estimate and individual property prices
					try {
						const dealUpdateData: any = {
							deal_value: totalEstimateAmount,
						};
						
						// Add individual property prices from ratesheet engine (without modification)
						for (let i = 0; i < allPropertyEstimates.length; i++) {
							const priceField = i === 0 ? 'price' : `price${i + 1}`;
							const propertyPrice = allPropertyEstimates[i].amount;
							dealUpdateData[priceField] = `${propertyPrice} (excluding GST)`;
							console.log(`[StepQuote] ${priceField} = ${propertyPrice} (excluding GST, from ratesheet engine)`);
						}
						
						console.log("[StepQuote] Updating deal with total estimate and property prices", { dealId, dealValue: totalEstimateAmount, propertyPrices: dealUpdateData });
						await updateDeal(dealId, dealUpdateData);
						console.log("[StepQuote] Deal updated successfully with total estimate and property prices");
					} catch (dealUpdateError) {
						console.warn("[StepQuote] Failed to update deal with total estimate and property prices:", dealUpdateError);
					}

					// Update each property with any missing details
					for (const { property, estimate } of allPropertyEstimates) {
						try {
							const propertyUpdateData: any = {};
							
							// Ensure property has all the details we're using for estimation
							if (!property?.property_category) {
								propertyUpdateData.property_category = estimate.property_category || "residential";
							}
							if (!property?.number_of_bedrooms && (estimate.bedrooms ?? 0) > 0) {
								propertyUpdateData.number_of_bedrooms = estimate.bedrooms;
							}
							if (!property?.number_of_bathrooms && (estimate.bathrooms ?? 0) > 0) {
								propertyUpdateData.number_of_bathrooms = estimate.bathrooms;
							}
							if (!property?.number_of_levels && (estimate.levels ?? 0) > 0) {
								propertyUpdateData.number_of_levels = estimate.levels;
							}
							if (property?.basement === undefined && estimate.basement !== undefined) {
								propertyUpdateData.basement = estimate.basement;
							}
							
							if (Object.keys(propertyUpdateData).length > 0) {
								console.log("[StepQuote] Updating property with missing details", { propertyId: property.id, propertyUpdateData });
								await updateProperty(property.id, propertyUpdateData);
								console.log("[StepQuote] Property updated successfully");
							}
						} catch (propertyUpdateError) {
							console.warn("[StepQuote] Failed to update property:", propertyUpdateError);
						}
					}
					
					// Update the proposal/quote with the new total estimate
					if (quoteId) {
						const proposalUpdateData: any = {
							quote_amount: totalEstimateAmount,
							inspection_amount: totalEstimateAmount, // Also update inspection_amount in Directus
						};
						
						console.log("[StepQuote] Updating proposal with total estimate", { quoteId, totalAmount: totalEstimateAmount });
						try {
							await patchRequest(`/items/os_proposals/${encodeURIComponent(String(quoteId))}`, proposalUpdateData);
							console.log("[StepQuote] Proposal updated successfully with total estimate");
							
							// Update the local proposal object with new values if it exists
							if (proposal) {
								console.log("[StepQuote] Updating local proposal object", { 
									before: { quote_amount: proposal.quote_amount, inspection_amount: (proposal as any)?.inspection_amount },
									after: { quote_amount: totalEstimateAmount, inspection_amount: totalEstimateAmount }
								});
								proposal.quote_amount = totalEstimateAmount;
								(proposal as any).inspection_amount = totalEstimateAmount;
								console.log("[StepQuote] Local proposal object updated", { 
									quote_amount: proposal.quote_amount, 
									inspection_amount: (proposal as any)?.inspection_amount
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
							console.warn("[StepQuote] Failed to update proposal with total estimate:", proposalUpdateError);
							// Still update the local proposal object so the UI shows the new total price
							if (proposal) {
								proposal.quote_amount = totalEstimateAmount;
								(proposal as any).inspection_amount = totalEstimateAmount;
							}
						}
					}
				} else {
					console.warn("[StepQuote] No valid estimates calculated for any properties", { propertyCount: properties.length });
				}
			} else {
				console.warn("[StepQuote] Service type is not dilapidation", { serviceType: service?.service_type });
			}
		} catch (error) {
			console.warn("[StepQuote] Failed to process fresh quote calculation:", error);
		}
	}

	// If still no proposal, attempt to create one now using rate estimate
	if (!proposal && dealId && properties.length > 0) {
		const deal = await getDeal(dealId);
		const svcId = deal?.service as any;
		const service = svcId ? await getServiceById(svcId) : null;
		let totalAmount = 0;
		
		if (service?.service_type === "dilapidation") {
			console.log("[StepQuote] Creating dilapidation proposal with", { propertyCount: properties.length });
			
			// Calculate total estimate for all properties
			for (const property of properties) {
				const propertyDetails: PropertyDetails = {
					property_category: (property?.property_category as any) || "residential",
					bedrooms: (property as any)?.number_of_bedrooms || 0,
					bathrooms: (property as any)?.number_of_bathrooms || 0,
					levels: (property as any)?.number_of_levels || 0,
					basement: Boolean((property as any)?.basement),
				};
				
				try {
					const estimate = await estimateDilapidationQuote(propertyDetails);
					if (estimate && estimate.quote_price > 0) {
						totalAmount += estimate.quote_price;
					}
				} catch (error) {
					console.warn("[StepQuote] Dilapidation quote estimation failed for property:", property.id, error);
				}
			}
		}
		
		console.log("[StepQuote] Creating proposal with", { dealId, contactId, propertyId, totalAmount, userId });
		const created = await createProposal({ dealId, contactId, propertyId, amount: totalAmount, note: undefined, userId });
		console.log("[StepQuote] Proposal created", { id: (created as any)?.id, created });
		// After creating the proposal (quote), redirect to include quoteId in URL
		const paramsOut = new URLSearchParams();
		// Standard order: userId, contactId, dealId, propertyId, quoteId
		if (userId) paramsOut.set("userId", String(userId));
		if (contactId) paramsOut.set("contactId", String(contactId));
		if (dealId) paramsOut.set("dealId", String(dealId));
		if (propertyId) paramsOut.set("propertyId", String(propertyId));
		paramsOut.set("quoteId", String(created.id));
		redirect(`/steps/04-quote/03-dilapidation?${paramsOut.toString()}`);
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
		if (dealId) paramsOut.set("dealId", String(dealId));
		if (propertyId) paramsOut.set("propertyId", String(propertyId));
		paramsOut.set("quoteId", String(created.id));
		redirect(`/steps/04-quote/03-dilapidation?${paramsOut.toString()}`);
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
			console.log("[StepQuote] Fetching service addons for dilapidation", { serviceId });
			const svcRes = await getRequest<{ data: { id: number; service_name: string; addons?: number[] } }>(`/items/services/${encodeURIComponent(String(serviceId))}?fields=id,service_name,addons`);
			console.log("[StepQuote] Service response for dilapidation", { serviceId, serviceData: (svcRes as any)?.data });
			
			const addonIds = Array.isArray((svcRes as any)?.data?.addons) ? ((svcRes as any).data.addons as number[]) : [];
			console.log("[StepQuote] Service addon IDs for dilapidation", { serviceId, addonIds });
			
			if (addonIds.length > 0) {
				const idsCsv = addonIds.join(",");
				const apiUrl = `/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(idsCsv)}`;
				console.log("[StepQuote] Fetching addon details for dilapidation", { addonIds, idsCsv, apiUrl });
				
				const addonsRes = await getRequest<{ data: any[] }>(apiUrl);
				console.log("[StepQuote] Addons response for dilapidation", { addonsData: (addonsRes as any)?.data });
				
				if (Array.isArray((addonsRes as any)?.data) && (addonsRes as any).data.length > 0) {
					addons = ((addonsRes as any).data).map((a: any) => ({
						id: Number(a.id),
						name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
						price: Number(a.price ?? a.amount ?? 0),
					}));
					console.log("[StepQuote] Processed addons for dilapidation", { addons });
				} else {
					console.log("[StepQuote] No addons found with configured IDs, using fallback addons");
					// Fallback: Use available addons (1-9) when configured addon IDs don't exist
					const fallbackAddonIds = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // All available addons
					const fallbackIdsCsv = fallbackAddonIds.join(",");
					console.log("[StepQuote] Fetching fallback addon details for dilapidation IDs:", fallbackIdsCsv);
					const fallbackAddonsRes = await getRequest<{ data: any[] }>(`/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(fallbackIdsCsv)}`);
					console.log("[StepQuote] Fallback addons response for dilapidation:", fallbackAddonsRes);
					
					if (Array.isArray((fallbackAddonsRes as any)?.data) && (fallbackAddonsRes as any).data.length > 0) {
						addons = ((fallbackAddonsRes as any).data).map((a: any) => ({
							id: Number(a.id),
							name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
							price: Number(a.price ?? a.amount ?? 0),
						}));
						console.log("[StepQuote] Processed fallback addons for dilapidation:", addons);
					}
				}
			} else {
				console.log("[StepQuote] No addon IDs found for dilapidation service, using fallback addons");
				// Fallback: Use available addons (1-9) for dilapidation
				const fallbackAddonIds = [1, 2, 3, 4, 5, 6, 7, 8, 9]; // All available addons
				const fallbackIdsCsv = fallbackAddonIds.join(",");
				console.log("[StepQuote] Fetching fallback addon details for dilapidation IDs:", fallbackIdsCsv);
				const fallbackAddonsRes = await getRequest<{ data: any[] }>(`/items/addons?filter%5Bid%5D%5B_in%5D=${encodeURIComponent(fallbackIdsCsv)}`);
				console.log("[StepQuote] Fallback addons response for dilapidation:", fallbackAddonsRes);
				
				if (Array.isArray((fallbackAddonsRes as any)?.data) && (fallbackAddonsRes as any).data.length > 0) {
					addons = ((fallbackAddonsRes as any).data).map((a: any) => ({
						id: Number(a.id),
						name: a.name || a.addon_name || a.title || `Addon ${a.id}`,
						price: Number(a.price ?? a.amount ?? 0),
					}));
					console.log("[StepQuote] Processed fallback addons for dilapidation:", addons);
				}
			}
		} catch (error) {
			console.error("[StepQuote] Error loading addons for dilapidation:", error);
		}
	} else {
		console.log("[StepQuote] No serviceId available for addon loading in dilapidation");
	}

	// Debug logging for addon loading
	console.log("[StepQuote] Addon loading debug", {
		serviceId,
		addonsCount: addons.length,
		preselectedAddonIds,
		dealId,
		quoteId,
		hasProposal: !!proposal,
		serviceLabel,
		addons: addons
	});

	// Resolve property termite risk (from first property in our properties array)
	let termiteRisk: string | undefined = undefined;
	let termiteRiskReason: string | undefined = undefined;
	if (properties.length > 0) {
		try {
			const prop = await getProperty(properties[0].id);
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
					rightSubtitle={statusLabel ? (<><strong>Status:</strong> {statusLabel}</>) : undefined}
					rightMeta={[
						{ label: "Quote #", value: (viewModel as any)?.quote_id || (viewModel as any)?.id },
						{ label: "Issue Date", value: issueDateFmt },
						{ label: "Expiry Date", value: expiryDateFmt },
						{ label: "Properties", value: `${properties.length} property${properties.length !== 1 ? 'ies' : ''}` },
					]}
				/>
				<DilapidationQuotesForm quote={viewModel as any} propertyQuotes={individualPropertyQuotes} dealId={dealId} contactId={contactId} propertyId={propertyId} invoiceId={invoiceId} paymentId={paymentId} quoteNote={quoteNote} addons={addons} termiteRisk={termiteRisk} termiteRiskReason={termiteRiskReason} preselectedAddonIds={preselectedAddonIds} userId={userId} gstRate={gstRate} proposalStatus={statusRaw} />
			</div>
		</div>
	);
}