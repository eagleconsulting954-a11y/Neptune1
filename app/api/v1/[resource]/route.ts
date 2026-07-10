import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { createResource, deleteResource, listResource, updateResource, type ResourceName } from "@/src/lib/server/db";

const allowed = new Set<ResourceName>(["vessels", "duties", "work_orders", "certificates", "incidents", "crm_accounts", "activity_events", "subscriptions"]);

async function resourceFrom(context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!allowed.has(resource as ResourceName)) throw new Error("NOT_FOUND");
  return resource as ResourceName;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "NOT_FOUND") return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete request" }, { status: 500 });
}

export async function GET(_: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    return NextResponse.json({ items: await listResource(resource, session.orgId) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    const body = await request.json();
    return NextResponse.json({ item: await createResource(resource, session.orgId, body) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const item = await updateResource(resource, session.orgId, body.id, body);
    return item ? NextResponse.json({ item }) : NextResponse.json({ error: "Record not found" }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    return NextResponse.json({ ok: await deleteResource(resource, session.orgId, id) });
  } catch (error) {
    return errorResponse(error);
  }
}
