import { apiFetch } from "@/lib/http";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

type QuoteRecord = {
  id: string | number;
  deal?: string | number;
  contact?: string | number;
  property?: string | number;
  amount?: number;
  status?: string;
};

type DirectusListResponse<T> = { data: T[] };

async function fetchQuotes(): Promise<QuoteRecord[]> {
  const session = await getSession();
  const cookieStore = await cookies();
  const fallbackToken =
    cookieStore.get("directus_session_token")?.value ||
    cookieStore.get("directus_access_token")?.value ||
    cookieStore.get("access_token")?.value ||
    null;
  const authToken = session?.token ?? fallbackToken ?? null;
  const sessionCookie = cookieStore.get("directus_session_token")?.value || null;
  const refreshCookie = cookieStore.get("directus_refresh_token")?.value || null;
  const cookieHeader = [
    sessionCookie ? `directus_session_token=${sessionCookie}` : null,
    refreshCookie ? `directus_refresh_token=${refreshCookie}` : null,
  ].filter(Boolean).join("; ");
  try {
    const res = await apiFetch(
      "/items/os_proposals?fields=id,deal,contact,quote_amount,status&limit=50&sort=-date_created",
      { headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(cookieHeader ? { Cookie: cookieHeader } : {}) } }
    );
    const json = (await res.json()) as DirectusListResponse<any>;
    const mapped: QuoteRecord[] = (json.data ?? []).map((p: any) => ({
      id: p.id,
      deal: p.deal,
      contact: p.contact,
      property: p.property,
      amount: p.quote_amount,
      status: p.status,
    }));
    return mapped;
  } catch {
    return [];
  }
}

export default async function QuotesPage() {
  const quotes = await fetchQuotes();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#262626" }}>Quotes</h1>
      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Quote #</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Deal</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Contact</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Amount</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{String(q.id)}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{String(q.deal ?? "—")}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{String(q.contact ?? "—")}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>
                  {typeof q.amount === "number" ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(q.amount) : "—"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{q.status || "—"}</td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "16px", color: "#8c8c8c" }}>No quotes found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


