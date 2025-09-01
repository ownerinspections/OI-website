"use server";

import { getRequest } from "@/lib/http/fetcher";
import type { PropertyRecord } from "./createProperty";

type DirectusItemResponse<T> = { data: T };

export async function getProperty(id: string): Promise<PropertyRecord> {
	const res = await getRequest<DirectusItemResponse<PropertyRecord>>(`/items/property/${id}`);
	return res?.data as PropertyRecord;
}
