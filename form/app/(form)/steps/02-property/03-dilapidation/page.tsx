import DilapidationPropertiesForm from "@/components/properties/DilapidationPropertiesForm";

import { getProperty } from "@/lib/actions/properties/getProperty";
import { getDeal } from "@/lib/actions/deals/getDeal";
import { getServiceById } from "@/lib/actions/services/getService";
import { getPropertyNote } from "@/lib/actions/globals/getGlobal";
import FormHeader from "@/components/ui/FormHeader";
import { redirect } from "next/navigation";

export default async function DilapidationPropertyStep({ searchParams }: { searchParams?: Promise<Record<string, string | string[]>> }) {
	const params = (await searchParams) ?? {};
	const dealId = typeof params.dealId === "string" ? params.dealId : undefined;
	const contactId = typeof params.contactId === "string" ? params.contactId : undefined;
	const userId = typeof params.userId === "string" ? params.userId : undefined;
	const quoteId = typeof params.quoteId === "string" ? params.quoteId : undefined;
	const paymentId = typeof params.paymentId === "string" ? params.paymentId : undefined;
	const invoiceId = typeof params.invoiceId === "string" ? params.invoiceId : undefined;
	const propertyId = typeof params.propertyId === "string" ? params.propertyId : undefined;

	if (!dealId || !contactId || !userId) {
		redirect('/not-found');
	}

    // Load properties - same logic as pre-purchase but for multiple properties
    let properties: any[] = [];
    if (propertyId) {
        const idsArray = propertyId.split(",").filter(id => id.trim());
        // Use the same getProperty function for each property ID
        const propertyResults = await Promise.all(
            idsArray.map(id => getProperty(id))
        );
        // Filter out null/undefined properties (failed fetches or non-existent properties)
        properties = propertyResults.filter(property => property !== null && property !== undefined);
    }

	const [deal, propertyNote] = await Promise.all([
		dealId ? getDeal(dealId) : Promise.resolve(null),
		getPropertyNote(),
	]);

	const serviceId = deal?.service ?? undefined;
	const service = serviceId ? await getServiceById(serviceId) : null;

	return (
		<div className="container">
			<div className="card">
				<FormHeader
					rightTitle="Property Details"
					rightSubtitle="Dilapidation Inspection"
				/>
				<DilapidationPropertiesForm 
					properties={properties}
					dealId={dealId} 
					contactId={contactId} 
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