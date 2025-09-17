import React from 'react';

interface NoteBoxProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
}

export default function NoteBox({ children, className, style }: NoteBoxProps) {
	const noteBoxStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 10,
		background: "#ffffff",
		border: "1px solid #6b7280",
		color: "#595959",
		borderRadius: 6,
		padding: 10,
		marginBottom: 4,
		...style,
	};

	return (
		<div className={className} style={noteBoxStyle}>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#6b7280", flexShrink: 0 }}>
				<rect x="3" y="4" width="18" height="15" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
				<line x1="8" y1="10" x2="16" y2="10" stroke="currentColor" strokeWidth="2"/>
				<line x1="8" y1="14" x2="16" y2="14" stroke="currentColor" strokeWidth="2"/>
			</svg>
			<div style={{ flex: 1, lineHeight: 1.4 }}>
				{children}
			</div>
		</div>
	);
}
