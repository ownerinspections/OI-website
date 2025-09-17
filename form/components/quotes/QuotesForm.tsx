"use client";

import React from "react";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import AddonTooltip from "@/components/ui/AddonTooltip";
import StageTooltip from "@/components/ui/StageTooltip";
import Toggle from "@/components/ui/Toggle";
import InfoBox from "@/components/ui/messages/InfoBox";
import WarningBox from "@/components/ui/messages/WarningBox";
import NoteBox from "@/components/ui/messages/NoteBox";
import { fetchGstRate } from "@/lib/actions/invoices/createInvoice";
import { estimateInsuranceReportQuote, type PropertyDetails } from "@/lib/actions/quotes/estimateQuote";

// Server action to create invoice and approve proposal
async function createInvoiceAndNavigate(quoteId: string, dealId: string, contactId: string, propertyId: string, totalAmount: number, invoiceIdParam?: string, userId?: string, paymentId?: string) {
	try {
		const response = await fetch('/api/proposals/approve-and-create-invoice', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ quoteId, dealId, contactId, propertyId, totalAmount, invoiceId: invoiceIdParam || null, userId: userId || null }),
		});
		
		if (response.ok) {
			const { invoiceId } = await response.json();
			const params = new URLSearchParams();
			// Ensure userId is first in the invoice URL
			if (userId) params.set("userId", userId);
			if (contactId) params.set("contactId", contactId);
			if (dealId) params.set("dealId", dealId);
			if (propertyId) params.set("propertyId", propertyId);
			params.set("quoteId", quoteId);
			if (invoiceIdParam) params.set("invoiceId", invoiceIdParam);
			else if (invoiceId) params.set("invoiceId", invoiceId);
			// Include paymentId if it exists
			if (paymentId) params.set("paymentId", paymentId);
			window.location.href = `/steps/05-invoice?${params.toString()}`;
		} else {
			// Fallback to current behavior if API fails
			const params = new URLSearchParams();
			// Ensure userId is first in the invoice URL
			if (userId) params.set("userId", userId);
			if (contactId) params.set("contactId", contactId);
			if (dealId) params.set("dealId", dealId);
			if (propertyId) params.set("propertyId", propertyId);
			params.set("quoteId", quoteId);
			if (invoiceIdParam) params.set("invoiceId", invoiceIdParam);
			// Include paymentId if it exists
			if (paymentId) params.set("paymentId", paymentId);
			window.location.href = `/steps/05-invoice?${params.toString()}`;
		}
	} catch (error) {
		console.error('Error creating invoice:', error);
		// Fallback to current behavior if API fails
		const params = new URLSearchParams();
		// Ensure userId is first in the invoice URL
		if (userId) params.set("userId", userId);
		if (contactId) params.set("contactId", contactId);
		if (dealId) params.set("dealId", dealId);
		if (propertyId) params.set("propertyId", propertyId);
		params.set("quoteId", quoteId);
		if (invoiceIdParam) params.set("invoiceId", invoiceIdParam);
		// Include paymentId if it exists
		if (paymentId) params.set("paymentId", paymentId);
		window.location.href = `/steps/05-invoice?${params.toString()}`;
	}
}

type Props = {
	quote?: {
		id: string | number;
		quote_id?: string | number;
		amount: number;
		quote_amount?: number;
		inspection_amount?: number;
		currency?: string;
		note?: string | null;
		service_code?: string;
		service_label?: string;
		property_category?: string;
		quote_note?: string;
		date_created?: string;
		date_expires?: string;
	};
	dealId?: string;
	contactId?: string;
	propertyId?: string;
	invoiceId?: string;
	paymentId?: string;
	quoteNote?: string;
	addons?: Array<{ id: number; name: string; price: number }>;
	termiteRisk?: string;
	termiteRiskReason?: string;
    preselectedAddonIds?: number[];
    userId?: string;
    gstRate?: number;
    proposalStatus?: string;
    stagePrices?: Array<{ stage: number; price: number }>;
    preselectedStages?: number[];
    estimatedDamageLoss?: number;
    onEstimatedDamageLossChange?: (value: number) => void;
    showInspectionBox?: boolean;
    propertyCategory?: string;
    serviceId?: number;
};

