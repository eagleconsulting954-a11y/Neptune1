import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getEntitlement, type Entitlement } from "@/src/lib/server/trial";
import { createAuthSession, revokeAuthSession, validateAuthSession } from "@/src/lib/server/security";

export type Session = { userId: string; orgId: string; role: string; email?: string; sessionId?: string; exp: number };
export type ProtectedSession = Session & { entitlement: Entitlement };
const SESSION_COOKIE = "neptune_session_v2";
const ACCESS_COOKIE = "neptune_access_v1";

function secret() {
  return process.env.AUTH_SECRET || "development-secret-change-before-production";
}

function signature(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function tokenWithExpiry(payload: Omit<Session, "exp">, exp: number) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString("base64url");
  return `${body}.${signature(body)}`;
}

export function createToken(payload: Omit<Session, "exp">, hours = 12) {
  return tokenWithExpiry(payload, Date.now() + hours * 60 * 60 * 1000);
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
  const session = verifyToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  if (session.sessionId) {
    try {
      if (!await validateAuthSession(session.sessionId, session.userId)) return null;
    } catch {
      return null;
    }
  }
  return session;
}

export async function setSession(
  payload: Omit<Session, "exp" | "sessionId">,
  options: { userAgent?: string | null; ip?: string | null; deviceLabel?: string | null; persist?: boolean } = {}
) {
  const jar = await cookies();
  let exp = Date.now() + 12 * 60 * 60 * 1000;
  let sessionId: string | undefined;

  if (options.persist !== false) {
    const record = await createAuthSession({
      userId: payload.userId,
      orgId: payload.orgId,
      userAgent: options.userAgent,
      ip: options.ip,
      deviceLabel: options.deviceLabel,
      hours: 12
    });
    sessionId = record.id;
    exp = record.exp;
  }

  jar.set(SESSION_COOKIE, tokenWithExpiry({ ...payload, sessionId }, exp), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12
  });
  return sessionId || null;
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
  const current = verifyToken(jar.get(SESSION_COOKIE)?.value);
  if (current?.sessionId) {
    try { await revokeAuthSession(current.sessionId, current.userId); } catch {}
  }
  jar.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  jar.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  jar.set("neptune_paid", "", { path: "/", maxAge: 0 });
}

export function requireSession(): Promise<ProtectedSession>;
export function requireSession(options: { allowExpired: true }): Promise<Session>;
export async function requireSession(options: { allowExpired?: boolean } = {}): Promise<Session | ProtectedSession> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (options.allowExpired) return session;

  const entitlement = await getEntitlement(session.orgId);
  if (!entitlement.allowed) throw new Error(entitlement.reason || "SUBSCRIPTION_REQUIRED");
  return { ...session, entitlement };
}
