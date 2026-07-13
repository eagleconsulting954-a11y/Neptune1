import { NextResponse } from "next/server";
import { getPlatformOverview, requirePlatformAdmin, setErrorResolved } from "@/src/lib/server/platform-admin";

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Platform administrator access required." }, { status: 403 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "DATABASE_URL is required for platform analytics." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to load platform analytics." }, { status: 500 });
}

export async function GET() {
  try {
    await requirePlatformAdmin();
    return NextResponse.json(await getPlatformOverview());
  } catch (error) {
    return accessError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requirePlatformAdmin();
    const body = await request.json();
    if (!body.id || typeof body.resolved !== "boolean") {
      return NextResponse.json({ error: "id and resolved are required." }, { status: 400 });
    }
    const item = await setErrorResolved(String(body.id), body.resolved);
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: "Bug record not found." }, { status: 404 });
  } catch (error) {
    return accessError(error);
  }
}