export default function QuotesForm({ quote, dealId, contactId, propertyId, invoiceId, paymentId, quoteNote, addons, termiteRisk, termiteRiskReason, preselectedAddonIds, userId, gstRate, proposalStatus, stagePrices, preselectedStages, estimatedDamageLoss, onEstimatedDamageLossChange, showInspectionBox = true, propertyCategory = "residential", serviceId }: Props) {
	const cardStyle: React.CSSProperties = { padding: 16 };
	const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 };
	const headerLeftSpacerStyle: React.CSSProperties = { flex: 1 };
	const quoteMetaStyle: React.CSSProperties = { textAlign: "right", color: "var(--color-text-secondary)" };
	const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 8 };
	const labelStyle: React.CSSProperties = { color: "var(--color-text-secondary)" };
	const valueStyle: React.CSSProperties = { color: "var(--color-text-primary)", fontWeight: 500 };
	// Removed local header to rely on page-level step header
	const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 16, gap: 8 };
	const addonRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, border: "1px solid #d9d9d9", borderRadius: 6, marginBottom: 8 };
	const addonNameStyle: React.CSSProperties = { color: "var(--color-text-primary)", fontWeight: 500 };
	const addonPriceStyle: React.CSSProperties = { color: "var(--color-primary)", fontWeight: 600 };
	const inspectionBoxStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #d9d9d9", color: "var(--color-text-primary)", borderRadius: 6, padding: 8, marginBottom: 8 };


	const [selected, setSelected] = React.useState<Record<number, boolean>>(() => {
		const map: Record<number, boolean> = {};
		(addons || []).forEach((a) => {
			map[a.id] = Array.isArray(preselectedAddonIds) ? preselectedAddonIds.includes(a.id) : false;
		});
		return map;
	});

	const [selectedStages, setSelectedStages] = React.useState<Record<number, boolean>>(() => {
		const map: Record<number, boolean> = {};
		(stagePrices || []).forEach((s) => {
			map[s.stage] = Array.isArray(preselectedStages) ? preselectedStages.includes(s.stage) : true; // Default to true for stages
		});
		return map;
	});

	// State for stage names
	const [stageNames, setStageNames] = React.useState<Record<number, string>>({});

	// Fetch stage names when serviceId or stagePrices change
	React.useEffect(() => {
		if (!serviceId || !Array.isArray(stagePrices) || stagePrices.length === 0) {
			return;
		}

		const fetchStageNames = async () => {
			try {
				const response = await fetch(`/api/services/${serviceId}`);
				if (response.ok) {
					const data = await response.json();
					if (data.data && Array.isArray(data.data.stages)) {
						const names: Record<number, string> = {};
						data.data.stages.forEach((stage: any) => {
							const stageNum = Number(stage.stage_number);
							if (Number.isFinite(stageNum)) {
								names[stageNum] = stage.stage_name || `Stage ${stageNum}`;
							}
						});
						setStageNames(names);
					}
				}
			} catch (error) {
				console.warn('Failed to fetch stage names:', error);
			}
		};

		fetchStageNames();
	}, [serviceId, stagePrices]);

	// State for estimated damage loss and dynamic stage prices
	const [currentEstimatedDamageLoss, setCurrentEstimatedDamageLoss] = React.useState(estimatedDamageLoss || 100000);
	const [currentStagePrices, setCurrentStagePrices] = React.useState(stagePrices || []);
	const [isUpdatingQuote, setIsUpdatingQuote] = React.useState(false);

	// Debounced function to update quote when estimated damage loss changes
	const updateQuoteFromDamageLoss = React.useCallback(
		React.useMemo(() => {
			let timeoutId: NodeJS.Timeout;
			return (newValue: number) => {
				clearTimeout(timeoutId);
				timeoutId = setTimeout(async () => {
					if (newValue > 0 && propertyCategory) {
						setIsUpdatingQuote(true);
						try {
							const propertyDetails: PropertyDetails = {
								property_category: propertyCategory as "residential" | "commercial",
								stages: [1, 2],
								estimated_damage_loss: newValue
							};
							
							const estimate = await estimateInsuranceReportQuote(propertyDetails);
							if (estimate?.stage_prices) {
								setCurrentStagePrices(estimate.stage_prices);
							}
						} catch (error) {
							console.error("Failed to update quote:", error);
						} finally {
							setIsUpdatingQuote(false);
						}
					}
				}, 500); // 500ms debounce
			};
		}, [propertyCategory]),
		[propertyCategory]
	);

	const handleEstimatedDamageLossChange = (value: number) => {
		setCurrentEstimatedDamageLoss(value);
		updateQuoteFromDamageLoss(value);
		if (onEstimatedDamageLossChange) {
			onEstimatedDamageLossChange(value);
		}
	};

	// Calculate base amount from selected stages if stagePrices are provided, otherwise use quote amount
	const baseAmount = React.useMemo(() => {
		const pricesToUse = currentStagePrices.length > 0 ? currentStagePrices : (stagePrices || []);
		if (pricesToUse.length > 0) {
			return pricesToUse.reduce((sum, s) => (selectedStages[s.stage] ? sum + Number(s.price || 0) : sum), 0);
		}
		return Number((quote as any)?.inspection_amount ?? (quote as any)?.quote_amount ?? quote?.amount ?? 0);
	}, [currentStagePrices, stagePrices, selectedStages, quote]);

	const addonsTotal = (addons || []).reduce((sum, a) => (selected[a.id] ? sum + Number(a.price || 0) : sum), 0);
	const subtotalExcludingGst = baseAmount + addonsTotal;
	const gstAmount = +(subtotalExcludingGst * ((gstRate || 10) / 100)).toFixed(2);
	const totalAmountIncludingGst = +(subtotalExcludingGst + gstAmount).toFixed(2);

	const handleAcceptQuoteClick = () => {
		createInvoiceAndNavigate(String(quote?.id), dealId || "", contactId || "", propertyId || "", subtotalExcludingGst, invoiceId || undefined, userId || undefined, paymentId || undefined);
	};

	// Debounce patch to server when total changes
	React.useEffect(() => {
		let alive = true;
		const id = quote?.id;
		const total = totalAmountIncludingGst; // Send total including GST to server
		if (!id) return;
		const timer = setTimeout(async () => {
			if (!alive) return;
			try {
				const selectedAddonIds = Object.entries(selected)
					.filter(([, on]) => Boolean(on))
					.map(([id]) => Number(id))
					.filter((n) => Number.isFinite(n));
				
				const selectedStageNumbers = Object.entries(selectedStages)
					.filter(([, on]) => Boolean(on))
					.map(([stage]) => Number(stage))
					.filter((n) => Number.isFinite(n));

				await fetch(`/api/proposals/${encodeURIComponent(String(id))}/total`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ 
						total, 
						addons: selectedAddonIds,
						stages: selectedStageNumbers
					}),
					cache: "no-store",
				});
			} catch {}
		}, 300);
		return () => { alive = false; clearTimeout(timer); };
	}, [quote?.id, totalAmountIncludingGst, selected, selectedStages]);

	const prevHref = (() => {
		const params = new URLSearchParams();
		// Standard order: userId, contactId, dealId, propertyId, invoiceId, quoteId, paymentId
		if (userId) params.set("userId", String(userId));
		if (contactId) params.set("contactId", String(contactId));
		if (dealId) params.set("dealId", String(dealId));
		if (propertyId) params.set("propertyId", String(propertyId));
		if (invoiceId) params.set("invoiceId", String(invoiceId));
		if (quote?.id) params.set("quoteId", String(quote.id));
		if (paymentId) params.set("paymentId", String(paymentId));
		const qs = params.toString();
		return qs ? `/steps/02-property?${qs}` : "/steps/02-property";
	})();

	if (!quote) return <div style={cardStyle}>No quote found.</div>;

	return (
		<div style={cardStyle}>
			{/* Header (mirrors invoice header right-side meta) */}
			{/* Secondary quote details removed - now shown in page header only */}
			{(quoteNote ?? quote?.quote_note) ? (
				<NoteBox style={{ marginBottom: 16 }}>
					<div>{quoteNote ?? quote?.quote_note}</div>
				</NoteBox>
			) : null}
			{Array.isArray(currentStagePrices) && currentStagePrices.length > 0 ? (
				<div style={{ marginTop: 8, marginBottom: 8 }}>
					{showInspectionBox && (
						<div style={inspectionBoxStyle}>
							<span style={{ fontWeight: 600 }}>{quote.service_label || quote.service_code || "Inspection"}</span>
							{/* Hide price for insurance reports with stages */}
							{!(Array.isArray(currentStagePrices) && currentStagePrices.length > 0) && (
								<span style={{ ...valueStyle, color: "var(--color-primary)", fontSize: 16 }}>
									{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(baseAmount)}
								</span>
							)}
						</div>
					)}
					{/* Estimated Damage Loss field for insurance reports - moved to top */}
					{estimatedDamageLoss !== undefined && (
						<div style={{ marginBottom: 16 }}>
							<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
								<label style={{ ...labelStyle, width: "50%" }}>Estimated Damage Loss amount:</label>
								<div style={{ position: "relative", width: "50%" }}>
									<input
										type="text"
										value={currentEstimatedDamageLoss.toLocaleString()}
										onChange={(e) => {
											// Remove commas and parse the number
											const numericValue = e.target.value.replace(/,/g, '');
											const parsedValue = Number(numericValue) || 0;
											handleEstimatedDamageLossChange(parsedValue);
										}}
										style={{
											width: "100%",
											padding: "8px 50px 8px 8px",
											border: "1px solid #d9d9d9",
											borderRadius: 4,
											fontSize: 14
										}}
										placeholder="Enter estimated damage loss"
										disabled={isUpdatingQuote}
									/>
									<span style={{ 
										position: "absolute", 
										right: 8, 
										top: "50%", 
										transform: "translateY(-50%)", 
										...labelStyle, 
										fontSize: 12,
										pointerEvents: "none"
									}}>AUD</span>
								</div>
								{isUpdatingQuote && (
									<span style={{ ...labelStyle, fontSize: 12, color: "var(--color-primary)" }}>Updating...</span>
								)}
							</div>
						</div>
					)}
					<InfoBox>
						<div>
							<div style={{ fontWeight: 600 }}>Inspection Stages</div>
							<div style={{ fontSize: 12, marginTop: 2 }}>Select which stages you'd like to include in your inspection. Toggle items below on or off — totals update automatically.</div>
						</div>
					</InfoBox>
					<div>
						{currentStagePrices.map((s) => (
							<div key={s.stage} style={addonRowStyle}>
					<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
						<Toggle checked={Boolean(selectedStages[s.stage])} onChange={(next) => setSelectedStages((prev) => ({ ...prev, [s.stage]: next }))} />
						{serviceId ? (
							<StageTooltip serviceId={serviceId} stageNumber={s.stage}>
								<span style={addonNameStyle}>
									{stageNames[s.stage] 
										? `Stage ${s.stage} - ${stageNames[s.stage]}`
										: `Stage ${s.stage}`
									}
								</span>
							</StageTooltip>
						) : (
							<span style={addonNameStyle}>Stage {s.stage}</span>
						)}
					</div>
								<span style={addonPriceStyle}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(s.price || 0)}</span>
							</div>
						))}
					</div>
				</div>
			) : null}
			{Array.isArray(addons) && addons.length > 0 ? (
				<div style={{ marginTop: 8, marginBottom: 8 }}>
					{/* Only show inspection box if we don't have stages (to avoid duplication) */}
					{!(Array.isArray(stagePrices) && stagePrices.length > 0) && (
						<div style={inspectionBoxStyle}>
							<span style={{ fontWeight: 600 }}>{quote.service_label || quote.service_code || "Inspection"}</span>
							<span style={{ ...valueStyle, color: "var(--color-primary)", fontSize: 16 }}>
								{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(baseAmount)}
							</span>
						</div>
					)}
					<InfoBox>
						<div>
							<div style={{ fontWeight: 600 }}>Optional add-ons</div>
							<div style={{ fontSize: 12, marginTop: 2 }}>Add extra services to tailor your quote. Toggle items below on or off — totals update automatically.</div>
						</div>
					</InfoBox>
					{(() => {
						const risk = (termiteRisk || "").toString().toLowerCase();
						if (risk === "high" || risk === "moderate" || risk === "low") {
							const riskLabel = termiteRisk?.charAt(0).toUpperCase() + (termiteRisk?.slice(1).toLowerCase() || "");
							return (
								<WarningBox>
									<div>
										<div style={{ fontWeight: 600 }}>Termite risk: {riskLabel}</div>
										<div style={{ fontSize: 12, marginTop: 2 }}>We recommend adding Pest Inspection, Thermal Imaging, and Moisture Meter to your quote for additional peace of mind{termiteRiskReason ? ` — ${termiteRiskReason}` : ""}.</div>
									</div>
								</WarningBox>
							);
						}
						return null;
					})()}
					<div>
						{addons.map((a) => (
							<div key={a.id} style={addonRowStyle}>
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<Toggle checked={Boolean(selected[a.id])} onChange={(next) => setSelected((prev) => ({ ...prev, [a.id]: next }))} />
									<AddonTooltip addonId={a.id}>
										<span style={addonNameStyle}>{a.name}</span>
									</AddonTooltip>
								</div>
								<span style={addonPriceStyle}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(a.price || 0)}</span>
							</div>
						))}
					</div>
				</div>
			) : null}
			<div style={rowStyle}>
				<div style={labelStyle}>Quote amount</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(baseAmount)}</div>
			</div>
			<div style={rowStyle}>
				<div style={labelStyle}>Add-ons total</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(addonsTotal)}</div>
			</div>
			<div style={rowStyle}>
				<div style={labelStyle}>GST ({gstRate || 10}%)</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(gstAmount)}</div>
			</div>
			<div style={{ ...rowStyle, borderTop: "1px solid #d9d9d9", paddingTop: 8 }}>
				<div style={{ ...labelStyle, fontWeight: 600 }}>Total (Including GST)</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)", fontSize: 18 }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalAmountIncludingGst)}</div>
			</div>


			{proposalStatus !== "approved" && (
				<div style={actionsStyle}>
					<PreviousButton href={prevHref} />
					<button 
						className="button-primary" 
						onClick={handleAcceptQuoteClick}
					>
						Accept Quote
					</button>
				</div>
			)}
		</div>
	);
}
