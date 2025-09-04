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

export async function createAgent(data: AgentCreateInput): Promise<AgentRecord> {
	const first = (data.first_name || "").trim() || null;
	const last = (data.last_name || "").trim() || null;
	const mobileVal = (data.mobile || "").trim() || null;
	const emailVal = (data.email || "").trim() || null;

	function compact(obj: Record<string, unknown>): Record<string, unknown> {
		return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
	}

	const payload = compact({
		first_name: first,
		last_name: last,
		mobile: mobileVal,
		email: emailVal,
	});
	const res = await postRequest<DirectusItemResponse<AgentRecord>>("/items/agents", payload);
	return res?.data as AgentRecord;
}

export async function createAgentsForProperty(
	propertyId: string | number,
	agents: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>
): Promise<Array<AgentRecord>> {
	async function findAgentByEmail(email: string): Promise<AgentRecord | null> {
		try {
			const q = `/items/agents?filter%5Bemail%5D%5B_eq%5D=${encodeURIComponent(email)}`;
			const res = await getRequest<DirectusListResponse<AgentRecord>>(q);
			const arr = Array.isArray(res?.data) ? res!.data! : [];
			return arr.length > 0 ? (arr[0] as AgentRecord) : null;
		} catch (e) {
			try { console.error("[agents] findAgentByEmail failed", { email, e }); } catch {}
			return null;
		}
	}
	async function linkAgentAndProperty(agentId: string | number, propId: string | number): Promise<void> {
		try {
			await postRequest("/items/agents_property_2", { agents_id: agentId, property_id: propId });
		} catch (e) {
			try { console.error("[agents] failed linking agents_property_2", { agentId, propId, e }); } catch {}
		}
		try {
			await postRequest("/items/property_agents_1", { agents_id: agentId, property_id: propId });
		} catch (e) {
			try { console.error("[agents] failed linking property_agents_1", { agentId, propId, e }); } catch {}
		}
	}

	const validAgents = (agents || []).filter((a) => {
		const fn = (a?.first_name || "").trim();
		const ln = (a?.last_name || "").trim();
		const mb = (a?.mobile || "").trim();
		const em = (a?.email || "").trim();
		return fn !== "" || ln !== "" || mb !== "" || em !== "";
	});
	if (validAgents.length === 0) return [];
	const results: Array<AgentRecord> = [];
	for (const a of validAgents) {
		try {
			const email = (a.email || "").trim();
			let agentToUse: AgentRecord | null = null;
			if (email) {
				const existing = await findAgentByEmail(email);
				if (existing && existing.id) {
					agentToUse = existing;
					try { console.log("[agents] using existing agent by email", { email, id: existing.id }); } catch {}
				}
			}
			if (!agentToUse) {
				const created = await createAgent({
					first_name: (a.first_name || "").trim() || null,
					last_name: (a.last_name || "").trim() || null,
					mobile: (a.mobile || "").trim() || null,
					email: email || null,
				});
				agentToUse = created;
			}
			results.push(agentToUse);
			await linkAgentAndProperty(agentToUse.id, propertyId);
		} catch (_e) {
			console.error("[agents] failed creating agent for property", propertyId, a, _e);
		}
	}

	return results;
}



