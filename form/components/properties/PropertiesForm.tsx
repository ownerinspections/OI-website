"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import AutoFillField from "@/components/ui/fields/AutoFillField";
import NextButton from "@/components/ui/controls/NextButton";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import type { PropertyRecord } from "@/lib/actions/properties/createProperty";
import { submitProperty } from "@/lib/actions/properties/submitProperty";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import { extractPropertyDetails } from "@/lib/actions/properties/extractPropertyDetails";
import InfoBox from "@/components/ui/messages/InfoBox";
import SuccessBox from "@/components/ui/messages/SuccessBox";
import WarningBox from "@/components/ui/messages/WarningBox";
import ErrorBox from "@/components/ui/messages/ErrorBox";
import NoteBox from "@/components/ui/messages/NoteBox";
import { validatePropertyField, validatePropertyForm, type PropertyValidationData } from "@/lib/validation/propertyValidation";
import { PhoneVerificationSkeleton } from "@/components/ui/SkeletonLoader";

type Props = {
	property?: PropertyRecord;
	propertyId?: string;
	contactId?: string;
	userId?: string;
	dealId?: string;
	quoteId?: string;
	paymentId?: string;
	invoiceId?: string;
	serviceId?: number;
	serviceName?: string | null;
	propertyCategory?: "residential" | "commercial" | string;
	propertyNote?: string;
};

type ActionState = Awaited<ReturnType<typeof submitProperty>>;

