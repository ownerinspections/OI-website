import PropertiesForm from "@/components/properties/PropertiesForm";
import { getProperty } from "@/lib/actions/properties/getProperty";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getServiceById } from "@/lib/actions/services/getService";
import { getPropertyNote } from "@/lib/actions/globals/getGlobal";
import FormHeader from "@/components/ui/FormHeader";
import { redirect } from "next/navigation";

export default async function PrePurchasePropertyStep({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;

	if (!dealId || !contactId || !userId) {
		redirect('/not-found');
	}

	const [propertyResult, deal, propertyNote] = await Promise.all([
		propertyId ? getProperty(propertyId) : Promise.resolve(undefined),
		dealId ? getDeal(dealId) : Promise.resolve(null),
		getPropertyNote(),
	]);

	// Handle property result to ensure proper typing
	const property = propertyResult || undefined;

	const serviceId = deal?.service ?? undefined;
	const service = serviceId ? await getServiceById(serviceId) : null;

	return (
		<div className="container">
			<div className="card">
				<FormHeader
					rightTitle="Property Details"
					rightSubtitle="Pre-Purchase Inspection"
				/>
				<PropertiesForm 
					property={property} 
					dealId={dealId} 
					contactId={contactId} 
					propertyId={propertyId} 
					quoteId={quoteId} 
					paymentId={paymentId} 
					invoiceId={invoiceId} 
					propertyNote={propertyNote} 
					userId={userId}
					serviceId={serviceId}
					serviceName={service?.service_name}
				/>
			</div>
		</div>
	);
}
