"use server";

import { patchRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export async function updateContact<T extends Record<string, unknown>>(id: string, data: T) {
	return patchRequest<DirectusItemResponse<T>>(`/items/contacts/${id}`, data);
}
