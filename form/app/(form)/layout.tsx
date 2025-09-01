import type { ReactNode } from "react";

export default function FormLayout({ children }: { children: ReactNode }) {
	return (
		<div className="container">
			<div className="card">
				{children}
			</div>
		</div>
	);
}
