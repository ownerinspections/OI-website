"use server";

import { patchRequest } from "@/lib/http/fetcher";

type UpdatePayload = Record<string, unknown>;

export async function updateInvoice(id: string, data: UpdatePayload) {
	if (!id) throw new Error("Missing invoice id");
	const path = `/items/os_invoices/${encodeURIComponent(String(id))}`;
	return patchRequest<{ data: unknown }>(path, data);
}
