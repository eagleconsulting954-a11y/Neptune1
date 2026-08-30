import { NextResponse, type NextRequest } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set([
  "/api/stripe/webhook"
]);

function accessIsValid(value?: string) {
  if (!value) return false;
  const [status, expiresAtRaw] = value.split("|");
  const expiresAt = Number(expiresAtRaw);
  if (!["trialing", "active"].includes(status)) return false;
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now();
}

function trustedOrigins(request: NextRequest) {
  const values = new Set<string>([request.nextUrl.origin]);
  const configured = String(process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) {
    try { values.add(new URL(configured).origin); } catch {}
  }
  return values;
}

function csrfRejection(request: NextRequest) {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return null;
  if (CSRF_EXEMPT_PATHS.has(request.nextUrl.pathname)) return null;

  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return NextResponse.json({ error: "Cross-site mutation rejected.", code: "CSRF_REJECTED" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let normalizedOrigin = "";
    try { normalizedOrigin = new URL(origin).origin; } catch {
      return NextResponse.json({ error: "Invalid request origin.", code: "CSRF_REJECTED" }, { status: 403 });
    }
    if (!trustedOrigins(request).has(normalizedOrigin)) {
      return NextResponse.json({ error: "Request origin is not trusted.", code: "CSRF_REJECTED" }, { status: 403 });
    }
  }

  return null;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith("/api/")) {
    const rejected = csrfRejection(request);
    return rejected || NextResponse.next();
  }

  const tenantRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/ai-governance") ||
    pathname.startsWith("/security-center") ||
    pathname.startsWith("/passkeys");
  const platformRoute = pathname.startsWith("/platform-admin");
  if (!tenantRoute && !platformRoute) return NextResponse.next();

  const session = request.cookies.get("neptune_session_v2")?.value;
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (platformRoute) return NextResponse.next();

  const access = request.cookies.get("neptune_access_v1")?.value;
  if (!accessIsValid(access)) {
    const url = new URL("/trial-expired", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/admin/:path*",
    "/ai-governance/:path*",
    "/platform-admin/:path*",
    "/security-center/:path*",
    "/passkeys/:path*"
  ]
};
