import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { findUserByEmail } from "@/src/lib/server/db";

const SSO_COOKIE = "neptune_oidc_state_v1";
const SSO_TTL_SECONDS = 10 * 60;

type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  code_challenge_methods_supported?: string[];
};

type StatePayload = {
  state: string;
  verifier: string;
  returnTo: string;
  createdAt: number;
};

function required(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`SSO_CONFIG_REQUIRED:${name}`);
  return value;
}

export function oidcConfigured() {
  return Boolean(process.env.OIDC_ISSUER_URL && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.NEXT_PUBLIC_APP_URL);
}

function secret() {
  return process.env.AUTH_SECRET || "development-secret-change-before-production";
}

function safeReturnTo(value: unknown) {
  const path = String(value || "/dashboard");
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function encodeState(payload: StatePayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeState(value?: string | null): StatePayload | null {
  try {
    if (!value) return null;
    const [body, supplied] = value.split(".");
    if (!body || !supplied) return null;
    const expected = sign(body);
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as StatePayload;
    if (!payload.state || !payload.verifier || Date.now() - payload.createdAt > SSO_TTL_SECONDS * 1000) return null;
    return { ...payload, returnTo: safeReturnTo(payload.returnTo) };
  } catch {
    return null;
  }
}

function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function discovery(): Promise<OidcDiscovery> {
  const issuer = required("OIDC_ISSUER_URL").replace(/\/$/, "");
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error(`SSO_DISCOVERY_FAILED:${response.status}`);
  const metadata = await response.json() as OidcDiscovery;
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.issuer) throw new Error("SSO_DISCOVERY_INVALID");
  if (new URL(metadata.issuer).origin !== new URL(issuer).origin) throw new Error("SSO_ISSUER_MISMATCH");
  if (metadata.code_challenge_methods_supported && !metadata.code_challenge_methods_supported.includes("S256")) throw new Error("SSO_PKCE_S256_REQUIRED");
  return metadata;
}

function callbackUrl() {
  return `${required("NEXT_PUBLIC_APP_URL").replace(/\/$/, "")}/api/auth/sso/callback`;
}

export async function beginOidcSso(returnTo?: string | null) {
  if (!oidcConfigured()) throw new Error("SSO_NOT_CONFIGURED");
  const metadata = await discovery();
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const jar = await cookies();
  jar.set(SSO_COOKIE, encodeState({ state, verifier, returnTo: safeReturnTo(returnTo), createdAt: Date.now() }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/sso",
    maxAge: SSO_TTL_SECONDS
  });
  const url = new URL(metadata.authorization_endpoint);
  url.searchParams.set("client_id", required("OIDC_CLIENT_ID"));
  url.searchParams.set("redirect_uri", callbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", String(process.env.OIDC_SCOPES || "openid email profile"));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function finishOidcSso(input: { code: string; state: string }) {
  if (!oidcConfigured()) throw new Error("SSO_NOT_CONFIGURED");
  const jar = await cookies();
  const stored = decodeState(jar.get(SSO_COOKIE)?.value);
  jar.set(SSO_COOKIE, "", { path: "/api/auth/sso", maxAge: 0 });
  if (!stored || !input.state || input.state !== stored.state) throw new Error("SSO_STATE_INVALID");
  const metadata = await discovery();
  if (!metadata.userinfo_endpoint) throw new Error("SSO_USERINFO_REQUIRED");

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: callbackUrl(),
    client_id: required("OIDC_CLIENT_ID"),
    client_secret: required("OIDC_CLIENT_SECRET"),
    code_verifier: stored.verifier
  });
  const tokenResponse = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: tokenBody,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  const token = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!tokenResponse.ok || !token.access_token) throw new Error(`SSO_TOKEN_EXCHANGE_FAILED:${tokenResponse.status}`);

  const userResponse = await fetch(metadata.userinfo_endpoint, {
    headers: { authorization: `Bearer ${String(token.access_token)}`, accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000)
  });
  const profile = await userResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!userResponse.ok) throw new Error(`SSO_USERINFO_FAILED:${userResponse.status}`);
  const email = String(profile.email || "").trim().toLowerCase();
  if (!email || profile.email_verified === false) throw new Error("SSO_VERIFIED_EMAIL_REQUIRED");
  const user = await findUserByEmail(email);
  if (!user || user.is_active === false || !user.email_verified_at) throw new Error("SSO_ACCOUNT_NOT_PROVISIONED");
  return { user, profile, returnTo: stored.returnTo };
}
