"use client";

import { useState, useEffect } from "react";

export default function FormFooter({ termsLink, privacyPolicyLink, onAgreementChange }: { termsLink?: string; privacyPolicyLink?: string; onAgreementChange?: (agreed: boolean) => void }) {
	const [agreed, setAgreed] = useState(false);

	// Notify parent component when agreement state changes
	useEffect(() => {
		onAgreementChange?.(agreed);
	}, [agreed, onAgreementChange]);

	return (
		<div style={{ marginTop: 16, paddingTop: 12, display: "flex", alignItems: "flex-start", gap: 12 }}>
			<input
				id="agree-terms"
				type="checkbox"
				checked={agreed}
				onChange={(e) => setAgreed(e.target.checked)}
				style={{ 
					width: 20, 
					height: 20, 
					marginTop: 2,
					flexShrink: 0
				}}
			/>
			<label 
				htmlFor="agree-terms" 
				style={{ 
					fontSize: 14, 
					color: "var(--color-text-secondary)",
					lineHeight: 1.4,
					cursor: "pointer"
				}}
			>
				I agree to the {termsLink ? (<a href={termsLink} target="_blank" rel="noopener noreferrer">Terms and Conditions</a>) : ("Terms and Conditions")}
				{privacyPolicyLink && (
					<>
						{" and "}
						<a href={privacyPolicyLink} target="_blank" rel="noopener noreferrer">Privacy Policy</a>
					</>
				)}
				.
			</label>
		</div>
	);
}


