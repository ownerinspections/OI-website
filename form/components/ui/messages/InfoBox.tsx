import React from 'react';

interface InfoBoxProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function InfoBox({ children, className, style }: InfoBoxProps) {
	const infoBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #3b82f6",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
		...style,
	};

	return (
		<div className={className} style={infoBoxStyle}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#3b82f6" }}>
				<circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
				<line x1="12" y1="16" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
				<line x1="12" y1="8" x2="12.01" y2="8" stroke="currentColor" strokeWidth="2"/>
			</svg>
			{children}
		</div>
	);
}
