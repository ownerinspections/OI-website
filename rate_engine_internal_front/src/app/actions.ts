"use server";

interface QuotePayload {
  service: string;
  [key: string]: any;
}

interface QuoteResponse {
  quote_price: number;
  gst?: number;
  price_including_gst?: number;
  discount?: number;
  payable_price?: number;
  stage_prices?: Array<{ stage: number | string; price: number }>;
  addons?: Array<{ name: string; price: number }>;
  addons_total?: number;
  note?: string;
}

// Stage mapping for new construction stages
const NEW_CONSTRUCTION_STAGE_NAMES: Record<number, string> = {
  1: "Bored Piers (Screw Piles)",
  2: "Slab Pre-Pour",
  3: "Frame Inspection",
  4: "Lock-Up (Pre-Plaster)",
  5: "Fixing including Waterproofing",
  6: "Completion (PCI) Pre-Handover",
};

// Stage mapping for expert witness report
const EXPERT_WITNESS_STAGE_NAMES: Record<number, string> = {
  1: "Document review and inspection",
  2: "Detailed report preparation",
  3: "Repair cost estimate (Scott schedule)",
};

// Stage mapping for insurance report
const INSURANCE_STAGE_NAMES: Record<number, string> = {
  1: "Document review and inspection",
  2: "Detailed report preparation",
  3: "Cost estimate",
};

// Stage mapping for defects investigation report
const DEFECTS_INVESTIGATION_STAGE_NAMES: Record<number, string> = {
  1: "Document review and inspection",
  2: "Detailed report preparation",
};

export async function calculateQuote(
  payload: QuotePayload
): Promise<{ success: boolean; data?: QuoteResponse; error?: string }> {
  try {
    const apiUrl =
      process.env.RATE_ENGINE_INTERNAL_API_URL || "http://127.0.0.1:8020";
    
    console.log(`Attempting to connect to API at: ${apiUrl}`);
    console.log(`Payload:`, JSON.stringify(payload, null, 2));
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${apiUrl}/api/v1/quotes/estimate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.detail || `API error: ${response.status}`,
      };
    }

    const data = await response.json();
    console.log(`API Response:`, JSON.stringify(data, null, 2));
    
    // Transform stage numbers to names based on service type
    if (data.stage_prices && Array.isArray(data.stage_prices)) {
      let stageMapping: Record<number, string> = {};
      
      // Determine which stage mapping to use based on service type
      if (payload.service === "new_construction_stages") {
        stageMapping = NEW_CONSTRUCTION_STAGE_NAMES;
      } else if (payload.service === "expert_witness_report") {
        stageMapping = EXPERT_WITNESS_STAGE_NAMES;
      } else if (payload.service === "insurance_report") {
        stageMapping = INSURANCE_STAGE_NAMES;
      } else if (payload.service === "defects_investigation") {
        stageMapping = DEFECTS_INVESTIGATION_STAGE_NAMES;
      }
      
      // Apply transformation if we have a mapping
      if (Object.keys(stageMapping).length > 0) {
        data.stage_prices = data.stage_prices.map((item: any) => ({
          stage: stageMapping[item.stage] || item.stage,
          price: item.price,
        }));
      }
    }
    
    return { success: true, data };
  } catch (error: any) {
    console.error(`API Connection Error:`, error);
    const apiUrl = process.env.RATE_ENGINE_INTERNAL_API_URL || "http://127.0.0.1:8020";
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timeout. The API at ${apiUrl} took too long to respond.`,
      };
    }
    
    return {
      success: false,
      error: `Cannot connect to rate engine API at ${apiUrl}. Please ensure the API is running. Error: ${error.message}`,
    };
  }
}

