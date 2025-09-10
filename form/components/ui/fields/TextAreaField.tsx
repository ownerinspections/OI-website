import type { TextareaHTMLAttributes } from "react";

type TextAreaFieldProps = {
	name: string;
	label: string;
	defaultValue?: string;
	value?: string;
	error?: string;
	rows?: number;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">;

export default function TextAreaField({ name, label, defaultValue, value, error, rows = 4, ...rest }: TextAreaFieldProps) {
	const labelStyle: React.CSSProperties = {
		display: "block",
		marginBottom: 6,
		color: "var(--color-text-secondary)",
		fontSize: 14,
	};

	const textareaStyle: React.CSSProperties = {
		width: "100%",
		minHeight: rows * 24,
		borderRadius: 6,
		border: `1px solid ${error ? "var(--color-error)" : "var(--color-light-gray)"}`,
		padding: 12,
		color: "var(--color-text-primary)",
		background: "var(--color-white)",
		boxSizing: "border-box",
		resize: "vertical",
	};

	const errorStyle: React.CSSProperties = {
		color: "var(--color-error)",
		fontSize: 12,
		marginTop: 6,
	};

	const fieldStyle: React.CSSProperties = {
		marginBottom: 16,
	};

	return (
		<div style={fieldStyle}>
			<label htmlFor={name} style={labelStyle}>{label}</label>
			<textarea id={name} name={name} defaultValue={value === undefined ? defaultValue : undefined} value={value} rows={rows} style={textareaStyle} {...rest} />
			{error ? <div style={errorStyle}>{error}</div> : null}
		</div>
	);
}
