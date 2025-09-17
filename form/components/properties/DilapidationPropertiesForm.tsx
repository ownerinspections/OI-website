"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import AutoFillField from "@/components/ui/fields/AutoFillField";
import NextButton from "@/components/ui/controls/NextButton";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import type { PropertyRecord } from "@/lib/actions/properties/createProperty";
import { submitDilapidationProperties } from "@/lib/actions/properties/submitDilapidationProperties";
import SelectField from "@/components/ui/fields/SelectField";
import TextField from "@/components/ui/fields/TextField";
import { extractPropertyDetails } from "@/lib/actions/properties/extractPropertyDetails";
import InfoBox from "@/components/ui/messages/InfoBox";
import SuccessBox from "@/components/ui/messages/SuccessBox";
import WarningBox from "@/components/ui/messages/WarningBox";
import ErrorBox from "@/components/ui/messages/ErrorBox";
import NoteBox from "@/components/ui/messages/NoteBox";

type Props = {
	properties?: PropertyRecord[];
	contactId?: string;
	userId?: string;
	dealId?: string;
	quoteId?: string;
	paymentId?: string;
	invoiceId?: string;
	serviceId?: number;
	serviceName?: string | null;
	propertyNote?: string;
};

type ActionState = Awaited<ReturnType<typeof submitDilapidationProperties>>;

export default function DilapidationPropertiesForm({ 
	properties = [], 
	contactId, 
	userId, 
	dealId, 
	quoteId, 
	paymentId, 
	invoiceId, 
	serviceId, 
	serviceName, 
	propertyNote 
}: Props) {
	const initialState: ActionState = {} as any;
	const [state, formAction] = useActionState<ActionState, FormData>(submitDilapidationProperties, initialState);
	const [submitted, setSubmitted] = useState<boolean>(false);

	// Simple array of property forms - start with 1, allow up to 10
	const [propertyCount, setPropertyCount] = useState(Math.max(1, properties.length));
	const [extractionStates, setExtractionStates] = useState<boolean[]>(new Array(Math.max(1, properties.length)).fill(false));

	// Navigate to next step on success
	useEffect(() => {
		if (state?.success && state?.nextUrl) {
			window.location.replace(state.nextUrl);
		}
	}, [state?.success, state?.nextUrl]);

	// Use same styling as PropertiesForm
	const cardStyle: React.CSSProperties = { padding: 16 };
	const gridStyle: React.CSSProperties = { display: "grid", gap: 6 };
	const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 2, gap: 8 };

	const prevHref = useMemo(() => {
		const params = new URLSearchParams();
		if (userId) params.set("userId", String(userId));
		if (dealId) params.set("dealId", String(dealId));
		if (contactId) params.set("contactId", String(contactId));
		if (invoiceId) params.set("invoiceId", String(invoiceId));
		if (quoteId) params.set("quoteId", String(quoteId));
		if (paymentId) params.set("paymentId", String(paymentId));
		
		// Include existing property IDs if we have them - use propertyId for consistency
		if (properties && properties.length > 0) {
			const propertyIds = properties.map(p => p.id).filter(Boolean);
			if (propertyIds.length > 0) {
				params.set("propertyId", propertyIds.join(","));
			}
		}
		
		const qs = params.toString();
		return qs ? `/steps/01-contact?${qs}` : "/steps/01-contact";
	}, [userId, dealId, contactId, invoiceId, quoteId, paymentId, properties]);

	const addProperty = () => {
		if (propertyCount < 10) {
			setPropertyCount(propertyCount + 1);
			setExtractionStates([...extractionStates, false]);
		}
	};

	const removeProperty = (index: number) => {
		if (propertyCount > 1) {
			setPropertyCount(propertyCount - 1);
			setExtractionStates(extractionStates.filter((_, i) => i !== index));
		}
	};

	const updateExtractionState = (index: number, isExtracting: boolean) => {
		setExtractionStates(prev => {
			const newStates = [...prev];
			newStates[index] = isExtracting;
			return newStates;
		});
	};

	// Check if any property is currently extracting
	const isAnyExtracting = extractionStates.some(Boolean);

	return (
		<div style={cardStyle}>
			{isAnyExtracting ? (
				<div style={{ position: "fixed", inset: 0, background: "transparent", zIndex: 999 }} aria-hidden="true" />
			) : null}
			{propertyNote ? (
				<NoteBox style={{ marginBottom: 16 }}>
					{propertyNote}
				</NoteBox>
			) : null}

			<form action={formAction} className="form-grid" style={gridStyle} noValidate aria-busy={isAnyExtracting} onSubmit={() => setSubmitted(true)}>
				<input type="hidden" name="contact_id" value={contactId ?? ""} />
				<input type="hidden" name="user_id" value={userId ?? ""} />
				<input type="hidden" name="deal_id" value={dealId ?? ""} />
				<input type="hidden" name="quote_id" value={quoteId ?? ""} />
				<input type="hidden" name="service_id" value={serviceId ? String(serviceId) : ""} />

				{/* Render all property forms */}
				{Array.from({ length: propertyCount }, (_, index) => (
					<PropertyFormSection 
						key={index}
						index={index}
						property={properties[index]}
						submitted={submitted}
						onRemove={() => removeProperty(index)}
						canRemove={propertyCount > 1}
						onExtractionStateChange={(isExtracting) => updateExtractionState(index, isExtracting)}
					/>
				))}

				{/* Simple Add Button */}
				{propertyCount < 10 && (
					<div style={{ gridColumn: "1 / -1", textAlign: "center", marginTop: 16 }}>
						<button
							type="button"
							onClick={addProperty}
							style={{
								background: "#0b487b",
								color: "white",
								border: "none",
								borderRadius: 6,
								padding: "12px 24px",
								cursor: "pointer",
								fontSize: 14,
								fontWeight: "500"
							}}
						>
							+ Add Property ({propertyCount}/10)
						</button>
					</div>
				)}

				{/* Navigation */}
				<div style={{ ...actionsStyle, gridColumn: "1 / -1", pointerEvents: isAnyExtracting ? "none" : undefined, opacity: isAnyExtracting ? 0.6 : 1 }}>
					<PreviousButton href={isAnyExtracting ? undefined : prevHref} />
					<NextButton disabled={isAnyExtracting} />
				</div>
			</form>
		</div>
	);
}

