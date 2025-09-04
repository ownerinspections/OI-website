"use server";

import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { CLIENT_ROLE_ID } from "@/lib/env";

type DirectusListResponse<T> = { data: T[] };
type DirectusItemResponse<T> = { data: T };

export type CreateUserInput = {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    phone: string;
    contact_id?: string;
};

export type DirectusUserRecord = {
    id: string;
    status?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
    role?: string;
    phone?: string;
};

export async function createOrUpdateUserForContact(input: CreateUserInput): Promise<{ success: boolean; userId?: string; message?: string }>
{
    const roleId = CLIENT_ROLE_ID;

    try {
        try { console.log("[user][sync] Start", { email: input.email }); } catch {}
        const encodedEmail = encodeURIComponent(input.email);
        const existing = await getRequest<DirectusListResponse<DirectusUserRecord>>(
            `/users?filter%5Bemail%5D%5B_eq%5D=${encodedEmail}`
        );

        const payload: Omit<DirectusUserRecord, "id"> & { contact?: string } = {
            status: "unverified",
            first_name: input.first_name,
            last_name: input.last_name,
            email: input.email,
            password: input.password,
            role: roleId,
            phone: input.phone,
            ...(input.contact_id ? { contact: input.contact_id } : {}),
        };

        if (Array.isArray(existing?.data) && existing.data.length > 0) {
            const userId = existing.data[0].id;
            // Merge user fields while preserving any existing; ensure contact relation is set
            try {
                try { console.log("[user][sync] Updating existing user", { userId, email: input.email }); } catch {}
                await patchRequest<DirectusItemResponse<DirectusUserRecord>>(`/users/${userId}`, payload as unknown as Record<string, unknown>);
            } catch (_e) {
                // Some Directus setups disallow password updates via PATCH without current password; try without password
                const { password: _pw, ...withoutPassword } = payload;
                try { console.warn("[user][sync] Retrying update without password", { userId, email: input.email, error: String(_e) }); } catch {}
                await patchRequest<DirectusItemResponse<DirectusUserRecord>>(`/users/${userId}`, withoutPassword as unknown as Record<string, unknown>);
            }
            return { success: true, userId };
        }

        try { console.log("[user][sync] Creating new user", { email: input.email }); } catch {}
        const created = await postRequest<DirectusItemResponse<DirectusUserRecord>>(
            "/users",
            payload as unknown as Record<string, unknown>
        );
        const userId = created?.data?.id;
        if (!userId) return { success: false, message: "Failed to create user" };
        return { success: true, userId };
    } catch (_err) {
        try { console.error("[user][sync] Failed to create or update user", { email: input.email, error: String(_err) }); } catch {}
        return { success: false, message: "Failed to create or update user" };
    }
}


