"use client";


export default function PreviousButton({ href, label = "Previous" }: { href?: string; label?: string }) {
	function onClick(e: React.MouseEvent<HTMLButtonElement>) {
		if (href) {
			e.preventDefault();
			window.location.href = href;
			return;
		}
		// fall back to history
		e.preventDefault();
		history.back();
	}
	
	return (
		<button type="button" className="button-secondary" onClick={onClick}>
			{label}
		</button>
	);
}
