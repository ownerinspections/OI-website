"use client";

import React from "react";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import AddonTooltip from "@/components/ui/AddonTooltip";
import Toggle from "@/components/ui/Toggle";
import InfoBox from "@/components/ui/messages/InfoBox";
import WarningBox from "@/components/ui/messages/WarningBox";
import NoteBox from "@/components/ui/messages/NoteBox";

// Server action to create invoice and navigate
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
			if (userId) params.set("userId", userId);
			if (contactId) params.set("contactId", contactId);
			if (dealId) params.set("dealId", dealId);
			if (propertyId) params.set("propertyId", propertyId);
			params.set("quoteId", quoteId);
			if (invoiceIdParam) params.set("invoiceId", invoiceIdParam);
			else if (invoiceId) params.set("invoiceId", invoiceId);
			if (paymentId) params.set("paymentId", paymentId);
			window.location.href = `/steps/05-invoice?${params.toString()}`;
		} else {
			const params = new URLSearchParams();
			if (userId) params.set("userId", userId);
			if (contactId) params.set("contactId", contactId);
			if (dealId) params.set("dealId", dealId);
			if (propertyId) params.set("propertyId", propertyId);
			params.set("quoteId", quoteId);
			if (invoiceIdParam) params.set("invoiceId", invoiceIdParam);
			if (paymentId) params.set("paymentId", paymentId);
			window.location.href = `/steps/05-invoice?${params.toString()}`;
		}
	} catch (error) {
		console.error('Error creating invoice:', error);
		const params = new URLSearchParams();
		if (userId) params.set("userId", userId);
		if (contactId) params.set("contactId", contactId);
		if (dealId) params.set("dealId", dealId);
		if (propertyId) params.set("propertyId", propertyId);
		params.set("quoteId", quoteId);
		if (invoiceIdParam) params.set("invoiceId", invoiceIdParam);
		if (paymentId) params.set("paymentId", paymentId);
		window.location.href = `/steps/05-invoice?${params.toString()}`;
	}
}

type PropertyQuote = {
	property: {
		id: string;
		full_address: string;
		property_category: string;
		property_type: string;
		number_of_bedrooms: number;
		number_of_bathrooms: number;
		number_of_levels: number;
		basement: boolean;
	};
	estimate: {
		quote_price: number;
		note?: string;
	};
};

