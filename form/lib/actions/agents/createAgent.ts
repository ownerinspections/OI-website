"use server";

import { postRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type AgentRecord = {
	id: string | number;
	first_name?: string | null;
	last_name?: string | null;
	mobile?: string | null;
	phone?: string | null;
};

export type AgentCreateInput = Omit<AgentRecord, "id">;

export async function createAgent(data: AgentCreateInput): Promise<AgentRecord> {
	const first = (data.first_name || "").trim() || null;
	const last = (data.last_name || "").trim() || null;
	const rawMobile = (data.mobile || data.phone || "").trim();
	const digits = rawMobile.replace(/\D+/g, "");
	const phoneVal = rawMobile && digits.length >= 8 ? rawMobile : null;

	function compact(obj: Record<string, unknown>): Record<string, unknown> {
		return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ""));
	}

	const fullName = [first || "", last || ""].join(" ").replace(/\s+/g, " ").trim();

	const candidates: Array<Record<string, unknown>> = [
		compact({ first_name: first, last_name: last, mobile: phoneVal }),
		compact({ first_name: first, last_name: last, phone: phoneVal }),
		compact({ name: fullName || undefined, phone: phoneVal }),
		compact({ agent_first_name: first, agent_last_name: last, agent_mobile: phoneVal }),
		compact({ agent_name: fullName || undefined, agent_phone: phoneVal }),
		compact({ name: fullName || undefined }),
		compact({ first_name: first, last_name: last }),
	];

	let lastError: unknown = null;
	for (const payload of candidates) {
		try {
			const res = await postRequest<DirectusItemResponse<AgentRecord>>("/items/agents", payload);
			return res?.data as AgentRecord;
		} catch (e) {
			lastError = e;
		}
	}
	throw lastError as Error;
}

export async function createAgentsForProperty(
	propertyId: string | number,
	agents: Array<{ first_name?: string; last_name?: string; mobile?: string }>
): Promise<Array<AgentRecord>> {
	const validAgents = (agents || []).filter((a) => {
		const fn = (a?.first_name || "").trim();
		const ln = (a?.last_name || "").trim();
		const mb = (a?.mobile || "").trim();
		return fn !== "" || ln !== "" || mb !== "";
	});
	if (validAgents.length === 0) return [];
	const results: Array<AgentRecord> = [];
	for (const a of validAgents) {
		try {
			const created = await createAgent({
				first_name: (a.first_name || "").trim() || null,
				last_name: (a.last_name || "").trim() || null,
				mobile: (a.mobile || "").trim() || null,
			});
			results.push(created);
		} catch (_e) {
			console.error("[agents] failed creating agent for property", propertyId, a, _e);
		}
	}
	return results;
}


