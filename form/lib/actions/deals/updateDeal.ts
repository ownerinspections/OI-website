"use server";

import { patchRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type DealUpdateInput = Partial<{
	name: string;
	deal_type: "residential" | "commercial" | string;
	owner: string;
	deal_stage: string;
	contact: string;
	service: number;
	property?: string;
	addons?: number[];
	user?: string;
	deal_value?: number;
	close_date?: string;
}>;

export type DealRecord = {
	id: string | number;
};

export async function updateDeal(id: string | number, data: DealUpdateInput) {
	try {
		console.log("[updateDeal] request", { id, data });
		const res = await patchRequest<DirectusItemResponse<DealRecord>>(`/items/os_deals/${id}`, data as Record<string, unknown>);
		console.log("[updateDeal] response", res);
		return res?.data;
	} catch (err) {
		console.error("[updateDeal] error", err);
		throw err;
	}
}
