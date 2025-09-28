"use client";

import { useState } from "react";
import { ContactFormSkeleton, PropertyFormSkeleton, PhoneVerificationSkeleton, QuoteFormSkeleton, InvoiceFormSkeleton, PaymentFormSkeleton, ReceiptSkeleton, BookingFormSkeleton } from "@/components/ui/SkeletonLoader";

export default function PreviousButton({ href, label = "Previous" }: { href?: string; label?: string }) {
	const [isNavigating, setIsNavigating] = useState(false);

	function onClick(e: React.MouseEvent<HTMLButtonElement>) {
		if (href) {
			e.preventDefault();
			setIsNavigating(true);
			window.location.href = href;
			return;
		}
		// fall back to history
		e.preventDefault();
		setIsNavigating(true);
		history.back();
	}

	// Determine which skeleton to show based on current step
	function getPreviousStepSkeleton() {
		const currentPath = window.location.pathname;
		
		if (currentPath.includes('/steps/02-property')) {
			return <ContactFormSkeleton />; // Step 2 → Step 1
		} else if (currentPath.includes('/steps/03-phone-verification')) {
			return <PropertyFormSkeleton />; // Step 3 → Step 2
		} else if (currentPath.includes('/steps/04-quote')) {
			return <PhoneVerificationSkeleton />; // Step 4 → Step 3
		} else if (currentPath.includes('/steps/05-invoice')) {
			return <QuoteFormSkeleton />; // Step 5 → Step 4
		} else if (currentPath.includes('/steps/06-payment')) {
			return <InvoiceFormSkeleton />; // Step 6 → Step 5
		} else if (currentPath.includes('/steps/07-receipt')) {
			return <PaymentFormSkeleton />; // Step 7 → Step 6
		} else if (currentPath.includes('/steps/08-booking')) {
			return <ReceiptSkeleton />; // Step 8 → Step 7
		} else if (currentPath.includes('/steps/09-thank-you')) {
			return <BookingFormSkeleton />; // Step 9 → Step 8
		}
		
		// Default fallback
		return <ContactFormSkeleton />;
	}

	// Show skeleton loading while navigating backward - render as full page
	if (isNavigating) {
		return (
			<div style={{ 
				position: "fixed", 
				top: 0, 
				left: 0, 
				right: 0, 
				bottom: 0, 
				background: "var(--color-pale-gray)", 
				zIndex: 9999,
				overflow: "auto"
			}}>
				<div className="container">
					<div className="card">
						{getPreviousStepSkeleton()}
					</div>
				</div>
			</div>
		);
	}
	
	return (
		<button type="button" className="button-secondary" onClick={onClick}>
			{label}
		</button>
	);
}
