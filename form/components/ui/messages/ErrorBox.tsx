import React from 'react';

interface ErrorBoxProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function ErrorBox({ children, className, style }: ErrorBoxProps) {
	const errorBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #ef4444",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
		...style,
	};

	return (
		<div className={className} style={errorBoxStyle}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#ef4444" }}>
				<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
				<line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2"/>
				<line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2"/>
			</svg>
			{children}
		</div>
	);
}
