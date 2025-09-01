import { KONG_GATEWAY_URL } from "@/lib/env";

type JsonRecord = Record<string, unknown>;

type FormRecord = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = KONG_GATEWAY_URL.replace(/\/$/, "");
	const suffix = path.startsWith("/") ? path : `/${path}`;
	return `${base}${suffix}`;
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
	const text = await res.text();
	try {
		return JSON.parse(text) as T;
	} catch (_err) {
		return {} as T;
	}
}

export async function getRequest<T = unknown>(path: string): Promise<T> {
	const url = buildUrl(path);
	const res = await fetch(url, { method: "GET", cache: "no-store" });
	if (!res.ok) {
		throw new Error(`GET ${url} failed with ${res.status}`);
	}
	return parseJsonResponse<T>(res);
}

export async function postRequest<T = unknown>(path: string, body?: JsonRecord): Promise<T> {
	const url = buildUrl(path);
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
		cache: "no-store",
	});
	if (!res.ok) {
		let details = "";
		try {
			const text = await res.text();
			details = text ? `: ${text.slice(0, 500)}` : "";
		} catch {}
		throw new Error(`POST ${url} failed with ${res.status}${details}`);
	}
	return parseJsonResponse<T>(res);
}

export async function postFormRequest<T = unknown>(path: string, body?: FormRecord): Promise<T> {
	const url = buildUrl(path);
	const formBody = body
		? Object.entries(body)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v === null ? "" : String(v))}`)
			.join("&")
		: undefined;
	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: formBody,
		cache: "no-store",
	});
	if (!res.ok) {
		throw new Error(`POST ${url} failed with ${res.status}`);
	}
	return parseJsonResponse<T>(res);
}

export async function patchRequest<T = unknown>(path: string, body?: JsonRecord): Promise<T> {
	const url = buildUrl(path);
	const res = await fetch(url, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
		cache: "no-store",
	});
	if (!res.ok) {
		throw new Error(`PATCH ${url} failed with ${res.status}`);
	}
	return parseJsonResponse<T>(res);
}
