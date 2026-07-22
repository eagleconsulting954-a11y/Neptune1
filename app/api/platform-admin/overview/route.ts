import { NextResponse } from "next/server";
import { getSession } from "@/src/lib/server/auth";
import { getPlatformOverview, setErrorResolved } from "@/src/lib/server/platform-admin";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";

async function requireDesignatedAdmin() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  if (!isDesignatedAdminEmail(session.email)) throw new Error("FORBIDDEN");
  return session;
}

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "FORBIDDEN") return NextResponse.json({ error: "Platform administrator access is restricted to the designated admin email." }, { status: 403 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "DATABASE_URL is required for platform analytics." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to load platform analytics." }, { status: 500 });
}

export async function GET() {
  try {
    await requireDesignatedAdmin();
    return NextResponse.json(await getPlatformOverview());
  } catch (error) {
    return accessError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await requireDesignatedAdmin();
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
