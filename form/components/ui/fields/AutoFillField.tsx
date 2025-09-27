"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { VALIDATION_MESSAGES } from "@/lib/validation/constants";

type AutoFillOption = {
	value: string;
	label: string;
};

type AutoFillFieldProps = {
	id?: string;
	name: string;
	label: string;
	options: AutoFillOption[];
	defaultValue?: string; // default visible label
	defaultSelectedValue?: string; // default submitted value (option.value)
	placeholder?: string;
	error?: string;
	hint?: string;
	required?: boolean;
	onSelect?: (option: AutoFillOption) => void;
	// When provided, will be called with the current query whenever the user types
	onInputChange?: (query: string) => void;
	// If true, bypass client-side filtering and show options as provided
	disableClientFilter?: boolean;
	// Show a loading indicator on the right inside the input
	loading?: boolean;
	// Customize the text shown in the input after a selection is made
	getSelectedLabel?: (option: AutoFillOption) => string;
	// When true, submit the selected label as the hidden input value instead of option.value
	submitSelectedLabel?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue" | "onSelect">;

function validateAutoFillField(selectedValue: string, required?: boolean): string | undefined {
	if (required && !selectedValue?.trim()) {
		return VALIDATION_MESSAGES.SELECT_OPTION;
	}
	return undefined;
}

export default function AutoFillField({
	id,
	name,
	label,
	options,
	defaultValue,
	defaultSelectedValue,
	placeholder,
	error,
	hint,
	disabled,
	required,
	onSelect,
	onInputChange,
	disableClientFilter,
	loading,
	getSelectedLabel,
	submitSelectedLabel,
	...rest
}: AutoFillFieldProps) {
	const [clientError, setClientError] = useState<string | undefined>();
	const reactId = useId();
	const fieldId = id ?? `${name}-${reactId}`;
	const listboxId = `${fieldId}-listbox`;
	const hintId = hint ? `${fieldId}-hint` : undefined;
	const errorId = error ? `${fieldId}-error` : undefined;
	const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

	// Show server error if present, otherwise show client validation error
	const displayError = error || clientError;

	const [isClient, setIsClient] = useState(false);
	const [query, setQuery] = useState<string>(defaultValue ?? "");
	const [selectedValue, setSelectedValue] = useState<string>(defaultSelectedValue ?? "");
	const [open, setOpen] = useState<boolean>(false);
	const [activeIndex, setActiveIndex] = useState<number>(-1);
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const normalizedOptions = useMemo(() => options ?? [], [options]);

	// Set isClient to true after hydration to prevent serialization errors
	useEffect(() => {
		setIsClient(true);
	}, []);

	// Sync visible input and selected value when default props change (e.g., server-side prefill)
	useEffect(() => {
		setQuery(defaultValue ?? "");
	}, [defaultValue]);

	useEffect(() => {
		setSelectedValue(defaultSelectedValue ?? "");
	}, [defaultSelectedValue]);

	const filtered = useMemo(() => {
		if (disableClientFilter) return normalizedOptions;
		if (!query) return normalizedOptions;
		const lower = query.toLowerCase();
		return normalizedOptions.filter((opt) => opt.label.toLowerCase().includes(lower));
	}, [normalizedOptions, query, disableClientFilter]);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			if (!wrapperRef.current) return;
			if (!wrapperRef.current.contains(e.target as Node)) {
				setOpen(false);
				setActiveIndex(-1);
			}
		}
		document.addEventListener("mousedown", onClickOutside);
		return () => document.removeEventListener("mousedown", onClickOutside);
	}, []);

	function commitSelection(opt: AutoFillOption) {
		const display = typeof getSelectedLabel === "function" ? getSelectedLabel(opt) : opt.label;
		setQuery(display);
		setSelectedValue(opt.value);
		setOpen(false);
		setActiveIndex(-1);
		
		// Validate the selection
		const validationError = validateAutoFillField(opt.value, required);
		setClientError(validationError);
		
		if (typeof onSelect === "function") onSelect(opt);
		// Blur the input to move cursor out after selecting an option
		inputRef.current?.blur();
	}

	function handleOptionClick(opt: AutoFillOption) {
		return () => commitSelection(opt);
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
			setOpen(true);
			return;
		}
		if (!open) return;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setActiveIndex((prev) => {
				const next = prev + 1;
				return next >= filtered.length ? 0 : next;
			});
			return;
		}
		if (e.key === "ArrowUp") {
			e.preventDefault();
			setActiveIndex((prev) => {
				const next = prev - 1;
				return next < 0 ? Math.max(0, filtered.length - 1) : next;
			});
			return;
		}
		if (e.key === "Enter") {
			e.preventDefault();
			if (activeIndex >= 0 && activeIndex < filtered.length) {
				commitSelection(filtered[activeIndex]!);
			} else {
				setOpen(false);
			}
			return;
		}
		if (e.key === "Escape") {
			e.preventDefault();
			setOpen(false);
			setActiveIndex(-1);
		}
	}

	const fieldStyle: React.CSSProperties = {
		marginBottom: 16,
	};

	const labelStyle: React.CSSProperties = {
		display: "block",
		marginBottom: 6,
		color: "var(--color-text-secondary)",
		fontSize: 14,
	};

	const wrapperStyle: React.CSSProperties = {
		position: "relative",
	};

	const inputStyle: React.CSSProperties = {
		width: "100%",
		height: "var(--field-height)",
		lineHeight: "calc(var(--field-height) - 2px)",
		borderRadius: 6,
		border: `1px solid ${displayError ? "var(--color-error)" : "var(--color-light-gray)"}`,
		padding: loading ? "0 36px 0 12px" : "0 12px",
		color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
		background: "var(--color-white)",
		boxSizing: "border-box",
	};

	const listboxStyle: React.CSSProperties = {
		position: "absolute",
		top: "calc(var(--field-height) + 4px)",
		left: 0,
		right: 0,
		border: `1px solid var(--color-light-gray)`,
		borderRadius: 6,
		background: "var(--color-white)",
		boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
		zIndex: 1000,
		maxHeight: "200px",
		overflowY: "auto",
	};

	const optionStyleBase: React.CSSProperties = {
		padding: "12px 16px",
		cursor: "pointer",
		fontSize: 14,
		color: "var(--color-text-primary)",
		background: "var(--color-white)",
		minHeight: "44px",
		display: "flex",
		alignItems: "center",
	};

	const hintStyle: React.CSSProperties = {
		color: "var(--color-text-muted)",
		fontSize: 12,
		marginTop: 6,
	};

	const errorStyle: React.CSSProperties = {
		color: "var(--color-error)",
		fontSize: 12,
		marginTop: 6,
	};

	return (
		<div style={fieldStyle}>
			<label htmlFor={fieldId} style={labelStyle}>
				{label}
				{required && <span style={{ color: "var(--color-error)", marginLeft: 4 }}>*</span>}
			</label>
			<div ref={wrapperRef} style={wrapperStyle}>
				<input
					id={fieldId}
					name={`${name}_label`}
					type="text"
					ref={inputRef}
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setSelectedValue("");
						setOpen(true);
						setActiveIndex(-1);
						
						// Clear validation error when user starts typing
						setClientError(undefined);
						
						if (typeof onInputChange === "function") onInputChange(e.target.value);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={onKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					aria-invalid={!!displayError}
					aria-describedby={describedBy}
					aria-autocomplete="list"
					aria-expanded={open}
					aria-controls={open ? listboxId : undefined}
					role="combobox"
					style={inputStyle}
					{...rest}
				/>
				{loading ? (
					<div aria-hidden="true" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "var(--color-dark-gray)" }}>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
							<circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
							<path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2">
								<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
							</path>
						</svg>
					</div>
				) : null}
				<input type="hidden" name={name} value={submitSelectedLabel ? query : selectedValue} />
				{open && filtered.length > 0 ? (
					<ul id={listboxId} role="listbox" style={listboxStyle}>
						{filtered.map((opt, idx) => {
							const isActive = idx === activeIndex;
							return (
								<li
									key={opt.value}
									role="option"
									aria-selected={isActive}

									onMouseEnter={isClient ? () => setActiveIndex(idx) : undefined}
									onMouseDown={(e) => e.preventDefault()}
									onClick={isClient ? handleOptionClick(opt) : undefined}
									style={{
										...optionStyleBase,
										background: isActive ? "var(--color-pale-gray)" : "var(--color-white)",
									}}
								>
									{opt.label}
								</li>
							);
						})}
					</ul>
				) : null}
			</div>
			{hint ? <div id={hintId} style={hintStyle}>{hint}</div> : null}
			{displayError ? <div id={errorId} style={errorStyle}>{displayError}</div> : null}
		</div>
	);
}
