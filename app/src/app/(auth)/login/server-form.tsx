import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setSession } from "@/lib/auth/session";
import { apiFetch } from "@/lib/http";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "").trim();
  if (!email || !password) {
    return { error: "Email and password are required" };
  }
  // Authenticate via Kong → Directus (or upstream auth service)
  const res = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  const token = (() => {
    if (data?.token) return data.token;
    if (data?.access_token) return data.access_token;
    if (data?.data?.token) return data.data.token;
    if (data?.data?.access_token) return data.data.access_token;
    return null;
  })();

  await setSession({
    user: { id: data.user?.id ?? "", email: data.user?.email ?? email, name: data.user?.name },
    token,
  });
  revalidatePath("/");
  redirect("/dashboard");
}

export default function LoginForm() {
  return (
    <form action={loginAction} style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 500 }}>Email</span>
        <input
          type="email"
          name="email"
          placeholder="you@example.com"
          required
          style={{
            border: `1px solid var(--color-light-gray)`,
            borderRadius: 6,
            padding: "10px 12px",
            outline: "none",
            transition: "border-color .15s ease, box-shadow .15s ease",
          }}
        />
      </label>
      <label style={{ display: "grid", gap: 6 }}>
        <span style={{ fontWeight: 500 }}>Password</span>
        <input
          type="password"
          name="password"
          required
          style={{
            border: `1px solid var(--color-light-gray)`,
            borderRadius: 6,
            padding: "10px 12px",
            outline: "none",
            transition: "border-color .15s ease, box-shadow .15s ease",
          }}
        />
      </label>
      <button
        type="submit"
        style={{
          background: "var(--color-primary-blue)",
          color: "white",
          border: 0,
          borderRadius: 6,
          padding: "10px 14px",
          cursor: "pointer",
          fontWeight: 600,
          transition: "background-color .15s ease",
        }}
      >
        Sign in
      </button>
    </form>
  );
}


