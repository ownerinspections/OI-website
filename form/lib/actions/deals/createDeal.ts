"use server";

import { DEAL_OWNER_ID, DEAL_STAGE_NEW_ID } from "@/lib/env";
import { postRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type DealInput = {
	name: string;
	deal_type: "residential" | "commercial";
	owner: string;
	deal_stage: string;
	service: number;
	property?: string;
	user?: string;
};

export type DealRecord = {
	id: string | number;
};

export async function createDeal(data: DealInput) {
	const payload: DealInput = {
		name: data.name,
		deal_type: data.deal_type,
		owner: data.owner || DEAL_OWNER_ID,
		deal_stage: data.deal_stage || DEAL_STAGE_NEW_ID,
		service: data.service,
		...(data.property ? { property: data.property } : {} as any),
		...(data.user ? { user: data.user } : {} as any),
	};

	const res = await postRequest<DirectusItemResponse<DealRecord>>("/items/os_deals", payload as unknown as Record<string, unknown>);
	return res?.data;
}
