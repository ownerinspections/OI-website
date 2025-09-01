import ContactsForm from "@/components/contacts/ContactsForm";
import { listAllServices } from "@/lib/actions/services/getService";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getContact } from "@/lib/actions/contacts/getContact";
// import { getProperty } from "@/lib/actions/properties/getProperty";
import FormHeader from "@/components/ui/FormHeader";
import FormFooter from "@/components/ui/FormFooter";
import { getContactNote, getFormTermsLink } from "@/lib/actions/globals/getGlobal";

export default async function StepContact({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const services = await listAllServices();
	const params = (await searchParams) ?? {};

	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactIdParam = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyIdParam = typeof params.propertyId === "string" ? params.propertyId : undefined;
	// const categoryParam = typeof params.category === "string" ? (params.category as "residential" | "commercial") : undefined;

	let deal: Awaited<ReturnType<typeof getDeal>> | null = null;
	if (dealId) {
		try {
			deal = await getDeal(dealId);
		} catch (_e) {
			deal = null;
		}
	}

	const resolvedContactId = contactIdParam ?? (deal?.contact ? String(deal.contact) : undefined);
	const resolvedPropertyId = propertyIdParam ?? (deal?.property ? String(deal.property) : undefined);

	let contact: any = null;
	if (resolvedContactId) {
		try {
			const res = await getContact(resolvedContactId);
			contact = (res as any)?.data ?? null;
		} catch (_e) {
			contact = null;
		}
	}

	// Step 1 no longer uses property/category to prefill
	// let property: any = null;
	// if (resolvedPropertyId) {
	// 	try {
	// 		property = await getProperty(resolvedPropertyId);
	// 	} catch (_e) {
	// 		property = null;
	// 	}
	// }
	// const propertyCategory = (property?.property_category as "residential" | "commercial" | undefined) ?? undefined;
	// const defaultCategory = categoryParam ?? propertyCategory;

	const contactNote = await getContactNote();
	const termsLink = await getFormTermsLink();

	const initialValues = {
		first_name: contact?.first_name ?? "",
		last_name: contact?.last_name ?? "",
		email: contact?.email ?? "",
		phone: contact?.phone ?? "",
		service_id: deal?.service ? String(deal.service) : "",
	} as const;

	return (
		<div className="container">
			<div className="card">
				<FormHeader rightTitle="Contact details" />
				{contactNote ? (
					<div style={{ background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 }}>
						<div>{contactNote}</div>
					</div>
				) : null}
				<ContactsForm
					services={services}
					dealId={dealId}
					contactId={resolvedContactId}
					propertyId={resolvedPropertyId}
					initialValues={initialValues}
				/>
				<FormFooter termsLink={termsLink} />
			</div>
		</div>
	);
}
