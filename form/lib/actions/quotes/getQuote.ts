"use server";

import { getRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type QuoteRecord = {
	id: string | number;
	deal: string | number;
	contact: string | number;
	property: string | number;
	service: number;
	service_code: string;
	property_category: "residential" | "commercial";
	amount: number;
	currency?: string;
	note?: string | null;
	stage_prices?: unknown | null;
	status?: string;
};

export async function getQuote(id: string | number): Promise<QuoteRecord | null> {
	const res = await getRequest<DirectusItemResponse<QuoteRecord>>(`/items/os_quotes/${id}`);
	return (res as any)?.data ?? null;
}
