"use server";

import { getRequest } from "@/lib/http/fetcher";

type DirectusItemResponse<T> = { data: T };

export type GlobalRecord = Record<string, unknown>;

export async function getGlobal() {
    const res = await getRequest<DirectusItemResponse<GlobalRecord>>(`/items/global`);
    return res?.data ?? {};
}

// Fetches only the property_note field from globals collection per requirement
type PropertyNoteResponse = { data?: { property_note?: string } };
export async function getPropertyNote(): Promise<string> {
	const res = await getRequest<PropertyNoteResponse>(`/items/globals?fields=property_note`);
	return String(res?.data?.property_note ?? "");
}


// Fetches only the quote_note field from globals collection per requirement
type QuoteNoteResponse = { data?: { quote_note?: string } };
export async function getQuoteNote(): Promise<string> {
	const res = await getRequest<QuoteNoteResponse>(`/items/globals?fields=quote_note`);
	return String(res?.data?.quote_note ?? "");
}


// Fetches only the contact_note field
type ContactNoteResponse = { data?: { contact_note?: string } };
export async function getContactNote(): Promise<string> {
	const res = await getRequest<ContactNoteResponse>(`/items/globals?fields=contact_note`);
	return String(res?.data?.contact_note ?? "");
}

// Fetches only the phone_verification_note field
type PhoneVerificationNoteResponse = { data?: { phone_verification_note?: string } };
export async function getPhoneVerificationNote(): Promise<string> {
	const res = await getRequest<PhoneVerificationNoteResponse>(`/items/globals?fields=phone_verification_note`);
	return String(res?.data?.phone_verification_note ?? "");
}

// Fetches only the invoice_note field
type InvoiceNoteResponse = { data?: { invoice_note?: string } };
export async function getInvoiceNote(): Promise<string> {
	const res = await getRequest<InvoiceNoteResponse>(`/items/globals?fields=invoice_note`);
	return String(res?.data?.invoice_note ?? "");
}

// Fetches only the payment_note field
type PaymentNoteResponse = { data?: { payment_note?: string } };
export async function getPaymentNote(): Promise<string> {
	const res = await getRequest<PaymentNoteResponse>(`/items/globals?fields=payment_note`);
	return String(res?.data?.payment_note ?? "");
}

// Fetches only the receipt_note field
type ReceiptNoteResponse = { data?: { receipt_note?: string } };
export async function getReceiptNote(): Promise<string> {
	const res = await getRequest<ReceiptNoteResponse>(`/items/globals?fields=receipt_note`);
	return String(res?.data?.receipt_note ?? "");
}


// Fetches only the form_terms_and_conditions_link field
type TermsLinkResponse = { data?: { form_terms_and_conditions_link?: string } };
export async function getFormTermsLink(): Promise<string> {
	const res = await getRequest<TermsLinkResponse>(`/items/globals?fields=form_terms_and_conditions_link`);
	return String(res?.data?.form_terms_and_conditions_link ?? "");
}

