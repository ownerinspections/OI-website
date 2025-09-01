import React, { forwardRef, useId } from "react";
import type { SelectHTMLAttributes } from "react";

type Option = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SelectFieldProps = {
  id?: string;
  name: string;
  label: string;
  options: Option[];
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "defaultValue" | "children">;

const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  {
    id,
    name,
    label,
    options,
    value,
    defaultValue,
    placeholder,
    error,
    hint,
    disabled,
    required,
    onChange,
    ...rest
  },
  ref
) {
  const reactId = useId();
  const fieldId = id ?? `${name}-${reactId}`;
  const errorId = error ? `${fieldId}-error` : undefined;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const fieldStyle: React.CSSProperties = {
    marginBottom: 16,
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    color: "var(--color-text-secondary)",
    fontSize: 14,
  };

  const selectWrapperStyle: React.CSSProperties = {
    position: "relative",
  };

  const selectStyle: React.CSSProperties = {
    width: "100%",
    height: "var(--field-height)",
    lineHeight: "calc(var(--field-height) - 2px)",
    borderRadius: 6,
    border: `1px solid ${error ? "var(--color-error)" : "var(--color-light-gray)"}`,
    padding: "0 36px 0 12px",
    color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
    background: "var(--color-white)",
    boxSizing: "border-box",
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
  };

  const iconStyle: React.CSSProperties = {
    position: "absolute",
    right: 12,
    top: "50%",
    transform: "translateY(-50%)",
    pointerEvents: "none",
    color: "var(--color-dark-gray)",
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
      <label htmlFor={fieldId} style={labelStyle}>{label}</label>
      <div style={selectWrapperStyle}>
        <select
          id={fieldId}
          name={name}
          ref={ref}
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          style={selectStyle}
          {...rest}
        >
          {placeholder ? (
            <option value="" disabled={required} hidden={required}>
              {placeholder}
            </option>
          ) : null}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style={iconStyle}>
          <path d="M7 10l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {hint ? <div id={hintId} style={hintStyle}>{hint}</div> : null}
      {error ? <div id={errorId} style={errorStyle}>{error}</div> : null}
    </div>
  );
});

export default SelectField;


