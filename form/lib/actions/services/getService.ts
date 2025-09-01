"use server";

import { getRequest } from "@/lib/http/fetcher";

type DirectusListResponse<T> = { data: T[] };

export type ServiceRecord = {
	id: number;
	service_name: string;
	service_type: string | null;
	property_category: "residential" | "commercial";
};

export async function listServicesByCategory(category: "residential" | "commercial") {
	const encoded = encodeURIComponent(category);
	const res = await getRequest<DirectusListResponse<ServiceRecord>>(`/items/services?filter%5Bproperty_category%5D%5B_eq%5D=${encoded}`);
	return res?.data ?? [];
}

export async function listAllServices() {
	const res = await getRequest<DirectusListResponse<ServiceRecord>>(`/items/services`);
	return res?.data ?? [];
}

type DirectusItemResponse<T> = { data: T };
export async function getServiceById(id: number | string) {
	const res = await getRequest<DirectusItemResponse<ServiceRecord>>(`/items/services/${id}`);
	return res?.data ?? null;
}
