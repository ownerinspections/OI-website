import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { apiFetch } from "@/lib/http";
import LoginForm from "./server-form";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // If already logged in, go to dashboard
  const session = await getSession();
  if (session?.user) {
    redirect("/dashboard");
  }

  // Log cookie presence for diagnostics
  const cookieStore = await cookies();
  try {
    const hasSess = Boolean(cookieStore.get("oi_session")?.value);
    const hasAccess1 = Boolean(cookieStore.get("directus_session_token")?.value);
    const hasAccess2 = Boolean(cookieStore.get("directus_access_token")?.value);
    const hasAccess3 = Boolean(cookieStore.get("access_token")?.value);
    const hasRefresh = Boolean(cookieStore.get("directus_refresh_token")?.value);
    console.log("[app/login] cookies snapshot", {
      hasOiSession: hasSess,
      hasDirectusSessionToken: hasAccess1,
      hasDirectusAccessToken: hasAccess2,
      hasAccessToken: hasAccess3,
      hasRefreshToken: hasRefresh,
    });
  } catch {}

  return (
    <main style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--color-pale-gray)",
      color: "var(--color-charcoal)",
      padding: "24px"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--color-white)",
        border: `1px solid var(--color-light-gray)`,
        borderRadius: 8,
        padding: 24,
        boxShadow: "0 1px 2px rgba(0,0,0,0.06)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
          <Image
            src="/ownerlogo.png"
            alt="Owner Inspections"
            width={360}
            height={120}
            priority
          />
        </div>
        <h1 style={{ fontSize: 20, lineHeight: 1.2, textAlign: "center", marginBottom: 4 }}>Owner Inspections</h1>
        <p style={{ textAlign: "center", color: "var(--color-dark-gray)", fontSize: 13, marginBottom: 16 }}>Secure dashboard access</p>
        <div style={{ height: 4, width: "100%", background: "linear-gradient(90deg, var(--color-primary-blue), var(--color-secondary-blue))", borderRadius: 999, marginBottom: 16 }} />
        <LoginForm />
      </div>
    </main>
  );
}


