"use server";

import { getRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type DealRecord = {
	id: string | number;
	name?: string;
	deal_type?: "residential" | "commercial" | string;
	owner?: string;
	deal_stage?: string;
	contact?: string;
	service?: number;
	property?: string;
	addons?: number[];
};

export async function getDeal(id: string | number): Promise<DealRecord | null> {
	const res = await getRequest<DirectusItemResponse<DealRecord>>(`/items/os_deals/${id}`);
	return (res as any)?.data ?? null;
}
