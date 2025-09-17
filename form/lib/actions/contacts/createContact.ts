"use server";

import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { createDeal } from "@/lib/actions/deals/createDeal";
import type { DealInput } from "@/lib/actions/deals/createDeal";
import { DEAL_OWNER_ID, DEAL_STAGE_NEW_ID, KONG_GATEWAY_URL, DEAL_NAME } from "@/lib/env";
import { getServiceById } from "@/lib/actions/services/getService";
import { updateContact } from "@/lib/actions/contacts/updateContact";
import { updateDeal } from "@/lib/actions/deals/updateDeal";
import { createOrUpdateUserForContact } from "@/lib/actions/users/createUser";
import { updateUser } from "@/lib/actions/users/updateUser";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { cookies, headers } from "next/headers";

export type ContactInput = {
	first_name: string;
	last_name: string;
	email: string;
	phone: string;
};

export type ActionResult = {
	success?: boolean;
	errors?: Record<string, string>;
	message?: string;
	userId?: string;
	contactId?: string;
	dealId?: string | number;
	debug?: unknown[];
	form?: Partial<{
		first_name: string;
		last_name: string;
		email: string;
		phone: string;
		service_id: string;
	}>;
};

function validate(input: ContactInput): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!input.first_name?.trim()) errors.first_name = "First name is required";
	if (!input.last_name?.trim()) errors.last_name = "Last name is required";
	if (!input.email?.trim()) errors.email = "Email is required";
	else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(input.email)) errors.email = "Enter a valid email";
	if (!input.phone?.trim()) {
		errors.phone = "Phone is required";
	} else {
		// Check if it's in E.164 format (+61...)
		if (input.phone.startsWith("+61")) {
			const phoneDigits = input.phone.replace(/\D+/g, "");
			if (phoneDigits.length !== 11 || !phoneDigits.startsWith("614")) {
				errors.phone = "Enter a valid Australian mobile number";
			}
		} else {
			// Check if it's in local format (4xx xxx xxx or partial)
			const phoneDigits = input.phone.replace(/\D+/g, "");
			if (phoneDigits.length < 9 || !phoneDigits.startsWith("4")) {
				errors.phone = "Enter a valid Australian mobile number";
			}
		}
	}
	return errors;
}

type DirectusListResponse<T> = { data: T[] };
type DirectusItemResponse<T> = { data: T };

type ContactRecord = {
	id: string;
	status?: string;
	first_name?: string;
	last_name?: string;
	email?: string;
	phone?: string;
};

export async function createContact(data: ContactInput): Promise<ActionResult> {
	console.log("📞 [CREATE CONTACT] Starting contact creation with data:", data);
	
	const errors = validate(data);
	if (Object.keys(errors).length > 0) {
		console.log("❌ [CREATE CONTACT] Validation errors:", errors);
		return { success: false, errors, form: { ...data } };
	}

	try {
		// 1) Check if contact exists by email
		const encodedEmail = encodeURIComponent(data.email);
		console.log("📞 [CREATE CONTACT] Checking for existing contact with email:", data.email);
		const list = await getRequest<DirectusListResponse<ContactRecord>>(
			`/items/contacts?filter%5Bemail%5D%5B_eq%5D=${encodedEmail}`
		);

		let contactId: string | null = null;

		if (Array.isArray(list?.data) && list.data.length > 0) {
			// 2) Update existing (first_name, last_name, phone) — do not update email
			contactId = list.data[0].id;
			console.log("📞 [CREATE CONTACT] Found existing contact, updating:", contactId);
			await patchRequest<DirectusItemResponse<ContactRecord>>(
				`/items/contacts/${contactId}`,
				{
					first_name: data.first_name,
					last_name: data.last_name,
					phone: data.phone,
				}
			);
			console.log("✅ [CREATE CONTACT] Successfully updated existing contact");
		} else {
			// 3) Create new
			console.log("📞 [CREATE CONTACT] Creating new contact with email:", data.email);
			try {
				const created = await postRequest<DirectusItemResponse<ContactRecord>>(
					"/items/contacts",
					{
						status: "published",
						first_name: data.first_name,
						last_name: data.last_name,
						email: data.email,
						phone: data.phone,
					}
				);
				contactId = created?.data?.id ?? null;
				console.log("✅ [CREATE CONTACT] Successfully created new contact with ID:", contactId);
			} catch (e) {
				console.error("❌ [CREATE CONTACT] Failed to create contact:", e);
				throw e;
			}
		}

		if (!contactId) {
			console.log("❌ [CREATE CONTACT] No contact ID returned");
			return { success: false, message: "Failed to get contact id" };
		}

		// 4) Return success with contactId
		console.log("✅ [CREATE CONTACT] Returning success with contactId:", contactId);
		return { success: true, contactId };
	} catch (_err) {
		console.error("❌ [CREATE CONTACT] Failed to save contact:", _err);
		return { success: false, message: "Failed to save contact", form: { ...data } };
	}
}

