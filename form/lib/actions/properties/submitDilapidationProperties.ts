"use server";

import { createProperty } from "@/lib/actions/properties/createProperty";
import { updateProperty } from "@/lib/actions/properties/updateProperty";
import { createAgentsForProperty } from "@/lib/actions/agents/createAgent";

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
		if (quoting_levels && !/^\d+$/.test(quoting_levels)) {
			errors[`property_${index}_quoting_levels`] = "Must be a number";
		}

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

		// Process each property
		for (const property of properties) {
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
				number_of_levels: property.quoting_levels ? Number(property.quoting_levels) : null,
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

				// Create agents for this property if any
				if (property.agents_json) {
					try {
						const agents = JSON.parse(property.agents_json);
						if (Array.isArray(agents) && agents.length > 0) {
							await createAgentsForProperty(resultingPropertyId, agents);
						}
					} catch (e) {
						console.warn(`[submitDilapidationProperties] Failed to parse agents for property ${resultingPropertyId}:`, e);
					}
				}
			}
		}

		console.log(`[submitDilapidationProperties] Successfully created/updated ${createdPropertyIds.length} properties:`, createdPropertyIds);
		console.log(`[submitDilapidationProperties] All property IDs to be added to URL:`, createdPropertyIds.join(","));

		const next = new URL("/steps/03-phone-verification", "http://localhost");
		if (user_id) next.searchParams.set("userId", user_id);
		if (contact_id) next.searchParams.set("contactId", contact_id);
		if (deal_id) next.searchParams.set("dealId", deal_id);
		// Pass all property IDs - use propertyId for consistency with other services
		if (createdPropertyIds.length > 0) {
			next.searchParams.set("propertyId", createdPropertyIds.join(","));
		}
		console.log("[submitDilapidationProperties] Success - redirecting to:", `${next.pathname}${next.search}`);
		return { success: true, nextUrl: `${next.pathname}${next.search}` };
	} catch (e) {
		console.error("[submitDilapidationProperties] Error:", e);
		return { success: false, message: "Failed to save properties" };
	}
}
