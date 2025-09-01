import { apiFetch } from "@/lib/http";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

type PaymentRecord = {
  id: string | number;
  payment_id?: string;
  invoice?: string | number;
  amount?: number | string;
  status?: string;
  payment_method_type?: string;
};

type DirectusListResponse<T> = { data: T[] };

async function fetchPayments(): Promise<PaymentRecord[]> {
  const session = await getSession();
  const cookieStore = await cookies();
  const fallbackToken =
    cookieStore.get("directus_session_token")?.value ||
    cookieStore.get("directus_access_token")?.value ||
    cookieStore.get("access_token")?.value ||
    null;
  const authToken = session?.token ?? fallbackToken ?? null;
  try {
    const res = await apiFetch(
      "/items/os_payments?fields=id,payment_id,invoice,amount,status,payment_method_type&limit=50&sort=-date_created",
      { headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) } }
    );
    const json = (await res.json()) as DirectusListResponse<PaymentRecord>;
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function PaymentsPage() {
  const payments = await fetchPayments();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#262626" }}>Payments</h1>
      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Payment #</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Invoice</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Amount</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Status</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Method</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{p.payment_id || String(p.id)}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{String(p.invoice ?? "—")}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>
                  {typeof p.amount === "number"
                    ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(p.amount)
                    : typeof p.amount === "string"
                    ? p.amount
                    : "—"}
                </td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{p.status || "—"}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{p.payment_method_type || "—"}</td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "16px", color: "#8c8c8c" }}>No payments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


