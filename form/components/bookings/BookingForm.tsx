"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import EmailField from "@/components/ui/fields/EmailField";
import TextAreaField from "@/components/ui/fields/TextAreaField";
import LongDateField from "@/components/ui/fields/LongDateField";
import SelectField from "@/components/ui/fields/SelectField";
import AddContactButton from "@/components/contacts/AddContactButton";
import { submitBooking } from "@/lib/actions/bookings/submitBooking";
import type { BookingActionResult } from "@/lib/actions/bookings/submitBooking";

type ContactRecord = { id: string | number; first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null; contact_type?: string | null };

const CONTACT_TYPE_OPTIONS = [
	{ value: "agent", label: "Agent" },
	{ value: "builder", label: "Builder" },
	{ value: "buyer", label: "Buyer" },
	{ value: "conveyancer", label: "Conveyancer" },
	{ value: "developer", label: "Developer" },
	{ value: "individual", label: "Individual" },
	{ value: "landlord", label: "Landlord" },
	{ value: "lawyer", label: "Lawyer" },
	{ value: "organization", label: "Organization" },
	{ value: "other", label: "Other" },
	{ value: "owner", label: "Owner" },
	{ value: "real_estate_agent", label: "Real Estate Agent" },
	{ value: "seller", label: "Seller" },
	{ value: "site_supervisor", label: "Site Supervisor" },
	{ value: "solicitor", label: "Solicitor" },
	{ value: "tenant", label: "Tenant" },
];

// Contact type options excluding real estate agents (for dilapidation inspections)
const CONTACT_TYPE_OPTIONS_NO_REAL_ESTATE = CONTACT_TYPE_OPTIONS.filter(
	option => option.value !== "real_estate_agent"
);

type Props = {
	bookingId: string;
	userId?: string;
	contactId?: string;
	dealId?: string;
	propertyId?: string;
	quoteId?: string;
	invoiceId?: string;
	inspection_type?: string;
	contactsList: ContactRecord[];
	booking: any;
	properties?: any[];
};

