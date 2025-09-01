import { cookies } from "next/headers";

export type Session = {
  user?: {
    id: string;
    email: string;
    name?: string;
  } | null;
  token?: string | null;
};

const COOKIE_NAME = "oi_session";

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    try {
      console.log("[session] getSession ok", { hasUser: Boolean(parsed?.user), hasToken: Boolean(parsed?.token) });
    } catch {}
    return parsed;
  } catch {
    try { console.warn("[session] getSession failed to parse JSON"); } catch {}
    return null;
  }
}

export async function setSession(session: Session) {
  const cookieStore = await cookies();
  try {
    console.log("[session] setSession", { hasUser: Boolean(session?.user), hasToken: Boolean(session?.token) });
  } catch {}
  cookieStore.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}


