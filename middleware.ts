import { NextResponse, type NextRequest } from "next/server";

function accessIsValid(value?: string) {
  if (!value) return false;
  const [status, expiresAtRaw] = value.split("|");
  const expiresAt = Number(expiresAtRaw);
  if (!["trialing", "active"].includes(status)) return false;
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > Date.now();
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  if (!protectedRoute) return NextResponse.next();

  const session = request.cookies.get("neptune_session_v2")?.value;
  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  const access = request.cookies.get("neptune_access_v1")?.value;
  if (!accessIsValid(access)) {
    const url = new URL("/trial-expired", request.url);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/admin/:path*"] };
