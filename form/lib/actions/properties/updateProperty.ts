"use server";

import { patchRequest } from "@/lib/http/fetcher";
import type { PropertyRecord } from "./createProperty";

type DirectusItemResponse<T> = { data: T };

export type PropertyUpdateInput = Partial<Omit<PropertyRecord, "id" | "status">>;

export async function updateProperty(
	id: string,
	data: PropertyUpdateInput,
	options?: { publish?: boolean }
): Promise<PropertyRecord> {
	const shouldPublish = options?.publish !== undefined ? options.publish : true;
	const payload: Record<string, unknown> = shouldPublish ? { ...data, status: "published" } : { ...data };
	const res = await patchRequest<DirectusItemResponse<PropertyRecord>>(`/items/property/${id}`, payload);
	return res?.data as PropertyRecord;
}
