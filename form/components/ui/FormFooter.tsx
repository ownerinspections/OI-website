"use client";

import { useState } from "react";

export default function FormFooter({ termsLink }: { termsLink?: string }) {
	const [agreed, setAgreed] = useState(true);

	return (
		<div style={{ borderTop: "1px solid var(--color-light-gray)", marginTop: 16, paddingTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
			<input
				id="agree-terms"
				type="checkbox"
				checked={agreed}
				onChange={(e) => setAgreed(e.target.checked)}
				style={{ width: 16, height: 16 }}
			/>
			<label htmlFor="agree-terms" style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
				I agree to the {termsLink ? (<a href={termsLink} target="_blank" rel="noopener noreferrer">Terms and Conditions</a>) : ("Terms and Conditions")}.
			</label>
		</div>
	);
}


