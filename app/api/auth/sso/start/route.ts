import { NextResponse } from "next/server";
import { beginOidcSso, oidcConfigured } from "@/src/lib/server/oidc-sso";

export async function GET(request: Request) {
  try {
    if (!oidcConfigured()) return NextResponse.json({ error: "Enterprise SSO is not configured for this deployment." }, { status: 503 });
    const returnTo = new URL(request.url).searchParams.get("from") || "/dashboard";
    return NextResponse.redirect(await beginOidcSso(returnTo));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unable to start enterprise SSO." }, { status: 500 });
  }
}
