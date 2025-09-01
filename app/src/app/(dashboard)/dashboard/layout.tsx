import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", minHeight: "100vh" }}>
      <aside style={{
        borderRight: `1px solid var(--color-light-gray)`,
        padding: 16,
        background: "var(--color-white)",
      }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>Dashboard</h2>
        <nav style={{ display: "grid", gap: 8 }}>
          <Link href="/dashboard/contacts">Contacts</Link>
          <Link href="/dashboard/properties">Properties</Link>
          <Link href="/dashboard/quotes">Quotes</Link>
          <Link href="/dashboard/invoices">Invoices</Link>
          <Link href="/dashboard/payments">Payments</Link>
          <Link href="/dashboard/bookings">Bookings</Link>
          <Link href="/logout" style={{
            display: "inline-block",
            marginTop: 12,
            background: "var(--color-primary-blue)",
            color: "white",
            border: 0,
            borderRadius: 6,
            padding: "8px 10px",
            fontWeight: 600,
          }}>Logout</Link>
        </nav>
      </aside>
      <main style={{ padding: 24, background: "var(--color-pale-gray)" }}>{children}</main>
    </div>
  );
}


