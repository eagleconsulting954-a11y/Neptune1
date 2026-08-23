import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import {
  CRM_STAGES,
  createCrmAccount,
  deleteCrmAccount,
  listCrmAccounts,
  updateCrmAccount
} from "@/src/lib/server/crm-admin";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your Neptune subscription is not active.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  if (message === "ADMIN_EMAIL_REQUIRED") return NextResponse.json({ error: "CRM access is restricted to the two designated Neptune administrator emails." }, { status: 403 });
  if (message === "CRM_NOT_FOUND") return NextResponse.json({ error: "CRM opportunity not found." }, { status: 404 });
  if (message === "CRM_NO_CHANGES") return NextResponse.json({ error: "No CRM changes were supplied." }, { status: 400 });
  if (message === "CRM_COMPANY_REQUIRED") return NextResponse.json({ error: "Company is required." }, { status: 400 });
  if (message === "CRM_EMAIL_INVALID") return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (message === "CRM_STAGE_INVALID") return NextResponse.json({ error: "Select a valid pipeline stage." }, { status: 400 });
  if (message.includes("_INVALID")) return NextResponse.json({ error: "One or more CRM values are invalid." }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete the CRM request." }, { status: 500 });
}

async function adminSession() {
  const session = await requireSession();
  if (!isDesignatedAdminEmail(session.email)) throw new Error("ADMIN_EMAIL_REQUIRED");
  return session;
}

export async function GET() {
  try {
    const session = await adminSession();
    return NextResponse.json({ items: await listCrmAccounts(session.orgId), stages: CRM_STAGES });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await adminSession();
    const body = await request.json().catch(() => ({}));
    const item = await createCrmAccount(session, body, request);
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await adminSession();
    const body = await request.json().catch(() => ({}));
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    const item = await updateCrmAccount(session, id, body, request);
    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await adminSession();
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });
    await deleteCrmAccount(session, id, request);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