export async function submitContact(prevState: ActionResult, formData: FormData): Promise<ActionResult> {
	const debug: unknown[] = [];
	const rawEmail = String(formData.get("email") ?? "");
	const emailNormalized = rawEmail.trim().toLowerCase();
	const payload: ContactInput = {
		first_name: String(formData.get("first_name") ?? "").trim(),
		last_name: String(formData.get("last_name") ?? "").trim(),
		email: emailNormalized,
		phone: String(formData.get("phone") ?? "").trim(),
	};


	const service_id_raw = String(formData.get("service_id") ?? "");
	const deal_id_raw = String(formData.get("deal_id") ?? "");
	const contact_id_raw = String(formData.get("contact_id") ?? "").trim();
	const property_id_raw = String(formData.get("property_id") ?? "").trim();
	const user_id_raw = String(formData.get("user_id") ?? "").trim();

	const allIdsPresent = Boolean(deal_id_raw && contact_id_raw && property_id_raw);

	const parsedInputs = {
		deal_id_raw,
		contact_id_raw,
		property_id_raw,
		service_id_raw,
		user_id_raw,
		allIdsPresent,
	};
	console.log("[submitContact] parsed inputs", parsedInputs);
	debug.push({ tag: "parsed_inputs", ...parsedInputs });

	if (!service_id_raw) {
		const errors = { ...validate(payload) };
		return {
			success: false,
			errors: { ...errors, service_id: "Service is required" },
			form: { ...payload, service_id: "" },
		};
	}

	// Define types for parallel operation results
	type UserUpdateResult = { success: true } | { success: false; error: unknown };
	type ContactResult = 
		| { success: true; contactId: string }
		| { success: false; error: unknown; critical?: boolean };

	// Batch 1: Run user update and contact resolution in parallel (independent operations)
	const [userUpdateResult, contactResult] = await Promise.all([
		// User update operation
		user_id_raw ? (async (): Promise<UserUpdateResult> => {
			console.log("[submitContact] updating existing user", { user_id_raw });
			debug.push({ tag: "update_user", user_id_raw, payload: { ...payload } });
			try {
				await updateUser(user_id_raw, {
					first_name: payload.first_name,
					last_name: payload.last_name,
					email: payload.email,
					phone: payload.phone,
				});
				console.log("[submitContact] user updated");
				debug.push({ tag: "update_user_success", user_id_raw });
				return { success: true } as const;
			} catch (_e) {
				console.error("[submitContact] failed to update user", _e);
				debug.push({ tag: "update_user_error", error: String(_e) });
				return { success: false, error: _e } as const;
			}
		})() : Promise.resolve({ success: true } as const),

		// Contact resolution operation
		contact_id_raw ? (async (): Promise<ContactResult> => {
			console.log("[submitContact] updating existing contact", { contact_id_raw });
			debug.push({ tag: "update_contact", contact_id_raw, payload: { ...payload } });
			try {
				await updateContact(contact_id_raw, {
					first_name: payload.first_name,
					last_name: payload.last_name,
					phone: payload.phone,
				});
				console.log("[submitContact] contact updated");
				debug.push({ tag: "update_contact_success", contact_id_raw });
				return { success: true, contactId: contact_id_raw };
			} catch (_e) {
				if (allIdsPresent) {
					return { success: false, error: _e, critical: true };
				}
				console.log("[submitContact] creating new contact due to update failure or no id");
				const res = await createContact(payload);
				if (!res.success || !res.contactId) return { success: false, error: res };
				debug.push({ tag: "create_contact", contactId: res.contactId });
				return { success: true, contactId: res.contactId };
			}
		})() : (async (): Promise<ContactResult> => {
			console.log("[submitContact] creating new contact (no contact_id in payload)");
			const res = await createContact(payload);
			if (!res.success || !res.contactId) return { success: false, error: res };
			debug.push({ tag: "create_contact", contactId: res.contactId });
			return { success: true, contactId: res.contactId };
		})(),
	]);

	// Handle contact result
	if (!contactResult.success) {
		if (contactResult.critical) {
			return {
				success: false,
				message: "Failed to update existing contact",
				debug,
				form: { ...payload, service_id: service_id_raw },
			};
		}
		return contactResult.error as ActionResult;
	}

	const resolvedContactId = contactResult.contactId;

	// Use existing userId if provided, otherwise ensure a Directus user exists for the contact
	let userIdForDeal: string | undefined = user_id_raw || undefined;
	
	if (!user_id_raw) {
		// Only create/update user if no userId was provided in URL
		try {
			const passwordFromPhone = payload.phone.replace(/^\+/, "");
			const userRes = await createOrUpdateUserForContact({
				first_name: payload.first_name,
				last_name: payload.last_name,
				email: payload.email,
				password: passwordFromPhone,
				phone: payload.phone,
				contact_id: resolvedContactId || undefined,
			});
			userIdForDeal = userRes.userId;
			debug.push({ tag: "user_sync", success: userRes.success, userId: userRes.userId });
		} catch (_e) {
			debug.push({ tag: "user_sync_error", error: String(_e) });
		}
	} else {
		debug.push({ tag: "user_existing", userId: user_id_raw });
	}
	
	// Link contact to user similar to how deal links to user
	if (userIdForDeal && resolvedContactId) {
		try {
			await updateContact(resolvedContactId, { user: userIdForDeal } as any);
			debug.push({ tag: "contact_link_user", contactId: resolvedContactId, userId: userIdForDeal });
		} catch (linkErr) {
			debug.push({ tag: "contact_link_user_error", error: String(linkErr) });
		}
	}

	// Step 1: do not create or update property
	let propertyId: string | undefined = undefined;

	try {
		const serviceId = Number(service_id_raw);
		console.log("[submitContact] resolving service", { serviceId });
		const service = await getServiceById(serviceId);
		console.log("[submitContact] resolved service", { name: service?.service_name });
		debug.push({ tag: "service_resolved", serviceId, name: service?.service_name });
		const dealPayload: DealInput = {
			name: service?.service_name ? `${service.service_name} ${DEAL_NAME}` : DEAL_NAME,
			deal_type: service?.property_category === "commercial" ? "commercial" : "residential",
			owner: DEAL_OWNER_ID,
			deal_stage: DEAL_STAGE_NEW_ID,
			contact: resolvedContactId!,
			service: serviceId,
			...(userIdForDeal ? { user: userIdForDeal } : {} as any),
		};

		let dealId: string | number | undefined = undefined;
		if (deal_id_raw) {
			// Use existing deal id
			console.log("[submitContact] using existing deal id", { deal_id_raw });
			dealId = deal_id_raw;
			debug.push({ tag: "deal_existing", dealId: deal_id_raw });
		} else {
			console.log("[submitContact] creating new deal", { dealPayload });
			const created = await createDeal(dealPayload);
			console.log("[submitContact] created deal", { id: created?.id });
			dealId = created?.id;
			debug.push({ tag: "deal_created", dealId });
		}

		if (!dealId) {
			return {
				success: false,
				contactId: resolvedContactId!,
				message: "Failed to resolve deal",
				form: { ...payload, service_id: service_id_raw },
			};
		}

		// Update existing deal with confirmed property category and service (always send service when deal id exists)
		if (deal_id_raw) {
			try {
				const newServiceId = Number(service_id_raw);
				// IMPORTANT: Do not include property in deal update per requirement
				const payload: Record<string, unknown> = {
					// Keep existing deal_type as-is or align with selected service
					service: newServiceId,
					...(userIdForDeal ? { user: userIdForDeal } : {}),
				};

				const url = `${KONG_GATEWAY_URL.replace(/\/$/, "")}/items/os_deals/${deal_id_raw}`;
				console.log("[submitContact] updating existing deal (force service)", { method: "PATCH", url, payload });
				debug.push({ tag: "update_deal", method: "PATCH", url, dealId: deal_id_raw, payload });

				const updated = await updateDeal(deal_id_raw, payload);
				console.log("[submitContact] updated deal success");
				debug.push({ tag: "update_deal_success", dealId: deal_id_raw, response: updated });
			} catch (_e) {
				console.error("[submitContact] failed updating deal", _e);
				debug.push({ tag: "update_deal_error", error: String(_e) });
			}
		}

		console.log("[submitContact] success", { contactId: resolvedContactId, dealId });
		debug.push({ tag: "success", contactId: resolvedContactId, dealId });
		return { success: true, userId: userIdForDeal, contactId: resolvedContactId!, dealId, debug };
	} catch (_e) {
		console.error("[submitContact] error", _e);
		return {
			success: false,
			userId: userIdForDeal,
			contactId: resolvedContactId!,
			message: "Failed to create property or deal",
			debug,
			form: { ...payload, service_id: service_id_raw },
		};
	}
}
