import type { InputHTMLAttributes } from "react";

type TextFieldProps = {
	name: string;
	label: string;
	defaultValue?: string;
	value?: string;
	error?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

export default function TextField({ name, label, defaultValue, value, error, type, ...rest }: TextFieldProps) {
	const inputStyle: React.CSSProperties = {
		width: "100%",
		height: "var(--field-height)",
		lineHeight: "calc(var(--field-height) - 2px)",
		borderRadius: 6,
		border: `1px solid ${error ? "var(--color-error)" : "var(--color-light-gray)"}`,
		padding: "0 12px",
		color: "var(--color-text-primary)",
		background: "var(--color-white)",
		boxSizing: "border-box",
	};

	const labelStyle: React.CSSProperties = {
		display: "block",
		marginBottom: 6,
		color: "var(--color-text-secondary)",
		fontSize: 14,
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
			<input id={name} name={name} type={type ?? "text"} defaultValue={value === undefined ? defaultValue : undefined} value={value} style={inputStyle} {...rest} />
			{error ? <div style={errorStyle}>{error}</div> : null}
		</div>
	);
}
