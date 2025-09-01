"use server";

import { postRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type PropertyRecord = {
	id: string;
	status?: "draft" | "published" | string;
	property_category?: "residential" | "commercial" | string;
	property_type?: string;
	street_address?: string;
	unit_number?: string;
	suburb?: string;
	state?: string;
	post_code?: string;
	full_address?: string;
	realestate_url?: string | null;
	number_of_bedrooms?: number;
	number_of_bathrooms?: number;
	number_of_levels?: number;
	property_description?: string;
	area_sq?: string | number;
	basement?: boolean;
	additional_structures?: string | null;
	contact?: string;
	deals?: string | string[];
	termite_risk?: string | null;
	termite_risk_reason?: string | null;
	// Newly added extracted metadata fields
	land_size?: string | number | null;
	year_built?: string | number | null;
	bushfire_prone?: string | boolean | null;
	flood_risk?: string | boolean | null;
	heritage_overlay?: string | boolean | null;
	last_sold?: string | null;
	last_rental?: string | null;
};

export type PropertyCreateInput = Omit<PropertyRecord, "id" | "status">;

export async function createProperty(data: PropertyCreateInput): Promise<PropertyRecord> {
	const payload: Record<string, unknown> = {
		...data,
		status: "published",
	};

	const res = await postRequest<DirectusItemResponse<PropertyRecord>>("/items/property", payload);
	return res?.data as PropertyRecord;
}
