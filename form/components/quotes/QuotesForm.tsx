"use client";

import React from "react";
import PreviousButton from "@/components/ui/controls/PreviousButton";

// Server action to create invoice and approve proposal
async function createInvoiceAndNavigate(quoteId: string, dealId: string, contactId: string, propertyId: string, totalAmount: number, invoiceIdParam?: string, userId?: string) {
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
	quoteNote?: string;
	addons?: Array<{ id: number; name: string; price: number }>;
	termiteRisk?: string;
	termiteRiskReason?: string;
    preselectedAddonIds?: number[];
    userId?: string;
};

export default function QuotesForm({ quote, dealId, contactId, propertyId, invoiceId, quoteNote, addons, termiteRisk, termiteRiskReason, preselectedAddonIds, userId }: Props) {
	const cardStyle: React.CSSProperties = { padding: 16 };
	const headerStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 };
	const headerLeftSpacerStyle: React.CSSProperties = { flex: 1 };
	const quoteMetaStyle: React.CSSProperties = { textAlign: "right", color: "var(--color-text-secondary)" };
	const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginBottom: 8 };
	const labelStyle: React.CSSProperties = { color: "var(--color-text-secondary)" };
	const valueStyle: React.CSSProperties = { color: "var(--color-text-primary)", fontWeight: 500 };
	// Removed local header to rely on page-level step header
	const noteStyle: React.CSSProperties = { background: "var(--color-pale-gray)", borderRadius: 6, padding: 12, marginBottom: 16 };
	const actionsStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", marginTop: 16, gap: 8 };
	const addonRowStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: 8, border: "1px solid #d9d9d9", borderRadius: 6, marginBottom: 8 };
	const addonNameStyle: React.CSSProperties = { color: "var(--color-text-primary)", fontWeight: 500 };
	const addonPriceStyle: React.CSSProperties = { color: "var(--color-primary)", fontWeight: 600 };
	const infoBoxStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "#ffffff", border: "1px solid #3b82f6", color: "#595959", borderRadius: 6, padding: 8, marginBottom: 8 };
	const warnBoxStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, background: "#ffffff", border: "1px solid #f59e0b", color: "#595959", borderRadius: 6, padding: 8, marginBottom: 8 };
	const inspectionBoxStyle: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", border: "1px solid #d9d9d9", color: "var(--color-text-primary)", borderRadius: 6, padding: 8, marginBottom: 8 };

	const Toggle: React.FC<{ checked: boolean; onChange: (next: boolean) => void }> = ({ checked, onChange }) => {
		const trackStyle: React.CSSProperties = {
			width: 44,
			height: 24,
			borderRadius: 999,
			background: checked ? "var(--color-primary)" : "#d9d9d9",
			position: "relative",
			border: "none",
			outline: "none",
			cursor: "pointer",
			padding: 2,
			display: "inline-flex",
			alignItems: "center",
		};
		const knobStyle: React.CSSProperties = {
			width: 20,
			height: 20,
			borderRadius: 999,
			background: "#fff",
			boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
			transform: checked ? "translateX(20px)" : "translateX(0px)",
			transition: "transform 0.15s ease-in-out",
		};
		return (
			<button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} style={trackStyle}>
				<span style={knobStyle} />
			</button>
		);
	};

	const [selected, setSelected] = React.useState<Record<number, boolean>>(() => {
		const map: Record<number, boolean> = {};
		(addons || []).forEach((a) => {
			map[a.id] = Array.isArray(preselectedAddonIds) ? preselectedAddonIds.includes(a.id) : false;
		});
		return map;
	});

	const baseAmount = Number((quote as any)?.inspection_amount ?? (quote as any)?.quote_amount ?? quote?.amount ?? 0);
	const addonsTotal = (addons || []).reduce((sum, a) => (selected[a.id] ? sum + Number(a.price || 0) : sum), 0);
	const totalAmount = baseAmount + addonsTotal;

	// Debounce patch to server when total changes
	React.useEffect(() => {
		let alive = true;
		const id = quote?.id;
		const total = totalAmount;
		if (!id) return;
		const timer = setTimeout(async () => {
			if (!alive) return;
			try {
				const selectedAddonIds = Object.entries(selected)
					.filter(([, on]) => Boolean(on))
					.map(([id]) => Number(id))
					.filter((n) => Number.isFinite(n));
				await fetch(`/api/proposals/${encodeURIComponent(String(id))}/total`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ total, addons: selectedAddonIds }),
					cache: "no-store",
				});
			} catch {}
		}, 300);
		return () => { alive = false; clearTimeout(timer); };
	}, [quote?.id, totalAmount, selected]);

	const prevHref = (() => {
		const params = new URLSearchParams();
		// Standard order: contactId, dealId, propertyId, quoteId
		if (contactId) params.set("contactId", String(contactId));
		if (dealId) params.set("dealId", String(dealId));
		if (propertyId) params.set("propertyId", String(propertyId));
		if (quote?.id) params.set("quoteId", String(quote.id));
        if (userId) params.set("userId", String(userId));
		const qs = params.toString();
		return qs ? `/steps/02-property?${qs}` : "/steps/02-property";
	})();

	if (!quote) return <div style={cardStyle}>No quote found.</div>;

	return (
		<div style={cardStyle}>
			{/* Header (mirrors invoice header right-side meta) */}
			{/* Secondary quote details removed - now shown in page header only */}
			{(quoteNote ?? quote?.quote_note) ? (
				<div style={noteStyle}>
					<div>{quoteNote ?? quote?.quote_note}</div>
				</div>
			) : null}
			{Array.isArray(addons) && addons.length > 0 ? (
				<div style={{ marginTop: 8, marginBottom: 8 }}>
					<div style={inspectionBoxStyle}>
						<span style={{ fontWeight: 600 }}>{quote.service_label || quote.service_code || "Inspection"}</span>
						<span style={{ ...valueStyle, color: "var(--color-primary)", fontSize: 16 }}>
							{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD" }).format(baseAmount)}
						</span>
					</div>
					<div style={infoBoxStyle}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#3b82f6" }}>
							<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
							<line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" strokeWidth="2" />
							<circle cx="12" cy="7" r="1" fill="currentColor" />
						</svg>
						<div>
							<div style={{ fontWeight: 600 }}>Optional add-ons</div>
							<div style={{ fontSize: 12, marginTop: 2 }}>Add extra services to tailor your quote. Toggle items below on or off — totals update automatically.</div>
						</div>
					</div>
					{(() => {
						const risk = (termiteRisk || "").toString().toLowerCase();
						if (risk === "high" || risk === "moderate" || risk === "low") {
							const riskLabel = termiteRisk?.charAt(0).toUpperCase() + (termiteRisk?.slice(1).toLowerCase() || "");
							return (
								<div style={warnBoxStyle}>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#f59e0b" }}>
										<path d="M12 2l10 18H2L12 2z" stroke="currentColor" strokeWidth="2" fill="none" />
										<circle cx="12" cy="16" r="1" fill="currentColor" />
										<path d="M12 8v5" stroke="currentColor" strokeWidth="2" />
									</svg>
									<div>
										<div style={{ fontWeight: 600 }}>Termite risk: {riskLabel}</div>
										<div style={{ fontSize: 12, marginTop: 2 }}>We recommend adding Pest Inspection, Thermal Imaging, and Moisture Meter to your quote for additional peace of mind{termiteRiskReason ? ` — ${termiteRiskReason}` : ""}.</div>
									</div>
								</div>
							);
						}
						return null;
					})()}
					<div>
						{addons.map((a) => (
							<div key={a.id} style={addonRowStyle}>
								<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
									<Toggle checked={Boolean(selected[a.id])} onChange={(next) => setSelected((prev) => ({ ...prev, [a.id]: next }))} />
									<span style={addonNameStyle}>{a.name}</span>
								</div>
								<span style={addonPriceStyle}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD" }).format(a.price || 0)}</span>
							</div>
						))}
					</div>
				</div>
			) : null}
			<div style={rowStyle}>
				<div style={labelStyle}>Quote amount</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD" }).format(baseAmount)}</div>
			</div>
			<div style={rowStyle}>
				<div style={labelStyle}>Add-ons total</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)" }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD" }).format(addonsTotal)}</div>
			</div>
			<div style={{ ...rowStyle, borderTop: "1px solid #d9d9d9", paddingTop: 8 }}>
				<div style={{ ...labelStyle, fontWeight: 600 }}>Total (excluding GST)</div>
				<div style={{ ...valueStyle, color: "var(--color-primary)", fontSize: 18 }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: quote?.currency || "AUD" }).format(totalAmount)}</div>
			</div>


			<div style={actionsStyle}>
				<PreviousButton href={prevHref} />
				<button 
					className="button-primary" 
					onClick={() => createInvoiceAndNavigate(String(quote.id), dealId || "", contactId || "", propertyId || "", totalAmount, invoiceId || undefined, userId || undefined)}
				>
					Accept Quote
				</button>
			</div>
		</div>
	);
}
