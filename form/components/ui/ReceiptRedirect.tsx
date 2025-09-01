"use client";

import { useEffect, useState } from "react";

type Props = { to: string; seconds?: number };

export default function ReceiptRedirect({ to, seconds = 3 }: Props) {
	const initial = Math.max(0, Math.floor(seconds));
	const [remaining, setRemaining] = useState<number>(initial);

	useEffect(() => {
		setRemaining(Math.max(0, Math.floor(seconds)));
	}, [seconds]);

	useEffect(() => {
		if (remaining <= 0) return;
		const id = setInterval(() => {
			setRemaining((prev) => {
				const next = Math.max(0, prev - 1);
				if (next === 0) {
					window.location.assign(to);
				}
				return next;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [to, remaining]);

	const headerStyle: React.CSSProperties = { marginBottom: 12 };
	const successRowStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		gap: 8,
		background: "#ffffff",
		border: "1px solid #10b981",
		color: "#595959",
		borderRadius: 6,
		padding: 8,
		marginBottom: 4,
	};

	return (
		<>
			<h2 style={headerStyle}>Payment successful</h2>
			<div style={successRowStyle} aria-live="polite">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ color: "#10b981" }}>
					<path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
				</svg>
				<span>Redirecting to your receipt in {remaining}s…</span>
			</div>
			<p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>
				If you are not redirected, <a href={to}>view your receipt</a>.
			</p>
		</>
	);
}


