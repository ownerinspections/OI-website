"use server";

import { createProperty } from "@/lib/actions/properties/createProperty";
import { updateProperty } from "@/lib/actions/properties/updateProperty";
import { createAgentContactsForDeal } from "@/lib/actions/contacts/createAgentContacts";
import { VALIDATION_MESSAGES, VALIDATION_PATTERNS, VALIDATION_LIMITS } from "@/lib/validation/constants";
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

export async function submitProperty(_prev: SubmitResult, formData: FormData): Promise<SubmitResult> {
	console.log("[submitProperty] Server action called");
	const property_id = String(formData.get("property_id") ?? "").trim();
	const deal_id = String(formData.get("deal_id") ?? "").trim();
	const contact_id = String(formData.get("contact_id") ?? "").trim();
	const user_id = String(formData.get("user_id") ?? "").trim();
	const service_id = String(formData.get("service_id") ?? "").trim();
	
	console.log("[submitProperty] Form data:", {
		property_id,
		deal_id,
		contact_id,
		user_id,
		service_id,
		full_address: formData.get("full_address"),
		street_address: formData.get("street_address"),
		suburb: formData.get("suburb"),
		state: formData.get("state"),
		post_code: formData.get("post_code"),
		quoting_property_classification: formData.get("quoting_property_classification"),
		quoting_property_type: formData.get("quoting_property_type"),
		area_sq: formData.get("area_sq"),
		number_of_levels: formData.get("number_of_levels")
	});

	const number_of_bedrooms = String(formData.get("number_of_bedrooms") ?? "").trim();
	const number_of_bathrooms = String(formData.get("number_of_bathrooms") ?? "").trim();
	const number_of_levels = String(formData.get("number_of_levels") ?? "").trim();
	const basement = String(formData.get("basement") ?? "").trim();
	const area_sq = String(formData.get("area_sq") ?? "").trim();
	const property_description = String(formData.get("property_description") ?? "").trim();
	const full_address = String(formData.get("full_address") ?? "").trim();
	const street_address = String(formData.get("street_address") ?? "").trim();
	const unit_number = String(formData.get("unit_number") ?? "").trim();
	const suburb = String(formData.get("suburb") ?? "").trim();
	const state = String(formData.get("state") ?? "").trim();
	const post_code = String(formData.get("post_code") ?? "").trim();


	// New validations for visible quoting fields
	const quoting_property_classification = String(formData.get("quoting_property_classification") ?? "").trim();
	const quoting_property_type = String(formData.get("quoting_property_type") ?? "").trim();
	const quoting_bedrooms_including_study = String(formData.get("quoting_bedrooms_including_study") ?? "").trim();
	const quoting_bathrooms_rounded = String(formData.get("quoting_bathrooms_rounded") ?? "").trim();
	const quoting_levels = String(formData.get("quoting_levels") ?? "").trim();
	const quoting_has_basement_or_subfloor = String(formData.get("quoting_has_basement_or_subfloor") ?? "").trim();
	const quoting_additional_structures = String(formData.get("quoting_additional_structures") ?? "").trim();

	// Optional termite info from extraction
	const termite_risk = String(formData.get("termite_risk") ?? "").trim();
	const termite_risk_reason = String(formData.get("termite_risk_reason") ?? "").trim();

	// Additional extracted metadata
	const land_size = String(formData.get("land_size") ?? "").trim();
	const year_built = String(formData.get("year_built") ?? "").trim();
	const bushfire_prone = String(formData.get("bushfire_prone") ?? "").trim();
	const flood_risk = String(formData.get("flood_risk") ?? "").trim();
	const heritage_overlay = String(formData.get("heritage_overlay") ?? "").trim();
	const last_sold_str = String(formData.get("last_sold") ?? "").trim();
	const last_rental_str = String(formData.get("last_rental") ?? "").trim();

	// Extracted listing info (hidden): realestate URL and up to several agents
	const realestate_url = String(formData.get("realestate_url") ?? "").trim();
	let extractedAgents: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }> = [];
	const agentsJsonRaw = String(formData.get("agents_json") ?? "").trim();
	if (agentsJsonRaw) {
		try {
			const arr = JSON.parse(agentsJsonRaw);
			if (Array.isArray(arr)) {
				extractedAgents = arr as Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>;
			}
		} catch {}
	}
	if (extractedAgents.length === 0) {
		for (let i = 0; i < 5; i++) {
			const fn = String(formData.get(`agent_${i}_first_name`) ?? "").trim();
			const ln = String(formData.get(`agent_${i}_last_name`) ?? "").trim();
			const mb = String(formData.get(`agent_${i}_mobile`) ?? "").trim();
			const em = String(formData.get(`agent_${i}_email`) ?? "").trim();
			if (fn || ln || mb || em) extractedAgents.push({ first_name: fn, last_name: ln, mobile: mb, email: em });
		}
	}

	const errors: Record<string, string> = {};

	// Services that don't require address fields and property details (5, 6, 7, 8)
	const servicesWithoutPropertyDetails = [5, 6, 7, 8];
	const serviceIdNumber = service_id ? parseInt(service_id, 10) : null;
	const isAddressRequired = !serviceIdNumber || !servicesWithoutPropertyDetails.includes(serviceIdNumber);
	const showPropertyDetails = !serviceIdNumber || !servicesWithoutPropertyDetails.includes(serviceIdNumber);

	// Address must be selected (only for services that require it)
	if (isAddressRequired) {
		if (!full_address) {
			errors.full_address = VALIDATION_MESSAGES.ADDRESS_REQUIRED;
		}
		if (full_address && (!suburb || !state || !post_code)) {
			errors.full_address = VALIDATION_MESSAGES.INVALID_ADDRESS;
		}
	}

	// Required quoting fields (only for services that need property details)
	if (showPropertyDetails) {
		if (!quoting_property_classification) errors.quoting_property_classification = VALIDATION_MESSAGES.PROPERTY_CLASSIFICATION_REQUIRED;
		if (!quoting_property_type) errors.quoting_property_type = VALIDATION_MESSAGES.PROPERTY_TYPE_REQUIRED;
		if (!quoting_bedrooms_including_study) errors.quoting_bedrooms_including_study = VALIDATION_MESSAGES.REQUIRED;
		if (!quoting_bathrooms_rounded) errors.quoting_bathrooms_rounded = VALIDATION_MESSAGES.REQUIRED;

		// Property-type specific required fields
		const isApartmentUnit = quoting_property_type.toLowerCase() === "apartment/unit";
		if (!isApartmentUnit) {
			if (!quoting_levels) errors.quoting_levels = VALIDATION_MESSAGES.LEVELS_REQUIRED;
			if (!quoting_has_basement_or_subfloor) errors.quoting_has_basement_or_subfloor = VALIDATION_MESSAGES.BASEMENT_REQUIRED;
			// additional_structures is optional
		}

		// Enhanced numeric validation with proper error messages
		if (quoting_bedrooms_including_study) {
			if (!VALIDATION_PATTERNS.BEDROOMS.test(quoting_bedrooms_including_study)) {
				errors.quoting_bedrooms_including_study = VALIDATION_MESSAGES.INVALID_BEDROOMS;
			}
		}
		if (quoting_bathrooms_rounded) {
			if (!VALIDATION_PATTERNS.BATHROOMS.test(quoting_bathrooms_rounded)) {
				errors.quoting_bathrooms_rounded = VALIDATION_MESSAGES.INVALID_BATHROOMS;
			}
		}
		// No longer validate quoting_levels as numeric since it's now a dropdown with text values
	}

	// Services that need basic property category/type fields (5, 6, 7, 8)
	const servicesWithPropertyCategoryType = [5, 6, 7, 8];
	const showPropertyCategoryType = serviceIdNumber && servicesWithPropertyCategoryType.includes(serviceIdNumber);
	
	if (showPropertyCategoryType) {
		if (!quoting_property_classification) errors.quoting_property_classification = VALIDATION_MESSAGES.PROPERTY_CLASSIFICATION_REQUIRED;
		if (!quoting_property_type) errors.quoting_property_type = VALIDATION_MESSAGES.PROPERTY_TYPE_REQUIRED;
		
		// New construction stages specific fields (service 5)
		if (serviceIdNumber === 5) {
			if (!area_sq) errors.area_sq = VALIDATION_MESSAGES.REQUIRED;
			if (!number_of_levels) errors.number_of_levels = VALIDATION_MESSAGES.LEVELS_REQUIRED;
			
			// Enhanced numeric validation for area
			if (area_sq) {
				if (!VALIDATION_PATTERNS.AREA_SIZE.test(area_sq)) {
					errors.area_sq = VALIDATION_MESSAGES.INVALID_AREA;
				} else {
					const area = parseFloat(area_sq);
					if (area < VALIDATION_LIMITS.MIN_AREA || area > VALIDATION_LIMITS.MAX_AREA) {
						errors.area_sq = `Area must be between ${VALIDATION_LIMITS.MIN_AREA} and ${VALIDATION_LIMITS.MAX_AREA} sq m`;
					}
				}
			}
			// Note: number_of_levels validation for dropdown values is handled by the dropdown options
		}
	}

	if (Object.keys(errors).length > 0) {
		console.log("[submitProperty] Validation errors:", errors);
		return { success: false, errors };
	}

	try {
		console.log("[submitProperty] Building payload for service:", serviceIdNumber, {
			area_sq,
			number_of_levels,
			quoting_levels,
			showPropertyCategoryType
		});
		
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

		// Build payload with available keys
		const payload: Record<string, unknown> = {
			// Address
			full_address: full_address || null,
			street_address: street_address || null,
			unit_number: unit_number || null,
			suburb: suburb || null,
			state: state ? state.toLowerCase() : null,
			post_code: post_code || null,
			// Quoting-derived fields mapped to backend keys
			number_of_bedrooms: quoting_bedrooms_including_study ? Number(quoting_bedrooms_including_study) : null,
			number_of_bathrooms: quoting_bathrooms_rounded ? Number(quoting_bathrooms_rounded) : null,
			number_of_levels: quoting_levels ? mapLevelsToNumber(quoting_levels) : (number_of_levels ? mapLevelsToNumber(number_of_levels) : null),
			property_category: quoting_property_classification ? quoting_property_classification.toLowerCase() : null,
			property_type: quoting_property_type || null,
			// New construction stages specific fields
			area_sq: area_sq ? Number(area_sq) : null,
			basement: quoting_has_basement_or_subfloor
				? (quoting_has_basement_or_subfloor.toLowerCase() === "yes" ? true : quoting_has_basement_or_subfloor.toLowerCase() === "no" ? false : null)
				: null,
			additional_structures: quoting_additional_structures || null,
			termite_risk: termite_risk || null,
			termite_risk_reason: termite_risk_reason || null,
			// Newly added extracted metadata
			land_size: land_size || null,
			year_built: year_built || null,
			bushfire_prone: bushfire_prone || null,
			flood_risk: flood_risk || null,
			heritage_overlay: heritage_overlay || null,
			last_sold: last_sold_str || null,
			last_rental: last_rental_str || null,
			realestate_url: realestate_url || null,
			// Relations
			contact: contact_id || null,
			deals: deal_id || null,
			...(user_id ? { user: user_id } : {}),
		};

		console.log("[submitProperty] Final payload:", {
			...payload,
			// Highlight new construction stages specific fields
			area_sq: payload.area_sq,
			number_of_levels: payload.number_of_levels,
			property_category: payload.property_category,
			property_type: payload.property_type
		});

		let resultingPropertyId: string | undefined = undefined;
		if (property_id) {
			console.log("[submitProperty] Updating existing property with new extraction data:", property_id);
			const updated = await updateProperty(property_id, payload as any);
			resultingPropertyId = updated?.id ? String(updated.id) : property_id;
			console.log("[submitProperty] Property updated successfully with new address and extracted details");
		} else {
			console.log("[submitProperty] Creating new property with extraction data");
			const created = await createProperty(payload as any);
			resultingPropertyId = created?.id ? String(created.id) : undefined;
			console.log("[submitProperty] New property created successfully");
		}

		// Create agent contacts linked to deal and user (instead of linking to property)
		if (extractedAgents.length > 0 && deal_id && user_id) {
			try {
				console.log("[submitProperty] Creating agent contacts for deal:", deal_id, "user:", user_id);
				await createAgentContactsForDeal(deal_id, user_id, extractedAgents);
				console.log("[submitProperty] Successfully created agent contacts");
			} catch (e) {
				console.error("[submitProperty] Failed to create agent contacts:", e);
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
			console.log("[submitProperty] Phone already verified, skipping step 3 and going to step 4");
			
			// Determine the service-specific quote page to redirect to
			let quoteUrl = "/steps/04-quote"; // fallback to generic quote page
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
				console.warn("[submitProperty] Failed to determine service-specific quote page, using generic", e);
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
					// Create a new proposal based on rate estimate
					const deal = await getDeal(deal_id);
					const svcId = deal?.service as any;
					const service = svcId ? await getServiceById(svcId) : null;
					const propId = resultingPropertyId || (deal?.property ? String(deal.property) : undefined);
					let property = null;
					if (propId) {
						// Handle multiple property IDs for dilapidation services
						if (propId.includes(",")) {
							// For multiple properties, get the first one as representative
							const firstPropId = propId.split(",")[0].trim();
							property = await getProperty(firstPropId);
						} else {
							property = await getProperty(propId);
						}
					}
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
					const created = await createProposal({ dealId: deal_id, contactId: contact_id, propertyId: resultingPropertyId, amount, note, userId: user_id });
					quoteId = created?.id;
				}
			} catch {
				// ignore and continue without quoteId
			}

			const next = new URL(quoteUrl, baseUrl);
			if (user_id) next.searchParams.set("userId", user_id);
			if (contact_id) next.searchParams.set("contactId", contact_id);
			if (deal_id) next.searchParams.set("dealId", deal_id);
			if (resultingPropertyId) next.searchParams.set("propertyId", String(resultingPropertyId));
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
			console.log("[submitProperty] Phone not verified, going to step 3");
			const next = new URL("/steps/03-phone-verification", baseUrl);
			if (user_id) next.searchParams.set("userId", user_id);
			if (contact_id) next.searchParams.set("contactId", contact_id);
			if (deal_id) next.searchParams.set("dealId", deal_id);
			if (resultingPropertyId) next.searchParams.set("propertyId", String(resultingPropertyId));
			nextStepUrl = `${next.pathname}${next.search}`;
		}

		console.log("[submitProperty] Success - redirecting to:", nextStepUrl);
		return { success: true, nextUrl: nextStepUrl };
	} catch (_e) {
		return { success: false, message: "Failed to save property" };
	}
}
