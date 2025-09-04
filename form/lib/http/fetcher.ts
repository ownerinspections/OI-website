import { KONG_GATEWAY_URL } from "@/lib/env";

type JsonRecord = Record<string, unknown>;

type FormRecord = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const base = KONG_GATEWAY_URL.replace(/\/$/, "");
	const suffix = path.startsWith("/") ? path : `/${path}`;
	return `${base}${suffix}`;
}

function maybeLogInvoicePatch(path: string, body?: JsonRecord) {
	try {
		const isInvoicePatch = typeof path === "string" && path.startsWith("/items/os_invoices/");
		const status = body && (body as any).status;
		if (!isInvoicePatch || status === undefined) return;
		const stack = new Error().stack;
		console.log("[audit][invoice-patch] PATCH", {
			path,
			status,
			amount_paid: (body as any)?.amount_paid,
			body,
			stack,
		});
	} catch {}
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
		let details = "";
		try {
			const text = await res.text();
			details = text ? `: ${text.slice(0, 2000)}` : "";
			try { console.error("[HTTP] GET error", { url, status: res.status, responseBody: text?.slice(0, 2000) }); } catch {}
		} catch {}
		throw new Error(`GET ${url} failed with ${res.status}${details}`);
	}
	return parseJsonResponse<T>(res);
}

export async function postRequest<T = unknown>(path: string, body?: JsonRecord): Promise<T> {
	const url = buildUrl(path);
	const debug = process.env.DEBUG_HTTP === "1" || process.env.DEBUG_HTTP === "true";
	if (debug) {
		try { console.log("[HTTP] POST", { url, body }); } catch {}
	}
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
			details = text ? `: ${text.slice(0, 2000)}` : "";
			try { console.error("[HTTP] POST error", { url, status: res.status, requestBody: body, responseBody: text?.slice(0, 2000) }); } catch {}
		} catch {}
		throw new Error(`POST ${url} failed with ${res.status}${details}`);
	}
	const json = await parseJsonResponse<T>(res);
	if (debug) {
		try { console.log("[HTTP] POST response", { url, json }); } catch {}
	}
	return json;
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
		let details = "";
		try {
			const text = await res.text();
			details = text ? `: ${text.slice(0, 2000)}` : "";
			try { console.error("[HTTP] POST-FORM error", { url, status: res.status, requestBody: formBody, responseBody: text?.slice(0, 2000) }); } catch {}
		} catch {}
		throw new Error(`POST ${url} failed with ${res.status}${details}`);
	}
	return parseJsonResponse<T>(res);
}

export async function patchRequest<T = unknown>(path: string, body?: JsonRecord): Promise<T> {
	const url = buildUrl(path);
	// Centralized audit for invoice status changes
	maybeLogInvoicePatch(path, body);
	const res = await fetch(url, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: body ? JSON.stringify(body) : undefined,
		cache: "no-store",
	});
	if (!res.ok) {
		let details = "";
		try {
			const text = await res.text();
			details = text ? `: ${text.slice(0, 2000)}` : "";
			try { console.error("[HTTP] PATCH error", { url, status: res.status, requestBody: body, responseBody: text?.slice(0, 2000) }); } catch {}
		} catch {}
		throw new Error(`PATCH ${url} failed with ${res.status}${details}`);
	}
	return parseJsonResponse<T>(res);
}
