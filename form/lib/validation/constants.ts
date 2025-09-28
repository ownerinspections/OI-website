export const VALIDATION_MESSAGES = {
  REQUIRED: "This field is required",
  SELECT_DATE: "Please select a date",
  INVALID_EMAIL: "Enter a valid email address",
  INVALID_PHONE: "Enter a valid phone number",
  // Property-specific validation messages
  INVALID_ADDRESS: "Please select a valid address",
  INVALID_NUMBER: "Must be a valid number",
  INVALID_POSITIVE_NUMBER: "Must be a positive number",
  INVALID_AREA: "Area must be a positive number",
  INVALID_BEDROOMS: "Must be between 1 and 20 bedrooms",
  INVALID_BATHROOMS: "Must be between 1 and 10 bathrooms",
  ADDRESS_REQUIRED: "Please select an address from the suggestions",
  PROPERTY_CLASSIFICATION_REQUIRED: "Please select a property classification",
  PROPERTY_TYPE_REQUIRED: "Please select a property type",
  LEVELS_REQUIRED: "Please select the number of levels",
  BASEMENT_REQUIRED: "Please specify if basement/subfloor exists",
  // Additional validation messages
  INVALID_AREA_RANGE: "Area must be between 1 and 10,000 sq m",
  INVALID_BEDROOMS_RANGE: "Must be between 1 and 20 bedrooms",
  INVALID_BATHROOMS_RANGE: "Must be between 1 and 10 bathrooms",
  INVALID_LEVELS_SELECTION: "Please select a valid level option",
  INVALID_BASEMENT_SELECTION: "Please select Yes, No, or N/A",
  INVALID_PROPERTY_CLASSIFICATION: "Please select Residential or Commercial",
  INVALID_PROPERTY_TYPE: "Please select a valid property type"
} as const;

export const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^\+61[4-5]\d{8}$/, // Australian mobile format
  // Property-specific validation patterns
  POSITIVE_INTEGER: /^[1-9]\d*$/,
  POSITIVE_DECIMAL: /^\d+(\.\d+)?$/,
  BEDROOMS: /^([1-9]|1[0-9]|20)$/,
  BATHROOMS: /^([1-9]|10)$/,
  AREA_SIZE: /^\d+(\.\d+)?$/,
  // Additional patterns
  PROPERTY_CLASSIFICATION: /^(Residential|Commercial)$/,
  PROPERTY_TYPE: /^(House|Townhouse|Apartment\/Unit|Villa|Duplex|Office|Retail|Industrial|Warehouse|Other)$/,
  LEVELS_SELECTION: /^(Single Storey|Double Storey|Triple Storey|N\/A|[1-3])$/,
  BASEMENT_SELECTION: /^(Yes|No|N\/A)$/
} as const;

export const VALIDATION_LIMITS = {
  MIN_BEDROOMS: 1,
  MAX_BEDROOMS: 20,
  MIN_BATHROOMS: 1,
  MAX_BATHROOMS: 10,
  MIN_AREA: 1,
  MAX_AREA: 10000
} as const;
