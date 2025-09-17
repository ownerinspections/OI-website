"use client";

import { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { VALIDATION_MESSAGES } from "@/lib/validation/constants";

interface LongDateFieldProps {
    name: string;
    label: string;
    defaultValue?: string;
    placeholder?: string;
    required?: boolean;
    error?: string;
    onChange?: (date: Date | null) => void;
}

function validateDateField(date: Date | null, required?: boolean): string | undefined {
    if (required && !date) {
        return VALIDATION_MESSAGES.SELECT_DATE;
    }
    return undefined;
}

export default function LongDateField({ 
    name, 
    label, 
    defaultValue = "", 
    placeholder = "Select a date",
    required = false,
    error,
    onChange
}: LongDateFieldProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [displayDate, setDisplayDate] = useState<string>("");
    const [showPlaceholder, setShowPlaceholder] = useState<boolean>(!defaultValue);
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const [clientError, setClientError] = useState<string | undefined>();
    const datePickerRef = useRef<DatePicker>(null);

    // Show server error if present, otherwise show client validation error
    const displayError = error || clientError;

    // Format date to long format (e.g., "9 September 2025")
    const formatToLongDate = (date: Date | null): string => {
        if (!date) return "";
        
        try {
            const day = date.getDate();
            const month = date.toLocaleDateString('en-US', { month: 'long' });
            const year = date.getFullYear();
            
            return `${day} ${month} ${year}`;
        } catch (error) {
            console.error("Error formatting date:", error);
            return "";
        }
    };


    // Update display date when selected date changes
    useEffect(() => {
        const formatted = formatToLongDate(selectedDate);
        setDisplayDate(formatted);
        setShowPlaceholder(!selectedDate);
    }, [selectedDate]);

    // Initialize display date on mount
    useEffect(() => {
        if (defaultValue) {
            try {
                const date = new Date(defaultValue);
                if (!isNaN(date.getTime())) {
                    setSelectedDate(date);
                    setDisplayDate(formatToLongDate(date));
                    setShowPlaceholder(false);
                }
            } catch (error) {
                console.error("Error parsing default date:", error);
            }
        }
    }, [defaultValue]);

    const handleDateChange = (date: Date | null) => {
        setSelectedDate(date);
        setIsOpen(false);
        const validationError = validateDateField(date, required);
        setClientError(validationError);
        onChange?.(date);
    };

    const handleCalendarIconClick = () => {
        setIsOpen(!isOpen);
    };

    const handleInputClick = () => {
        setIsOpen(true);
    };

    const handleClickOutside = () => {
        setIsOpen(false);
    };

    const handleSelect = () => {
        setIsOpen(false);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
            <label 
                htmlFor={name}
                style={{ 
                    fontSize: 14, 
                    fontWeight: 500, 
                    color: "var(--color-text-primary)",
                    display: "block"
                }}
            >
                {label}
                {required && <span style={{ color: "var(--color-error)", marginLeft: 4 }}>*</span>}
            </label>
            
            <div style={{ position: "relative", width: "100%" }}>
                <DatePicker
                    ref={datePickerRef}
                    selected={selectedDate}
                    onChange={handleDateChange}
                    open={isOpen}
                    onSelect={handleSelect}
                    onClickOutside={handleClickOutside}
                    wrapperClassName="datepicker-wrapper"
                    customInput={
                        <div style={{ position: "relative", width: "100%" }}>
                            <input
                                type="text"
                                id={name}
                                value={displayDate || ""}
                                placeholder={showPlaceholder ? "Select a date" : ""}
                                readOnly
                                onClick={handleInputClick}
                                style={{
                                    width: "100%",
                                    padding: "12px 48px 12px 16px",
                                    border: `1px solid ${displayError ? "var(--color-error)" : "var(--color-light-gray)"}`,
                                    borderRadius: 6,
                                    fontSize: 14,
                                    color: "var(--color-text-primary)",
                                    backgroundColor: "var(--color-white)",
                                    outline: "none",
                                    transition: "border-color 0.2s ease",
                                    cursor: "pointer"
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = "var(--color-primary-blue)";
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = displayError ? "var(--color-error)" : "var(--color-light-gray)";
                                }}
                            />
                            
                            {/* Calendar icon button */}
                            <button
                                type="button"
                                onClick={handleCalendarIconClick}
                                style={{
                                    position: "absolute",
                                    right: 12,
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 4,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--color-text-muted)",
                                    transition: "color 0.2s ease",
                                    zIndex: 2
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.color = "var(--color-primary-blue)";
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.color = "var(--color-text-muted)";
                                }}
                                title="Open calendar"
                            >
                                <svg
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                    <line x1="16" y1="2" x2="16" y2="6"></line>
                                    <line x1="8" y1="2" x2="8" y2="6"></line>
                                    <line x1="3" y1="10" x2="21" y2="10"></line>
                                </svg>
                            </button>
                        </div>
                    }
                    dateFormat="yyyy-MM-dd"
                    minDate={new Date(new Date().setHours(0, 0, 0, 0))}
                    showPopperArrow={false}
                    popperClassName="custom-datepicker-popper"
                    popperPlacement="bottom-start"
                />
                
                {/* Hidden input for form submission - send ISO date format */}
                <input
                    type="hidden"
                    name={name}
                    value={selectedDate ? selectedDate.toISOString() : ""}
                />
            </div>
            
            {displayError ? (
                <div style={{ color: "var(--color-error)", fontSize: 12, marginTop: 6 }}>
                    {displayError}
                </div>
            ) : null}
            
            <style jsx global>{`
                .datepicker-wrapper {
                    width: 100% !important;
                }
                .custom-datepicker-popper {
                    z-index: 9999 !important;
                }
                .react-datepicker {
                    border: 1px solid var(--color-light-gray) !important;
                    border-radius: 6px !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                    font-family: inherit !important;
                }
                .react-datepicker__header {
                    background-color: var(--color-pale-gray) !important;
                    border-bottom: 1px solid var(--color-light-gray) !important;
                    border-radius: 6px 6px 0 0 !important;
                }
                .react-datepicker__current-month {
                    color: var(--color-text-primary) !important;
                    font-weight: 600 !important;
                }
                .react-datepicker__day-name {
                    color: var(--color-text-secondary) !important;
                    font-weight: 500 !important;
                }
                .react-datepicker__day {
                    color: var(--color-text-primary) !important;
                }
                .react-datepicker__day:hover {
                    background-color: var(--color-pale-gray) !important;
                }
                .react-datepicker__day--selected {
                    background-color: var(--color-primary-blue) !important;
                    color: white !important;
                }
                .react-datepicker__day--selected:hover {
                    background-color: var(--color-primary-blue) !important;
                }
                .react-datepicker__day--disabled {
                    color: var(--color-text-muted) !important;
                    cursor: not-allowed !important;
                }
                .react-datepicker__day--disabled:hover {
                    background-color: transparent !important;
                }
                .react-datepicker__navigation {
                    color: var(--color-text-primary) !important;
                }
                .react-datepicker__navigation:hover {
                    color: var(--color-primary-blue) !important;
                }
            `}</style>
        </div>
    );
}
