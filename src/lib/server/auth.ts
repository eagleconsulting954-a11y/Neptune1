import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getEntitlement, type Entitlement } from "@/src/lib/server/trial";

export type Session = { userId: string; orgId: string; role: string; email?: string; exp: number };
const SESSION_COOKIE = "neptune_session_v2";
const ACCESS_COOKIE = "neptune_access_v1";

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
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSession(payload: Omit<Session, "exp">) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
}

export async function setAccessCookie(entitlement: Entitlement) {
  const jar = await cookies();
  if (!entitlement.allowed) {
    jar.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
    jar.set("neptune_paid", "", { path: "/", maxAge: 0 });
    return;
  }

  const expiresAtMs = entitlement.expiresAt
    ? new Date(entitlement.expiresAt).getTime()
    : Date.now() + 30 * 86_400_000;
  const maxAge = Math.max(1, Math.floor((expiresAtMs - Date.now()) / 1000));
  jar.set(ACCESS_COOKIE, `${entitlement.status}|${expiresAtMs}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge
  });
  jar.set("neptune_paid", "", { path: "/", maxAge: 0 });
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  jar.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  jar.set("neptune_paid", "", { path: "/", maxAge: 0 });
}

export async function requireSession(options: { allowExpired?: boolean } = {}) {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (options.allowExpired) return session;

  const entitlement = await getEntitlement(session.orgId);
  if (!entitlement.allowed) throw new Error(entitlement.reason || "SUBSCRIPTION_REQUIRED");
  return { ...session, entitlement };
}
