"use client";

import React, { useState } from "react";
import { CompanyInfo, CustomerInfo, PropertyInfo } from "@/lib/actions/invoices/createInvoice";
import PreviousButton from "@/components/ui/controls/PreviousButton";
import FormFooter from "@/components/ui/FormFooter";

type Props = {
	invoice: {
		id: string;
		invoice_id?: string;
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
	termsLink?: string;
	privacyPolicyLink?: string;
};

// Utility function to format Australian phone numbers
function formatAustralianPhone(phone: string): string {
	if (!phone) return phone;
	
	// Remove all non-digit characters
	const digits = phone.replace(/\D/g, '');
	
	// Handle different input formats
	if (digits.startsWith('61')) {
		// Already has country code
		const withoutCountry = digits.substring(2);
		if (withoutCountry.startsWith('4') && withoutCountry.length === 9) {
			// Mobile number: 4XX XXX XXX
			return `+61 ${withoutCountry.substring(0, 3)} ${withoutCountry.substring(3, 6)} ${withoutCountry.substring(6)}`;
		}
	} else if (digits.startsWith('0')) {
		// Australian format with leading 0
		const withoutZero = digits.substring(1);
		if (withoutZero.startsWith('4') && withoutZero.length === 9) {
			// Mobile number: 4XX XXX XXX
			return `+61 ${withoutZero.substring(0, 3)} ${withoutZero.substring(3, 6)} ${withoutZero.substring(6)}`;
		}
	} else if (digits.startsWith('4') && digits.length === 9) {
		// Just the mobile number without country code or leading 0
		return `+61 ${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6)}`;
	}
	
	// If we can't format it properly, return the original
	return phone;
}

export default function InvoicesForm({ invoice, companyInfo, customerInfo, nextHref, prevHref, payNowAction, termsLink, privacyPolicyLink }: Props) {
	const isPaid = (invoice.status || "").toLowerCase() === "paid";
	const [termsAgreed, setTermsAgreed] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	
	console.log("InvoicesForm rendered with termsLink:", termsLink, "privacyPolicyLink:", privacyPolicyLink, "termsAgreed:", termsAgreed);
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

	const handlePayNow = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrorMessage(null);
		
		console.log("Pay Now clicked, termsAgreed:", termsAgreed);
		
		// Check if terms are agreed to
		if (!termsAgreed) {
			console.log("Terms not agreed, showing error");
			setErrorMessage("You must agree to the Terms and Conditions and Privacy Policy to proceed with payment.");
			return;
		}
		
		console.log("Terms agreed, proceeding with payment");
		// If terms are agreed, proceed with the payment action
		if (payNowAction) {
			await payNowAction();
		}
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
							{customerInfo.email && <div>{customerInfo.email}</div>}
							{customerInfo.phone && <div>{formatAustralianPhone(customerInfo.phone)}</div>}
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
							{/* Full Address */}
							<div style={{ marginBottom: 8 }}>
								{(() => {
									const addressParts = [];
									if (invoice.property.street_address) addressParts.push(invoice.property.street_address);
									if (invoice.property.suburb) addressParts.push(invoice.property.suburb);
									if (invoice.property.state) addressParts.push(invoice.property.state);
									if (invoice.property.post_code) addressParts.push(invoice.property.post_code);
									return addressParts.join(', ');
								})()}
							</div>
							{/* Property Details */}
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
								{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.unit_price)}
							</td>
							<td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
								{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(item.total)}
							</td>
						</tr>
					))}
				</tbody>
			</table>

			{/* Totals */}
			<div style={totalsStyle}>
				<div style={totalRowStyle}>
					<span style={{ color: "var(--color-text-secondary)" }}>Subtotal:</span>
					<span style={{ fontWeight: 600 }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoice.subtotal)}</span>
				</div>
				<div style={totalRowStyle}>
					<span style={{ color: "var(--color-text-secondary)" }}>GST ({invoice.gst_rate.toFixed(0)}%):</span>
					<span style={{ fontWeight: 600 }}>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoice.total_tax)}</span>
				</div>
				<div style={{ ...totalRowStyle, borderTop: "2px solid var(--color-primary)", paddingTop: 8, fontSize: 18, fontWeight: 700, color: "var(--color-primary)" }}>
					<span>Total:</span>
					<span>{new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(invoice.total)}</span>
				</div>
			</div>

			{/* Terms and Conditions */}
			{!isPaid && (termsLink || privacyPolicyLink) && (
				<FormFooter 
					termsLink={termsLink} 
					privacyPolicyLink={privacyPolicyLink} 
					onAgreementChange={(agreed) => {
						console.log("Terms agreement changed to:", agreed);
						setTermsAgreed(agreed);
					}}
				/>
			)}

			{/* Error Message */}
			{errorMessage && (
				<div style={{ 
					color: "var(--color-error)", 
					fontSize: 14, 
					marginTop: 8,
					padding: 8,
					background: "#fef2f2",
					border: "1px solid #fecaca",
					borderRadius: 4
				}}>
					{errorMessage}
				</div>
			)}

			{/* Actions */}
			<div style={actionsStyle}>
				{!isPaid && prevHref && <PreviousButton href={prevHref} />}
				{!isPaid && (payNowAction ? (
					<form onSubmit={handlePayNow}>
						<button 
							type="submit" 
							className="button-primary"
						>
							Pay Now
						</button>
					</form>
				) : nextHref ? (
					<a className="button-primary" href={nextHref}>Pay Now</a>
				) : null)}
			</div>
		</div>
	);
}
