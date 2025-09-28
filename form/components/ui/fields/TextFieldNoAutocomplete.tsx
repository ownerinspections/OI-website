"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { VALIDATION_MESSAGES } from "@/lib/validation/constants";

type TextFieldNoAutocompleteProps = {
	name: string;
	label: string;
	defaultValue?: string;
	value?: string;
	error?: string;
	required?: boolean;
	readOnly?: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name">;

function validateTextField(value: string, required?: boolean): string | undefined {
	if (required && !value?.trim()) {
		return VALIDATION_MESSAGES.REQUIRED;
	}
	return undefined;
}

export default function TextFieldNoAutocomplete({ name, label, defaultValue, value, error, type, required, readOnly, onChange, ...rest }: TextFieldNoAutocompleteProps) {
	const [clientError, setClientError] = useState<string | undefined>();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fieldValue = e.target.value;
    // Only show client validation if there's no server error
    if (!error) {
      const validationError = validateTextField(fieldValue, required);
      setClientError(validationError);
    } else {
      // Clear client error when there's a server error
      setClientError(undefined);
    }
    onChange?.(e);
  };

	// Show server error if present, otherwise show client validation error
	const displayError = error || clientError;
	const inputStyle: React.CSSProperties = {
		width: "100%",
		height: "var(--field-height)",
		lineHeight: "calc(var(--field-height) - 2px)",
		borderRadius: 6,
		border: `1px solid ${displayError ? "var(--color-error)" : "var(--color-light-gray)"}`,
		padding: "0 12px",
		color: "var(--color-text-primary)",
		background: readOnly ? "var(--color-pale-gray)" : "var(--color-white)",
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
			<label htmlFor={name} style={labelStyle}>
				{label}
				{required && <span style={{ color: "var(--color-error)", marginLeft: 4 }}>*</span>}
			</label>
			<input id={name} name={name} type={type ?? "text"} defaultValue={value === undefined ? defaultValue : undefined} value={value} onChange={handleChange} readOnly={readOnly} autoComplete="off" style={inputStyle} {...rest} />
			{displayError ? <div style={errorStyle}>{displayError}</div> : null}
		</div>
	);
}
