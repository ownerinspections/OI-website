import { NextResponse } from "next/server";
import { getRequest } from "@/lib/http/fetcher";

type KongPlacesResponse = {
  predictions?: Array<{
    place_id?: string;
    description?: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>;
};

type PlaceDetailsResponse = {
  result?: {
    formatted_address?: string;
    address_components?: Array<{
      long_name?: string;
      short_name?: string;
      types?: string[];
    }>;
  };
};

type Suggestion = {
  id: string;
  street_address: string;
  unit_number: string;
  suburb: string;
  state: string;
  postcode: string;
  label: string;
};

function normalizeAuState(input: string): string {
  const v = (input || "").trim().toUpperCase();
  const map: Record<string, string> = {
    "AUSTRALIAN CAPITAL TERRITORY": "ACT",
    ACT: "ACT",
    "NEW SOUTH WALES": "NSW",
    NSW: "NSW",
    "NORTHERN TERRITORY": "NT",
    NT: "NT",
    QUEENSLAND: "QLD",
    QLD: "QLD",
    "SOUTH AUSTRALIA": "SA",
    SA: "SA",
    TASMANIA: "TAS",
    TAS: "TAS",
    VICTORIA: "VIC",
    VIC: "VIC",
    "WESTERN AUSTRALIA": "WA",
    WA: "WA",
  };
  return map[v] ?? v;
}

async function fetchAutocomplete(input: string, country: string, types: string): Promise<KongPlacesResponse> {
  const qs = new URLSearchParams({ input, components: `country:${country}`, types }).toString();
  // Prefer standard Google path through Kong
  try {
    const path = `/maps/api/place/autocomplete/json?${qs}`;
    console.log("[places.autocomplete] GET", path);
    const data = await getRequest<KongPlacesResponse>(path);
    console.log("[places.autocomplete] predictions count (std)", Array.isArray(data?.predictions) ? data.predictions!.length : 0);
    return data;
  } catch {
    // Fallback to legacy custom path
    try {
      const path = `/google/places/autocomplete?${qs}`;
      console.log("[places.autocomplete] GET fallback", path);
      const data = await getRequest<KongPlacesResponse>(path);
      console.log("[places.autocomplete] predictions count (fallback)", Array.isArray(data?.predictions) ? data.predictions!.length : 0);
      return data;
    } catch {
      console.error("[places.autocomplete] Failed both autocomplete endpoints");
      return {} as KongPlacesResponse;
    }
  }
}

async function fetchDetails(placeId: string): Promise<PlaceDetailsResponse> {
  const qs = new URLSearchParams({ place_id: placeId, fields: "address_component,formatted_address" }).toString();
  try {
    const path = `/maps/api/place/details/json?${qs}`;
    console.log("[places.autocomplete] details GET", path);
    const data = await getRequest<PlaceDetailsResponse>(path);
    return data;
  } catch {
    console.error("[places.autocomplete] details fetch failed", { placeId });
    return {} as PlaceDetailsResponse;
  }
}

function parseFromPrediction(p: NonNullable<KongPlacesResponse["predictions"]>[number]): { suburb: string; state: string; postcode: string } | null {
  const description = (p?.description || "").trim();
  const sec = (p?.structured_formatting?.secondary_text || "").trim();
  const text = `${sec ? sec + ", " : ""}${description}`;
  // Extract postcode (AU is 4 digits)
  const pcMatch = text.match(/\b(\d{4})\b/);
  const postcode = pcMatch ? pcMatch[1] : "";
  // Extract state abbreviation near postcode
  const stMatch = text.match(/\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\b/);
  const state = stMatch ? stMatch[1] : "";
  // Try to get suburb before state
  let suburb = "";
  if (sec) {
    // secondary_text often like: "Suburb NSW, Australia"
    const beforeState = sec.split(/\b(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\b/)[0]?.trim() || "";
    suburb = beforeState.replace(/,+\s*$/, "").trim();
  }
  if (!suburb) {
    // Fallback: take token before state in description
    const parts = description.split(",").map((s: string) => s.trim());
    for (const part of parts) {
      if (state && part.includes(state)) break;
      suburb = part; // keep updating until we hit state
    }
  }
  if (suburb && state && postcode) return { suburb, state, postcode };
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const input = (searchParams.get("input") || "").trim();
  const country = (searchParams.get("country") || "au").toLowerCase();
  const types = searchParams.get("types") || "locality";
  console.log("[places.autocomplete] request", { input, country, types });

  if (!input || input.length < 3) {
    return NextResponse.json({ suggestions: [] satisfies Suggestion[] });
  }

  const auto = await fetchAutocomplete(input, country, types);
  const predictions = Array.isArray(auto?.predictions) ? auto.predictions.slice(0, 6) : [];
  console.log("[places.autocomplete] predictions sliced", predictions.length);

  const results: Suggestion[] = [];
  for (const p of predictions) {
    console.log("[places.autocomplete] prediction", { place_id: p?.place_id, description: p?.description });
    const pid = p?.place_id;
    if (!pid) continue;
    const details = await fetchDetails(pid);
    const comps = Array.isArray(details?.result?.address_components) ? details.result!.address_components! : [];
    let streetNumber = "";
    let routeName = "";
    let unitNumber = "";
    let suburb = "";
    let state = "";
    let postcode = "";
    for (const c of comps) {
      const types = c?.types ?? [];
      if (types.includes("street_number")) streetNumber = c.long_name ?? streetNumber;
      if (types.includes("route")) routeName = c.long_name ?? routeName;
      if (types.includes("subpremise")) unitNumber = c.long_name ?? unitNumber;
      if (types.includes("locality")) suburb = c.long_name ?? suburb;
      if (types.includes("administrative_area_level_1")) state = normalizeAuState(c.short_name ?? c.long_name ?? state);
      if (types.includes("postal_code")) postcode = c.long_name ?? postcode;
    }
    console.log("[places.autocomplete] details parsed", { suburb, state, postcode });
    if (!(suburb && state && postcode)) {
      const parsed = parseFromPrediction(p);
      if (parsed) {
        suburb = parsed.suburb;
        state = parsed.state;
        postcode = parsed.postcode;
        console.log("[places.autocomplete] parsed from prediction", parsed);
      }
    }
    if (suburb && state && postcode) {
      // Prefer formatted_address from details; fallback to prediction description
      let label = (details?.result?.formatted_address || p?.description || "").trim();
      // Trim trailing ', Australia'
      if (label && /,\s*Australia\s*$/i.test(label)) label = label.replace(/,\s*Australia\s*$/i, "").trim();
      // Ensure postcode is present in the label
      if (label && !new RegExp(`\\b${postcode}\\b`).test(label)) {
        label = `${label}, ${postcode}`;
      }
      if (!label) label = `${suburb}, ${state} ${postcode}`;
      const street_address = `${streetNumber ? streetNumber + " " : ""}${routeName}`.trim();
      results.push({ id: pid, street_address, unit_number: unitNumber, suburb, state, postcode, label });
      console.log("[places.autocomplete] push result", { id: pid, label });
    } else {
      console.warn("[places.autocomplete] Skipping prediction due to missing components", { description: p?.description });
    }
  }
  console.log("[places.autocomplete] results count", results.length);

  return NextResponse.json({ suggestions: results });
}


