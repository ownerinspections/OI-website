"use client";

import React from "react";
import { CompanyInfo, CustomerInfo, PropertyInfo } from "@/lib/actions/invoices/createInvoice";
import PreviousButton from "@/components/ui/controls/PreviousButton";

type Props = {
	invoice: {
		id: string;
		invoice_number: string;
		status: string;
		issue_date: string;
		due_date: string;
		subtotal: number;
		total_tax: number;
		total: number;
		contact: string;
		proposal: string;
		gst_rate: number;
		line_items: Array<{
			name: string;
			description?: string | null;
			quantity: number;
			unit_price: number;
			total: number;
		}>;
		property?: PropertyInfo;
	};
	companyInfo: CompanyInfo | null;
	customerInfo: CustomerInfo | null;
	nextHref?: string;
	prevHref?: string;
	payNowAction?: () => Promise<void>;
};

export default function InvoicesForm({ invoice, companyInfo, customerInfo, nextHref, prevHref, payNowAction }: Props) {
	const isPaid = (invoice.status || "").toLowerCase() === "paid";
	const headerStyle: React.CSSProperties = { 
		display: "flex", 
		justifyContent: "space-between", 
		alignItems: "flex-start", 
		marginBottom: 16
	};
	const companyStyle: React.CSSProperties = { 
		flex: 1,
		color: "var(--color-primary)"
	};
	const invoiceMetaStyle: React.CSSProperties = { 
		textAlign: "right",
		color: "var(--color-text-secondary)"
	};
	const sectionStyle: React.CSSProperties = { 
		display: "grid", 
		gridTemplateColumns: "1fr 1fr", 
		gap: 32, 
		marginBottom: 32 
	};
	const customerStyle: React.CSSProperties = { 
		background: "var(--color-pale-gray)", 
		padding: 16, 
		borderRadius: 8 
	};
	const tableStyle: React.CSSProperties = { 
		width: "100%", 
		borderCollapse: "collapse", 
		marginBottom: 24 
	};
	const thStyle: React.CSSProperties = { 
		background: "var(--color-primary)", 
		color: "white", 
		padding: "12px 8px", 
		textAlign: "left",
		fontWeight: 600
	};
	const tdStyle: React.CSSProperties = { 
		padding: "12px 8px", 
		borderBottom: "1px solid var(--color-light-gray)" 
	};
	const totalsStyle: React.CSSProperties = { 
		display: "flex", 
		flexDirection: "column", 
		alignItems: "flex-end", 
		gap: 8,
		marginTop: 16
	};
	const totalRowStyle: React.CSSProperties = { 
		display: "flex", 
		justifyContent: "space-between", 
		minWidth: 200,
		padding: "4px 0"
	};
	const actionsStyle: React.CSSProperties = { 
		display: "flex", 
		justifyContent: "space-between", 
		marginTop: 32,
		paddingTop: 16,
		borderTop: "1px solid var(--color-light-gray)"
	};

	return (
		<div>
			{/* Header */}
			<div style={headerStyle}>
				<div style={companyStyle} />
				<div style={invoiceMetaStyle}>
					{/* Secondary invoice meta removed – shown in step header */}
				</div>
			</div>

			{/* Customer Details */}
			<div style={sectionStyle}>
				<div style={customerStyle}>
					<h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)" }}>Bill To:</h3>
					{customerInfo ? (
						<div style={{ lineHeight: 1.5 }}>
							<div style={{ fontWeight: 600 }}>
								{customerInfo.company_name || `${customerInfo.first_name || ''} ${customerInfo.last_name || ''}`.trim() || 'Customer'}
							</div>
							{customerInfo.first_name && customerInfo.last_name && !customerInfo.company_name && (
								<div>{customerInfo.first_name} {customerInfo.last_name}</div>
							)}
							{customerInfo.email && <div>{customerInfo.email}</div>}
							{customerInfo.phone && <div>{customerInfo.phone}</div>}
							{customerInfo.address && <div>{customerInfo.address}</div>}
						</div>
					) : (
						<div style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>Customer information not available</div>
					)}
				</div>
				<div style={customerStyle}>
					<h3 style={{ margin: "0 0 12px 0", color: "var(--color-primary)" }}>Property Details:</h3>
					{invoice.property ? (
						<div style={{ lineHeight: 1.5 }}>
							{invoice.property.street_address && <div style={{ fontWeight: 600 }}>{invoice.property.street_address}</div>}
							{invoice.property.suburb && invoice.property.state && invoice.property.postcode && (
								<div>{invoice.property.suburb}, {invoice.property.state} {invoice.property.postcode}</div>
							)}
							{invoice.property.property_type && <div>Type: {invoice.property.property_type}</div>}
							{invoice.property.property_category && <div>Category: {invoice.property.property_category}</div>}
							{invoice.property.number_of_bedrooms && <div>Bedrooms: {invoice.property.number_of_bedrooms}</div>}
							{invoice.property.number_of_bathrooms && <div>Bathrooms: {invoice.property.number_of_bathrooms}</div>}
							{invoice.property.number_of_levels && <div>Levels: {invoice.property.number_of_levels}</div>}
							{invoice.property.basement && <div>Basement: Yes</div>}
							{invoice.property.termite_risk && <div>Termite Risk: {invoice.property.termite_risk}</div>}
						</div>
					) : (
						<div style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}>Property information not available</div>
					)}
				</div>
			</div>

			{/* Line Items */}
			<table style={tableStyle}>
				<thead>
					<tr>
						<th style={thStyle}>Description</th>
						<th style={{ ...thStyle, textAlign: "center" }}>Qty</th>
						<th style={{ ...thStyle, textAlign: "right" }}>Unit Price</th>
						<th style={{ ...thStyle, textAlign: "right" }}>Total</th>
					</tr>
				</thead>
				<tbody>
					{invoice.line_items.map((item, index) => (
						<tr key={index}>
							<td style={tdStyle}>
								<div style={{ fontWeight: 600 }}>{item.name}</div>
								{item.description && <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>{item.description}</div>}
							</td>
							<td style={{ ...tdStyle, textAlign: "center" }}>{item.quantity}</td>
							<td style={{ ...tdStyle, textAlign: "right" }}>
								{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(item.unit_price)}
							</td>
							<td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
								{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(item.total)}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* Totals */}
			<div style={totalsStyle}>
				<div style={totalRowStyle}>
					<span style={{ color: "var(--color-text-secondary)" }}>Subtotal:</span>
					<span style={{ fontWeight: 600 }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(invoice.subtotal)}</span>
				</div>
				<div style={totalRowStyle}>
					<span style={{ color: "var(--color-text-secondary)" }}>GST ({invoice.gst_rate.toFixed(0)}%):</span>
					<span style={{ fontWeight: 600 }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(invoice.total_tax)}</span>
				</div>
				<div style={{ ...totalRowStyle, borderTop: "2px solid var(--color-primary)", paddingTop: 8, fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
					<span>Total:</span>
					<span>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(invoice.total)}</span>
				</div>
			</div>

			{/* Actions */}
			<div style={actionsStyle}>
				{!isPaid && prevHref && <PreviousButton href={prevHref} />}
				{!isPaid && (payNowAction ? (
					<form action={payNowAction}>
						<button type="submit" className="button-primary">Pay Now</button>
					</form>
				) : nextHref ? (
					<a className="button-primary" href={nextHref}>Pay Now</a>
				) : null)}
			</div>
		</div>
	);
}
