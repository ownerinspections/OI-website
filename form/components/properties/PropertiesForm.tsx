"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import AutoFillField from "@/components/ui/fields/AutoFillField";
import NextButton from "@/components/ui/controls/NextButton";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import type { PropertyRecord } from "@/lib/actions/properties/createProperty";
import { submitProperty } from "@/lib/actions/properties/submitProperty";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import type { extractPropertyDetails as ExtractFn } from "@/lib/actions/properties/extractPropertyDetails";

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
	onExtract?: typeof ExtractFn;
};

type ActionState = Awaited<ReturnType<typeof submitProperty>>;

export default function PropertiesForm({ property, propertyId, contactId, userId, dealId, quoteId, paymentId, invoiceId, serviceId, serviceName, propertyCategory, propertyNote, onExtract }: Props) {
	const initialState: ActionState = {} as any;
	const [state, formAction] = useActionState<ActionState, FormData>(submitProperty, initialState);
	const [submitted, setSubmitted] = useState<boolean>(false);

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
		if (initializedFromProperty) return;
		const hasExistingProperty = Boolean(property?.id || propertyId);
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
		setQuoteEditable({
			property_classification: classification,
			property_type: property?.property_type ?? "",
			bedrooms_including_study: toNumericString(property?.number_of_bedrooms as unknown),
			bathrooms_rounded: toNumericString(property?.number_of_bathrooms as unknown),
			levels: toNumericString(property?.number_of_levels as unknown),
			has_basement_or_subfloor: basementValue,
			additional_structures: typeof property?.additional_structures === "string" ? property!.additional_structures! : "",
		});

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
	}, [property?.id, propertyId, property?.property_category, property?.property_type, property?.number_of_bedrooms, property?.number_of_bathrooms, property?.number_of_levels, property?.basement, propertyCategory, initializedFromProperty]);

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

	// Message box styles with colored backgrounds and dark gray text
	const extractingTextRowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #3b82f6",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
	};

	const successTextRowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #10b981",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
	};

	const warnTextRowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #ef4444",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
	};

	const errorTextRowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #ef4444",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
	};

	const countsWarnTextRowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #f59e0b",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
	};

	const addressError = useMemo(() => {
		const serverError = state?.errors?.full_address;
		// Clear error as soon as user types or selects an address
		if (addressSelected) return undefined;
		if (addressQuery.trim().length > 0) return undefined;
		return serverError ?? (submitted ? "Full address is required" : undefined);
	}, [state?.errors?.full_address, addressSelected, addressQuery, submitted]);

	// Client-side validation helpers and per-field errors for quoting fields
	const quotingErrors = state?.errors ?? {};

	const showQuotingErrors = useMemo(() => {
		return submitted && (hasExtracted || !!extractError);
	}, [submitted, hasExtracted, extractError]);

	function isNumericString(value?: string) {
		return typeof value === "string" && /^\d+$/.test(value);
	}

	const propertyClassificationError = !(quoteEditable.property_classification ?? "")
		? (quotingErrors.quoting_property_classification ?? (showQuotingErrors ? "Required" : undefined))
		: undefined;
	const propertyTypeError = !(quoteEditable.property_type ?? "")
		? (quotingErrors.quoting_property_type ?? (showQuotingErrors ? "Required" : undefined))
		: undefined;
	const isApartmentUnit = useMemo(() => {
		const t = (quoteEditable.property_type ?? "").toLowerCase();
		return t === "apartment/unit";
	}, [quoteEditable.property_type]);
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
	const bedroomsError = (() => {
		const value = quoteEditable.bedrooms_including_study ?? "";
		if (!value) return quotingErrors.quoting_bedrooms_including_study ?? (showQuotingErrors ? "Required" : undefined);
		if (!isNumericString(value)) return quotingErrors.quoting_bedrooms_including_study ?? "Must be a number";
		return undefined;
	})();
	const bathroomsError = (() => {
		const value = quoteEditable.bathrooms_rounded ?? "";
		if (!value) return quotingErrors.quoting_bathrooms_rounded ?? (showQuotingErrors ? "Required" : undefined);
		if (!isNumericString(value)) return quotingErrors.quoting_bathrooms_rounded ?? "Must be a number";
		return undefined;
	})();
	const levelsError = (() => {
		if (isApartmentUnit) return undefined;
		const value = quoteEditable.levels ?? "";
		if (!value) return quotingErrors.quoting_levels ?? (showQuotingErrors ? "Required" : undefined);
		if (!isNumericString(value)) return quotingErrors.quoting_levels ?? "Must be a number";
		return undefined;
	})();
	const basementError = isApartmentUnit
		? undefined
		: (!(quoteEditable.has_basement_or_subfloor ?? "")
			? (quotingErrors.quoting_has_basement_or_subfloor ?? (showQuotingErrors ? "Required" : undefined))
			: undefined);
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

	return (
		<div style={cardStyle}>
			{extracting ? (
				<div style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 999 }} aria-hidden="true" />
			) : null}
			{/* Service label removed per request */}
			{propertyNote ? (
				<div style={noteStyle}>
					<div>{propertyNote}</div>
				</div>
			) : null}

			<form action={formAction} className="form-grid" style={gridStyle} noValidate aria-busy={extracting} onSubmit={() => setSubmitted(true)}>
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
						onInputChange={extracting ? undefined : (q) => { setAddressQuery(q); setAddressSelected(false); }}
						onSelect={(opt) => {
							const s = addressSuggestions.find((x) => x.id === opt.value);
							if (s) {
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
								// Trigger extraction using the selected address label
								(async () => {
									setExtractError("");
									setExtracting(true);
									console.log("[PropertiesForm] Starting extraction for", s.label);
									try {
										const res = onExtract ? await onExtract({ address: s.label }) : null;
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
						}}
						required
						loading={extracting || addressLoading}
						error={addressError}
						autoComplete="off"
					/>
				</div>

				{addressNotFound ? (
					<div style={{ gridColumn: "1 / -1", ...errorTextRowStyle }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#ef4444" }}>
							<path d="M12 2l10 18H2L12 2z" stroke="currentColor" strokeWidth="2" fill="none" />
							<circle cx="12" cy="16" r="1" fill="currentColor" />
							<path d="M12 8v5" stroke="currentColor" strokeWidth="2" />
						</svg>
						<span>Address not found. Please try again.</span>
					</div>
				) : null}

				{/* Extracting message as inline text (no box), success green */}
				{extracting ? (
					<div style={{ gridColumn: "1 / -1", ...extractingTextRowStyle }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#3b82f6" }}>
							<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
							<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2">
								<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
							</path>
						</svg>
						<span>Please hold on, we're extracting your property details from our database</span>
					</div>
				) : null}
				{!extracting && hasExtracted && !missingCoreCounts ? (
					<div style={{ gridColumn: "1 / -1", ...successTextRowStyle }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#10b981" }}>
							<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						<span>Property details extracted. Please double‑check, modify if needed, then hit Next.</span>
					</div>
				) : null}
				{!extracting && !!extractError && !missingCoreCounts ? (
					<div style={{ gridColumn: "1 / -1", ...warnTextRowStyle }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#ef4444" }}>
							<path d="M12 2l10 18H2L12 2z" stroke="currentColor" strokeWidth="2" fill="none" />
							<circle cx="12" cy="16" r="1" fill="currentColor" />
							<path d="M12 8v5" stroke="currentColor" strokeWidth="2" />
						</svg>
						<span>We couldn't extract your property details. Please fill out the form and hit Next.</span>
					</div>
				) : null}

				{/* Warn specifically if core counts are missing (bedrooms, bathrooms, levels) */}
				{!extracting && (hasExtracted || !!extractError) && missingCoreCounts ? (
					<div style={{ gridColumn: "1 / -1", ...countsWarnTextRowStyle }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#f59e0b" }}>
							<path d="M12 2l10 18H2L12 2z" stroke="currentColor" strokeWidth="2" fill="none" />
							<circle cx="12" cy="16" r="1" fill="currentColor" />
							<path d="M12 8v5" stroke="currentColor" strokeWidth="2" />
						</svg>
						<span>We couldn't extract all property information. Please fill out the form and hit Next.</span>
					</div>
				) : null}

				{/* Quoting info editable fields (render only after extraction result) */}
				{(hasExtracted || !!extractError) && !extracting ? (
					<>
						<SelectField
							name="quoting_property_classification"
							label="Property classification"
							value={quoteEditable.property_classification ?? ""}
							onChange={(e) => setQuoteEditable((p) => ({ ...p, property_classification: e.target.value }))}
							error={propertyClassificationError}
							required
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
							onChange={(e) => setQuoteEditable((p) => ({ ...p, property_type: e.target.value }))}
							error={propertyTypeError}
							required
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
							onChange={(e) => setQuoteEditable((p) => ({ ...p, bedrooms_including_study: e.target.value }))}
							inputMode="numeric"
							pattern="^\\d+$"
							required
							error={bedroomsError}
						/>
						<TextField
							name="quoting_bathrooms_rounded"
							label="Bathrooms (rounded)"
							value={quoteEditable.bathrooms_rounded ?? ""}
							onChange={(e) => setQuoteEditable((p) => ({ ...p, bathrooms_rounded: e.target.value }))}
							inputMode="numeric"
							pattern="^\\d+$"
							required
							error={bathroomsError}
						/>
						{!isApartmentUnit ? (
							<>
								<TextField
									name="quoting_levels"
									label="Levels"
									value={quoteEditable.levels ?? ""}
									onChange={(e) => setQuoteEditable((p) => ({ ...p, levels: e.target.value }))}
									inputMode="numeric"
									pattern="^\\d+$"
									required
									error={levelsError}
								/>
								<SelectField
									name="quoting_has_basement_or_subfloor"
									label="Basement/Subfloor"
									value={quoteEditable.has_basement_or_subfloor ?? ""}
									onChange={(e) => setQuoteEditable((p) => ({ ...p, has_basement_or_subfloor: e.target.value }))}
									error={basementError}
									required
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
										onChange={(e) => setQuoteEditable((p) => ({ ...p, additional_structures: e.target.value }))}
										error={additionalStructuresError}
									/>
								</div>
							</>
						) : null}
						{/* Read-only client info preview */}
						{clientInfo ? (
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
				<input type="hidden" name="quoting_property_classification" value={quoteEditable.property_classification ?? ""} />
				<input type="hidden" name="quoting_property_type" value={quoteEditable.property_type ?? ""} />
				<input type="hidden" name="quoting_bedrooms_including_study" value={quoteEditable.bedrooms_including_study ?? ""} />
				<input type="hidden" name="quoting_bathrooms_rounded" value={quoteEditable.bathrooms_rounded ?? ""} />
				<input type="hidden" name="quoting_levels" value={quoteEditable.levels ?? ""} />
				<input type="hidden" name="quoting_has_basement_or_subfloor" value={quoteEditable.has_basement_or_subfloor ?? ""} />
				<input type="hidden" name="quoting_additional_structures" value={quoteEditable.additional_structures ?? ""} />
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
					<NextButton disabled={extracting} />
				</div>
			</form>
		</div>
	);
}
