import { apiFetch } from "@/lib/http";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

type InvoiceRecord = {
  id: string | number;
  invoice_id?: string;
  contact?: string | number;
  subtotal?: number;
  total_tax?: number;
  total?: number;
  status?: string;
};

type DirectusListResponse<T> = { data: T[] };

async function fetchInvoices(): Promise<InvoiceRecord[]> {
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
      "/items/os_invoices?fields=id,invoice_id,contact,subtotal,total_tax,total,status&limit=50&sort=-date_created",
      { headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(cookieHeader ? { Cookie: cookieHeader } : {}) } }
    );
    const json = (await res.json()) as DirectusListResponse<InvoiceRecord>;
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function InvoicesPage() {
  const invoices = await fetchInvoices();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#262626" }}>Invoices</h1>
      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Invoice #</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Contact</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Total</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{inv.invoice_id || String(inv.id)}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{String(inv.contact ?? "—")}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>
                  {typeof inv.total === "number" ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(inv.total) : "—"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{inv.status || "—"}</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "16px", color: "#8c8c8c" }}>No invoices found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


