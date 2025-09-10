import PropertiesForm from "@/components/properties/PropertiesForm";
import { getProperty } from "@/lib/actions/properties/getProperty";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getServiceById } from "@/lib/actions/services/getService";
import { getPropertyNote } from "@/lib/actions/globals/getGlobal";
import { extractPropertyDetails } from "@/lib/actions/properties/extractPropertyDetails";
import FormHeader from "@/components/ui/FormHeader";

export default async function StepProperty({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;

	const [property, deal, propertyNote] = await Promise.all([
		propertyId ? getProperty(propertyId) : Promise.resolve(undefined),
		dealId ? getDeal(dealId) : Promise.resolve(null),
		getPropertyNote(),
	]);

	const serviceId = deal?.service ?? undefined;
	const service = serviceId ? await getServiceById(serviceId) : null;

	return (
		<div className="container">
			<div className="card">
				<FormHeader rightTitle="Property details" />
				<PropertiesForm
					property={property}
					propertyId={propertyId}
					contactId={contactId}
					userId={userId}
					dealId={dealId}
					quoteId={quoteId}
					paymentId={paymentId}
					invoiceId={invoiceId}
					serviceId={serviceId}
					serviceName={service?.service_name}
					propertyCategory={property?.property_category as any}
					propertyNote={propertyNote}
					onExtract={extractPropertyDetails}
				/>
			</div>
		</div>
	);
}
