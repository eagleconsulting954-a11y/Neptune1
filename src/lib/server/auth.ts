import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type Session = { userId: string; orgId: string; role: string; email?: string; exp: number };
const COOKIE = "neptune_session_v2";

function secret() {
  return process.env.AUTH_SECRET || "development-secret-change-before-production";
}

function signature(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createToken(payload: Omit<Session, "exp">, hours = 12) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + hours * 60 * 60 * 1000 })).toString("base64url");
  return `${body}.${signature(body)}`;
}

export function verifyToken(token?: string | null): Session | null {
  try {
    if (!token) return null;
    const [body, provided] = token.split(".");
    if (!body || !provided) return null;
    const expected = signature(body);
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export async function getSession() {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

export async function setSession(payload: Omit<Session, "exp">) {
  const jar = await cookies();
  jar.set(COOKIE, createToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { path: "/", maxAge: 0 });
  jar.set("neptune_paid", "", { path: "/", maxAge: 0 });
}

export async function requireSession() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}
