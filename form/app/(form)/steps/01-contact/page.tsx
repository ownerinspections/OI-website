import ContactsForm from "@/components/contacts/ContactsForm";
import { listAllServices } from "@/lib/actions/services/getService";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getContact } from "@/lib/actions/contacts/getContact";
import { getUser } from "@/lib/actions/users/getUser";
// import { getProperty } from "@/lib/actions/properties/getProperty";
import FormHeader from "@/components/ui/FormHeader";
import { getContactNote } from "@/lib/actions/globals/getGlobal";
import NoteBox from "@/components/ui/messages/NoteBox";

export default async function StepContact({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};

	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactIdParam = typeof params.contactId === "string" ? params.contactId : undefined;
	const propertyIdParam = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const userIdParam = typeof params.userId === "string" ? params.userId : undefined;
	// const categoryParam = typeof params.category === "string" ? (params.category as "residential" | "commercial") : undefined;

	// First batch: Run independent API calls in parallel
	const [services, deal, contactNote] = await Promise.all([
		listAllServices(),
		dealId ? getDeal(dealId).catch(() => null) : Promise.resolve(null),
		getContactNote(),
	]);

	const resolvedContactId = contactIdParam ?? (deal?.contact ? String(deal.contact) : undefined);
	const resolvedPropertyId = propertyIdParam ?? (deal?.property ? String(deal.property) : undefined);

	// Second batch: Run contact and user calls in parallel (after deal resolves)
	const [contact, user] = await Promise.all([
		resolvedContactId ? getContact(resolvedContactId).then(res => (res as any)?.data ?? null).catch(() => null) : Promise.resolve(null),
		userIdParam ? getUser(userIdParam).catch(() => null) : Promise.resolve(null),
	]);

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

	const initialValues = {
		first_name: user?.first_name ?? contact?.first_name ?? "",
		last_name: user?.last_name ?? contact?.last_name ?? "",
		email: user?.email ?? contact?.email ?? "",
		phone: user?.phone ?? contact?.phone ?? "",
		service_id: deal?.service ? String(deal.service) : "",
	} as const;

	return (
		<div className="container">
			<div className="card">
				<FormHeader rightTitle="Contact details" />
				{contactNote ? (
					<NoteBox style={{ marginBottom: 16 }}>
						{contactNote}
					</NoteBox>
				) : null}
				<ContactsForm
					services={services}
					dealId={dealId}
					contactId={resolvedContactId}
					propertyId={resolvedPropertyId}
					userId={userIdParam}
					initialValues={initialValues}
				/>
			</div>
		</div>
	);
}
