"use server";

import { patchRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type QuoteUpdateInput = Partial<{
	amount: number;
	currency: string;
	note: string | null;
	stage_prices: unknown | null;
	status: string;
}>;

export async function updateQuote(id: string | number, data: QuoteUpdateInput) {
	const res = await patchRequest<DirectusItemResponse<unknown>>(`/items/os_quotes/${id}`, data as unknown as Record<string, unknown>);
	return (res as any)?.data ?? null;
}
