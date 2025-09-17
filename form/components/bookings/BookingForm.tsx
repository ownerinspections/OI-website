"use client";

import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/fields/TextField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import EmailField from "@/components/ui/fields/EmailField";
import TextAreaField from "@/components/ui/fields/TextAreaField";
import LongDateField from "@/components/ui/fields/LongDateField";
import AddAgentButton from "@/components/agents/AddAgentButton";
import AddContactButton from "@/components/contacts/AddContactButton";
import { submitBooking } from "@/lib/actions/bookings/submitBooking";
import type { BookingActionResult } from "@/lib/actions/bookings/submitBooking";

type AgentRecord = { id: string | number; first_name?: string | null; last_name?: string | null; mobile?: string | null; email?: string | null };
type ContactRecord = { id: string | number; first_name?: string | null; last_name?: string | null; phone?: string | null; email?: string | null };

type Props = {
	bookingId: string;
	userId?: string;
	contactId?: string;
	dealId?: string;
	propertyId?: string;
	quoteId?: string;
	invoiceId?: string;
	agentsList: AgentRecord[];
	contactsList: ContactRecord[];
	booking: any;
};

export default function BookingForm({ 
	bookingId, 
	userId, 
	contactId, 
	dealId, 
	propertyId, 
	quoteId, 
	invoiceId, 
	agentsList, 
	contactsList, 
	booking 
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

	// During redirect after success, render nothing
	if (state?.success) {
		return null;
	}

	const formStyle: React.CSSProperties = {
		display: "grid",
		gap: 24,
	};

	return (
		<form action={formAction} style={formStyle} noValidate>
			<input type="hidden" name="booking_id" value={bookingId} />
			<input type="hidden" name="user_id" value={userId ?? ""} />
			<input type="hidden" name="contact_id" value={contactId ?? ""} />
			<input type="hidden" name="deal_id" value={dealId ?? ""} />
			<input type="hidden" name="property_id" value={propertyId ?? ""} />
			<input type="hidden" name="quote_id" value={quoteId ?? ""} />
			<input type="hidden" name="invoice_id" value={invoiceId ?? ""} />

			{/* Contacts block: edit contacts */}
			<div className="booking-form-section">
				<div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Contacts</div>
				<div className="booking-form-content">
					{contactsList.length === 0 ? (
						<>
							<div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center", marginBottom: 16 }}>No contacts assigned to this booking</div>
							<div style={{ display: "grid", gap: 16 }}>
								<div className="contact-form-grid">
									<TextField name="new_contact_1_first_name" label="First name" required />
									<TextField name="new_contact_1_last_name" label="Last name" required />
								</div>
								<div className="contact-form-grid">
									<EmailField name="new_contact_1_email" label="Email" required />
									<AuPhoneField name="new_contact_1_phone" label="Mobile" required error={state?.errors?.["contact_new_1_phone"]} />
								</div>
							</div>
						</>
					) : (
						contactsList.map((ct) => (
							<div key={String(ct.id)} style={{ display: "grid", gap: 16 }}>
								<div className="contact-form-grid">
									<TextField name={`contact_${ct.id}_first_name`} label="First name" defaultValue={ct.first_name || ""} required readOnly />
									<TextField name={`contact_${ct.id}_last_name`} label="Last name" defaultValue={ct.last_name || ""} required readOnly />
								</div>
								<div className="contact-form-grid">
									<EmailField name={`contact_${ct.id}_email`} label="Email" defaultValue={ct.email || ""} required readOnly />
									<AuPhoneField 
										name={`contact_${ct.id}_phone`} 
										label="Mobile" 
										defaultValue={(ct.phone || "").toString()} 
										required 
										readOnly
										error={state?.errors?.[`contact_${ct.id}_phone`]}
									/>
								</div>
							</div>
						))
					)}
				</div>
				<div style={{ marginTop: 12 }}>
					<AddContactButton />
				</div>
			</div>

			{/* Real Estate Agents block: edit real estate agents */}
			<div className="booking-form-section">
				<div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Real Estate Agent</div>
				<div className="booking-form-content">
					{agentsList.length === 0 ? (
						<>
							<div style={{ color: "var(--color-text-secondary)", fontSize: 14, textAlign: "center", marginBottom: 16 }}>No real estate agents assigned to this booking</div>
							<div style={{ display: "grid", gap: 16 }}>
								<div className="agent-form-grid">
									<TextField name="new_agent_1_first_name" label="First name" required />
									<TextField name="new_agent_1_last_name" label="Last name" required />
								</div>
								<div className="agent-form-grid">
									<EmailField name="new_agent_1_email" label="Email (optional)" />
									<AuPhoneField name="new_agent_1_mobile" label="Mobile" required error={state?.errors?.["agent_new_1_mobile"]} />
								</div>
							</div>
						</>
					) : (
						agentsList.map((ag) => (
							<div key={String(ag.id)} style={{ display: "grid", gap: 16 }}>
								<div className="agent-form-grid">
									<TextField name={`agent_${ag.id}_first_name`} label="First name" defaultValue={ag.first_name || ""} required />
									<TextField name={`agent_${ag.id}_last_name`} label="Last name" defaultValue={ag.last_name || ""} required />
								</div>
								<div className="agent-form-grid">
									<EmailField name={`agent_${ag.id}_email`} label="Email (optional)" defaultValue={ag.email && ag.email !== "N/A" ? ag.email : ""} />
									<AuPhoneField 
										name={`agent_${ag.id}_mobile`} 
										label="Mobile" 
										defaultValue={(ag.mobile || "").toString()} 
										required 
										error={state?.errors?.[`agent_${ag.id}_mobile`]}
									/>
								</div>
							</div>
						))
					)}
				</div>
				<div style={{ marginTop: 12 }}>
					<AddAgentButton />
				</div>
			</div>

			{/* Form fields for tentative date and additional information */}
			<div className="booking-form-section">
				<div style={{ fontWeight: 600, marginBottom: 12, fontSize: 16 }}>Booking Details</div>
				<div className="booking-form-content">
					<div style={{ display: "grid", gap: 16 }}>
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
					</div>
				</div>
			</div>
			
			<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
				<button type="submit" className="button-primary">Book Now</button>
			</div>
		</form>
	);
}
