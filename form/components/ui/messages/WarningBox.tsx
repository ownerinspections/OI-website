import React from 'react';

interface WarningBoxProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function WarningBox({ children, className, style }: WarningBoxProps) {
	const warningBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #f59e0b",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
		...style,
	};

	return (
		<div className={className} style={warningBoxStyle}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#f59e0b" }}>
				<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="currentColor" strokeWidth="2" fill="none"/>
				<line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" strokeWidth="2"/>
				<line x1="12" y1="17" x2="12.01" y2="17" stroke="currentColor" strokeWidth="2"/>
			</svg>
			{children}
		</div>
	);
}
