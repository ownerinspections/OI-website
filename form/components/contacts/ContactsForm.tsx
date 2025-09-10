"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import AutoFillField from "@/components/ui/fields/AutoFillField";
import NextButton from "@/components/ui/controls/NextButton";
import type { ActionResult } from "@/lib/actions/contacts/createContact";
import { submitContact } from "@/lib/actions/contacts/createContact";
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
};

export default function ContactsForm({ services, dealId, contactId, propertyId, userId, initialValues }: Props) {
	const initialState: ActionResult = {};
	const [state, formAction] = useActionState<ActionResult, FormData>(submitContact, initialState);
	const router = useRouter();
	const [firstName, setFirstName] = useState<string>(initialValues?.first_name ?? "");
	const [lastName, setLastName] = useState<string>(initialValues?.last_name ?? "");
	const [email, setEmail] = useState<string>(initialValues?.email ?? "");
	const [serviceId, setServiceId] = useState<string>(initialValues?.service_id ?? "");
	const [submitted, setSubmitted] = useState<boolean>(false);

	const filteredServices = useMemo(() => services, [services]);

	const initialServiceOptionLabel = useMemo(() => {
		if (!serviceId) return "";
		const found = services.find((s) => String(s.id) === String(serviceId));
		return found?.service_name ?? "";
	}, [serviceId, services]);

	useEffect(() => {
		if (state?.debug) {
			try {
				console.group("[ContactsForm] submitContact debug");
				for (const entry of state.debug as any[]) {
					console.log(entry?.tag || "entry", entry);
				}
				console.groupEnd();
			} catch (_e) {
				console.warn("[ContactsForm] failed to log debug", _e);
			}
		}
	}, [state?.debug]);

	useEffect(() => {
		if (state?.success && state?.contactId && state?.dealId) {
			const url = new URL(`/steps/02-property`, window.location.origin);
			// Required order: userId, contactId, dealId, propertyId, quoteId
			const currentUrl = new URL(window.location.href);
			const currentUserId = currentUrl.searchParams.get("userId");
			// Use userId from state if available, otherwise preserve from current URL
			const userIdToUse = state?.userId || currentUserId;
			if (userIdToUse) url.searchParams.set("userId", userIdToUse);
			url.searchParams.set("contactId", state.contactId);
			url.searchParams.set("dealId", String(state.dealId));
			if (propertyId) url.searchParams.set("propertyId", propertyId);
			const quoteId = currentUrl.searchParams.get("quoteId");
			if (quoteId) url.searchParams.set("quoteId", quoteId);
			router.replace(url.toString());
		}
	}, [state?.success, state?.userId, state?.contactId, state?.dealId, propertyId, router]);

	const formStyle: React.CSSProperties = {
		display: "grid",
		gap: 16,
	};

	const fullWidth: React.CSSProperties = { gridColumn: "1 / -1" };

	// Use global .button-primary class for responsive behavior defined in globals.css
	const buttonStyle: React.CSSProperties = {};

	const actionsStyle: React.CSSProperties = {
		...fullWidth,
		display: "flex",
		justifyContent: "flex-end",
	};

	// During redirect after success, render nothing
	if (state?.success) {
		return null;
	}

	const serviceIdError = state?.errors?.service_id ?? (submitted && !serviceId ? "Service is required" : undefined);


	return (
		<>
			{/* Removed duplicate local subtitle to rely on standardized step header */}
			<form action={formAction} className="form-grid" style={formStyle} noValidate onSubmit={() => setSubmitted(true)}>
					<input type="hidden" name="deal_id" value={dealId ?? ""} />
					<input type="hidden" name="contact_id" value={contactId ?? ""} />
					<input type="hidden" name="property_id" value={propertyId ?? ""} />
					<input type="hidden" name="user_id" value={userId ?? ""} />
					<div>
						<TextField name="first_name" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={state?.errors?.first_name} required autoComplete="given-name" />
					</div>
					<div>
						<TextField name="last_name" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={state?.errors?.last_name} required autoComplete="family-name" />
					</div>
					<div>
						<EmailField name="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} error={state?.errors?.email} required />
					</div>
					<div>
						<AuPhoneField name="phone" label="Phone" defaultValue={initialValues?.phone} error={state?.errors?.phone} required />
					</div>
					<div style={fullWidth}>
						<AutoFillField
							name="service_id"
							label="Inspection Type"
							options={filteredServices.map((s) => ({ value: String(s.id), label: s.service_name }))}
							defaultSelectedValue={serviceId || ""}
							defaultValue={initialServiceOptionLabel || undefined}
							placeholder={"Type to search a service"}
							error={serviceIdError}
							onSelect={(opt) => setServiceId(opt.value)}
							autoComplete="off"
						/>
					</div>
					{/* Address fields removed on step 1 */}
				<div style={actionsStyle}>
					<NextButton label="Next" />
				</div>
			</form>
		</>
	);
}
