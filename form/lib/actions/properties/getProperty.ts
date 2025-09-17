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
			return null;
		}
		// Re-throw other errors
		throw error;
	}
}
