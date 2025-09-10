"use client";

import { useState } from "react";
import TextField from "./TextField";

type EmailFieldProps = {
	name: string;
	label?: string;
	defaultValue?: string;
	value?: string;
	error?: string;
	required?: boolean;
	onChange?: React.ChangeEventHandler<HTMLInputElement>;
};

// Email validation regex that properly validates email format - no trimming
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function validateEmail(email: string): string | undefined {
	if (!email) return undefined;
	// Don't trim - check the email exactly as entered by the user
	if (!EMAIL_REGEX.test(email)) {
		return "Enter a valid email address";
	}
	return undefined;
}

export default function EmailField({ name, label = "Email", defaultValue, value, error, required, onChange }: EmailFieldProps) {
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
		/>
	);
}
