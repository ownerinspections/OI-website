"use server";

import { OPENAI_MODEL, OPENAI_ENABLE_WEBSEARCH } from "@/lib/env";
import fs from "fs/promises";
import path from "path";

export type QuotingInfo = {
  property_classification: "Residential" | "Commercial" | "N/A" | string;
  property_type: "House" | "Townhouse" | "Apartment/Unit" | "Villa" | "Duplex" | "Other" | "N/A" | string;
  bedrooms_including_study: number | "N/A";
  bathrooms_rounded: number | "N/A";
  levels: "Single Storey" | "Double Storey" | "Triple Storey" | "N/A";
  has_basement_or_subfloor: "Yes" | "No" | "N/A";
  additional_structures: string[];
};

export type ClientInfo = {
  floor_area_sqm: number | "N/A";
  land_size: string | "N/A";
  year_built: number | "N/A";
  suburb_median_house_price: number | "N/A";
  suburb_median_unit_price: number | "N/A";
  price_growth_12m_pct: number | "N/A";
  termite_risk: "High" | "Moderate" | "Low" | "N/A" | string;
  termite_risk_reason: string;
  bushfire_prone: "Yes" | "No" | "N/A";
  flood_risk: "Yes" | "No" | "N/A";
  heritage_overlay: "Yes" | "No" | "N/A";
  last_sold_price: { price: number | "N/A"; date: string };
  last_rental_listing: { price_per_week: number | "N/A"; date: string };
  recent_sales_nearby: Array<{ address: string; price: number; date: string }>;
};

export type ExtractionResult = {
  address: string;
  realestate_url?: string | "N/A";
  quoting_info: QuotingInfo;
  client_info: ClientInfo;
  agents?: Array<{ first_name?: string; last_name?: string; mobile?: string; email?: string }>;
  free_text_notes: string;
};

let cachedSystemPrompt: string | null = null;

async function loadSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt) return cachedSystemPrompt;
  const promptPath = path.join(process.cwd(), "lib", "prompts", "property-extractor-system.txt");
  const content = await fs.readFile(promptPath, "utf8");
  cachedSystemPrompt = content;
  return content;
}

export async function extractPropertyDetails(input: { address: string }): Promise<ExtractionResult | null> {
  console.log("[extractPropertyDetails] input", input);
  let systemPrompt = "";
  try {
    systemPrompt = await loadSystemPrompt();
  } catch (e) {
    console.error("[extractPropertyDetails] failed to load system prompt", e);
    try {
      console.warn("[extractPropertyDetails] issue", { stage: "prompt_load_failed" });
    } catch {}
    return null;
  }
  const userContent = input.address;

  const payload: Record<string, unknown> = {
    model: OPENAI_MODEL,
    input: `${systemPrompt}\n\nAddress: ${userContent}`,
  };
  if (OPENAI_ENABLE_WEBSEARCH) {
    payload.tools = [{ type: "web_search_preview" }];
  }

  type OpenAIResponse = {
    output_text?: string;
    output?: Array<{
      type?: string;
      role?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    choices?: Array<{ message?: { role?: string; content?: string } }>;
  };

  function tryParseExtraction(content: string): ExtractionResult | null {
    if (!content) return null;
    let raw = content.trim();
    raw = raw.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "");
    try {
      return JSON.parse(raw) as ExtractionResult;
    } catch {}
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) {
      const sub = raw.slice(start, end + 1);
      try {
        return JSON.parse(sub) as ExtractionResult;
      } catch {}
    }
    return null;
  }

  function extractTextFromJson(json: OpenAIResponse, fallbackText: string): string {
    if (typeof json?.output_text === "string" && json.output_text) {
      return json.output_text;
    }
    if (Array.isArray(json?.output) && json.output.length > 0) {
      for (const part of json.output) {
        if (Array.isArray(part?.content)) {
          const textPart = part!.content!.find((c) => typeof c?.text === "string" && c.text.length > 0)?.text;
          if (textPart) return textPart;
        }
      }
    }
    if (Array.isArray(json?.choices) && json.choices.length > 0) {
      const c = json.choices[0]?.message?.content;
      if (typeof c === "string" && c) return c;
    }
    return fallbackText;
  }

  function extractTextFromSse(raw: string): string {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("data:"));
    // Iterate from last non-[DONE]
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const payload = line.slice(5).trim(); // after 'data:'
      if (!payload || payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload) as OpenAIResponse | Record<string, unknown>;
        const textGuess = extractTextFromJson(j as OpenAIResponse, "");
        if (textGuess) return textGuess;
      } catch {}
    }
    return "";
  }

  try {
    const start = Date.now();
    const urlBase = process.env.KONG_GATEWAY_URL ?? "http://localhost:8000";
    const url = `${urlBase.replace(/\/$/, "")}/openai/v1/responses`;
    console.log("[extractPropertyDetails] POST", url, "model=", payload.model, "tools=", !!(payload as any).tools);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const ms = Date.now() - start;
    const text = await res.text();
    console.log("[extractPropertyDetails] status=", res.status, "ms=", ms, "rawLen=", text?.length ?? 0);
    if (!res.ok) {
      console.error("[extractPropertyDetails] error body (first 500)", text.slice(0, 500));
      try {
        console.warn("[extractPropertyDetails] issue", {
          stage: "http_error",
          status: res.status,
          bodyPreview: text.slice(0, 500),
        });
      } catch {}
      return null;
    }
    let json: OpenAIResponse = {} as any;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON; maybe SSE
    }
    let content = extractTextFromJson(json, "");
    if (!content) {
      // Try SSE fallback
      const sseText = extractTextFromSse(text);
      if (sseText) content = sseText;
    }
    if (!content) {
      // Last resort: raw text
      content = text;
    }
    console.log("[extractPropertyDetails] raw content length=", content?.length ?? 0);
    console.log("[extractPropertyDetails] raw content:\n", content);
    const parsed = tryParseExtraction(content);
    console.log("[extractPropertyDetails] parsed", parsed ? "ok" : "null");
    if (!parsed) {
      try {
        console.warn("[extractPropertyDetails] issue", {
          stage: "parse_failed",
          contentPreview: (content || "").slice(0, 500),
        });
      } catch {}
      return null;
    }
    // Validate usable quoting info presence
    const q = parsed.quoting_info as any;
    const hasUsable = Boolean(
      (q?.property_classification && q.property_classification !== "N/A") ||
      (q?.property_type && q.property_type !== "N/A") ||
      (typeof q?.bedrooms_including_study === "number") ||
      (typeof q?.bathrooms_rounded === "number") ||
      (q?.levels && q.levels !== "N/A" && typeof q?.levels === "string") ||
      (q?.has_basement_or_subfloor && q.has_basement_or_subfloor !== "N/A") ||
      (Array.isArray(q?.additional_structures) && q.additional_structures.length > 0)
    );
    if (!hasUsable) {
      try {
        console.warn("[extractPropertyDetails] issue", {
          stage: "no_usable_quoting_info",
          quoting_info: q ?? null,
          inputAddress: userContent,
          promptChars: String(payload.input || "").length,
          websearch: !!(payload as any).tools,
        });
      } catch {}
    }
    return parsed;
  } catch (_err) {
    console.error("[extractPropertyDetails] request error", _err);
    try {
      console.warn("[extractPropertyDetails] issue", {
        stage: "request_exception",
        error: (_err as any)?.message ?? String(_err),
      });
    } catch {}
    return null;
  }
}


