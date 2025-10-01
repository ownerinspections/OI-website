"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import TextField from "@/components/ui/fields/TextField";
import EmailField from "@/components/ui/fields/EmailField";
import AuPhoneField from "@/components/ui/fields/AuPhoneField";
import AutoFillField from "@/components/ui/fields/AutoFillField";
import NextButton from "@/components/ui/controls/NextButton";
import { ContactFormSkeleton } from "@/components/ui/SkeletonLoader";
import type { ActionResult } from "@/lib/actions/contacts/createContact";
import { submitContact } from "@/lib/actions/contacts/createContact";
import type { ServiceRecord } from "@/lib/actions/services/getService";
import { getServiceType, getStepUrl } from "@/lib/config/service-routing";

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
	const [phone, setPhone] = useState<string>(initialValues?.phone ?? "");
	const [serviceId, setServiceId] = useState<string>(initialValues?.service_id ?? "");
	const [submitted, setSubmitted] = useState<boolean>(false);
	const [showValidationErrors, setShowValidationErrors] = useState<boolean>(false);

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
			// Get service ID from the selected service
			const selectedServiceId = serviceId ? Number(serviceId) : null;
			
			console.log('[ContactsForm] Redirecting with service ID:', selectedServiceId);
			
			// Use service routing to determine the correct property step URL
			let propertyStepUrl = "/steps/02-property"; // fallback
			if (selectedServiceId) {
				const serviceType = getServiceType(selectedServiceId);
				propertyStepUrl = getStepUrl(2, serviceType);
				console.log('[ContactsForm] Service routing:', { selectedServiceId, serviceType, propertyStepUrl });
			}
			
			// Build query params
			const params = new URLSearchParams();
			const currentUrl = new URL(window.location.href);
			const currentUserId = currentUrl.searchParams.get("userId");
			// Use userId from state if available, otherwise preserve from current URL
			const userIdToUse = state?.userId || currentUserId;
			if (userIdToUse) params.set("userId", userIdToUse);
			params.set("contactId", state.contactId);
			params.set("dealId", String(state.dealId));
			if (propertyId) params.set("propertyId", propertyId);
			const quoteId = currentUrl.searchParams.get("quoteId");
			if (quoteId) params.set("quoteId", quoteId);
			
			// Construct the full path with query string
			const redirectUrl = `${propertyStepUrl}?${params.toString()}`;
			console.log('[ContactsForm] Final redirect URL:', redirectUrl);
			
			// Use router.push with just the path and query string (no origin)
			router.push(redirectUrl);
		}
	}, [state?.success, state?.userId, state?.contactId, state?.dealId, propertyId, serviceId, router]);

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

	// Client-side validation using the same logic as server-side (createContact.ts validate function)
	const isFormValid = useMemo(() => {
		if (!firstName?.trim()) return false;
		if (!lastName?.trim()) return false;
		if (!email?.trim()) return false;
		if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return false;
		if (!phone?.trim()) return false;
		// Check if it's in E.164 format (+61...)
		if (phone.startsWith("+61")) {
			const phoneDigits = phone.replace(/\D+/g, "");
			if (phoneDigits.length !== 11 || !phoneDigits.startsWith("614")) return false;
		} else {
			// Check if it's in local format (4xx xxx xxx or partial)
			const phoneDigits = phone.replace(/\D+/g, "");
			if (phoneDigits.length < 9 || !phoneDigits.startsWith("4")) return false;
		}
		if (!serviceId) return false;
		return true;
	}, [firstName, lastName, email, phone, serviceId]);

	// Validation error messages (only show if validation attempted)
	const firstNameError = showValidationErrors && !firstName?.trim() ? "First name is required" : state?.errors?.first_name;
	const lastNameError = showValidationErrors && !lastName?.trim() ? "Last name is required" : state?.errors?.last_name;
	
	const emailError = useMemo(() => {
		if (state?.errors?.email) return state.errors.email;
		if (!showValidationErrors) return undefined;
		if (!email?.trim()) return "Email is required";
		if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) return "Enter a valid email";
		return undefined;
	}, [email, showValidationErrors, state?.errors?.email]);

	const phoneError = useMemo(() => {
		if (state?.errors?.phone) return state.errors.phone;
		if (!showValidationErrors) return undefined;
		if (!phone?.trim()) return "Phone is required";
		if (phone.startsWith("+61")) {
			const phoneDigits = phone.replace(/\D+/g, "");
			if (phoneDigits.length !== 11 || !phoneDigits.startsWith("614")) return "Enter a valid Australian mobile number";
		} else {
			const phoneDigits = phone.replace(/\D+/g, "");
			if (phoneDigits.length < 9 || !phoneDigits.startsWith("4")) return "Enter a valid Australian mobile number";
		}
		return undefined;
	}, [phone, showValidationErrors, state?.errors?.phone]);

	const serviceIdError = showValidationErrors && !serviceId ? "Service is required" : state?.errors?.service_id;

	// Show full page skeleton loading after success (until redirect)
	if (state?.success) {
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
			{/* Removed duplicate local subtitle to rely on standardized step header */}
			<form 
				action={formAction} 
				className="form-grid" 
				style={formStyle} 
				noValidate 
				onSubmit={() => {
					setSubmitted(true);
				}}
			>
					<input type="hidden" name="deal_id" value={dealId ?? ""} />
					<input type="hidden" name="contact_id" value={contactId ?? ""} />
					<input type="hidden" name="property_id" value={propertyId ?? ""} />
					<input type="hidden" name="user_id" value={userId ?? ""} />
					<div>
						<TextField name="first_name" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} error={firstNameError} required autoComplete="given-name" />
					</div>
					<div>
						<TextField name="last_name" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} error={lastNameError} required autoComplete="family-name" />
					</div>
					<div>
						<EmailField name="email" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} required />
					</div>
					<div>
						<AuPhoneField name="phone" label="Phone" defaultValue={initialValues?.phone} error={phoneError} required onChange={(value) => setPhone(value)} />
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
							required
						/>
					</div>
					{/* Address fields removed on step 1 */}
				<div style={actionsStyle}>
					<NextButton 
						label="Next"
						onClick={(e) => {
							if (!isFormValid) {
								e.preventDefault();
								setShowValidationErrors(true);
								return;
							}
							// If form is valid, let the normal submission proceed
						}}
					/>
				</div>
			</form>
		</>
	);
}
