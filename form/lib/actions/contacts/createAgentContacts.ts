"use server";

import { getRequest, postRequest, patchRequest } from "@/lib/http/fetcher";
import { createContact } from "@/lib/actions/contacts/createContact";
import type { ContactInput } from "@/lib/actions/contacts/createContact";

type DirectusListResponse<T> = { data: T[] };

export type AgentContactRecord = {
	id: string;
	first_name?: string | null;
	last_name?: string | null;
	phone?: string | null;
	email?: string | null;
	contact_type?: string | null;
};

export async function createAgentContactsForDeal(
	dealId: string | number,
	userId: string | number,
	agents: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>
): Promise<Array<AgentContactRecord>> {
	console.log("👤 [CREATE AGENT CONTACTS] Starting agent contact creation for deal:", dealId, "user:", userId, "with agents:", agents);
	
	async function findContactByEmail(email: string): Promise<AgentContactRecord | null> {
		try {
			console.log("👤 [CREATE AGENT CONTACTS] Searching for existing contact with email:", email);
			const q = `/items/contacts?filter%5Bemail%5D%5B_eq%5D=${encodeURIComponent(email)}`;
			const res = await getRequest<DirectusListResponse<AgentContactRecord>>(q);
			const arr = Array.isArray(res?.data) ? res!.data! : [];
			const found = arr.length > 0 ? (arr[0] as AgentContactRecord) : null;
			console.log("👤 [CREATE AGENT CONTACTS] Contact search result:", found ? `Found contact ${found.id}` : "No existing contact found");
			return found;
		} catch (e) {
			console.error("❌ [CREATE AGENT CONTACTS] findContactByEmail failed:", { email, e });
			return null;
		}
	}

	async function findContactByPhone(phone: string): Promise<AgentContactRecord | null> {
		try {
			console.log("👤 [CREATE AGENT CONTACTS] Searching for existing contact with phone:", phone);
			const q = `/items/contacts?filter%5Bphone%5D%5B_eq%5D=${encodeURIComponent(phone)}`;
			const res = await getRequest<DirectusListResponse<AgentContactRecord>>(q);
			const arr = Array.isArray(res?.data) ? res!.data! : [];
			const found = arr.length > 0 ? (arr[0] as AgentContactRecord) : null;
			console.log("👤 [CREATE AGENT CONTACTS] Contact search result by phone:", found ? `Found contact ${found.id}` : "No existing contact found");
			return found;
		} catch (e) {
			console.error("❌ [CREATE AGENT CONTACTS] findContactByPhone failed:", { phone, e });
			return null;
		}
	}

	async function linkContactToUser(contactId: string | number, userId: string | number): Promise<void> {
		console.log("🔗 [CREATE AGENT CONTACTS] Linking contact", contactId, "to user", userId);
		try {
			// Link contact to user by updating the contact's user field directly
			await patchRequest(`/items/contacts/${contactId}`, { 
				user: userId 
			});
			console.log("✅ [CREATE AGENT CONTACTS] Successfully linked contact to user");
		} catch (e) {
			console.error("❌ [CREATE AGENT CONTACTS] Failed linking contact to user:", { contactId, userId, e });
		}
	}

	async function linkContactToDeal(contactId: string | number, dealId: string | number): Promise<void> {
		console.log("🔗 [CREATE AGENT CONTACTS] Linking contact", contactId, "to deal", dealId);
		try {
			// Create many-to-many relationship via junction table
			await postRequest("/items/os_deals_contacts", { 
				os_deals_id: dealId, 
				contacts_id: contactId 
			});
			console.log("✅ [CREATE AGENT CONTACTS] Successfully linked contact to deal via junction table");
		} catch (e) {
			console.error("❌ [CREATE AGENT CONTACTS] Failed linking contact to deal:", { contactId, dealId, e });
		}
	}


	const validAgents = (agents || []).filter((a) => {
		const fn = (a?.first_name || "").trim();
		const ln = (a?.last_name || "").trim();
		const mb = (a?.mobile || "").trim();
		const em = (a?.email || "").trim();
		const isValid = fn !== "" || ln !== "" || mb !== "" || em !== "";
		console.log("👤 [CREATE AGENT CONTACTS] Agent validation:", { agent: a, isValid });
		return isValid;
	});
	
	console.log("👤 [CREATE AGENT CONTACTS] Valid agents count:", validAgents.length);
	if (validAgents.length === 0) {
		console.log("⚠️ [CREATE AGENT CONTACTS] No valid agents to process");
		return [];
	}
	
		const results: Array<AgentContactRecord> = [];
	for (const a of validAgents) {
		try {
			console.log("👤 [CREATE AGENT CONTACTS] Processing agent:", a);
			const email = (a.email || "").trim();
			const phone = (a.mobile || "").trim();
			let contactToUse: AgentContactRecord | null = null;
			
			// Check for existing contact by email first
			if (email && email !== "N/A") {
				const existing = await findContactByEmail(email);
				if (existing && existing.id) {
					contactToUse = existing;
					console.log("👤 [CREATE AGENT CONTACTS] Using existing contact by email:", { email, id: existing.id });
				}
			}
			
			// If no contact found by email, check by phone number
			if (!contactToUse && phone && phone !== "N/A") {
				const existing = await findContactByPhone(phone);
				if (existing && existing.id) {
					contactToUse = existing;
					console.log("👤 [CREATE AGENT CONTACTS] Using existing contact by phone:", { phone, id: existing.id });
				}
			}
			
			if (!contactToUse) {
				console.log("👤 [CREATE AGENT CONTACTS] Creating new agent contact with data:", a);
				
				// Prepare contact data with agent type - create directly via API to bypass validation
				const firstName = (a.first_name || "").trim() || "Unknown";
				const lastName = (a.last_name || "").trim() || "Agent";
				const agentEmail = email && email !== "N/A" ? email : ""; // Empty string for missing email
				const agentPhone = phone && phone !== "N/A" ? phone : ""; // Empty string for missing phone
				
				console.log("👤 [CREATE AGENT CONTACTS] Processed agent data:", { firstName, lastName, agentEmail, agentPhone });
				
				try {
					// Create agent contact directly via API to avoid validation issues
				const payload: Record<string, any> = {
					status: "published",
					first_name: firstName,
					last_name: lastName,
					email: agentEmail, // Will be empty string if not available
					phone: agentPhone, // Will be empty string if not available
					contact_type: "real_estate_agent"
				};
					
					const created = await postRequest<{ data: AgentContactRecord }>("/items/contacts", payload);
					
					if (!created?.data?.id) {
						console.error("❌ [CREATE AGENT CONTACTS] Failed to create agent contact - no ID returned");
						continue;
					}
					
				contactToUse = {
					id: created.data.id,
					first_name: firstName,
					last_name: lastName,
					phone: agentPhone || null,
					email: agentEmail || null,
					contact_type: "real_estate_agent"
				};
					
					console.log("✅ [CREATE AGENT CONTACTS] Successfully created new agent contact with ID:", contactToUse.id);
				} catch (createError) {
					console.error("❌ [CREATE AGENT CONTACTS] Failed to create agent contact:", createError);
					continue;
				}
			}
			
			results.push(contactToUse);
			
			// Link to user and deal (same approach as step 1)
			await linkContactToUser(contactToUse.id, userId);
			await linkContactToDeal(contactToUse.id, dealId);
			
			console.log("✅ [CREATE AGENT CONTACTS] Successfully processed agent contact:", contactToUse.id);
		} catch (_e) {
			console.error("❌ [CREATE AGENT CONTACTS] Failed creating agent contact for deal:", { dealId, userId, agent: a, error: _e });
		}
	}

	console.log("✅ [CREATE AGENT CONTACTS] Returning results:", results.map(r => r.id));
	return results;
}
