"use server";

import { getRequest } from "@/lib/http/fetcher";
import type { PropertyRecord } from "@/lib/actions/properties/createProperty";

type DirectusCollectionResponse<T> = { data: T[] };

export async function getPropertiesByDeal(dealId: string): Promise<PropertyRecord[]> {
	try {
		const res = await getRequest<DirectusCollectionResponse<PropertyRecord>>(
			`/items/property?filter[deals][_eq]=${dealId}&sort=date_created`
		);
		return res?.data || [];
	} catch (error) {
		console.error("[getPropertiesByDeal] Error fetching properties:", error);
		return [];
	}
}
