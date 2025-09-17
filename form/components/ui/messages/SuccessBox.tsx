import React from 'react';

interface SuccessBoxProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function SuccessBox({ children, className, style }: SuccessBoxProps) {
	const successBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #10b981",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
		...style,
	};

	return (
		<div className={className} style={successBoxStyle}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#10b981" }}>
				<path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
				<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
			</svg>
			{children}
		</div>
	);
}