type Props = {
	quote?: {
		id: string | number;
		quote_id?: string | number
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
	propertyQuotes?: PropertyQuote[];
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
};

export default function DilapidationQuotesForm({ 
	quote, 
	propertyQuotes = [], 
	dealId, 
	contactId, 
	propertyId, 
	invoiceId, 
	paymentId, 
	quoteNote, 
	addons = [], 
	termiteRisk, 
	termiteRiskReason, 
	preselectedAddonIds = [], 
	userId, 
	gstRate = 10, 
	proposalStatus 
}: Props) {
	// Use exact same styles as QuotesForm
	const cardStyle: React.CSSProperties = { padding: 16 };
	const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 8 };
	const labelStyle: React.CSSProperties = { color: "var(--color-text-secondary)" };
	const valueStyle: React.CSSProperties = { color: "var(--color-text-primary)", fontWeight: 500 };
	const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 16, gap: 8 };
	const addonRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, border: "1px solid #d9d9d9", borderRadius: 6, marginBottom: 8 };
	const addonNameStyle: React.CSSProperties = { color: "var(--color-text-primary)", fontWeight: 500 };
	const addonPriceStyle: React.CSSProperties = { color: "var(--color-primary)", fontWeight: 600 };
	const inspectionBoxStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #d9d9d9", color: "var(--color-text-primary)", borderRadius: 6, padding: 8, marginBottom: 8 };

	// State for each property's selected addons
	const [selectedAddons, setSelectedAddons] = React.useState<Record<string, Record<number, boolean>>>(() => {
		const initial: Record<string, Record<number, boolean>> = {};
		propertyQuotes.forEach((pq) => {
			initial[pq.property.id] = {};
			(addons || []).forEach((a) => {
				initial[pq.property.id][a.id] = Array.isArray(preselectedAddonIds) ? preselectedAddonIds.includes(a.id) : false;
			});
		});
		return initial;
	});

	// Calculate totals
	const baseAmount = Number(quote?.amount ?? quote?.quote_amount ?? 0);
	
	// Calculate addons total across all properties
	const addonsTotal = Object.entries(selectedAddons).reduce((total, [propertyId, propertySelectedAddons]) => {
		return total + Object.entries(propertySelectedAddons)
			.filter(([, on]) => Boolean(on))
			.reduce((sum, [id]) => {
				const addon = addons.find(a => a.id === Number(id));
				return sum + (addon?.price ?? 0);
			}, 0);
	}, 0);

	const subtotal = baseAmount + addonsTotal;
	const gstAmount = +(subtotal * ((gstRate || 10) / 100)).toFixed(2);
	const totalAmountIncludingGst = +(subtotal + gstAmount).toFixed(2);

	const handleAcceptQuoteClick = () => {
		createInvoiceAndNavigate(String(quote?.id ?? ""), dealId ?? "", contactId ?? "", propertyId ?? "", totalAmountIncludingGst, invoiceId, userId || undefined, paymentId || undefined);
	};

	// Debounce patch to server when total changes
	React.useEffect(() => {
		let alive = true;
		const id = quote?.id;
		const total = totalAmountIncludingGst;
		if (!id) return;
		const timer = setTimeout(async () => {
			if (!alive) return;
			try {
				// Collect all selected addon IDs across all properties
				const allSelectedAddonIds = Object.values(selectedAddons)
					.flatMap(propertyAddons => 
						Object.entries(propertyAddons)
							.filter(([, on]) => Boolean(on))
							.map(([id]) => Number(id))
							.filter((n) => Number.isFinite(n))
					);

				await fetch(`/api/proposals/${encodeURIComponent(String(id))}/total`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ 
						total, 
						addons: allSelectedAddonIds
					}),
					cache: "no-store",
				});
			} catch {}
		}, 300);
		return () => { alive = false; clearTimeout(timer); };
	}, [quote?.id, totalAmountIncludingGst, selectedAddons]);

	const prevHref = (() => {
		const params = new URLSearchParams();
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
			{/* Quote Note */}
			{(quoteNote ?? quote?.quote_note) ? (
				<NoteBox style={{ marginBottom: 16 }}>
					<div>{quoteNote ?? quote?.quote_note}</div>
				</NoteBox>
			) : null}

			{/* Individual Property Quotes - Each property gets its own section with addons */}
			{propertyQuotes.map((propertyQuote, index) => (
				<div key={propertyQuote.property.id}>
					{/* Property Header - Same visual pattern as property page */}
					{index > 0 && (
						<div style={{ 
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
						</div>
					)}

					{/* Property Details and Base Quote - Same style as QuotesForm */}
					<div style={inspectionBoxStyle}>
						<div>
							<span style={{ fontWeight: 600 }}>Dilapidation Inspection</span>
							<div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 2 }}>
								{propertyQuote.property.full_address}
							</div>
						</div>
						<span style={{ ...valueStyle, color: "var(--color-primary)", fontSize: 16 }}>
							{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(propertyQuote.estimate.quote_price)}
						</span>
					</div>

					{/* Add-ons for this specific property */}
					{Array.isArray(addons) && addons.length > 0 && (
						<div style={{ marginTop: 8, marginBottom: 16 }}>
							<InfoBox>
								<div>
									<div style={{ fontWeight: 600 }}>Optional add-ons for this property</div>
									<div style={{ fontSize: 12, marginTop: 2 }}>Add extra services to tailor your quote for this property. Toggle items below on or off — totals update automatically.</div>
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
											<Toggle 
												checked={Boolean(selectedAddons[propertyQuote.property.id]?.[a.id])} 
												onChange={(next) => setSelectedAddons((prev) => ({
													...prev,
													[propertyQuote.property.id]: {
														...prev[propertyQuote.property.id],
														[a.id]: next
													}
												}))} 
											/>
											<AddonTooltip addonId={a.id}>
												<span style={addonNameStyle}>{a.name}</span>
											</AddonTooltip>
										</div>
										<span style={addonPriceStyle}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(a.price || 0)}</span>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			))}

			{/* Quote Summary - Exact same as QuotesForm */}
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

			{/* Navigation - Exact same as QuotesForm */}
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
