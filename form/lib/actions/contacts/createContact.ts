"use server";

import { getRequest, patchRequest, postRequest } from "@/lib/http/fetcher";
import { createDeal } from "@/lib/actions/deals/createDeal";
import type { DealInput } from "@/lib/actions/deals/createDeal";
import { DEAL_OWNER_ID, DEAL_STAGE_NEW_ID, KONG_GATEWAY_URL, DEAL_NAME } from "@/lib/env";
import { getServiceById } from "@/lib/actions/services/getService";
import { updateContact } from "@/lib/actions/contacts/updateContact";
import { updateDeal } from "@/lib/actions/deals/updateDeal";
import { createOrUpdateUserForContact } from "@/lib/actions/users/createUser";
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
	else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.email = "Enter a valid email";
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
	const errors = validate(data);
	if (Object.keys(errors).length > 0) {
		return { success: false, errors, form: { ...data } };
	}

	try {
		// 1) Check if contact exists by email
		const encodedEmail = encodeURIComponent(data.email);
		const list = await getRequest<DirectusListResponse<ContactRecord>>(
			`/items/contacts?filter%5Bemail%5D%5B_eq%5D=${encodedEmail}`
		);

		let contactId: string | null = null;

		if (Array.isArray(list?.data) && list.data.length > 0) {
			// 2) Update existing (first_name, last_name, phone) — do not update email
			contactId = list.data[0].id;
			await patchRequest<DirectusItemResponse<ContactRecord>>(
				`/items/contacts/${contactId}`,
				{
					first_name: data.first_name,
					last_name: data.last_name,
					phone: data.phone,
				}
			);
		} else {
			// 3) Create new
			try {
				try { console.log("[contact][create] Creating new contact", { email: data.email }); } catch {}
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
				try { console.log("[contact][create] Created contact", { contactId }); } catch {}
			} catch (e) {
				try { console.error("[contact][create] Failed", { email: data.email, error: String(e) }); } catch {}
				throw e;
			}
		}

		if (!contactId) {
			return { success: false, message: "Failed to get contact id" };
		}

		// 4) Return success with contactId
		return { success: true, contactId };
	} catch (_err) {
		try { console.error("[contact] Failed to save contact", { email: data.email, error: String(_err) }); } catch {}
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

	const allIdsPresent = Boolean(deal_id_raw && contact_id_raw && property_id_raw);

	const parsedInputs = {
		deal_id_raw,
		contact_id_raw,
		property_id_raw,
		service_id_raw,
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

	// Resolve or create contact
	let resolvedContactId: string | null = null;
	if (contact_id_raw) {
		console.log("[submitContact] updating existing contact", { contact_id_raw });
		debug.push({ tag: "update_contact", contact_id_raw, payload: { ...payload } });
		try {
			await updateContact(contact_id_raw, {
				first_name: payload.first_name,
				last_name: payload.last_name,
				phone: payload.phone,
			});
			resolvedContactId = contact_id_raw;
			console.log("[submitContact] contact updated");
			debug.push({ tag: "update_contact_success", contact_id_raw });
		} catch (_e) {
			if (allIdsPresent) {
				return {
					success: false,
					message: "Failed to update existing contact",
					debug,
					form: { ...payload, service_id: service_id_raw },
				};
			}
			console.log("[submitContact] creating new contact due to update failure or no id");
			const res = await createContact(payload);
			if (!res.success || !res.contactId) return res;
			resolvedContactId = res.contactId;
			debug.push({ tag: "create_contact", contactId: resolvedContactId });
		}
	} else {
		console.log("[submitContact] creating new contact (no contact_id in payload)");
		const res = await createContact(payload);
		if (!res.success || !res.contactId) return res;
		resolvedContactId = res.contactId;
		debug.push({ tag: "create_contact", contactId: resolvedContactId });
	}

	// Ensure a Directus user exists for the contact (no login in step 1)
	let access_token: string | undefined = undefined;
	let refresh_token: string | undefined = undefined;
	let expires: number | undefined = undefined;
	let expires_at: number | undefined = undefined;
	let userIdForDeal: string | undefined = undefined;
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
		// Link contact to user similar to how deal links to user
		if (userIdForDeal && resolvedContactId) {
			try {
				await updateContact(resolvedContactId, { user: userIdForDeal } as any);
				debug.push({ tag: "contact_link_user", contactId: resolvedContactId, userId: userIdForDeal });
			} catch (linkErr) {
				debug.push({ tag: "contact_link_user_error", error: String(linkErr) });
			}
		}
	} catch (_e) {
		debug.push({ tag: "user_sync_error", error: String(_e) });
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
