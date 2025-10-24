/**
 * Service routing utilities for handling service-specific URL generation
 */

// Service type mappings - these match the actual service_type field from the API
const SERVICE_TYPE_MAPPING: Record<number, string> = {
	1: "01-pre-purchase",           // Pre-Purchase Inspection (service_type: "pre_purchase")
	2: "02-pre-sales",              // Pre-Sales Inspection (service_type: "pre_sales")
	3: "03-dilapidation",           // Dilapidation Inspection (service_type: "dilapidation")
	4: "04-apartment-pre-settlement", // Apartment Pre Settlement Inspection (service_type: "apartment-pre-settlement")
	5: "05-new-construction-stages",    // New Construction Stages Inspections (service_type: "new_construction_stages")
	6: "06-insurance-report",       // Insurance Report Inspection (service_type: "insurance_report")
	7: "07-expert-witness-report",  // Expert Witness Report Inspection (service_type: "expert_witness_report")
	8: "08-defects-investigation",  // Defects Investigation Inspection (service_type: "defects_investigation")
};

/**
 * Get the service type string from a service ID
 * @param serviceId - The service ID from the database
 * @returns The service type string for routing
 */
export function getServiceType(serviceId: number): string {
	const serviceType = SERVICE_TYPE_MAPPING[serviceId];
	if (!serviceType) {
		console.warn(`Unknown service ID: ${serviceId}, falling back to generic form`);
		return "generic";
	}
	return serviceType;
}

/**
 * Generate the URL for a specific step and service type
 * @param stepNumber - The step number (1, 2, 3, etc.)
 * @param serviceType - The service type string
 * @returns The URL path for the service-specific step
 */
export function getStepUrl(stepNumber: number, serviceType: string): string {
	const stepPath = `0${stepNumber}-${getStepName(stepNumber)}`;
	
	// Steps that use unified pages (not service-specific)
	const unifiedSteps = [3, 6, 9]; // phone-verification, payment, thank-you
	
	// If it's a unified step, always use the base step URL
	if (unifiedSteps.includes(stepNumber)) {
		return `/steps/${stepPath}`;
	}
	
	// If it's a generic service or unknown service, use the base step URL
	if (serviceType === "generic" || !serviceType) {
		return `/steps/${stepPath}`;
	}
	
	return `/steps/${stepPath}/${serviceType}`;
}

/**
 * Get the step name from step number
 * @param stepNumber - The step number
 * @returns The step name for URL construction
 */
function getStepName(stepNumber: number): string {
	const stepNames: Record<number, string> = {
		1: "contact",
		2: "property", 
		3: "phone-verification",
		4: "quote",
		5: "invoice",
		6: "payment",
		7: "receipt",
		8: "booking",
		9: "thank-you",
	};
	
	return stepNames[stepNumber] || `step-${stepNumber}`;
}

/**
 * Check if a service type has a specific route
 * @param serviceType - The service type to check
 * @returns True if the service type has a specific route
 */
export function hasServiceSpecificRoute(serviceType: string): boolean {
	return serviceType !== "generic" && serviceType !== "";
}

/**
 * Get all available service types
 * @returns Array of all available service types
 */
export function getAllServiceTypes(): string[] {
	return Object.values(SERVICE_TYPE_MAPPING);
}

/**
 * Get service ID from service type
 * @param serviceType - The service type string
 * @returns The service ID or null if not found
 */
export function getServiceIdFromType(serviceType: string): number | null {
	for (const [id, type] of Object.entries(SERVICE_TYPE_MAPPING)) {
		if (type === serviceType) {
			return parseInt(id);
		}
	}
	return null;
}

/**
 * Check if a service ID requires a specialized form
 * @param serviceId - The service ID to check
 * @returns True if the service requires a specialized form
 */
export function isSpecializedService(serviceId: number): boolean {
	return [6, 7, 8, 9].includes(serviceId);
}

/**
 * Service type to route mapping - maps service_type strings to route paths
 */
const SERVICE_TYPE_TO_ROUTE_MAPPING: Record<string, string> = {
	"pre_purchase": "01-pre-purchase",
	"pre_sales": "02-pre-sales", 
	"dilapidation": "03-dilapidation",
	"apartment-pre-settlement": "04-apartment-pre-settlement",
	"new_construction_stages": "05-new-construction-stages",
	"construction_stages": "05-new-construction-stages", // Legacy alias
	"insurance_report": "06-insurance-report",
	"expert_witness_report": "07-expert-witness-report",
	"defects_investigation": "08-defects-investigation",
};

/**
 * Get the route type from a service type string
 * @param serviceType - The service type string from the database
 * @returns The route type string for routing
 */
export function getRouteTypeFromServiceType(serviceType: string): string {
	const routeType = SERVICE_TYPE_TO_ROUTE_MAPPING[serviceType];
	if (!routeType) {
		console.warn(`Unknown service type: ${serviceType}, falling back to generic form`);
		return "generic";
	}
	return routeType;
}

/**
 * Get the estimation function name based on service type
 * @param serviceType - The service type string from the database
 * @returns The estimation function name for the service
 */
export function getEstimationFunctionName(serviceType: string): string | null {
	const routeType = getRouteTypeFromServiceType(serviceType);
	if (routeType === "generic") {
		return null;
	}
	return routeType;
}
