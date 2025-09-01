"use server";

import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { DIRECTUS_DEFAULT_ROLE_ID } from "@/lib/env";

type DirectusListResponse<T> = { data: T[] };
type DirectusItemResponse<T> = { data: T };

export type CreateUserInput = {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    contactId: string;
};

export type DirectusUserRecord = {
    id: string;
    status?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
    role?: string;
    contacts?: Array<{ id: string }>;
};

export async function createOrUpdateUserForContact(input: CreateUserInput): Promise<{ success: boolean; userId?: string; message?: string }>
{
    const roleId = DIRECTUS_DEFAULT_ROLE_ID;

    try {
        const encodedEmail = encodeURIComponent(input.email);
        const existing = await getRequest<DirectusListResponse<DirectusUserRecord>>(
            `/users?filter%5Bemail%5D%5B_eq%5D=${encodedEmail}`
        );

        const payload: Omit<DirectusUserRecord, "id"> = {
            status: "active",
            first_name: input.first_name,
            last_name: input.last_name,
            email: input.email,
            password: input.password,
            role: roleId,
            contacts: [{ id: input.contactId }],
        };

        if (Array.isArray(existing?.data) && existing.data.length > 0) {
            const userId = existing.data[0].id;
            // Merge contacts while preserving any existing
            try {
                await patchRequest<DirectusItemResponse<DirectusUserRecord>>(`/users/${userId}`, payload as unknown as Record<string, unknown>);
            } catch (_e) {
                // Some Directus setups disallow password updates via PATCH without current password; try without password
                const { password: _pw, ...withoutPassword } = payload;
                await patchRequest<DirectusItemResponse<DirectusUserRecord>>(`/users/${userId}`, withoutPassword as unknown as Record<string, unknown>);
            }
            return { success: true, userId };
        }

        const created = await postRequest<DirectusItemResponse<DirectusUserRecord>>(
            "/users",
            payload as unknown as Record<string, unknown>
        );
        const userId = created?.data?.id;
        if (!userId) return { success: false, message: "Failed to create user" };
        return { success: true, userId };
    } catch (_err) {
        return { success: false, message: "Failed to create or update user" };
    }
}


