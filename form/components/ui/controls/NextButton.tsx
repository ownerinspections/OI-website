"use client";

export default function NextButton({ label = "Next", disabled, form, onClick }: { label?: string; disabled?: boolean; form?: string; onClick?: React.MouseEventHandler<HTMLButtonElement> }) {
	return (
		<button type="submit" className="button-primary" disabled={disabled} aria-disabled={disabled} form={form} onClick={onClick}>
			{label}
		</button>
	);
}
