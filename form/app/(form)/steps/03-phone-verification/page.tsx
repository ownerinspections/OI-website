import TwilioSMSForm from "@/components/twilio/TwilioSMSForm";
import AlreadyVerified from "@/components/twilio/AlreadyVerified";
import { PHONE_VERIFIED_REDIRECT_SECONDS } from "@/lib/env";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getContact } from "@/lib/actions/contacts/getContact";
import { getRequest, postRequest } from "@/lib/http/fetcher";
import { getServiceById } from "@/lib/actions/services/getService";
import { getProperty } from "@/lib/actions/properties/getProperty";
import { createProposal } from "@/lib/actions/quotes/createQuote";
import FormHeader from "@/components/ui/FormHeader";
import { getPhoneVerificationNote } from "@/lib/actions/globals/getGlobal";
import { getUser } from "@/lib/actions/users/getUser";

export default async function StepPhoneVerification({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactIdParam = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyIdParam = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const userIdParam = typeof params.userId === "string" ? params.userId : undefined;
	const quoteIdParam = typeof params.quoteId === "string" ? params.quoteId : undefined;

	let phone: string | undefined = undefined;
	let status: string | undefined = undefined;

	let contactId: string | undefined = contactIdParam;
	let propertyId: string | undefined = propertyIdParam;

	// Resolve missing ids from deal
	try {
		if (dealId && (!contactId || !propertyId)) {
			const deal = await getDeal(dealId);
			if (!contactId) contactId = deal?.contact ? String(deal.contact) : undefined;
			if (!propertyId) propertyId = deal?.property ? String(deal.property) : undefined;
		}
	} catch {
		// ignore
	}

	// Prefer user phone/status if available
	if (userIdParam) {
		try {
			const user = await getUser(String(userIdParam));
			if (user) {
				phone = (user as any)?.phone ?? phone;
				status = (user as any)?.status ?? status;
			}
		} catch {
			// ignore
		}
	}

	// Fallback: fetch contact details for phone and status
	if ((!phone || !status) && contactId) {
		try {
			const res = await getContact(contactId);
			const contact = (res as any)?.data as { phone?: string; status?: string } | null;
			phone = phone || (contact?.phone ?? undefined);
			status = status || ((contact as any)?.status ?? undefined);
		} catch {
			// ignore
		}
	}

	// If already verified (user active or contact published), ensure a proposal exists and include quoteId in redirect
	if (status === "active" || status === "published") {
		let quoteId: string | number | undefined = undefined;
		if (quoteIdParam) {
			quoteId = quoteIdParam;
		} else if (dealId) {
			try {
				// Try latest proposal for this deal
				const encodedDeal = encodeURIComponent(String(dealId));
				const res = await getRequest<{ data: any[] }>(`/items/os_proposals?filter%5Bdeal%5D%5B_eq%5D=${encodedDeal}&sort=-date_created&limit=1`);
				const latest = Array.isArray((res as any)?.data) && (res as any).data.length > 0 ? (res as any).data[0] : null;
				quoteId = latest?.id ?? undefined;
				if (!quoteId) {
					// Create a new proposal based on rate estimate
					const deal = await getDeal(dealId);
					const svcId = deal?.service as any;
					const service = svcId ? await getServiceById(svcId) : null;
					const propId = propertyId || (deal?.property ? String(deal.property) : undefined);
					const property = propId ? await getProperty(propId) : null;
					const property_category = (property?.property_category as any) || "residential";
					const service_code = service ? (service.service_type || service.service_name || "").toString() : "";
					let amount = 0;
					let note: string | undefined = undefined;
					if (service_code) {
						const payload = {
							service: service_code,
							property_category,
							bedrooms: (property as any)?.number_of_bedrooms || 0,
							bathrooms: (property as any)?.number_of_bathrooms || 0,
							levels: (property as any)?.number_of_levels || 0,
							basement: Boolean((property as any)?.basement),
						};
						try {
							const estimate = await postRequest<{ stage_prices: any; quote_price: number; note?: string }>("/api/v1/quotes/estimate", payload);
							amount = estimate?.quote_price ?? 0;
							note = estimate?.note || undefined;
						} catch {}
					}
					const created = await createProposal({ dealId, contactId, propertyId, amount, note, userId: userIdParam });
					quoteId = created?.id;
				}
			} catch {
				// ignore and continue without quoteId
			}
		}

		const paramsOut = new URLSearchParams();
		// Required order: userId, contactId, dealId, propertyId, quoteId
		if (userIdParam) paramsOut.set("userId", String(userIdParam));
		if (contactId) paramsOut.set("contactId", String(contactId));
		if (dealId) paramsOut.set("dealId", String(dealId));
		if (propertyId) paramsOut.set("propertyId", String(propertyId));
		if (quoteId) paramsOut.set("quoteId", String(quoteId));
		const to = `/steps/04-quote?${paramsOut.toString()}`;
		return (
			<div className="container">
				<div className="card">
					<FormHeader rightTitle="Phone verification" rightSubtitle={<><strong>Status:</strong> Verified</>} />
					<AlreadyVerified to={to} seconds={PHONE_VERIFIED_REDIRECT_SECONDS} />
				</div>
			</div>
		);
	}

	const phoneVerificationNote = await getPhoneVerificationNote();

	return (
		<div className="container">
			<div className="card">
				<FormHeader rightTitle="Phone verification" rightSubtitle={(status === "active" || status === "published") ? (<><strong>Status:</strong> Verified</>) : (<><strong>Status:</strong> Not verified</>)} />
				{phoneVerificationNote ? (
					<div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
						<div>{phoneVerificationNote}</div>
					</div>
				) : null}
				<TwilioSMSForm phone={phone} contactId={contactId} dealId={dealId} propertyId={propertyId} redirectSeconds={PHONE_VERIFIED_REDIRECT_SECONDS} quoteId={quoteIdParam} userId={userIdParam} />
			</div>
		</div>
	);
}
