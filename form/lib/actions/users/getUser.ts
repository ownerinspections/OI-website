"use server";

import { getRequest } from "@/lib/http/fetcher";

export type DirectusUser = {
    id: string;
    status?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
};

type DirectusItemResponse<T> = { data: T };

/**
 * Fetch a Directus user by id via the API gateway.
 */
export async function getUser(userId: string): Promise<DirectusUser | null> {
    if (!userId) return null;
    try {
        const res = await getRequest<DirectusItemResponse<DirectusUser>>(`/users/${encodeURIComponent(userId)}`);
        return (res as any)?.data ?? null;
    } catch (_e) {
        try { console.warn("[getUser] failed", { userId, error: String(_e) }); } catch {}
        return null;
    }
}