export default function BookingForm({ 
	bookingId, 
	userId, 
	contactId, 
	dealId, 
	propertyId, 
	quoteId, 
	invoiceId, 
	inspection_type,
	contactsList, 
	booking,
	properties = []
}: Props) {
	const initialState: BookingActionResult = {};
	const [state, formAction] = useActionState<BookingActionResult, FormData>(submitBooking, initialState);
	const router = useRouter();

	useEffect(() => {
		if (state?.debug) {
			try {
				console.group("[BookingForm] submitBooking debug");
				for (const entry of state.debug as any[]) {
					console.log(entry?.tag || "entry", entry);
				}
				console.groupEnd();
			} catch (_e) {
				console.warn("[BookingForm] failed to log debug", _e);
			}
		}
	}, [state?.debug]);

	useEffect(() => {
		if (state?.success) {
			// The server action will handle the redirect
			console.log("[BookingForm] Booking submitted successfully");
		}
	}, [state?.success]);

	// Initialize contact person toggles for property-specific fields and email requirement logic
	useEffect(() => {
		function initContactPersonToggles() {
			// Find all contact person choice selects
			const selects = document.querySelectorAll('select[name$="_contact_person_choice"]');
			
			selects.forEach(select => {
				const selectName = select.getAttribute('name');
				const propertyId = selectName?.match(/property_(\d+)_contact_person_choice/)?.[1];
				
				if (!propertyId) return;
				
				const newContactFields = document.getElementById(`new-contact-person-fields-${propertyId}`);
				
				if (!newContactFields) return;
				
				function toggleContactFields() {
					const selectElement = select as HTMLSelectElement;
					if (selectElement.value === 'new_contact') {
						newContactFields!.style.display = 'block';
					} else {
						newContactFields!.style.display = 'none';
					}
				}
				
				// Add event listener
				select.addEventListener('change', toggleContactFields);
				
				// Initial check
				toggleContactFields();
			});
		}

		function initContactPersonEmailLogic() {
			// Handle contact type changes for contact person fields
			const contactPersonTypeSelects = document.querySelectorAll('select[name$="_contact_person_contact_type"]');
			contactPersonTypeSelects.forEach(select => {
				const selectName = select.getAttribute('name');
				const propertyId = selectName?.match(/property_(\d+)_contact_person_contact_type/)?.[1];
				
				if (!propertyId) return;
				
				const emailField = document.querySelector(`input[name="property_${propertyId}_contact_person_email"]`) as HTMLInputElement;
				if (!emailField) return;
				
				function updateContactPersonEmailRequirement() {
					const selectElement = select as HTMLSelectElement;
					const isRealEstateAgent = selectElement.value === 'real_estate_agent';
					emailField.required = !isRealEstateAgent;
				}
				
				select.addEventListener('change', updateContactPersonEmailRequirement);
				updateContactPersonEmailRequirement(); // Initial check
			});
		}

		function initEmailRequirementLogic() {
			// Handle contact type changes for existing contacts
			const contactTypeSelects = document.querySelectorAll('select[name$="_contact_type"]');
			contactTypeSelects.forEach(select => {
				const selectName = select.getAttribute('name');
				const contactId = selectName?.match(/contact_(\d+)_contact_type/)?.[1];
				
				if (!contactId) return;
				
				const emailField = document.querySelector(`input[name="contact_${contactId}_email"]`) as HTMLInputElement;
				if (!emailField) return;
				
				function updateEmailRequirement() {
					const selectElement = select as HTMLSelectElement;
					const isRealEstateAgent = selectElement.value === 'real_estate_agent';
					emailField.required = !isRealEstateAgent;
				}
				
				select.addEventListener('change', updateEmailRequirement);
				updateEmailRequirement(); // Initial check
			});

			// Handle contact type changes for new contacts
			const newContactTypeSelects = document.querySelectorAll('select[name$="_contact_type"]');
			newContactTypeSelects.forEach(select => {
				const selectName = select.getAttribute('name');
				if (selectName?.includes('new_contact_')) {
					const contactIndex = selectName.match(/new_contact_(\d+)_contact_type/)?.[1];
					
					if (!contactIndex) return;
					
					const emailField = document.querySelector(`input[name="new_contact_${contactIndex}_email"]`) as HTMLInputElement;
					if (!emailField) return;
					
					function updateNewContactEmailRequirement() {
						const selectElement = select as HTMLSelectElement;
						const isRealEstateAgent = selectElement.value === 'real_estate_agent';
						emailField.required = !isRealEstateAgent;
					}
					
					select.addEventListener('change', updateNewContactEmailRequirement);
					updateNewContactEmailRequirement(); // Initial check
				}
			});
		}
		
		// Initialize when component mounts
		initContactPersonToggles();
		initContactPersonEmailLogic();
		initEmailRequirementLogic();
	}, []);

	// During redirect after success, render nothing
	if (state?.success) {
		return null;
	}

	// Use filtered contact type options for dilapidation inspections
	const contactTypeOptions = inspection_type === "dilapidation" 
		? CONTACT_TYPE_OPTIONS_NO_REAL_ESTATE 
		: CONTACT_TYPE_OPTIONS;

	const formStyle: React.CSSProperties = {
		display: "grid",
		gap: 24,
	};

	return (
		<form action={formAction} style={{ display: "grid", gap: 24 }} noValidate>
			<input type="hidden" name="booking_id" value={bookingId} />
			<input type="hidden" name="user_id" value={userId ?? ""} />
			<input type="hidden" name="contact_id" value={contactId ?? ""} />
			<input type="hidden" name="deal_id" value={dealId ?? ""} />
			<input type="hidden" name="property_id" value={propertyId ?? ""} />
			<input type="hidden" name="quote_id" value={quoteId ?? ""} />
			<input type="hidden" name="invoice_id" value={invoiceId ?? ""} />
			<input type="hidden" name="inspection_type" value={inspection_type ?? ""} />

			{/* Contact Person Selection for each property - only for dilapidation inspections */}
			{inspection_type === "dilapidation" && properties.length > 0 && (
				<div style={{ display: "grid", gap: 24 }}>
					{properties.map((property, index) => (
						<div key={String(property?.id || index)} style={{ 
							border: "1px solid var(--color-light-gray)", 
							borderRadius: 8, 
							padding: 16, 
							backgroundColor: "var(--color-pale-gray)" 
						}}>
							<div style={{ 
								fontWeight: 600, 
								marginBottom: 16, 
								fontSize: 14,
								color: "var(--color-text-primary)"
							}}>
								{properties.length > 1 ? `Property ${index + 1}` : "Property"} Contact Person
							</div>
							<div style={{ display: "grid", gap: 16 }}>
								<SelectField
									name={`property_${property?.id}_contact_person_choice`}
									label="Who should we contact at inspection time?"
									options={[
										{ value: "me", label: "Me (current contact)" },
										{ value: "new_contact", label: "Someone else (add new contact)" }
									]}
									defaultValue={(booking as any)?.contact_person_choice || "me"}
									placeholder="Select who to contact"
									required
								/>
								
								{/* New contact fields - shown conditionally based on JavaScript */}
								<div id={`new-contact-person-fields-${property?.id}`} style={{ display: "none", border: "1px solid var(--color-light-gray)", borderRadius: 8, padding: 16, backgroundColor: "white" }}>
									<div style={{ display: "grid", gap: 16 }}>
										<SelectField 
											name={`property_${property?.id}_contact_person_contact_type`} 
											label="Contact type" 
											options={CONTACT_TYPE_OPTIONS_NO_REAL_ESTATE}
											placeholder="Select contact type"
											required 
										/>
										<div className="contact-form-grid">
											<TextField 
												name={`property_${property?.id}_contact_person_first_name`} 
												label="First name" 
												required 
											/>
											<TextField 
												name={`property_${property?.id}_contact_person_last_name`} 
												label="Last name" 
												required 
											/>
										</div>
										<div className="contact-form-grid">
											<EmailField 
												name={`property_${property?.id}_contact_person_email`} 
												label="Email" 
												required 
											/>
											<AuPhoneField 
												name={`property_${property?.id}_contact_person_phone`} 
												label="Mobile" 
												required 
											/>
										</div>
									</div>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Contacts block: edit existing contacts */}
			{contactsList.length === 0 ? (
				<div>
					<div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center", marginBottom: 16 }}>No contacts assigned to this booking</div>
					<div style={{ display: "grid", gap: 16 }}>
						<div style={{ gridColumn: "1 / -1" }}>
							<SelectField 
								name="new_contact_1_contact_type" 
								label="Contact type" 
								options={contactTypeOptions}
								placeholder="Select contact type"
								required 
							/>
						</div>
						<div className="contact-form-grid">
							<TextField name="new_contact_1_first_name" label="First name" required />
							<TextField name="new_contact_1_last_name" label="Last name" required />
						</div>
						<div className="contact-form-grid">
							<EmailField name="new_contact_1_email" label="Email" required />
							<AuPhoneField name="new_contact_1_phone" label="Mobile" required error={state?.errors?.["contact_new_1_phone"]} />
						</div>
					</div>
				</div>
			) : (
				<div style={{ display: "grid", gap: 16 }}>
					{contactsList.map((ct) => (
						<div key={String(ct.id)} style={{ 
							border: "1px solid var(--color-light-gray)", 
							borderRadius: 8, 
							padding: 16, 
							backgroundColor: "var(--color-pale-gray)" 
						}}>
							<div style={{ display: "grid", gap: 16 }}>
								<div style={{ gridColumn: "1 / -1" }}>
									<SelectField 
										name={`contact_${ct.id}_contact_type`} 
										label="Contact type" 
										options={contactTypeOptions}
										defaultValue={ct.contact_type || ""}
										placeholder="Select contact type"
										required 
									/>
								</div>
								<div className="contact-form-grid">
									<TextField name={`contact_${ct.id}_first_name`} label="First name" defaultValue={ct.first_name || ""} required />
									<TextField name={`contact_${ct.id}_last_name`} label="Last name" defaultValue={ct.last_name || ""} required />
								</div>
								<div className="contact-form-grid">
									<EmailField 
										name={`contact_${ct.id}_email`} 
										label="Email" 
										defaultValue={ct.email || ""} 
										required={ct.contact_type !== "real_estate_agent"} 
									/>
									<AuPhoneField 
										name={`contact_${ct.id}_phone`} 
										label="Mobile" 
										defaultValue={(ct.phone || "").toString()} 
										required 
										error={state?.errors?.[`contact_${ct.id}_phone`]}
									/>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Application Process question - only for expert witness reports */}
			{inspection_type === "expert_witness_report" && (
				<SelectField
					name="booking_application_process"
					label="What is your application process?"
					options={[
						{ value: "nothing_lodged_yet", label: "Nothing lodged yet" },
						{ value: "in_mediation", label: "In mediation" },
						{ value: "at_tribunal", label: "At tribunal" },
						{ value: "in_court", label: "In court" }
					]}
					defaultValue={(booking as any)?.application_process || ""}
					placeholder="Select application process"
					required
				/>
			)}

			<div style={{ marginTop: 12 }}>
				<AddContactButton />
			</div>
			
			<LongDateField
				name="booking_tentative_inspection_date"
				label="Tentative inspection date (To Be Confirmed)"
				defaultValue={(booking as any)?.tentative_date ? new Date((booking as any).tentative_date).toISOString() : undefined}
			/>
			
			<TextAreaField 
				name="booking_additional_information" 
				label="Additional information" 
				placeholder="Add any extra details for this booking (optional)" 
				rows={4} 
				defaultValue={(booking as any)?.additional_info || ""} 
			/>
			
			
			<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
				<button type="submit" className="button-primary">Book Now</button>
			</div>
		</form>
	);
}
