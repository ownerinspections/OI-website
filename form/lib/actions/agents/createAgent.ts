"use server";

import { getRequest, postRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };
type DirectusListResponse<T> = { data: T[] };

export type AgentRecord = {
	id: string | number;
	first_name?: string | null;
	last_name?: string | null;
	mobile?: string | null;
	phone?: string | null;
	email?: string | null;
};

export type AgentCreateInput = Omit<AgentRecord, "id">;

function validateAgent(data: AgentCreateInput): Record<string, string> {
	const errors: Record<string, string> = {};
	if (!data.first_name?.trim()) errors.first_name = "First name is required";
	if (!data.last_name?.trim()) errors.last_name = "Last name is required";
	
	// Skip mobile validation if it's "N/A" (for extracted agents)
	const mobile = data.mobile?.trim();
	if (!mobile) {
		errors.mobile = "Mobile number is required";
	} else if (mobile !== "N/A") {
		// Check if it's in E.164 format (+61...)
		if (mobile.startsWith("+61")) {
			const phoneDigits = mobile.replace(/\D+/g, "");
			if (phoneDigits.length !== 11 || !phoneDigits.startsWith("614")) {
				errors.mobile = "Enter a valid Australian mobile number";
			}
		} else {
			// Check if it's in local format (4xx xxx xxx or partial)
			const phoneDigits = mobile.replace(/\D+/g, "");
			if (phoneDigits.length < 9 || !phoneDigits.startsWith("4")) {
				errors.mobile = "Enter a valid Australian mobile number";
			}
		}
	}
	return errors;
}

export async function createAgent(data: AgentCreateInput, skipValidation = false): Promise<AgentRecord> {
	// Validate required fields only if not skipping validation
	if (!skipValidation) {
		const errors = validateAgent(data);
		if (Object.keys(errors).length > 0) {
			console.log("❌ [CREATE AGENT] Validation errors:", errors);
			throw new Error(`Validation failed: ${Object.values(errors).join(", ")}`);
		}
	}

	const first = (data.first_name || "").trim() || null;
	const last = (data.last_name || "").trim() || null;
	const mobileVal = (data.mobile || "").trim() || null;
	const emailVal = (data.email || "").trim() || null;
	
	// Convert "N/A" values to null for extracted agents
	const cleanMobile = mobileVal === "N/A" ? null : mobileVal;
	const cleanEmail = emailVal === "N/A" ? null : emailVal;

	function compact(obj: Record<string, unknown>): Record<string, unknown> {
		return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
	}

	const payload = compact({
		first_name: first,
		last_name: last,
		mobile: cleanMobile,
		email: cleanEmail,
	});
	const res = await postRequest<DirectusItemResponse<AgentRecord>>("/items/agents", payload);
	return res?.data as AgentRecord;
}

export async function createAgentsForProperty(
	propertyId: string | number,
	agents: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>
): Promise<Array<AgentRecord>> {
	console.log("👤 [CREATE AGENTS] Starting agent creation for property:", propertyId, "with agents:", agents);
	
	async function findAgentByEmail(email: string): Promise<AgentRecord | null> {
		try {
			console.log("👤 [CREATE AGENTS] Searching for existing agent with email:", email);
			const q = `/items/agents?filter%5Bemail%5D%5B_eq%5D=${encodeURIComponent(email)}`;
			const res = await getRequest<DirectusListResponse<AgentRecord>>(q);
			const arr = Array.isArray(res?.data) ? res!.data! : [];
			const found = arr.length > 0 ? (arr[0] as AgentRecord) : null;
			console.log("👤 [CREATE AGENTS] Agent search result:", found ? `Found agent ${found.id}` : "No existing agent found");
			return found;
		} catch (e) {
			console.error("❌ [CREATE AGENTS] findAgentByEmail failed:", { email, e });
			return null;
		}
	}
	async function linkAgentAndProperty(agentId: string | number, propId: string | number): Promise<void> {
		console.log("🔗 [CREATE AGENTS] Linking agent", agentId, "to property", propId);
		try {
			await postRequest("/items/agents_property_2", { agents_id: agentId, property_id: propId });
			console.log("✅ [CREATE AGENTS] Successfully linked via agents_property_2");
		} catch (e) {
			console.error("❌ [CREATE AGENTS] Failed linking agents_property_2:", { agentId, propId, e });
		}
		try {
			await postRequest("/items/property_agents_1", { agents_id: agentId, property_id: propId });
			console.log("✅ [CREATE AGENTS] Successfully linked via property_agents_1");
		} catch (e) {
			console.error("❌ [CREATE AGENTS] Failed linking property_agents_1:", { agentId, propId, e });
		}
	}

	const validAgents = (agents || []).filter((a) => {
		const fn = (a?.first_name || "").trim();
		const ln = (a?.last_name || "").trim();
		const mb = (a?.mobile || "").trim();
		const em = (a?.email || "").trim();
		const isValid = fn !== "" || ln !== "" || mb !== "" || em !== "";
		console.log("👤 [CREATE AGENTS] Agent validation:", { agent: a, isValid });
		return isValid;
	});
	
	console.log("👤 [CREATE AGENTS] Valid agents count:", validAgents.length);
	if (validAgents.length === 0) {
		console.log("⚠️ [CREATE AGENTS] No valid agents to process");
		return [];
	}
	
	const results: Array<AgentRecord> = [];
	for (const a of validAgents) {
		try {
			console.log("👤 [CREATE AGENTS] Processing agent:", a);
			const email = (a.email || "").trim();
			let agentToUse: AgentRecord | null = null;
			if (email) {
				const existing = await findAgentByEmail(email);
				if (existing && existing.id) {
					agentToUse = existing;
					console.log("👤 [CREATE AGENTS] Using existing agent by email:", { email, id: existing.id });
				}
			}
			if (!agentToUse) {
				console.log("👤 [CREATE AGENTS] Creating new agent with data:", a);
				const created = await createAgent({
					first_name: (a.first_name || "").trim() || null,
					last_name: (a.last_name || "").trim() || null,
					mobile: (a.mobile || "").trim() || null,
					email: email || null,
				}, true); // Skip validation for extracted agents
				agentToUse = created;
				console.log("✅ [CREATE AGENTS] Successfully created new agent with ID:", agentToUse.id);
			}
			results.push(agentToUse);
			await linkAgentAndProperty(agentToUse.id, propertyId);
			console.log("✅ [CREATE AGENTS] Successfully processed agent:", agentToUse.id);
		} catch (_e) {
			console.error("❌ [CREATE AGENTS] Failed creating agent for property:", { propertyId, agent: a, error: _e });
		}
	}

	console.log("✅ [CREATE AGENTS] Returning results:", results.map(r => r.id));
	return results;
}



