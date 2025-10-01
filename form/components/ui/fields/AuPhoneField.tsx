"use client";

import { useMemo, useState, useEffect } from "react";
import { VALIDATION_MESSAGES, VALIDATION_PATTERNS } from "@/lib/validation/constants";

type AuPhoneFieldProps = {
	name: string;
	label?: string;
	defaultValue?: string;
	error?: string;
	required?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	onChange?: (value: string) => void;
};

function validatePhoneField(normalizedValue: string, required?: boolean): string | undefined {
	if (required && !normalizedValue?.trim()) {
		return VALIDATION_MESSAGES.REQUIRED;
	}
	if (normalizedValue && !VALIDATION_PATTERNS.PHONE.test(normalizedValue)) {
		return VALIDATION_MESSAGES.INVALID_PHONE;
	}
	return undefined;
}

export default function AuPhoneField({ name, label = "Phone", defaultValue, error, required, disabled, readOnly, onChange: onChangeCallback }: AuPhoneFieldProps) {
	const [clientError, setClientError] = useState<string | undefined>();
	const [hasInteracted, setHasInteracted] = useState(false);

	function formatLocal(digits: string): string {
		const nine = digits.slice(0, 9);
		const parts = [nine.slice(0, 3), nine.slice(3, 6), nine.slice(6, 9)].filter(Boolean);
		return parts.join(" ");
	}

	const initialLocal = useMemo(() => {
		if (!defaultValue) return "";
		const digits = defaultValue.replace(/\D+/g, "");
		let local = "";
		if (digits.startsWith("61")) {
			local = digits.slice(2);
		} else if (digits.startsWith("04")) {
			local = digits.slice(1);
		} else if (digits.startsWith("4")) {
			local = digits;
		}
		if (local && local[0] !== "4") local = "4" + local.slice(1);
		return formatLocal(local);
	}, [defaultValue]);

	const [localNumber, setLocalNumber] = useState(initialLocal);

	function onChange(e: React.ChangeEvent<HTMLInputElement>) {
		setHasInteracted(true);
		const digitsOnly = e.target.value.replace(/\D+/g, "");
		let next = digitsOnly;
		if (next.length === 0) {
			setLocalNumber("");
			// Only show client validation if there's no server error
			if (!error) {
				const validationError = validatePhoneField("", required);
				setClientError(validationError);
			} else {
				// Clear client error when there's a server error
				setClientError(undefined);
			}
			return;
		}
		if (next[0] !== "4") {
			next = "4" + next.slice(1);
		}
		next = next.slice(0, 9);
		setLocalNumber(formatLocal(next));
	}

	const normalized = useMemo(() => {
		const digitsOnly = localNumber.replace(/\D+/g, "");
		if (digitsOnly.length === 9 && digitsOnly.startsWith("4")) {
			return "+61" + digitsOnly;
		}
		// Return the local number if it has content but is incomplete, so server can show format error
		return localNumber.trim() ? localNumber : "";
	}, [localNumber]);

	// Validate when normalized value changes, but only after user interaction
	useEffect(() => {
		if (hasInteracted) {
			const validationError = validatePhoneField(normalized, required);
			setClientError(validationError);
		}
		// Notify parent of normalized value changes
		onChangeCallback?.(normalized);
	}, [normalized, required, hasInteracted, onChangeCallback]);

	// Show server error if present, but clear it if user has fixed the field
	// Only show server error if user hasn't interacted or field is still invalid
	const displayError = (error && (!hasInteracted || clientError)) ? error : clientError;

	const labelStyle: React.CSSProperties = {
		display: "block",
		marginBottom: 6,
		color: "var(--color-text-secondary)",
		fontSize: 14,
	};

	const wrapperStyle: React.CSSProperties = {
		display: "flex",
		alignItems: "center",
		border: `1px solid ${displayError ? "var(--color-error)" : "var(--color-light-gray)"}`,
		borderRadius: 6,
		background: readOnly ? "var(--color-pale-gray)" : "var(--color-white)",
		height: "var(--field-height)",
		overflow: "hidden",
		boxSizing: "border-box",
	};

	const prefixStyle: React.CSSProperties = {
		padding: "0 12px",
		background: "var(--color-pale-gray)",
		borderRight: `1px solid ${displayError ? "var(--color-error)" : "var(--color-light-gray)"}`,
		color: "var(--color-text-secondary)",
		height: "100%",
		display: "flex",
		alignItems: "center",
	};

	const inputStyle: React.CSSProperties = {
		flex: 1,
		height: "100%",
		border: "none",
		outline: "none",
		padding: "0 12px",
		color: "var(--color-text-primary)",
		background: "transparent",
		lineHeight: "calc(var(--field-height) - 2px)",
	};

	const errorStyle: React.CSSProperties = {
		color: "var(--color-error)",
		fontSize: 12,
		marginTop: 6,
	};

	const fieldStyle: React.CSSProperties = {
		marginBottom: 16,
	};

	const shouldValidate = !disabled && !readOnly;

	return (
		<div style={fieldStyle}>
			<label htmlFor={`${name}-local`} style={labelStyle}>
				{label}
				{required && <span style={{ color: "var(--color-error)", marginLeft: 4 }}>*</span>}
			</label>
			<div style={wrapperStyle}>
				<div style={prefixStyle}>+61</div>
				<input
					id={`${name}-local`}
					name={`${name}_local`}
					type="tel"
					value={localNumber}
					onChange={onChange}
					placeholder="4xx xxx xxx"
					inputMode="tel"
					maxLength={11}
					autoComplete="tel-national"
					style={inputStyle}
					aria-invalid={displayError ? "true" : undefined}
					aria-describedby={displayError ? `${name}-error` : undefined}
					disabled={disabled}
					readOnly={readOnly}
				/>
				{/* Hidden E.164 field that is submitted */}
				<input type="hidden" name={name} value={normalized} />
			</div>
			{displayError ? <div id={`${name}-error`} style={errorStyle}>{displayError}</div> : null}
		</div>
	);
}
