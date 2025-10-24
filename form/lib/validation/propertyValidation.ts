import { VALIDATION_MESSAGES, VALIDATION_PATTERNS, VALIDATION_LIMITS } from './constants';

export interface PropertyValidationData {
  full_address?: string;
  addressSelected?: boolean;
  propertyCategoryValue?: string;
  propertyTypeValue?: string;
  areaSizeValue?: string;
  numberOfLevelsValue?: string;
  bedroomsValue?: string;
  bathroomsValue?: string;
  levelsValue?: string;
  basementValue?: string;
  serviceId?: number;
  showPropertyCategoryType?: boolean;
  showPropertyDetails?: boolean;
  isApartmentUnit?: boolean;
}

export interface PropertyValidationErrors {
  full_address?: string;
  propertyCategory?: string;
  propertyType?: string;
  areaSize?: string;
  numberOfLevels?: string;
  bedrooms?: string;
  bathrooms?: string;
  levels?: string;
  basement?: string;
}

/**
 * Validates property form data and returns validation errors
 */
export function validatePropertyForm(data: PropertyValidationData): PropertyValidationErrors {
  const errors: PropertyValidationErrors = {};

  // Address validation
  if (data.showPropertyDetails || data.showPropertyCategoryType) {
    if (!data.addressSelected && !data.full_address) {
      errors.full_address = VALIDATION_MESSAGES.ADDRESS_REQUIRED;
    }
  }

  // Property category validation (for services 5, 6, 7, 8, 9)
  if (data.showPropertyCategoryType) {
    if (!data.propertyCategoryValue) {
      errors.propertyCategory = VALIDATION_MESSAGES.PROPERTY_CLASSIFICATION_REQUIRED;
    }
  }

  // Property type validation (for services 5, 6, 7, 8, 9)
  if (data.showPropertyCategoryType) {
    if (!data.propertyTypeValue) {
      errors.propertyType = VALIDATION_MESSAGES.PROPERTY_TYPE_REQUIRED;
    }
  }

  // New construction stages specific validation (service 5)
  if (data.serviceId === 5) {
    if (!data.areaSizeValue) {
      errors.areaSize = VALIDATION_MESSAGES.REQUIRED;
    } else if (!VALIDATION_PATTERNS.AREA_SIZE.test(data.areaSizeValue)) {
      errors.areaSize = VALIDATION_MESSAGES.INVALID_AREA;
    } else {
      const area = parseFloat(data.areaSizeValue);
      if (area < VALIDATION_LIMITS.MIN_AREA || area > VALIDATION_LIMITS.MAX_AREA) {
        errors.areaSize = `Area must be between ${VALIDATION_LIMITS.MIN_AREA} and ${VALIDATION_LIMITS.MAX_AREA} sq m`;
      }
    }

    if (!data.numberOfLevelsValue) {
      errors.numberOfLevels = VALIDATION_MESSAGES.LEVELS_REQUIRED;
    }
  }

  // Property details validation (for services that need full property details)
  if (data.showPropertyDetails) {
    // Bedrooms validation
    if (!data.bedroomsValue) {
      errors.bedrooms = VALIDATION_MESSAGES.REQUIRED;
    } else if (!VALIDATION_PATTERNS.BEDROOMS.test(data.bedroomsValue)) {
      errors.bedrooms = VALIDATION_MESSAGES.INVALID_BEDROOMS;
    }

    // Bathrooms validation
    if (!data.bathroomsValue) {
      errors.bathrooms = VALIDATION_MESSAGES.REQUIRED;
    } else if (!VALIDATION_PATTERNS.BATHROOMS.test(data.bathroomsValue)) {
      errors.bathrooms = VALIDATION_MESSAGES.INVALID_BATHROOMS;
    }

    // Levels validation (not for apartments/units)
    if (!data.isApartmentUnit) {
      if (!data.levelsValue) {
        errors.levels = VALIDATION_MESSAGES.LEVELS_REQUIRED;
      }
      
      if (!data.basementValue) {
        errors.basement = VALIDATION_MESSAGES.BASEMENT_REQUIRED;
      }
    }
  }

  return errors;
}

/**
 * Validates individual property fields
 */
export const validatePropertyField = {
  bedrooms: (value: string): string | undefined => {
    if (!value) return "Number of bedrooms is required";
    if (!VALIDATION_PATTERNS.BEDROOMS.test(value)) {
      return VALIDATION_MESSAGES.INVALID_BEDROOMS_RANGE;
    }
    return undefined;
  },

  bathrooms: (value: string): string | undefined => {
    if (!value) return "Number of bathrooms is required";
    if (!VALIDATION_PATTERNS.BATHROOMS.test(value)) {
      return VALIDATION_MESSAGES.INVALID_BATHROOMS_RANGE;
    }
    return undefined;
  },

  areaSize: (value: string): string | undefined => {
    if (!value) return "Area size is required";
    if (!VALIDATION_PATTERNS.AREA_SIZE.test(value)) {
      return VALIDATION_MESSAGES.INVALID_AREA;
    }
    const area = parseFloat(value);
    if (area < VALIDATION_LIMITS.MIN_AREA || area > VALIDATION_LIMITS.MAX_AREA) {
      return VALIDATION_MESSAGES.INVALID_AREA_RANGE;
    }
    return undefined;
  },

  address: (addressSelected: boolean, fullAddress?: string): string | undefined => {
    if (!addressSelected && !fullAddress) {
      return VALIDATION_MESSAGES.ADDRESS_REQUIRED;
    }
    return undefined;
  },

  propertyCategory: (value: string, required: boolean = false): string | undefined => {
    if (required && !value) {
      return VALIDATION_MESSAGES.PROPERTY_CLASSIFICATION_REQUIRED;
    }
    return undefined;
  },

  propertyType: (value: string, required: boolean = false): string | undefined => {
    if (required && !value) {
      return VALIDATION_MESSAGES.PROPERTY_TYPE_REQUIRED;
    }
    return undefined;
  },

  levels: (value: string, required: boolean = false): string | undefined => {
    if (required && !value) {
      return VALIDATION_MESSAGES.LEVELS_REQUIRED;
    }
    return undefined;
  },

  basement: (value: string, required: boolean = false): string | undefined => {
    if (required && !value) {
      return VALIDATION_MESSAGES.BASEMENT_REQUIRED;
    }
    return undefined;
  }
};

/**
 * Checks if the property form is valid for submission
 */
export function isPropertyFormValid(data: PropertyValidationData): boolean {
  const errors = validatePropertyForm(data);
  return Object.keys(errors).length === 0;
}
