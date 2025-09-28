"use client";

import { useState } from "react";
import type { TextareaHTMLAttributes } from "react";
import { VALIDATION_MESSAGES } from "@/lib/validation/constants";

type TextAreaFieldProps = {
	name: string;
	label: string;
	defaultValue?: string;
	value?: string;
	error?: string;
	rows?: number;
	required?: boolean;
	onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">;

function validateTextAreaField(value: string, required?: boolean): string | undefined {
	if (required && !value?.trim()) {
		return VALIDATION_MESSAGES.REQUIRED;
	}
	return undefined;
}

export default function TextAreaField({ name, label, defaultValue, value, error, rows = 4, required, onChange, ...rest }: TextAreaFieldProps) {
	const [clientError, setClientError] = useState<string | undefined>();

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const fieldValue = e.target.value;
    // Only show client validation if there's no server error
    if (!error) {
      const validationError = validateTextAreaField(fieldValue, required);
      setClientError(validationError);
    } else {
      // Clear client error when there's a server error
      setClientError(undefined);
    }
    onChange?.(e);
  };

	// Show server error if present, otherwise show client validation error
	const displayError = error || clientError;
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
		border: `1px solid ${displayError ? "var(--color-error)" : "var(--color-light-gray)"}`,
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
			<label htmlFor={name} style={labelStyle}>
				{label}
				{required && <span style={{ color: "var(--color-error)", marginLeft: 4 }}>*</span>}
			</label>
			<textarea id={name} name={name} defaultValue={value === undefined ? defaultValue : undefined} value={value} rows={rows} onChange={handleChange} style={textareaStyle} {...rest} />
			{displayError ? <div style={errorStyle}>{displayError}</div> : null}
		</div>
	);
}
