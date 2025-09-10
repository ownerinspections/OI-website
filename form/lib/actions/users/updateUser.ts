"use server";

import { patchRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type UpdateUserInput = {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
};

export async function updateUser<T extends Record<string, unknown>>(id: string, data: T) {
    return patchRequest<DirectusItemResponse<T>>(`/users/${id}`, data);
}
