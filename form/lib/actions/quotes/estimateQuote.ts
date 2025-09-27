"use server";

import { postRequest } from "@/lib/http/fetcher";
import { KONG_GATEWAY_URL } from "@/lib/env";

export type QuoteEstimateResponse = {
	stage_prices?: Array<{ stage: number; price: number }>;
	quote_price: number;
	note?: string;
};

export type PropertyDetails = {
	property_category: "residential" | "commercial";
	bedrooms?: number;
	bathrooms?: number;
	levels?: number;
	basement?: boolean;
	area_sq?: number;
	stages?: number[];
	estimated_damage_loss?: number;
};

/**
 * Generic function to call quote estimation API
 */
async function callServiceEstimateAPI(serviceType: string, payload: any): Promise<QuoteEstimateResponse | null> {
	try {
		const response = await postRequest<QuoteEstimateResponse>(
			`${KONG_GATEWAY_URL}/api/v1/quotes/estimate`,
			payload
		);
		return response;
	} catch (error) {
		console.error(`[estimateQuote] Failed to estimate ${serviceType} quote:`, error);
		return null;
	}
}

/**
 * Pre-purchase inspection quote estimation
 */
export async function estimatePrePurchaseQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "pre_purchase",
		property_category: property.property_category,
		bedrooms: property.bedrooms || 0,
		bathrooms: property.bathrooms || 0,
		levels: property.levels || 0,
		basement: property.basement || false
	};
	
	return await callServiceEstimateAPI("pre-purchase", payload);
}

/**
 * Pre-sales inspection quote estimation
 */
export async function estimatePreSalesQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "pre_sales",
		property_category: property.property_category,
		bedrooms: property.bedrooms || 0,
		bathrooms: property.bathrooms || 0,
		levels: property.levels || 0,
		basement: property.basement || false
	};
	
	return await callServiceEstimateAPI("pre-sales", payload);
}

/**
 * Dilapidation inspection quote estimation
 */
export async function estimateDilapidationQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "dilapidation",
		property_category: property.property_category,
		bedrooms: property.bedrooms || 0,
		bathrooms: property.bathrooms || 0,
		levels: property.levels || 0,
		basement: property.basement || false
	};
	
	return await callServiceEstimateAPI("dilapidation", payload);
}

/**
 * Apartment pre-settlement inspection quote estimation
 */
export async function estimateApartmentPreSettlementQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "apartment-pre-settlement",
		property_category: property.property_category,
		bedrooms: property.bedrooms || 0,
		bathrooms: property.bathrooms || 0
	};
	
	return await callServiceEstimateAPI("apartment-pre-settlement", payload);
}

/**
 * Construction stages inspection quote estimation
 */
export async function estimateConstructionStagesQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "construction_stages",
		property_category: property.property_category,
		stages: property.stages && property.stages.length > 0 ? property.stages : [1, 2, 3, 4, 5, 6],
		area_sq: property.area_sq || 0,
		levels: property.levels || 0
	};
	
	return await callServiceEstimateAPI("construction-stages", payload);
}

/**
 * Insurance report quote estimation
 */
export async function estimateInsuranceReportQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "insurance_report",
		property_category: property.property_category,
		stages: property.stages && property.stages.length > 0 ? property.stages : [1, 2, 3],
		estimated_damage_loss: property.estimated_damage_loss || 100000
	};
	
	return await callServiceEstimateAPI("insurance-report", payload);
}

/**
 * Expert witness report quote estimation
 */
export async function estimateExpertWitnessReportQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "expert_witness_report",
		property_category: property.property_category,
		stages: property.stages && property.stages.length > 0 ? property.stages : [1, 2, 3]
	};
	
	return await callServiceEstimateAPI("expert-witness-report", payload);
}

/**
 * Defects investigation quote estimation
 */
export async function estimateDefectsInvestigationQuote(property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	const payload = {
		service: "defects_investigation",
		property_category: property.property_category,
		stages: property.stages && property.stages.length > 0 ? property.stages : [1, 2, 3]
	};
	
	return await callServiceEstimateAPI("defects-investigation", payload);
}

/**
 * Generic quote estimation function that calls the appropriate service-specific estimate API
 * @param serviceType - The service type string from the database
 * @param property - Property details for estimation
 * @returns Quote estimate response or null if failed
 */
export async function estimateQuoteByServiceType(serviceType: string, property: PropertyDetails): Promise<QuoteEstimateResponse | null> {
	try {
		switch (serviceType) {
			case "pre_purchase":
				return await estimatePrePurchaseQuote(property);
			case "pre_sales":
				return await estimatePreSalesQuote(property);
			case "dilapidation":
				return await estimateDilapidationQuote(property);
			case "apartment-pre-settlement":
				return await estimateApartmentPreSettlementQuote(property);
			case "construction_stages":
				return await estimateConstructionStagesQuote(property);
			case "insurance_report":
				return await estimateInsuranceReportQuote(property);
			case "expert_witness_report":
				return await estimateExpertWitnessReportQuote(property);
			case "defects_investigation":
				return await estimateDefectsInvestigationQuote(property);
			default:
				console.warn(`[estimateQuoteByServiceType] Unknown service type: ${serviceType}`);
				return null;
		}
	} catch (error) {
		console.error(`[estimateQuoteByServiceType] Failed to estimate quote for service type ${serviceType}:`, error);
		return null;
	}
}

