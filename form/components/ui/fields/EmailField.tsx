"use client";

import { useState } from "react";
import TextField from "./TextField";
import { VALIDATION_MESSAGES, VALIDATION_PATTERNS } from "@/lib/validation/constants";

type EmailFieldProps = {
	name: string;
	label?: string;
	defaultValue?: string;
	value?: string;
	error?: string;
	required?: boolean;
	readOnly?: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

function validateEmail(email: string): string | undefined {
	if (!email) return undefined;
	// Don't trim - check the email exactly as entered by the user
	if (!VALIDATION_PATTERNS.EMAIL.test(email)) {
		return VALIDATION_MESSAGES.INVALID_EMAIL;
	}
	return undefined;
}

export default function EmailField({ name, label = "Email", defaultValue, value, error, required, readOnly, onChange }: EmailFieldProps) {
	const [clientError, setClientError] = useState<string | undefined>();

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const emailValue = e.target.value;
		const validationError = validateEmail(emailValue);
		setClientError(validationError);
		onChange?.(e);
	};

	// Show server error if present, otherwise show client validation error
	const displayError = error || clientError;

	return (
		<TextField
			name={name}
			label={label}
			defaultValue={value === undefined ? defaultValue : undefined}
			value={value}
			onChange={handleChange}
			type="email"
			autoComplete="email"
			inputMode="email"
			error={displayError}
			required={required}
			readOnly={readOnly}
		/>
	);
}
