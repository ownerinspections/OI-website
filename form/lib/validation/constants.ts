export const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  SELECT_OPTION: "Please select an option", 
  SELECT_DATE: "Please select a date",
  INVALID_EMAIL: "Enter a valid email address",
  INVALID_PHONE: "Enter a valid phone number"
} as const;

export const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^\+61[4-5]\d{8}$/ // Australian mobile format
} as const;
