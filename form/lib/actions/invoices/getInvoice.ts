"use server";

import { getRequest } from "@/lib/http/fetcher";

export type InvoiceResponse = {
	data: any;
};

export async function getInvoice(id: string) {
	if (!id) throw new Error("Missing invoice id");
	const path = `/items/os_invoices/${encodeURIComponent(String(id))}`;
	return getRequest<InvoiceResponse>(path);
}
