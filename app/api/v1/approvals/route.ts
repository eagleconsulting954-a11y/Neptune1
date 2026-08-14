import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { createApprovalRequest, listApprovalRequests, reviseApproval, signApproval } from "@/src/lib/server/approvals";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Login required." }, { status: 401 });
  if (message === "TRIAL_EXPIRED" || message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active Neptune access is required." }, { status: 402 });
  if (message === "VESSEL_PERMISSION_REQUIRED") return NextResponse.json({ error: "Your organization role does not permit this approval for the selected vessel." }, { status: 403 });
  if (message === "APPROVAL_ROLE_REQUIRED") return NextResponse.json({ error: "This sign-off requires the configured approver role or an organization manager." }, { status: 403 });
  if (message === "APPROVAL_EDIT_REQUIRED") return NextResponse.json({ error: "Only the requester or an organization manager may revise this approval." }, { status: 403 });
  if (message === "APPROVAL_NOT_FOUND") return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
  if (["APPROVAL_TITLE_REQUIRED", "APPROVAL_DECISION_INVALID", "APPROVAL_ALREADY_FINAL", "APPROVAL_ACKNOWLEDGMENT_REQUIRED", "APPROVAL_STATUS_INVALID"].includes(message)) return NextResponse.json({ error: message.replaceAll("_", " ").toLowerCase() }, { status: 400 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete the approval workflow." }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const limit = Number(new URL(request.url).searchParams.get("limit") || 200);
    return NextResponse.json({ items: await listApprovalRequests(session, limit) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const item = await createApprovalRequest({
      session,
      vesselId: body.vesselId || null,
      resourceType: body.resourceType || null,
      resourceId: body.resourceId || null,
      title: String(body.title || ""),
      description: body.description || null,
      requiredRole: body.requiredRole || null,
      dueAt: body.dueAt || null,
      request
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    if (!body.requestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    const result = await signApproval({
      session,
      requestId: String(body.requestId),
      decision: String(body.decision || ""),
      comment: body.comment || null,
      acknowledgment: String(body.acknowledgment || ""),
      request
    });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    if (!body.requestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });
    const item = await reviseApproval({
      session,
      requestId: String(body.requestId),
      description: body.description,
      dueAt: body.dueAt,
      request
    });
    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}
