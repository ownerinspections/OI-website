"use server";

import { updateContact } from "@/lib/actions/contacts/updateContact";

export type UpdatePhoneResult = {
    success?: boolean;
    errors?: { contact_id?: string; phone?: string };
    message?: string;
    phone?: string;
};

export async function submitUpdatePhone(_prev: UpdatePhoneResult, formData: FormData): Promise<UpdatePhoneResult> {
    const contact_id = String(formData.get("contact_id") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();
    const local = String(formData.get("phone_local") ?? "").trim();
    const localDigits = local.replace(/\D+/g, "");

    if (!contact_id) return { success: false, errors: { contact_id: "Missing contact" } };

    // Mirror step 1 validation messages
    if (localDigits.length === 0) return { success: false, errors: { phone: "Phone is required" } };
    if (localDigits.length < 9) return { success: false, errors: { phone: "Phone must be 9 digits" } };
    if (localDigits[0] !== "4") return { success: false, errors: { phone: "Phone must start with 4" } };
    if (!phone || !/^\+61\d{9}$/.test(phone)) return { success: false, errors: { phone: "Phone is not valid" } };

    try {
        await updateContact(contact_id, { phone });
        return { success: true, phone };
    } catch (_e) {
        return { success: false, message: "Failed to update phone" };
    }
}