// Simple property form section - same as PropertiesForm but with index
function PropertyFormSection({ 
	index, 
	property, 
	submitted,
	onRemove,
	canRemove,
	onExtractionStateChange
}: { 
	index: number; 
	property?: PropertyRecord; 
	submitted: boolean;
	onRemove: () => void;
	canRemove: boolean;
	onExtractionStateChange: (isExtracting: boolean) => void;
}) {
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

	// Initialize from existing property
	useEffect(() => {
		if (property?.id) {
			const classification = (() => {
				const raw = property?.property_category;
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
			setHasExtracted(true);
		}
	}, [property?.id]);

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

	const addressError = useMemo(() => {
		if (addressSelected) return undefined;
		if (addressQuery.trim().length > 0) return undefined;
		return submitted ? "Full address is required" : undefined;
	}, [addressSelected, addressQuery, submitted]);

	const isApartmentUnit = useMemo(() => {
		const t = (quoteEditable.property_type ?? "").toLowerCase();
		return t === "apartment/unit";
	}, [quoteEditable.property_type]);

	const handleAddressSelect = async (opt: { value: string; label: string }) => {
		const s = addressSuggestions.find((x) => x.id === opt.value);
		if (s) {
			setAddressSelected(true);
			setAddressLabel(s.label);
			setStreetAddress(s.street_address || "");
			setUnitNumber(s.unit_number || "");
			setSuburb(s.suburb);
			setPropertyStateCode(s.state);
			setPostcode(s.postcode);
			setHasExtracted(false);
			setQuoteEditable({});
			setClientInfo(null);
			
			// Trigger extraction
			setExtractError("");
			setExtracting(true);
			onExtractionStateChange(true);
			try {
				const res = await extractPropertyDetails({ address: s.label });
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
					setExtractError("no_data");
					setHasExtracted(false);
				}
				if (res?.client_info) setClientInfo(res.client_info);
				setRealestateUrl(typeof res?.realestate_url === "string" ? res.realestate_url : "");
				setExtractedAgents(Array.isArray(res?.agents) ? res!.agents! : []);
			} catch (e) {
				setExtractError("Failed to extract property details");
				setHasExtracted(false);
			} finally {
				setExtracting(false);
				onExtractionStateChange(false);
			}
		}
	};

	return (
		<>
			{/* Property Header with Remove Button */}
			{index > 0 && (
				<div style={{ 
					gridColumn: "1 / -1", 
					marginTop: 24, 
					marginBottom: 16,
					paddingTop: 16,
					borderTop: "2px solid #d9d9d9",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center"
				}}>
					<h3 style={{ 
						margin: 0, 
						color: "var(--color-text-primary)",
						fontSize: 18,
						fontWeight: "600"
					}}>
						Property {index + 1}
					</h3>
					{canRemove && (
						<button
							type="button"
							onClick={onRemove}
							style={{
								background: "transparent",
								color: "#ef4444",
								border: "1px solid #ef4444",
								borderRadius: 4,
								padding: "6px 12px",
								cursor: "pointer",
								fontSize: 12,
								fontWeight: "500"
							}}
						>
							Remove
						</button>
					)}
				</div>
			)}

			{/* Address Field */}
			<div style={{ gridColumn: "1 / -1", marginTop: index === 0 ? 12 : 0 }}>
				<AutoFillField
					name={`property_${index}_full_address`}
					label="Full Address"
					options={addressOptions}
					defaultValue={addressLabel}
					submitSelectedLabel
					placeholder="Start typing address"
					disableClientFilter
					onInputChange={(q) => { setAddressQuery(q); setAddressSelected(false); }}
					onSelect={handleAddressSelect}
					required={true}
					loading={extracting || addressLoading}
					error={addressError}
					autoComplete="off"
				/>
			</div>

			{/* Extraction Status */}
			{extracting ? (
				<InfoBox style={{ gridColumn: "1 / -1" }}>
					Please hold on, we're extracting your property details from our database
				</InfoBox>
			) : null}
			{!extracting && hasExtracted && !extractError ? (
				<SuccessBox style={{ gridColumn: "1 / -1" }}>
					Property details extracted. Please double‑check, modify if needed, then hit Next.
				</SuccessBox>
			) : null}
			{!extracting && !!extractError ? (
				<ErrorBox style={{ gridColumn: "1 / -1" }}>
					We couldn't extract your property details. Please fill out the form and hit Next.
				</ErrorBox>
			) : null}

			{/* Property Details */}
			{(hasExtracted || !!extractError) && !extracting ? (
				<>
					<SelectField
						name={`property_${index}_quoting_property_classification`}
						label="Property classification"
						value={quoteEditable.property_classification ?? ""}
						onChange={(e) => setQuoteEditable((p) => ({ ...p, property_classification: e.target.value }))}
						error={submitted && !quoteEditable.property_classification ? "Required" : undefined}
						required
						options={[
							{ value: "", label: "Select classification" },
							{ value: "Residential", label: "Residential" },
							{ value: "Commercial", label: "Commercial" },
						]}
					/>
					<SelectField
						name={`property_${index}_quoting_property_type`}
						label="Property type"
						value={quoteEditable.property_type ?? ""}
						onChange={(e) => setQuoteEditable((p) => ({ ...p, property_type: e.target.value }))}
						error={submitted && !quoteEditable.property_type ? "Required" : undefined}
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
						name={`property_${index}_quoting_bedrooms_including_study`}
						label="Bedrooms (including study)"
						value={quoteEditable.bedrooms_including_study ?? ""}
						onChange={(e) => setQuoteEditable((p) => ({ ...p, bedrooms_including_study: e.target.value }))}
						inputMode="numeric"
						pattern="^\\d+$"
						required
						error={submitted && !quoteEditable.bedrooms_including_study ? "Required" : undefined}
					/>
					<TextField
						name={`property_${index}_quoting_bathrooms_rounded`}
						label="Bathrooms (rounded)"
						value={quoteEditable.bathrooms_rounded ?? ""}
						onChange={(e) => setQuoteEditable((p) => ({ ...p, bathrooms_rounded: e.target.value }))}
						inputMode="numeric"
						pattern="^\\d+$"
						required
						error={submitted && !quoteEditable.bathrooms_rounded ? "Required" : undefined}
					/>
					{!isApartmentUnit ? (
						<>
							<TextField
								name={`property_${index}_quoting_levels`}
								label="Levels"
								value={quoteEditable.levels ?? ""}
								onChange={(e) => setQuoteEditable((p) => ({ ...p, levels: e.target.value }))}
								inputMode="numeric"
								pattern="^\\d+$"
								required
								error={submitted && !quoteEditable.levels ? "Required" : undefined}
							/>
							<SelectField
								name={`property_${index}_quoting_has_basement_or_subfloor`}
								label="Basement/Subfloor"
								value={quoteEditable.has_basement_or_subfloor ?? ""}
								onChange={(e) => setQuoteEditable((p) => ({ ...p, has_basement_or_subfloor: e.target.value }))}
								error={submitted && !quoteEditable.has_basement_or_subfloor ? "Required" : undefined}
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
									name={`property_${index}_quoting_additional_structures`}
									label="Additional structures"
									placeholder="e.g. Shed, Granny flat"
									value={quoteEditable.additional_structures ?? ""}
									onChange={(e) => setQuoteEditable((p) => ({ ...p, additional_structures: e.target.value }))}
								/>
							</div>
						</>
					) : null}
				</>
			) : null}

			{/* Hidden fields */}
			<input type="hidden" name={`property_${index}_id`} value={property?.id ?? ""} />
			<input type="hidden" name={`property_${index}_street_address`} value={streetAddress} />
			<input type="hidden" name={`property_${index}_unit_number`} value={unitNumber} />
			<input type="hidden" name={`property_${index}_suburb`} value={suburb} />
			<input type="hidden" name={`property_${index}_state`} value={propertyStateCode} />
			<input type="hidden" name={`property_${index}_post_code`} value={postcode} />
			<input type="hidden" name={`property_${index}_realestate_url`} value={realestateUrl} />
			<input type="hidden" name={`property_${index}_agents_json`} value={JSON.stringify(extractedAgents || [])} />
		</>
	);
}