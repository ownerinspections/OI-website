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

export async function submitProperty(_prev: SubmitResult, formData: FormData): Promise<SubmitResult> {
	const property_id = String(formData.get("property_id") ?? "").trim();
	const deal_id = String(formData.get("deal_id") ?? "").trim();
	const contact_id = String(formData.get("contact_id") ?? "").trim();

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
	let extractedAgents: Array<{ first_name?: string; last_name?: string; mobile?: string }> = [];
	const agentsJsonRaw = String(formData.get("agents_json") ?? "").trim();
	if (agentsJsonRaw) {
		try {
			const arr = JSON.parse(agentsJsonRaw);
			if (Array.isArray(arr)) {
				extractedAgents = arr as Array<{ first_name?: string; last_name?: string; mobile?: string }>;
			}
		} catch {}
	}
	if (extractedAgents.length === 0) {
		for (let i = 0; i < 5; i++) {
			const fn = String(formData.get(`agent_${i}_first_name`) ?? "").trim();
			const ln = String(formData.get(`agent_${i}_last_name`) ?? "").trim();
			const mb = String(formData.get(`agent_${i}_mobile`) ?? "").trim();
			if (fn || ln || mb) extractedAgents.push({ first_name: fn, last_name: ln, mobile: mb });
		}
	}

	const errors: Record<string, string> = {};

	// Address must be selected
	if (!full_address) {
		errors.full_address = "Please select a valid address";
	}
	if (full_address && (!suburb || !state || !post_code)) {
		errors.full_address = "Please select a valid address suggestion";
	}

	// Required quoting fields
	if (!quoting_property_classification) errors.quoting_property_classification = "Required";
	if (!quoting_property_type) errors.quoting_property_type = "Required";
	if (!quoting_bedrooms_including_study) errors.quoting_bedrooms_including_study = "Required";
	if (!quoting_bathrooms_rounded) errors.quoting_bathrooms_rounded = "Required";

	// Property-type specific required fields
	const isApartmentUnit = quoting_property_type.toLowerCase() === "apartment/unit";
	if (!isApartmentUnit) {
		if (!quoting_levels) errors.quoting_levels = "Required";
		if (!quoting_has_basement_or_subfloor) errors.quoting_has_basement_or_subfloor = "Required";
		// additional_structures is optional
	}

	// Numeric checks
	if (quoting_bedrooms_including_study && !/^\d+$/.test(quoting_bedrooms_including_study)) {
		errors.quoting_bedrooms_including_study = "Must be a number";
	}
	if (quoting_bathrooms_rounded && !/^\d+$/.test(quoting_bathrooms_rounded)) {
		errors.quoting_bathrooms_rounded = "Must be a number";
	}
	if (quoting_levels && !/^\d+$/.test(quoting_levels)) {
		errors.quoting_levels = "Must be a number";
	}

	if (Object.keys(errors).length > 0) {
		return { success: false, errors };
	}

	try {
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
			number_of_levels: quoting_levels ? Number(quoting_levels) : null,
			property_category: quoting_property_classification ? quoting_property_classification.toLowerCase() : null,
			property_type: quoting_property_type || null,
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
		};

		let resultingPropertyId: string | undefined = undefined;
		if (property_id) {
			const updated = await updateProperty(property_id, payload as any);
			resultingPropertyId = updated?.id ? String(updated.id) : property_id;
			// For existing property, optionally create agents if provided
			if (resultingPropertyId && extractedAgents.length > 0) {
				await createAgentsForProperty(resultingPropertyId, extractedAgents);
			}
		} else {
			const created = await createProperty(payload as any);
			resultingPropertyId = created?.id ? String(created.id) : undefined;
			// Create listing agents for the newly created property if any
			if (resultingPropertyId && extractedAgents.length > 0) {
				await createAgentsForProperty(resultingPropertyId, extractedAgents);
			}
		}

		const next = new URL("/steps/03-phone-verification", "http://localhost");
		if (contact_id) next.searchParams.set("contactId", contact_id);
		if (deal_id) next.searchParams.set("dealId", deal_id);
		if (resultingPropertyId) next.searchParams.set("propertyId", String(resultingPropertyId));
		return { success: true, nextUrl: `${next.pathname}${next.search}` };
	} catch (_e) {
		return { success: false, message: "Failed to save property" };
	}
}