export default function PropertiesForm({ property, propertyId, contactId, userId, dealId, quoteId, paymentId, invoiceId, serviceId, serviceName, propertyCategory, propertyNote }: Props) {
	const initialState: ActionState = {} as any;
	const [state, formAction] = useActionState<ActionState, FormData>(submitProperty, initialState);
	const [submitted, setSubmitted] = useState<boolean>(false);

	// Services that don't require full property details extraction (5, 6, 7, 8, 9)
	const servicesWithoutPropertyDetails = [5, 6, 7, 8, 9];
	const showPropertyDetails = !serviceId || !servicesWithoutPropertyDetails.includes(serviceId);
	
	// Services that need only property category and type fields (5, 6, 7, 8, 9)
	const servicesWithPropertyCategoryType = [5, 6, 7, 8, 9];
	const showPropertyCategoryType = serviceId && servicesWithPropertyCategoryType.includes(serviceId);

	// Removed other property details; keep only address fields
	const [addressQuery, setAddressQuery] = useState<string>("");
	const [addressOptions, setAddressOptions] = useState<Array<{ value: string; label: string }>>([]);
	const [addressSuggestions, setAddressSuggestions] = useState<Array<{ id: string; label: string; street_address: string; unit_number: string; suburb: string; state: string; postcode: string }>>([]);
	const [addressLoading, setAddressLoading] = useState<boolean>(false);
	const [addressLabel, setAddressLabel] = useState<string>("");
	const [addressSelected, setAddressSelected] = useState<boolean>(
		Boolean(property?.full_address) || Boolean(property?.suburb && property?.state && property?.post_code)
	);
	const [streetAddress, setStreetAddress] = useState<string>(property?.street_address || "");
	const [unitNumber, setUnitNumber] = useState<string>(property?.unit_number || "");
	const [suburb, setSuburb] = useState<string>(property?.suburb || "");
	const [propertyStateCode, setPropertyStateCode] = useState<string>(property?.state || "");
	const [postcode, setPostcode] = useState<string>(property?.post_code || "");

	// Property category and type for services 5, 6, 7, 8, 9
	const [propertyCategoryValue, setPropertyCategoryValue] = useState<string>(() => {
		const raw = property?.property_category || propertyCategory;
		if (!raw) return "";
		const lower = String(raw).toLowerCase();
		if (lower === "residential") return "Residential";
		if (lower === "commercial") return "Commercial";
		return "";
	});
	const [propertyTypeValue, setPropertyTypeValue] = useState<string>(property?.property_type || "");
	
	// Additional fields for construction stages service (service 5)
	const [areaSizeValue, setAreaSizeValue] = useState<string>(property?.area_sq ? String(property.area_sq) : "");
	const [numberOfLevelsValue, setNumberOfLevelsValue] = useState<string>(() => {
		const levels = property?.number_of_levels;
		if (!levels) return "";
		// Convert to number if it's a string, then map to text for dropdown
		const numericLevels = typeof levels === 'string' ? parseInt(levels, 10) : levels;
		if (numericLevels === 1) return "Single Storey";
		if (numericLevels === 2) return "Double Storey";
		if (numericLevels === 3) return "Triple Storey";
		return "";
	});

	// Extraction loading and results
	const [extracting, setExtracting] = useState<boolean>(false);
	const [extractError, setExtractError] = useState<string>("");
	const [hasExtracted, setHasExtracted] = useState<boolean>(false);
	const [quoteEditable, setQuoteEditable] = useState<{
		property_classification?: string;
		property_type?: string;
		bedrooms_including_study?: string;
		bathrooms_rounded?: string;
		levels?: string;
		has_basement_or_subfloor?: string;
		additional_structures?: string;
	}>({});
	const [clientInfo, setClientInfo] = useState<any>(null);
	const [realestateUrl, setRealestateUrl] = useState<string>("");
	const [extractedAgents, setExtractedAgents] = useState<Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>>([]);

	// When editing an existing property (propertyId present), prefill quoting fields and show them
	const [initializedFromProperty, setInitializedFromProperty] = useState<boolean>(false);
	useEffect(() => {
		console.log("[PropertiesForm] useEffect running - initializedFromProperty:", initializedFromProperty, "property?.id:", property?.id, "propertyId:", propertyId);
		if (initializedFromProperty) return;
		const hasExistingProperty = Boolean(property?.id || propertyId);
		console.log("[PropertiesForm] hasExistingProperty:", hasExistingProperty);
		if (!hasExistingProperty) return;
		// Prefill quoting fields from existing property details
		const classification = (() => {
			const raw = property?.property_category ?? propertyCategory;
			if (!raw) return "";
			const lower = String(raw).toLowerCase();
			if (lower === "residential") return "Residential";
			if (lower === "commercial") return "Commercial";
			return "";
		})();
		const basementValue = (() => {
			const raw: unknown = property?.basement as unknown;
			if (raw === true) return "Yes";
			if (raw === false) return "No";
			if (typeof raw === "string") {
				const v = raw.trim().toLowerCase();
				if (v === "yes" || v === "true") return "Yes";
				if (v === "no" || v === "false") return "No";
			}
			return "";
		})();
		function toNumericString(value: unknown): string {
			if (typeof value === "number" && Number.isFinite(value)) return String(value);
			if (typeof value === "string") {
				const t = value.trim();
				if (/^\d+$/.test(t)) return t;
			}
			return "";
		}
		// Map levels for both quoteEditable and numberOfLevelsValue
		const levelsValue = (() => {
			const levels = property?.number_of_levels;
			console.log("[PropertiesForm] Mapping levels - raw value:", levels, "type:", typeof levels);
			if (!levels) return "";
			// Convert to number if it's a string, then map to text for dropdown
			const numericLevels = typeof levels === 'string' ? parseInt(levels, 10) : levels;
			if (numericLevels === 1) return "Single Storey";
			if (numericLevels === 2) return "Double Storey";
			if (numericLevels === 3) return "Triple Storey";
			return "";
		})();
		console.log("[PropertiesForm] Mapped levelsValue:", levelsValue);

		const newQuoteEditable = {
			property_classification: classification,
			property_type: property?.property_type ?? "",
			bedrooms_including_study: toNumericString(property?.number_of_bedrooms as unknown),
			bathrooms_rounded: toNumericString(property?.number_of_bathrooms as unknown),
			levels: levelsValue,
			has_basement_or_subfloor: basementValue,
			additional_structures: typeof property?.additional_structures === "string" ? property!.additional_structures! : "",
		};
		console.log("[PropertiesForm] Setting quoteEditable:", newQuoteEditable);
		setQuoteEditable(newQuoteEditable);

		// Also update numberOfLevelsValue for service 5 (construction stages)
		console.log("[PropertiesForm] Setting numberOfLevelsValue:", levelsValue);
		setNumberOfLevelsValue(levelsValue);

		// Also update areaSizeValue for service 5 (construction stages)
		setAreaSizeValue(property?.area_sq ? String(property.area_sq) : "");

		// Build client info preview from existing property record
		try {
			const existing: any = {
				termite_risk: property?.termite_risk ?? null,
				termite_risk_reason: property?.termite_risk_reason ?? null,
				land_size: property?.land_size ?? null,
				year_built: property?.year_built ?? null,
				bushfire_prone: property?.bushfire_prone ?? null,
				flood_risk: property?.flood_risk ?? null,
				heritage_overlay: property?.heritage_overlay ?? null,
			};
			if (typeof property?.last_sold === "string" && property.last_sold.includes(",")) {
				const parts = property.last_sold.split(",");
				const price = (parts[0] ?? "").trim();
				const date = (parts[1] ?? "").trim();
				existing.last_sold_price = { price, date };
			}
			if (typeof property?.last_rental === "string" && property.last_rental.includes(",")) {
				const parts = property.last_rental.split(",");
				const pricePerWeek = (parts[0] ?? "").trim();
				const date = (parts[1] ?? "").trim();
				existing.last_rental_listing = { price_per_week: pricePerWeek, date };
			}
			setClientInfo(existing);
		} catch (_e) {
			// No-op if parsing fails; client info section will stay hidden
		}
		setHasExtracted(true);
		setInitializedFromProperty(true);
	}, [property?.id, propertyId, property?.property_category, property?.property_type, property?.number_of_bedrooms, property?.number_of_bathrooms, property?.number_of_levels, property?.basement, propertyCategory]);

	// No conditional detail fields

	const noteStyle: React.CSSProperties = { background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 };
	const cardStyle: React.CSSProperties = { padding: 16 };
	const gridStyle: React.CSSProperties = { display: "grid", gap: 6 };
	const headerStyle: React.CSSProperties = { marginBottom: 12 };
	// Removed rowStyle as other detail fields are no longer shown
	const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 2, gap: 8 };

	const infoBannerStyle: React.CSSProperties = {
		background: "#f5f5f5",
		border: "1px solid var(--color-light-gray)",
		borderRadius: 6,
		padding: 8,
		marginBottom: 6,
		color: "var(--color-text-secondary)",
	};


	// Enhanced validation using the new validation utility
	const serverErrors = state?.errors ?? {};
	const [hasUserInteracted, setHasUserInteracted] = useState<boolean>(false);
	const [showValidationAttempted, setShowValidationAttempted] = useState<boolean>(false);
	
	// Show validation errors if:
	// 1. User has interacted with the form
	// 2. Form has been submitted
	// 3. There are server-side validation errors
	// 4. There's existing property data but it's incomplete (for better UX when editing)
	// 5. User attempted to submit but form was invalid
	const hasExistingIncompleteData = Boolean(property?.id || propertyId) && !addressSelected;
	const showValidationErrors = hasUserInteracted || submitted || Object.keys(serverErrors).length > 0 || hasExistingIncompleteData || showValidationAttempted;

	// Real-time validation for address
	const addressError = useMemo(() => {
		const serverError = serverErrors.full_address;
		if (serverError) return serverError;
		
		if (showValidationErrors) {
			return validatePropertyField.address(addressSelected, addressLabel);
		}
		return undefined;
	}, [serverErrors.full_address, addressSelected, addressLabel, showValidationErrors]);

	// Real-time validation for property category (services 5, 6, 7, 8, 9)
	const propertyCategoryError = useMemo(() => {
		const serverError = serverErrors.quoting_property_classification;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyCategoryType) {
			return validatePropertyField.propertyCategory(propertyCategoryValue, true);
		}
		return undefined;
	}, [serverErrors.quoting_property_classification, propertyCategoryValue, showPropertyCategoryType, showValidationErrors]);

	// Real-time validation for property type (services 5, 6, 7, 8, 9)
	const propertyTypeErrorSpecialized = useMemo(() => {
		const serverError = serverErrors.quoting_property_type;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyCategoryType) {
			return validatePropertyField.propertyType(propertyTypeValue, true);
		}
		return undefined;
	}, [serverErrors.quoting_property_type, propertyTypeValue, showPropertyCategoryType, showValidationErrors]);

	// Real-time validation for construction stages specific fields (service 5)
	const areaSizeError = useMemo(() => {
		const serverError = serverErrors.area_sq;
		if (serverError) return serverError;
		
		if (showValidationErrors && serviceId === 5) {
			return validatePropertyField.areaSize(areaSizeValue);
		}
		return undefined;
	}, [serverErrors.area_sq, areaSizeValue, serviceId, showValidationErrors]);

	const numberOfLevelsError = useMemo(() => {
		const serverError = serverErrors.number_of_levels;
		if (serverError) return serverError;
		
		if (showValidationErrors && serviceId === 5) {
			return validatePropertyField.levels(numberOfLevelsValue, true);
		}
		return undefined;
	}, [serverErrors.number_of_levels, numberOfLevelsValue, serviceId, showValidationErrors]);

	// Real-time validation for property details (for services that need full property details)
	const propertyClassificationError = useMemo(() => {
		const serverError = serverErrors.quoting_property_classification;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyDetails) {
			return validatePropertyField.propertyCategory(quoteEditable.property_classification ?? "", true);
		}
		return undefined;
	}, [serverErrors.quoting_property_classification, quoteEditable.property_classification, showPropertyDetails, showValidationErrors]);

	const propertyTypeError = useMemo(() => {
		const serverError = serverErrors.quoting_property_type;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyDetails) {
			return validatePropertyField.propertyType(quoteEditable.property_type ?? "", true);
		}
		return undefined;
	}, [serverErrors.quoting_property_type, quoteEditable.property_type, showPropertyDetails, showValidationErrors]);

	const isApartmentUnit = useMemo(() => {
		const t = (quoteEditable.property_type ?? "").toLowerCase();
		return t === "apartment/unit";
	}, [quoteEditable.property_type]);

	// Clear apartment-specific fields when apartment is selected
	useEffect(() => {
		if (!isApartmentUnit) return;
		const hasAny = Boolean((quoteEditable.levels ?? "") || (quoteEditable.has_basement_or_subfloor ?? "") || (quoteEditable.additional_structures ?? ""));
		if (hasAny) {
			setQuoteEditable((p) => ({
				...p,
				levels: "",
				has_basement_or_subfloor: "",
				additional_structures: "",
			}));
		}
	}, [isApartmentUnit, quoteEditable.levels, quoteEditable.has_basement_or_subfloor, quoteEditable.additional_structures]);

	const bedroomsError = useMemo(() => {
		const serverError = serverErrors.quoting_bedrooms_including_study;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyDetails) {
			return validatePropertyField.bedrooms(quoteEditable.bedrooms_including_study ?? "");
		}
		return undefined;
	}, [serverErrors.quoting_bedrooms_including_study, quoteEditable.bedrooms_including_study, showPropertyDetails, showValidationErrors]);

	const bathroomsError = useMemo(() => {
		const serverError = serverErrors.quoting_bathrooms_rounded;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyDetails) {
			return validatePropertyField.bathrooms(quoteEditable.bathrooms_rounded ?? "");
		}
		return undefined;
	}, [serverErrors.quoting_bathrooms_rounded, quoteEditable.bathrooms_rounded, showPropertyDetails, showValidationErrors]);

	const levelsError = useMemo(() => {
		const serverError = serverErrors.quoting_levels;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyDetails && !isApartmentUnit) {
			return validatePropertyField.levels(quoteEditable.levels ?? "", true);
		}
		return undefined;
	}, [serverErrors.quoting_levels, quoteEditable.levels, showPropertyDetails, isApartmentUnit, showValidationErrors]);

	const basementError = useMemo(() => {
		const serverError = serverErrors.quoting_has_basement_or_subfloor;
		if (serverError) return serverError;
		
		if (showValidationErrors && showPropertyDetails && !isApartmentUnit) {
			return validatePropertyField.basement(quoteEditable.has_basement_or_subfloor ?? "", true);
		}
		return undefined;
	}, [serverErrors.quoting_has_basement_or_subfloor, quoteEditable.has_basement_or_subfloor, showPropertyDetails, isApartmentUnit, showValidationErrors]);

	const additionalStructuresError = undefined;

	const missingCoreCounts = useMemo(() => {
		function isEmpty(v?: string) {
			return !v || v.trim() === "";
		}
		if (isApartmentUnit) {
			return isEmpty(quoteEditable.bedrooms_including_study) && isEmpty(quoteEditable.bathrooms_rounded);
		}
		return isEmpty(quoteEditable.bedrooms_including_study) && isEmpty(quoteEditable.bathrooms_rounded) && isEmpty(quoteEditable.levels);
	}, [quoteEditable, isApartmentUnit]);

	// Comprehensive form validation
	const isFormValid = useMemo(() => {
		const validationData: PropertyValidationData = {
			full_address: addressLabel,
			addressSelected,
			propertyCategoryValue: showPropertyCategoryType ? propertyCategoryValue : quoteEditable.property_classification,
			propertyTypeValue: showPropertyCategoryType ? propertyTypeValue : quoteEditable.property_type,
			areaSizeValue: serviceId === 5 ? areaSizeValue : undefined,
			numberOfLevelsValue: serviceId === 5 ? numberOfLevelsValue : undefined,
			bedroomsValue: showPropertyDetails ? quoteEditable.bedrooms_including_study : undefined,
			bathroomsValue: showPropertyDetails ? quoteEditable.bathrooms_rounded : undefined,
			levelsValue: showPropertyDetails ? quoteEditable.levels : undefined,
			basementValue: showPropertyDetails ? quoteEditable.has_basement_or_subfloor : undefined,
			serviceId,
			showPropertyCategoryType: Boolean(showPropertyCategoryType),
			showPropertyDetails: Boolean(showPropertyDetails),
			isApartmentUnit
		};

		const errors = validatePropertyForm(validationData);
		return Object.keys(errors).length === 0;
	}, [
		addressLabel,
		addressSelected,
		propertyCategoryValue,
		propertyTypeValue,
		areaSizeValue,
		numberOfLevelsValue,
		quoteEditable.property_classification,
		quoteEditable.property_type,
		quoteEditable.bedrooms_including_study,
		quoteEditable.bathrooms_rounded,
		quoteEditable.levels,
		quoteEditable.has_basement_or_subfloor,
		serviceId,
		showPropertyCategoryType,
		showPropertyDetails,
		isApartmentUnit
	]);

	// No defaults needed

	// Navigate to next step on success
	useEffect(() => {
		if (state?.success && state?.nextUrl) {
			window.location.replace(state.nextUrl);
		}
	}, [state?.success, state?.nextUrl]);


	// Address autocomplete fetcher
	useEffect(() => {
		let alive = true;
		const q = addressQuery.trim();
		if (!q || q.length < 3) {
			setAddressOptions([]);
			setAddressSuggestions([]);
			return;
		}
		setAddressLoading(true);
		const timeout = setTimeout(async () => {
			try {
				const url = new URL("/api/places/autocomplete", window.location.origin);
				url.searchParams.set("input", q);
				url.searchParams.set("types", "address");
				const res = await fetch(url.toString());
				const json = await res.json();
				const raw: Array<{ id: string; label: string; street_address: string; unit_number: string; suburb: string; state: string; postcode: string }> = Array.isArray(json?.suggestions) ? json.suggestions : [];
				const opts: Array<{ value: string; label: string }> = raw.map((s) => ({ value: s.id, label: s.label }));
				if (alive) setAddressOptions(opts);
				if (alive) setAddressSuggestions(raw);
			} catch {
				if (alive) setAddressOptions([]);
				if (alive) setAddressSuggestions([]);
			} finally {
				if (alive) setAddressLoading(false);
			}
		}, 250);
		return () => { alive = false; clearTimeout(timeout); };
	}, [addressQuery]);

	// Initialize address label from existing property
	useEffect(() => {
		if (property?.full_address) {
			setAddressLabel(property.full_address);
			setAddressSelected(true);
			return;
		}
		if (property?.suburb && property?.state && property?.post_code) {
			setAddressLabel(`${property.suburb}, ${property.state} ${property.post_code}`);
			setAddressSelected(true);
		}
	}, [property?.full_address, property?.suburb, property?.state, property?.post_code]);

	const addressNotFound = useMemo(() => {
		const qlen = addressQuery.trim().length;
		return qlen >= 3 && !addressLoading && !addressSelected && addressOptions.length === 0;
	}, [addressQuery, addressLoading, addressSelected, addressOptions.length]);

	const prevHref = useMemo(() => {
		const params = new URLSearchParams();
		// Standard order: userId, dealId, contactId, propertyId, invoiceId, quoteId, paymentId
		if (userId) params.set("userId", String(userId));
		if (dealId) params.set("dealId", String(dealId));
		if (contactId) params.set("contactId", String(contactId));
		const effectivePropertyId = property?.id ?? propertyId;
		if (effectivePropertyId) params.set("propertyId", String(effectivePropertyId));
		if (invoiceId) params.set("invoiceId", String(invoiceId));
		if (quoteId) params.set("quoteId", String(quoteId));
		if (paymentId) params.set("paymentId", String(paymentId));
		const qs = params.toString();
		return qs ? `/steps/01-contact?${qs}` : "/steps/01-contact";
	}, [userId, dealId, contactId, property?.id, propertyId, invoiceId, quoteId, paymentId]);

	// Debug state - simplified to avoid function serialization issues
	console.log("[PropertiesForm] Rendering form - serviceId:", serviceId, "showPropertyDetails:", showPropertyDetails, "extracting:", extracting, "addressSelected:", addressSelected);
	console.log("[PropertiesForm] Property data:", { 
		id: property?.id, 
		number_of_levels: property?.number_of_levels,
		property_category: property?.property_category 
	});
	console.log("[PropertiesForm] QuoteEditable levels:", quoteEditable.levels);
	console.log("[PropertiesForm] NumberOfLevelsValue:", numberOfLevelsValue);
	console.log("[PropertiesForm] InitializedFromProperty:", initializedFromProperty);
	console.log("[PropertiesForm] Form state:", { submitted, success: state?.success, nextUrl: state?.nextUrl });
	console.log("[PropertiesForm] Validation state:", { 
		hasUserInteracted, 
		showValidationErrors, 
		isFormValid, 
		addressSelected, 
		addressLabel: addressLabel || "empty",
		hasExistingIncompleteData,
		showValidationAttempted
	});

	// Show full page skeleton loading while form is being submitted or after success (until redirect to step 3)
	if (submitted || state?.success) {
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
						<PhoneVerificationSkeleton />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div style={cardStyle}>
			{extracting ? (
				<div style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 999 }} aria-hidden="true" />
			) : null}
			{/* Service label removed per request */}
			{propertyNote ? (
				<NoteBox style={{ marginBottom: 16 }}>
					{propertyNote}
				</NoteBox>
			) : null}

			<form action={formAction} className="form-grid" style={gridStyle} noValidate aria-busy={extracting} onSubmit={(e) => {
				setSubmitted(true);
				setHasUserInteracted(true);
			}}>
				<input type="hidden" name="contact_id" value={contactId ?? ""} />
				<input type="hidden" name="user_id" value={userId ?? ""} />
				<input type="hidden" name="deal_id" value={dealId ?? ""} />
				<input type="hidden" name="property_id" value={property?.id ?? propertyId ?? ""} />
				<input type="hidden" name="quote_id" value={quoteId ?? ""} />
				<input type="hidden" name="service_id" value={serviceId ? String(serviceId) : ""} />
				{/* Full address (autocomplete) spanning full width */}
				<div style={{ gridColumn: "1 / -1", marginTop: 12 }}>
					<AutoFillField
						name="full_address"
						label="Full Address"
						options={addressOptions}
						defaultValue={addressLabel}
						submitSelectedLabel
						placeholder="Start typing address"
						disableClientFilter
						required={false}
						onInputChange={extracting ? undefined : (q) => { setAddressQuery(q); setAddressSelected(false); setHasUserInteracted(true); }}
						onSelect={(opt) => {
							const s = addressSuggestions.find((x) => x.id === opt.value);
							if (s) {
								console.log("[PropertiesForm] Address selected for service:", serviceId);
								setAddressSelected(true);
								setAddressLabel(s.label);
								setStreetAddress(s.street_address || "");
								setUnitNumber(s.unit_number || "");
								setSuburb(s.suburb);
								setPropertyStateCode(s.state);
								setPostcode(s.postcode);
								console.log("[PropertiesForm] Address selected", s);
								setHasExtracted(false);
								setQuoteEditable({});
								setClientInfo(null);
								// For services 7, 8, 9, mark as extracted without triggering property details extraction
								if (showPropertyCategoryType) {
									console.log("[PropertiesForm] Specialized service (7, 8, 9) - marking as extracted without property details");
									setHasExtracted(true);
									setExtracting(false);
								} else if (showPropertyDetails) {
									// Trigger extraction using the selected address label (only for services that need property details)
									(async () => {
										setExtractError("");
										setExtracting(true);
										console.log("[PropertiesForm] Starting extraction for", s.label);
										try {
											const res = await extractPropertyDetails({ address: s.label });
										console.log("[PropertiesForm] Extraction result", res);
										if (res?.quoting_info) {
											setQuoteEditable({
												property_classification: String(res.quoting_info.property_classification ?? ""),
												property_type: String(res.quoting_info.property_type ?? ""),
												bedrooms_including_study: res.quoting_info.bedrooms_including_study === "N/A" || res.quoting_info.bedrooms_including_study === undefined ? "" : String(res.quoting_info.bedrooms_including_study),
												bathrooms_rounded: res.quoting_info.bathrooms_rounded === "N/A" || res.quoting_info.bathrooms_rounded === undefined ? "" : String(res.quoting_info.bathrooms_rounded),
												levels: res.quoting_info.levels === "N/A" || res.quoting_info.levels === undefined ? "" : String(res.quoting_info.levels),
												has_basement_or_subfloor: String(res.quoting_info.has_basement_or_subfloor ?? ""),
												additional_structures: Array.isArray(res.quoting_info.additional_structures) ? res.quoting_info.additional_structures.join(", ") : "",
											});
											// Determine if extraction actually produced usable values
											const q = res.quoting_info;
											const hasUsable = Boolean(
												(q.property_classification && q.property_classification !== "N/A") ||
												(q.property_type && q.property_type !== "N/A") ||
												(typeof q.bedrooms_including_study === "number") ||
												(typeof q.bathrooms_rounded === "number") ||
												(typeof q.levels === "number") ||
												(q.has_basement_or_subfloor && q.has_basement_or_subfloor !== "N/A") ||
												(Array.isArray(q.additional_structures) && q.additional_structures.length > 0)
											);
											if (!hasUsable) {
												setExtractError("no_data");
												setHasExtracted(false);
											} else {
												setExtractError("");
												setHasExtracted(true);
											}
										} else {
											console.warn("[PropertiesForm] No quoting_info in extraction result");
											setExtractError("no_data");
											setHasExtracted(false);
										}
										if (res?.client_info) setClientInfo(res.client_info);
										setRealestateUrl(typeof res?.realestate_url === "string" ? res.realestate_url : "");
										setExtractedAgents(Array.isArray(res?.agents) ? res!.agents! : []);
									} catch (e) {
										console.error("[PropertiesForm] Extraction error", e);
										setExtractError("Failed to extract property details");
										setHasExtracted(false);
									} finally {
										setExtracting(false);
										console.log("[PropertiesForm] Extraction finished");
									}
									})();
								}
							}
						}}
						loading={extracting || addressLoading}
						error={addressError}
						autoComplete="off"
					/>
				</div>

				{addressNotFound ? (
					<ErrorBox style={{ gridColumn: "1 / -1" }}>
						Address not found. Please try again.
					</ErrorBox>
				) : null}

				{/* Property Category and Type fields for services 5, 6, 7, 8, 9 */}
				{showPropertyCategoryType ? (
					<>
						<SelectField
							name="quoting_property_classification"
							label="Property Classification"
							value={propertyCategoryValue}
							onChange={(e) => { setPropertyCategoryValue(e.target.value); setHasUserInteracted(true); }}
							error={propertyCategoryError}
							required={false}
							options={[
								{ value: "", label: "Select classification" },
								{ value: "Residential", label: "Residential" },
								{ value: "Commercial", label: "Commercial" },
							]}
						/>
						<SelectField
							name="quoting_property_type"
							label="Property Type"
							value={propertyTypeValue}
							onChange={(e) => { setPropertyTypeValue(e.target.value); setHasUserInteracted(true); }}
							error={propertyTypeErrorSpecialized}
							required={false}
							options={[
								{ value: "", label: "Select type" },
								{ value: "House", label: "House" },
								{ value: "Townhouse", label: "Townhouse" },
								{ value: "Apartment/Unit", label: "Apartment/Unit" },
								{ value: "Villa", label: "Villa" },
								{ value: "Duplex", label: "Duplex" },
								{ value: "Office", label: "Office" },
								{ value: "Retail", label: "Retail" },
								{ value: "Industrial", label: "Industrial" },
								{ value: "Warehouse", label: "Warehouse" },
								{ value: "Other", label: "Other" },
							]}
						/>
						{/* Additional fields for construction stages service (service 5) */}
						{serviceId === 5 ? (
							<>
								<TextField
									name="area_sq"
									label="Area Size (sq m)"
									value={areaSizeValue}
									onChange={(e) => { setAreaSizeValue(e.target.value); setHasUserInteracted(true); }}
									error={areaSizeError}
									required={false}
									inputMode="numeric"
									pattern="^\\d+(\\.\\d+)?$"
									placeholder="Enter area in square meters"
								/>
								<SelectField
									name="number_of_levels"
									label="Levels"
									value={numberOfLevelsValue}
									onChange={(e) => { setNumberOfLevelsValue(e.target.value); setHasUserInteracted(true); }}
									required={false}
									error={numberOfLevelsError}
									options={[
										{ value: "", label: "Select" },
										{ value: "Single Storey", label: "Single Storey" },
										{ value: "Double Storey", label: "Double Storey" },
										{ value: "Triple Storey", label: "Triple Storey" },
										{ value: "N/A", label: "N/A" },
									]}
								/>
							</>
						) : null}
					</>
				) : null}

				{/* Extracting message as inline text (no box), success green - only show for services that need property details */}
				{showPropertyDetails && extracting ? (
					<InfoBox style={{ gridColumn: "1 / -1" }}>
						Please hold on, we're extracting your property details from our database
					</InfoBox>
				) : null}
				{showPropertyDetails && !extracting && hasExtracted && !missingCoreCounts ? (
					<SuccessBox style={{ gridColumn: "1 / -1" }}>
						Property details extracted. Please double‑check, modify if needed, then hit Next.
					</SuccessBox>
				) : null}
				{showPropertyDetails && !extracting && !!extractError && !missingCoreCounts ? (
					<ErrorBox style={{ gridColumn: "1 / -1" }}>
						We couldn't extract your property details. Please fill out the form and hit Next.
					</ErrorBox>
				) : null}

				{/* Warn specifically if core counts are missing (bedrooms, bathrooms, levels) */}
				{showPropertyDetails && !extracting && (hasExtracted || !!extractError) && missingCoreCounts ? (
					<WarningBox style={{ gridColumn: "1 / -1" }}>
						We couldn't extract all property information. Please fill out the form and hit Next.
					</WarningBox>
				) : null}

				{/* Quoting info editable fields (render only after extraction result and for services that need property details) */}
				{(hasExtracted || !!extractError) && !extracting && showPropertyDetails ? (
					<>
						<SelectField
							name="quoting_property_classification"
							label="Property classification"
							value={quoteEditable.property_classification ?? ""}
							onChange={(e) => { setQuoteEditable((p) => ({ ...p, property_classification: e.target.value })); setHasUserInteracted(true); }}
							error={propertyClassificationError}
							required={false}
							options={[
								{ value: "", label: "Select classification" },
								{ value: "Residential", label: "Residential" },
								{ value: "Commercial", label: "Commercial" },
							]}
						/>
						<SelectField
							name="quoting_property_type"
							label="Property type"
							value={quoteEditable.property_type ?? ""}
							onChange={(e) => { setQuoteEditable((p) => ({ ...p, property_type: e.target.value })); setHasUserInteracted(true); }}
							error={propertyTypeError}
							required={false}
							options={[
								{ value: "", label: "Select type" },
								{ value: "House", label: "House" },
								{ value: "Townhouse", label: "Townhouse" },
								{ value: "Apartment/Unit", label: "Apartment/Unit" },
								{ value: "Villa", label: "Villa" },
								{ value: "Duplex", label: "Duplex" },
								{ value: "Other", label: "Other" },
							]}
						/>
						<TextField
							name="quoting_bedrooms_including_study"
							label="Bedrooms (including study)"
							value={quoteEditable.bedrooms_including_study ?? ""}
							onChange={(e) => { setQuoteEditable((p) => ({ ...p, bedrooms_including_study: e.target.value })); setHasUserInteracted(true); }}
							inputMode="numeric"
							pattern="^\\d+$"
							required={false}
							error={bedroomsError}
						/>
						<TextField
							name="quoting_bathrooms_rounded"
							label="Bathrooms (rounded)"
							value={quoteEditable.bathrooms_rounded ?? ""}
							onChange={(e) => { setQuoteEditable((p) => ({ ...p, bathrooms_rounded: e.target.value })); setHasUserInteracted(true); }}
							inputMode="numeric"
							pattern="^\\d+$"
							required={false}
							error={bathroomsError}
						/>
						{!isApartmentUnit ? (
							<>
								<SelectField
									name="quoting_levels"
									label="Levels"
									value={quoteEditable.levels ?? ""}
									onChange={(e) => { setQuoteEditable((p) => ({ ...p, levels: e.target.value })); setHasUserInteracted(true); }}
									required={false}
									error={levelsError}
									options={[
										{ value: "", label: "Select" },
										{ value: "Single Storey", label: "Single Storey" },
										{ value: "Double Storey", label: "Double Storey" },
										{ value: "Triple Storey", label: "Triple Storey" },
										{ value: "N/A", label: "N/A" },
									]}
								/>
								<SelectField
									name="quoting_has_basement_or_subfloor"
									label="Basement/Subfloor"
									value={quoteEditable.has_basement_or_subfloor ?? ""}
									onChange={(e) => { setQuoteEditable((p) => ({ ...p, has_basement_or_subfloor: e.target.value })); setHasUserInteracted(true); }}
									error={basementError}
									required={false}
									options={[
										{ value: "", label: "Select" },
										{ value: "Yes", label: "Yes" },
										{ value: "No", label: "No" },
										{ value: "N/A", label: "N/A" },
									]}
								/>
								<div style={{ gridColumn: "1 / -1" }}>
									<TextField
										name="quoting_additional_structures"
										label="Additional structures"
										placeholder="e.g. Shed, Granny flat"
										value={quoteEditable.additional_structures ?? ""}
										onChange={(e) => { setQuoteEditable((p) => ({ ...p, additional_structures: e.target.value })); setHasUserInteracted(true); }}
										error={additionalStructuresError}
									/>
								</div>
							</>
						) : null}
						{/* Read-only client info preview - hidden for apartment pre-settlement service */}
						{clientInfo && serviceId !== 4 ? (
							<div style={{ gridColumn: "1 / -1", background: "#f5f5f5", border: "1px solid var(--color-light-gray)", borderRadius: 6, padding: 12, margin: "8px 0" }}>
								<div style={{ marginBottom: 6, color: "var(--color-text-secondary)" }}>
									<strong>Client info</strong>
									<div style={{ fontSize: 12, marginTop: 2 }}><span style={{ color: "#ef4444", fontWeight: "bold" }}>Disclaimer:</span> Information provided is for general purposes only and should not be relied on as professional advice.</div>
								</div>
								<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Floor area (sqm)</div><div>{String(clientInfo.floor_area_sqm ?? "N/A")}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Land size</div><div>{String(clientInfo.land_size ?? "N/A")}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Year built</div><div>{String(clientInfo.year_built ?? "N/A")}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Termite risk</div><div>{String(clientInfo.termite_risk ?? "N/A")} {clientInfo.termite_risk_reason ? `– ${clientInfo.termite_risk_reason}` : ""}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Bushfire prone</div><div>{String(clientInfo.bushfire_prone ?? "N/A")}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Flood risk</div><div>{String(clientInfo.flood_risk ?? "N/A")}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Heritage overlay</div><div>{String(clientInfo.heritage_overlay ?? "N/A")}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Last sold</div><div>{clientInfo?.last_sold_price ? `${String(clientInfo.last_sold_price.price ?? "N/A")} on ${String(clientInfo.last_sold_price.date ?? "N/A")}` : "N/A"}</div></div>
									<div><div style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 2 }}>Last rental</div><div>{clientInfo?.last_rental_listing ? `${String(clientInfo.last_rental_listing.price_per_week ?? "N/A")}/wk on ${String(clientInfo.last_rental_listing.date ?? "N/A")}` : "N/A"}</div></div>
								</div>
							</div>
						) : null}
					</>
				) : null}
				{/* Hidden fields populated server-side from selected address */}
				<input type="hidden" name="street_address" value={streetAddress} />
				<input type="hidden" name="unit_number" value={unitNumber} />
				<input type="hidden" name="suburb" value={suburb} />
				<input type="hidden" name="state" value={propertyStateCode} />
				<input type="hidden" name="post_code" value={postcode} />
				{/* Hidden quoting fields to submit */}
				<input type="hidden" name="quoting_property_classification" value={showPropertyCategoryType ? propertyCategoryValue : (quoteEditable.property_classification ?? "")} />
				<input type="hidden" name="quoting_property_type" value={showPropertyCategoryType ? propertyTypeValue : (quoteEditable.property_type ?? "")} />
				{/* Only submit detailed property fields for services that need full property details (not 5, 6, 7, 8, 9) */}
				{showPropertyDetails ? (
					<>
						<input type="hidden" name="quoting_bedrooms_including_study" value={quoteEditable.bedrooms_including_study ?? ""} />
						<input type="hidden" name="quoting_bathrooms_rounded" value={quoteEditable.bathrooms_rounded ?? ""} />
						<input type="hidden" name="quoting_levels" value={quoteEditable.levels ?? ""} />
						<input type="hidden" name="quoting_has_basement_or_subfloor" value={quoteEditable.has_basement_or_subfloor ?? ""} />
						<input type="hidden" name="quoting_additional_structures" value={quoteEditable.additional_structures ?? ""} />
					</>
				) : null}
				<input type="hidden" name="termite_risk" value={clientInfo?.termite_risk ?? ""} />
				<input type="hidden" name="termite_risk_reason" value={clientInfo?.termite_risk_reason ?? ""} />
				{/* Additional extracted metadata */}
				<input type="hidden" name="land_size" value={clientInfo?.land_size ?? ""} />
				<input type="hidden" name="year_built" value={clientInfo?.year_built ?? ""} />
				<input type="hidden" name="bushfire_prone" value={clientInfo?.bushfire_prone ?? ""} />
				<input type="hidden" name="flood_risk" value={clientInfo?.flood_risk ?? ""} />
				<input type="hidden" name="heritage_overlay" value={clientInfo?.heritage_overlay ?? ""} />
				{/* Hidden extracted listing info */}
				<input type="hidden" name="realestate_url" value={realestateUrl ?? ""} />
				<input
					type="hidden"
					name="agents_json"
					value={(() => {
						try {
							return JSON.stringify(extractedAgents || []);
						} catch {
							return "[]";
						}
					})()}
				/>
				{extractedAgents.map((a, idx) => (
					<div key={`agent-hidden-${idx}`} style={{ display: "none" }}>
						<input type="hidden" name={`agent_${idx}_first_name`} value={a?.first_name ?? ""} />
						<input type="hidden" name={`agent_${idx}_last_name`} value={a?.last_name ?? ""} />
						<input type="hidden" name={`agent_${idx}_mobile`} value={a?.mobile ?? ""} />
						<input type="hidden" name={`agent_${idx}_email`} value={a?.email ?? ""} />
					</div>
				))}
				<input
					type="hidden"
					name="last_sold"
					value={(() => {
						const p = clientInfo?.last_sold_price;
						if (!p) return "";
						const price = p.price ?? "N/A";
						const date = p.date ?? "N/A";
						return `${String(price)},${String(date)}`;
					})()}
				/>
				<input
					type="hidden"
					name="last_rental"
					value={(() => {
						const r = clientInfo?.last_rental_listing;
						if (!r) return "";
						const price = r.price_per_week ?? "N/A";
						const date = r.date ?? "N/A";
						return `${String(price)},${String(date)}`;
					})()}
				/>

				<div style={{ ...actionsStyle, gridColumn: "1 / -1", pointerEvents: extracting ? "none" : undefined, opacity: extracting ? 0.6 : 1 }}>
					<PreviousButton href={extracting ? undefined : prevHref} />
					<NextButton 
						disabled={extracting} 
						onClick={(e) => {
							if (!isFormValid) {
								e.preventDefault();
								setHasUserInteracted(true);
								setShowValidationAttempted(true);
								return;
							}
							// If form is valid, let the normal submission proceed
						}}
					/>
				</div>
			</form>
		</div>
	);
}
