import { env } from "@/lib/env";

export async function apiFetch(input: string, init?: RequestInit) {
  const url = new URL(input, env.KONG_GATEWAY_URL);
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res;
}


