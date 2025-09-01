"use server";

import { postFormRequest } from "@/lib/http/fetcher";
import { VERIFY_SERVICE_SID, VERIFY_SANDBOX_ENABLED, VERIFY_SANDBOX_CODE } from "@/lib/env";

export type SendCodeResult = {
	success?: boolean;
	errors?: { phone?: string };
	message?: string;
	sandbox?: { code?: string };
};

export async function submitSendVerificationCode(_prev: SendCodeResult, formData: FormData): Promise<SendCodeResult> {
	const phone = String(formData.get("phone") ?? "").trim();
	const local = String(formData.get("phone_local") ?? "").trim();
	const localDigits = local.replace(/\D+/g, "");
	if (localDigits.length === 0) return { success: false, errors: { phone: "Phone is required" } };
	if (localDigits.length < 9) return { success: false, errors: { phone: "Phone must be 9 digits" } };
	if (localDigits[0] !== "4") return { success: false, errors: { phone: "Phone must start with 4" } };
	if (!phone || !/^\+61\d{9}$/.test(phone)) return { success: false, errors: { phone: "Phone is not valid" } };

	// Sandbox: return success and the expected code without hitting Twilio
	if (VERIFY_SANDBOX_ENABLED) {
		return { success: true, message: "Verification code sent (sandbox)", sandbox: { code: VERIFY_SANDBOX_CODE } };
	}

	if (!VERIFY_SERVICE_SID) return { success: false, message: "Missing VERIFY_SERVICE_SID" };
	try {
		const path = `/verify/Services/${encodeURIComponent(VERIFY_SERVICE_SID)}/Verifications`;
		await postFormRequest(path, { To: phone, Channel: "sms" });
		return { success: true, message: "Verification code sent" };
	} catch (_e) {
		return { success: false, message: "Failed to send code" };
	}
}
