import { apiFetch } from "@/lib/http";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

type PropertyRecord = {
  id: string;
  full_address?: string;
  street_address?: string;
  suburb?: string;
  state?: string;
  post_code?: string;
};

type DirectusListResponse<T> = { data: T[] };

async function fetchProperties(): Promise<PropertyRecord[]> {
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
      "/items/property?fields=id,full_address,street_address,suburb,state,post_code&limit=50&sort=-date_created",
      { headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}), ...(cookieHeader ? { Cookie: cookieHeader } : {}) } }
    );
    const json = (await res.json()) as DirectusListResponse<PropertyRecord>;
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function PropertiesPage() {
  const properties = await fetchProperties();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#262626" }}>Properties</h1>
      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden", background: "#ffffff" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Address</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Suburb</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>State</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Postcode</th>
            </tr>
          </thead>
          <tbody>
            {properties.map((p) => {
              const address = p.full_address || p.street_address || "—";
              return (
                <tr key={p.id}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{address}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{p.suburb || "—"}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{p.state || "—"}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{p.post_code || "—"}</td>
                </tr>
              );
            })}
            {properties.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "16px", color: "#8c8c8c" }}>No properties found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


