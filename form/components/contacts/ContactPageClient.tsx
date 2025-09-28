"use client";

import { useState, useEffect } from "react";
import ContactsForm from "./ContactsForm";
import { ContactFormSkeleton } from "@/components/ui/SkeletonLoader";
import FormHeaderClient from "@/components/ui/FormHeaderClient";
import NoteBox from "@/components/ui/messages/NoteBox";
import type { ServiceRecord } from "@/lib/actions/services/getService";

type Props = {
	services: ServiceRecord[];
	dealId?: string;
	contactId?: string;
	propertyId?: string;
	userId?: string;
	initialValues?: Partial<{
		first_name: string;
		last_name: string;
		email: string;
		phone: string;
		service_id: string;
	}>;
	contactNote?: string;
	company?: {
		phone?: string;
		email?: string;
		url?: string;
	} | null;
};

export default function ContactPageClient({ 
	services, 
	dealId, 
	contactId, 
	propertyId, 
	userId, 
	initialValues, 
	contactNote,
	company
}: Props) {
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Simulate a brief loading period to show skeleton
		const timer = setTimeout(() => {
			setIsLoading(false);
		}, 500); // Show skeleton for 500ms

		return () => clearTimeout(timer);
	}, []);

	if (isLoading) {
		return (
			<div style={{ 
				position: "fixed", 
				top: 0, 
				left: 0, 
				right: 0, 
				bottom: 0, 
				background: "var(--color-pale-gray)", 
				zIndex: 9999,
				overflow: "auto"
			}}>
				<div className="container">
					<div className="card">
						<ContactFormSkeleton />
					</div>
				</div>
			</div>
		);
	}

	return (
		<>
			<FormHeaderClient rightTitle="Contact details" company={company} />
			{contactNote && (
				<NoteBox style={{ marginBottom: 16 }}>
					{contactNote}
				</NoteBox>
			)}
			<ContactsForm
				services={services}
				dealId={dealId}
				contactId={contactId}
				propertyId={propertyId}
				userId={userId}
				initialValues={initialValues}
			/>
		</>
	);
}
