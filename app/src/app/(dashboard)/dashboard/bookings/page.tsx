import { apiFetch } from "@/lib/http";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

type BookingRecord = {
  id: string | number;
  proposal?: string | number;
  contact?: string | number;
  date?: string;
  status?: string;
};

type DirectusListResponse<T> = { data: T[] };

async function fetchBookings(): Promise<BookingRecord[]> {
  const session = await getSession();
  const cookieStore = await cookies();
  const fallbackToken =
    cookieStore.get("directus_session_token")?.value ||
    cookieStore.get("directus_access_token")?.value ||
    cookieStore.get("access_token")?.value ||
    null;
  const authToken = session?.token ?? fallbackToken ?? null;
  try {
    // Assuming os_bookings collection; if different, adjust endpoint
    const res = await apiFetch(
      "/items/os_bookings?fields=id,proposal,contact,date,status&limit=50&sort=-date_created",
      { headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) } }
    );
    const json = (await res.json()) as DirectusListResponse<BookingRecord>;
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function BookingsPage() {
  const bookings = await fetchBookings();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#262626" }}>Bookings</h1>
      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Booking #</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Proposal</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Contact</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Date</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id}>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{String(b.id)}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{String(b.proposal ?? "—")}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{String(b.contact ?? "—")}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{b.date ? new Date(b.date).toLocaleString() : "—"}</td>
                <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{b.status || "—"}</td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "16px", color: "#8c8c8c" }}>No bookings found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


