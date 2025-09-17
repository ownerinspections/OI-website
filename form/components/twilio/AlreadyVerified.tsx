"use client";

import { useEffect, useState } from "react";
import SuccessBox from "@/components/ui/messages/SuccessBox";

type Props = { to: string; seconds?: number };

export default function AlreadyVerified({ to, seconds = 3 }: Props) {
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
					// Trigger navigation exactly when countdown finishes
					window.location.assign(to);
				}
				return next;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [to, remaining]);


	return (
		<>
			<SuccessBox aria-live="polite">
				Your phone is already verified. Redirecting to your quote in {remaining}s…
			</SuccessBox>
			<p style={{ fontSize: 12, color: "var(--color-text-secondary)", marginTop: 8 }}>
				If you are not redirected, <a href={to}>continue to your quote</a>.
			</p>
		</>
	);
}


