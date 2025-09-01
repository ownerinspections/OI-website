"use server";

import { getRequest } from "@/lib/http/fetcher";
import { GOOGLE_AUTOCOMPLETE_PATH } from "@/lib/env";

export type SuburbSuggestion = {
	id: string;
	suburb: string;
	state: string;
	postcode: string;
};

type KongPlacesResponse = {
	predictions?: Array<{
		place_id?: string;
		structured_formatting?: {
			main_text?: string; // suburb/locality
			secondary_text?: string; // state and postcode
		};
		terms?: Array<{ value?: string }>;
		description?: string;
	}>;
};

export async function geocodeAddress(query: string): Promise<SuburbSuggestion[]> {
	const q = query.trim();
	if (!q) return [];

	// Fetch autocomplete predictions (address type) via Kong
	let predictions: NonNullable<KongPlacesResponse["predictions"]> = [];
	const qs = new URLSearchParams({ input: q, types: "address", components: "country:au" }).toString();
	// Attempt 1: configured path
	try {
		const res1 = await getRequest<KongPlacesResponse>(`${GOOGLE_AUTOCOMPLETE_PATH}?${qs}`);
		if (Array.isArray(res1?.predictions) && res1.predictions.length > 0) {
			predictions = res1.predictions;
		}
	} catch { /* ignore */ }

	// Attempt 2: standard Google path through Kong
	if (predictions.length === 0) {
		try {
			const res2 = await getRequest<KongPlacesResponse>(`/maps/api/place/autocomplete/json?${qs}`);
			if (Array.isArray(res2?.predictions) && res2.predictions.length > 0) {
				predictions = res2.predictions;
			}
		} catch { /* ignore */ }
	}

	// Attempt 3: legacy custom path using q= query param
	if (predictions.length === 0) {
		try {
			const res3 = await getRequest<KongPlacesResponse>(`/google/places/autocomplete?q=${encodeURIComponent(q)}`);
			if (Array.isArray(res3?.predictions) && res3.predictions.length > 0) {
				predictions = res3.predictions;
			}
		} catch { /* ignore */ }
	}

	predictions = predictions.slice(0, 8);

	const suggestions: SuburbSuggestion[] = predictions
		.map((p) => parsePrediction(p))
		.filter((s): s is SuburbSuggestion => !!s && !!s.suburb && !!s.state && !!s.postcode);

	return suggestions;
}

function normalizeAuState(input: string): string {
	const v = input.trim().toUpperCase();
	const map: Record<string, string> = {
		"AUSTRALIAN CAPITAL TERRITORY": "ACT",
		"ACT": "ACT",
		"NEW SOUTH WALES": "NSW",
		"NSW": "NSW",
		"NORTHERN TERRITORY": "NT",
		"NT": "NT",
		"QUEENSLAND": "QLD",
		"QLD": "QLD",
		"SOUTH AUSTRALIA": "SA",
		"SA": "SA",
		"TASMANIA": "TAS",
		"TAS": "TAS",
		"VICTORIA": "VIC",
		"VIC": "VIC",
		"WESTERN AUSTRALIA": "WA",
		"WA": "WA",
	};
	return map[v] ?? v;
}

function parsePrediction(p: NonNullable<KongPlacesResponse["predictions"]>[number]): SuburbSuggestion | null {
	const placeId = p?.place_id ?? crypto.randomUUID();
	const description = (p?.description ?? "").trim();
	const secondary = (p?.structured_formatting?.secondary_text ?? "").trim();

	// Prefer description; remove trailing ', Australia'
	const parts = description.split(",").map((s) => s.trim()).filter(Boolean);
	if (parts.length > 0 && /australia/i.test(parts[parts.length - 1] ?? "")) {
		parts.pop();
	}
	let regionSegment = parts[parts.length - 1] ?? "";
	let suburbCandidate = parts.length >= 2 ? parts[parts.length - 2] ?? "" : "";

	// Try to parse 'Suburb STATE 1234' pattern either in region segment or secondary text
	let suburb = "";
	let state = "";
	let postcode = "";

	let m = /(.+?)\s+([A-Z]{2,3})\s+(\d{4})$/.exec(regionSegment);
	if (!m && secondary) {
		m = /(.+?)\s+([A-Z]{2,3})\s+(\d{4})$/.exec(secondary);
	}
	if (m) {
		suburb = (m[1] ?? suburbCandidate ?? "").trim();
		state = normalizeAuState(m[2] ?? "");
		postcode = (m[3] ?? "").trim();
	} else {
		// Fallbacks
		const pc = (description.match(/\b(\d{4})\b/) || [])[1] ?? "";
		postcode = pc;
		// Try to find state token
		const stateToken = (description.match(/\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\b/) || [])[1] ?? "";
		state = stateToken ? normalizeAuState(stateToken) : "";
		// Use the previous segment as suburb if available, else attempt from secondary
		suburb = suburbCandidate || (secondary.split(",")[0]?.trim() ?? "");
	}

	if (!suburb || !state || !postcode) return null;

	return { id: placeId, suburb, state, postcode };
}


