"use server";

import { createProperty } from "@/lib/actions/properties/createProperty";
import { updateProperty } from "@/lib/actions/properties/updateProperty";
import { createAgentContactsForDeal } from "@/lib/actions/contacts/createAgentContacts";
import { APP_BASE_URL } from "@/lib/env";
import { getUser } from "@/lib/actions/users/getUser";
import { getContact } from "@/lib/actions/contacts/getContact";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getServiceById } from "@/lib/actions/services/getService";
import { createProposal } from "@/lib/actions/quotes/createQuote";
import { getRequest, postRequest } from "@/lib/http/fetcher";
import { getStepUrl, getRouteTypeFromServiceType } from "@/lib/config/service-routing";
import { getProperty } from "@/lib/actions/properties/getProperty";

export type SubmitResult = {
	success?: boolean;
	errors?: Record<string, string>;
	message?: string;
	nextUrl?: string;
};

export async function submitDilapidationProperties(_prev: SubmitResult, formData: FormData): Promise<SubmitResult> {
	console.log("[submitDilapidationProperties] Server action called");
	const deal_id = String(formData.get("deal_id") ?? "").trim();
	const contact_id = String(formData.get("contact_id") ?? "").trim();
	const user_id = String(formData.get("user_id") ?? "").trim();
	const service_id = String(formData.get("service_id") ?? "").trim();
	
	console.log("[submitDilapidationProperties] Form data:", {
		deal_id,
		contact_id,
		user_id,
		service_id,
	});

	const errors: Record<string, string> = {};

	// Extract all properties from form data
	const properties: Array<{
		id?: string;
		full_address: string;
		street_address: string;
		unit_number: string;
		suburb: string;
		state: string;
		post_code: string;
		quoting_property_classification: string;
		quoting_property_type: string;
		quoting_bedrooms_including_study: string;
		quoting_bathrooms_rounded: string;
		quoting_levels: string;
		quoting_has_basement_or_subfloor: string;
		quoting_additional_structures: string;
		realestate_url: string;
		agents_json: string;
	}> = [];

	// Find all property indices
	const propertyIndices = new Set<number>();
	for (const [key] of formData.entries()) {
		const match = key.match(/^property_(\d+)_/);
		if (match) {
			propertyIndices.add(parseInt(match[1], 10));
		}
	}
	console.log(`[submitDilapidationProperties] Found property indices:`, Array.from(propertyIndices));

	// Extract data for each property
	for (const index of propertyIndices) {
		const full_address = String(formData.get(`property_${index}_full_address`) ?? "").trim();
		const street_address = String(formData.get(`property_${index}_street_address`) ?? "").trim();
		const unit_number = String(formData.get(`property_${index}_unit_number`) ?? "").trim();
		const suburb = String(formData.get(`property_${index}_suburb`) ?? "").trim();
		const state = String(formData.get(`property_${index}_state`) ?? "").trim();
		const post_code = String(formData.get(`property_${index}_post_code`) ?? "").trim();
		const quoting_property_classification = String(formData.get(`property_${index}_quoting_property_classification`) ?? "").trim();
		const quoting_property_type = String(formData.get(`property_${index}_quoting_property_type`) ?? "").trim();
		const quoting_bedrooms_including_study = String(formData.get(`property_${index}_quoting_bedrooms_including_study`) ?? "").trim();
		const quoting_bathrooms_rounded = String(formData.get(`property_${index}_quoting_bathrooms_rounded`) ?? "").trim();
		const quoting_levels = String(formData.get(`property_${index}_quoting_levels`) ?? "").trim();
		const quoting_has_basement_or_subfloor = String(formData.get(`property_${index}_quoting_has_basement_or_subfloor`) ?? "").trim();
		const quoting_additional_structures = String(formData.get(`property_${index}_quoting_additional_structures`) ?? "").trim();
		const realestate_url = String(formData.get(`property_${index}_realestate_url`) ?? "").trim();
		const agents_json = String(formData.get(`property_${index}_agents_json`) ?? "").trim();
		const property_id = String(formData.get(`property_${index}_id`) ?? "").trim();

		// Validate required fields for each property
		if (!full_address) {
			errors[`property_${index}_full_address`] = "Please select a valid address";
		}
		if (full_address && (!suburb || !state || !post_code)) {
			errors[`property_${index}_full_address`] = "Please select a valid address suggestion";
		}
		if (!quoting_property_classification) {
			errors[`property_${index}_quoting_property_classification`] = "Required";
		}
		if (!quoting_property_type) {
			errors[`property_${index}_quoting_property_type`] = "Required";
		}
		if (!quoting_bedrooms_including_study) {
			errors[`property_${index}_quoting_bedrooms_including_study`] = "Required";
		}
		if (!quoting_bathrooms_rounded) {
			errors[`property_${index}_quoting_bathrooms_rounded`] = "Required";
		}

		// Property-type specific required fields
		const isApartmentUnit = quoting_property_type.toLowerCase() === "apartment/unit";
		if (!isApartmentUnit) {
			if (!quoting_levels) {
				errors[`property_${index}_quoting_levels`] = "Required";
			}
			if (!quoting_has_basement_or_subfloor) {
				errors[`property_${index}_quoting_has_basement_or_subfloor`] = "Required";
			}
		}

		// Numeric checks
		if (quoting_bedrooms_including_study && !/^\d+$/.test(quoting_bedrooms_including_study)) {
			errors[`property_${index}_quoting_bedrooms_including_study`] = "Must be a number";
		}
		if (quoting_bathrooms_rounded && !/^\d+$/.test(quoting_bathrooms_rounded)) {
			errors[`property_${index}_quoting_bathrooms_rounded`] = "Must be a number";
		}
		// Remove numeric validation for levels since it's now a dropdown with text values
		// if (quoting_levels && !/^\d+$/.test(quoting_levels)) {
		//	errors[`property_${index}_quoting_levels`] = "Must be a number";
		// }

		properties.push({
			id: property_id || undefined,
			full_address,
			street_address,
			unit_number,
			suburb,
			state,
			post_code,
			quoting_property_classification,
			quoting_property_type,
			quoting_bedrooms_including_study,
			quoting_bathrooms_rounded,
			quoting_levels,
			quoting_has_basement_or_subfloor,
			quoting_additional_structures,
			realestate_url,
			agents_json,
		});
	}

	if (Object.keys(errors).length > 0) {
		console.log("[submitDilapidationProperties] Validation errors:", errors);
		return { success: false, errors };
	}

	try {
		const createdPropertyIds: string[] = [];
		const allAgents: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }> = [];

		// Helper function to map levels text to numbers
		const mapLevelsToNumber = (levels: string): number | null => {
			if (!levels || levels === "N/A") return null;
			switch (levels) {
				case "Single Storey":
					return 1;
				case "Double Storey":
					return 2;
				case "Triple Storey":
					return 3;
				default:
					// If it's already a number, parse it
					const numLevels = Number(levels);
					return isNaN(numLevels) ? null : numLevels;
			}
		};

		// Process each property
		for (let i = 0; i < properties.length; i++) {
			const property = properties[i];
			// Determine the property field name based on index
			const propertyFieldName = i === 0 ? 'properties' : `properties${i + 1}`;
			
			// Build payload with available keys
			const payload: Record<string, unknown> = {
				// Address
				full_address: property.full_address || null,
				street_address: property.street_address || null,
				unit_number: property.unit_number || null,
				suburb: property.suburb || null,
				state: property.state ? property.state.toLowerCase() : null,
				post_code: property.post_code || null,
				// Quoting-derived fields mapped to backend keys
				number_of_bedrooms: property.quoting_bedrooms_including_study ? Number(property.quoting_bedrooms_including_study) : null,
				number_of_bathrooms: property.quoting_bathrooms_rounded ? Number(property.quoting_bathrooms_rounded) : null,
				number_of_levels: property.quoting_levels ? mapLevelsToNumber(property.quoting_levels) : null,
				property_category: property.quoting_property_classification ? property.quoting_property_classification.toLowerCase() : null,
				property_type: property.quoting_property_type || null,
				basement: property.quoting_has_basement_or_subfloor
					? (property.quoting_has_basement_or_subfloor.toLowerCase() === "yes" ? true : property.quoting_has_basement_or_subfloor.toLowerCase() === "no" ? false : null)
					: null,
				additional_structures: property.quoting_additional_structures || null,
				realestate_url: property.realestate_url || null,
				// Relations
				contact: contact_id || null,
				deals: deal_id || null,
				...(user_id ? { user: user_id } : {}),
			};

			let resultingPropertyId: string | undefined = undefined;
			if (property.id) {
				const updated = await updateProperty(property.id, payload as any);
				resultingPropertyId = updated?.id ? String(updated.id) : property.id;
			} else {
				const created = await createProperty(payload as any);
				resultingPropertyId = created?.id ? String(created.id) : undefined;
			}

			if (resultingPropertyId) {
				createdPropertyIds.push(resultingPropertyId);

				// Collect agents from this property (don't create them yet)
				if (property.agents_json) {
					try {
						const agents = JSON.parse(property.agents_json);
						if (Array.isArray(agents) && agents.length > 0) {
							allAgents.push(...agents);
						}
					} catch (e) {
						console.warn(`[submitDilapidationProperties] Failed to parse agents for property ${resultingPropertyId}:`, e);
					}
				}
			}
		}

		console.log(`[submitDilapidationProperties] Successfully created/updated ${createdPropertyIds.length} properties:`, createdPropertyIds);
		console.log(`[submitDilapidationProperties] All property IDs to be added to URL:`, createdPropertyIds.join(","));

		// Update deal with property IDs in different fields (properties, properties2, properties3, etc.)
		if (createdPropertyIds.length > 0 && deal_id) {
			try {
				const { updateDeal } = await import("@/lib/actions/deals/updateDeal");
				const dealUpdatePayload: Record<string, any> = {};
				
				// Assign each property ID to its corresponding field using proper one-to-many structure
				for (let i = 0; i < createdPropertyIds.length; i++) {
					const fieldName = i === 0 ? 'properties' : `properties${i + 1}`;
					dealUpdatePayload[fieldName] = [createdPropertyIds[i]];
				}
				
				await updateDeal(deal_id, dealUpdatePayload);
				console.log("[submitDilapidationProperties] Successfully updated deal with property IDs:", dealUpdatePayload);
			} catch (e) {
				console.error("[submitDilapidationProperties] Failed to update deal with property IDs:", e);
				// Don't fail the entire submission if deal update fails
			}
		}

		// Create agent contacts linked to deal and user (instead of linking to properties)
		if (allAgents.length > 0 && deal_id && user_id) {
			try {
				console.log("[submitDilapidationProperties] Creating agent contacts for deal:", deal_id, "user:", user_id, "agents:", allAgents.length);
				
				// Remove duplicates based on email
				const uniqueAgents = allAgents.reduce((acc, agent) => {
					const email = (agent.email || "").trim();
					if (email && email !== "N/A") {
						// Use email as key to prevent duplicates
						if (!acc.find(a => (a.email || "").trim().toLowerCase() === email.toLowerCase())) {
							acc.push(agent);
						}
					} else if (agent.first_name || agent.last_name || agent.mobile) {
						// Include agents without email if they have other info
						acc.push(agent);
					}
					return acc;
				}, [] as Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>);
				
				await createAgentContactsForDeal(deal_id, user_id, uniqueAgents);
				console.log("[submitDilapidationProperties] Successfully created", uniqueAgents.length, "unique agent contacts");
			} catch (e) {
				console.error("[submitDilapidationProperties] Failed to create agent contacts:", e);
				// Don't fail the entire submission if agent creation fails
			}
		}

		// Check phone verification status to determine next step
		let isPhoneVerified = false;
		let phone: string | undefined = undefined;
		let status: string | undefined = undefined;

		// Prefer user phone/status if available
		if (user_id) {
			try {
				const user = await getUser(String(user_id));
				if (user) {
					phone = (user as any)?.phone ?? phone;
					status = (user as any)?.status ?? status;
				}
			} catch {
				// ignore
			}
		}

		// Fallback: fetch contact details for phone and status
		if ((!phone || !status) && contact_id) {
			try {
				const res = await getContact(contact_id);
				const contact = (res as any)?.data as { phone?: string; status?: string } | null;
				phone = phone || (contact?.phone ?? undefined);
				status = status || ((contact as any)?.status ?? undefined);
			} catch {
				// ignore
			}
		}

		// Check if phone is verified
		isPhoneVerified = status === "active" || status === "published";

		// Generate proper SSR-compliant URL using APP_BASE_URL
		const baseUrl = APP_BASE_URL || (process?.env?.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
		
		let nextStepUrl: string;
		if (isPhoneVerified) {
			// Skip phone verification and go directly to step 4 (quote)
			console.log("[submitDilapidationProperties] Phone already verified, skipping step 3 and going to step 4");
			
			// Determine the service-specific quote page to redirect to
			let quoteUrl = "/steps/04-quote/03-dilapidation"; // dilapidation-specific quote page
			try {
				const deal = await getDeal(deal_id);
				if (deal?.service) {
					const service = await getServiceById(deal.service);
					if (service?.service_type) {
						const routeType = getRouteTypeFromServiceType(service.service_type);
						if (routeType !== "generic") {
							quoteUrl = getStepUrl(4, routeType);
						}
					}
				}
			} catch (e) {
				console.warn("[submitDilapidationProperties] Failed to determine service-specific quote page, using dilapidation-specific", e);
			}

			// Ensure a proposal exists for verified users
			let quoteId: string | number | undefined = undefined;
			try {
				// Try latest proposal for this deal
				const encodedDeal = encodeURIComponent(String(deal_id));
				const res = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodedDeal}&sort=-date_created&limit=1`);
				const latest = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
				quoteId = latest?.id ?? undefined;
				if (!quoteId) {
					// Create a new proposal based on rate estimate for dilapidation
					const deal = await getDeal(deal_id);
					const svcId = deal?.service as any;
					const service = svcId ? await getServiceById(svcId) : null;
					
					// For dilapidation, calculate total estimate for all properties
					let totalAmount = 0;
					if (service?.service_type === "dilapidation" && createdPropertyIds.length > 0) {
						console.log("[submitDilapidationProperties] Creating dilapidation proposal with", { propertyCount: createdPropertyIds.length });
						
						// Get all properties to calculate total estimate
						const properties = await Promise.all(
							createdPropertyIds.map(id => getProperty(id))
						);
						
						// Calculate total estimate for all properties
						for (const property of properties) {
							if (property) {
								const propertyDetails = {
									property_category: (property?.property_category as any) || "residential",
									bedrooms: (property as any)?.number_of_bedrooms || 0,
									bathrooms: (property as any)?.number_of_bathrooms || 0,
									levels: (property as any)?.number_of_levels || 0,
									basement: Boolean((property as any)?.basement),
								};
								
								try {
									const estimate = await postRequest<{ stage_prices: any; quote_price: number; note?: string }>("/api/v1/quotes/estimate", {
										service: "dilapidation",
										...propertyDetails
									});
									if (estimate && estimate.quote_price > 0) {
										totalAmount += estimate.quote_price;
									}
								} catch (error) {
									console.warn("[submitDilapidationProperties] Dilapidation quote estimation failed for property:", property.id, error);
								}
							}
						}
					}
					
					const created = await createProposal({ dealId: deal_id, contactId: contact_id, propertyId: createdPropertyIds.join(","), amount: totalAmount, note: undefined, userId: user_id });
					quoteId = created?.id;
				}
			} catch {
				// ignore and continue without quoteId
			}

			const next = new URL(quoteUrl, baseUrl);
			if (user_id) next.searchParams.set("userId", user_id);
			if (contact_id) next.searchParams.set("contactId", contact_id);
			if (deal_id) next.searchParams.set("dealId", deal_id);
			// Pass all property IDs - use propertyId for consistency with other services
			if (createdPropertyIds.length > 0) {
				next.searchParams.set("propertyId", createdPropertyIds.join(","));
			}
			if (quoteId) next.searchParams.set("quoteId", String(quoteId));
			// Add service type information
			try {
				const deal = await getDeal(deal_id);
				if (deal?.service) {
					const service = await getServiceById(deal.service);
					if (service?.service_type) {
						next.searchParams.set("serviceType", service.service_type);
					}
				}
			} catch (e) {
				// ignore service type if we can't fetch it
			}
			nextStepUrl = `${next.pathname}${next.search}`;
		} else {
			// Phone not verified, go to step 3 (phone verification)
			console.log("[submitDilapidationProperties] Phone not verified, going to step 3");
			const next = new URL("/steps/03-phone-verification", baseUrl);
			if (user_id) next.searchParams.set("userId", user_id);
			if (contact_id) next.searchParams.set("contactId", contact_id);
			if (deal_id) next.searchParams.set("dealId", deal_id);
			// Pass all property IDs - use propertyId for consistency with other services
			if (createdPropertyIds.length > 0) {
				next.searchParams.set("propertyId", createdPropertyIds.join(","));
			}
			nextStepUrl = `${next.pathname}${next.search}`;
		}

		console.log("[submitDilapidationProperties] Success - redirecting to:", nextStepUrl);
		return { success: true, nextUrl: nextStepUrl };
	} catch (e) {
		console.error("[submitDilapidationProperties] Error:", e);
		return { success: false, message: "Failed to save properties" };
	}
}
