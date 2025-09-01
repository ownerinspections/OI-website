import { apiFetch } from "@/lib/http";
import { getSession } from "@/lib/auth/session";
import { cookies } from "next/headers";

type ContactRecord = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

type DirectusListResponse<T> = { data: T[] };

async function fetchContacts(): Promise<ContactRecord[]> {
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
      "/items/contacts?fields=id,first_name,last_name,email,phone&limit=50&sort=-date_created",
      {
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      }
    );
    const json = (await res.json()) as DirectusListResponse<ContactRecord>;
    return json.data ?? [];
  } catch (err) {
    // Gracefully degrade when unauthenticated or forbidden
    return [];
  }
}

export default async function ContactsPage() {
  const contacts = await fetchContacts();
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ margin: 0, color: "#262626" }}>Contacts</h1>
      <div
        style={{
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          overflow: "hidden",
          background: "#ffffff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f5f5f5", textAlign: "left" }}>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Name</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Email</th>
              <th style={{ padding: "12px 14px", borderBottom: "1px solid #d9d9d9", color: "#595959" }}>Phone</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => {
              const name = [c.first_name, c.last_name].filter(Boolean).join(" ") || "—";
              return (
                <tr key={c.id}>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#262626" }}>{name}</td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5" }}>
                    <span style={{ color: "#2c9bd6" }}>{c.email || "—"}</span>
                  </td>
                  <td style={{ padding: "12px 14px", borderBottom: "1px solid #f5f5f5", color: "#595959" }}>{c.phone || "—"}</td>
                </tr>
              );
            })}
            {contacts.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: "16px", color: "#8c8c8c" }}>
                  No contacts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


