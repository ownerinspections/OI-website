"use server";

import { getRequest } from "@/lib/http/fetcher";
import type { PropertyRecord } from "./createProperty";

type DirectusItemResponse<T> = { data: T };

export async function getProperty(id: string): Promise<PropertyRecord | null> {
	try {
		const res = await getRequest<DirectusItemResponse<PropertyRecord>>(`/items/property/${id}`);
		return res?.data as PropertyRecord;
	} catch (error) {
		// If it's a 404 or similar error, return null instead of throwing
		if (error instanceof Error && error.message.includes('404')) {
			console.warn(`[getProperty] Property not found for ID: ${id}`);
			return null;
		}
		// Log the error with context before re-throwing
		console.error(`[getProperty] Error fetching property with ID: ${id}`, error);
		// Re-throw other errors
		throw error;
	}
}
