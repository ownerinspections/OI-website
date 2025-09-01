"use server";

import { getRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type ContactRecord = {
	id: string;
	status?: string;
	first_name?: string;
	last_name?: string;
	email?: string;
	phone?: string;
};

export async function getContact(id: string) {
	return getRequest<DirectusItemResponse<ContactRecord>>(`/items/contacts/${id}`);
}
