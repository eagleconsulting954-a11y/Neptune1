import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { createResource, deleteResource, listResource, updateResource, type ResourceName } from "@/src/lib/server/db";
import { canAccessResource, planDefinition } from "@/src/lib/plans";
import { isDesignatedAdminEmail } from "@/src/lib/server/admin-access";
import { assertResourceWriteAccess, scopeResourceRows } from "@/src/lib/server/org-access";
import { recordAuditEvent } from "@/src/lib/server/security";

const allowed = new Set<ResourceName>([
  "vessels",
  "duties",
  "work_orders",
  "certificates",
  "incidents",
  "crm_accounts",
  "activity_events",
  "subscriptions",
  "ports",
  "bunker_plans",
  "mrcc_contacts",
  "port_congestion_snapshots"
]);

async function resourceFrom(context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  if (!allowed.has(resource as ResourceName)) throw new Error("NOT_FOUND");
  return resource as ResourceName;
}

function assertPlanAccess(plan: string, resource: ResourceName, email?: string) {
  if (resource === "crm_accounts" && isDesignatedAdminEmail(email)) return;
  if (!canAccessResource(plan, resource)) throw new Error("PLAN_UPGRADE_REQUIRED");
}

function assertIdentityAccess(email: string | undefined, resource: ResourceName) {
  if (resource === "crm_accounts" && !isDesignatedAdminEmail(email)) throw new Error("ADMIN_EMAIL_REQUIRED");
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  if (message === "ADMIN_EMAIL_REQUIRED") return NextResponse.json({ error: "CRM access is restricted to the two designated Neptune administrator emails.", code: "ADMIN_EMAIL_REQUIRED" }, { status: 403 });
  if (message === "VESSEL_PERMISSION_REQUIRED") return NextResponse.json({ error: "Your organization role does not permit changes to this vessel record.", code: "VESSEL_PERMISSION_REQUIRED" }, { status: 403 });
  if (message === "PLAN_UPGRADE_REQUIRED") return NextResponse.json({ error: "This module is not included in your current package. Upgrade to Full Vessel Access to unlock the complete operating suite.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
  if (message === "VESSEL_LIMIT_REACHED") return NextResponse.json({ error: "The Captain package supports one vessel. Upgrade to FleetOps or Full Vessel Access to add more vessels.", code: "VESSEL_LIMIT_REACHED" }, { status: 403 });
  if (message === "NOT_FOUND") return NextResponse.json({ error: "Unknown resource" }, { status: 404 });
  if (message === "DATABASE_REQUIRED") return NextResponse.json({ error: "Persistent database is not configured. Add DATABASE_URL before creating real records." }, { status: 503 });
  console.error(error);
  return NextResponse.json({ error: "Unable to complete request" }, { status: 500 });
}

export async function GET(_: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    assertIdentityAccess(session.email, resource);
    assertPlanAccess(session.entitlement.plan, resource, session.email);
    const rows = await listResource(resource, session.orgId);
    return NextResponse.json({ items: await scopeResourceRows(session, resource, rows) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    assertIdentityAccess(session.email, resource);
    assertPlanAccess(session.entitlement.plan, resource, session.email);
    const body = await request.json();
    await assertResourceWriteAccess(session, resource, body);

    if (resource === "vessels") {
      const definition = planDefinition(session.entitlement.plan);
      const maxVessels = definition.limits.vessels;
      if (maxVessels !== null) {
        const existing = await listResource("vessels", session.orgId);
        if (existing.length >= maxVessels) throw new Error("VESSEL_LIMIT_REACHED");
      }
    }

    const item = await createResource(resource, session.orgId, body);
    await recordAuditEvent({ session, action: `${resource}.created`, entityType: resource, entityId: item.id, route: `/api/v1/${resource}`, method: "POST", request, metadata: { offlineId: body.id?.startsWith?.("offline_") ? body.id : undefined } });
    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    assertIdentityAccess(session.email, resource);
    assertPlanAccess(session.entitlement.plan, resource, session.email);
    const body = await request.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const existing = (await listResource(resource, session.orgId)).find(row => String(row.id) === String(body.id)) || null;
    if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    await assertResourceWriteAccess(session, resource, body, existing);
    const item = await updateResource(resource, session.orgId, body.id, body);
    if (!item) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    await recordAuditEvent({ session, action: `${resource}.updated`, entityType: resource, entityId: item.id, route: `/api/v1/${resource}`, method: "PATCH", request, metadata: { changedFields: Object.keys(body).filter(key => key !== "id") } });
    return NextResponse.json({ item });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ resource: string }> }) {
  try {
    const session = await requireSession();
    const resource = await resourceFrom(context);
    assertIdentityAccess(session.email, resource);
    assertPlanAccess(session.entitlement.plan, resource, session.email);
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const existing = (await listResource(resource, session.orgId)).find(row => String(row.id) === id) || null;
    if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    await assertResourceWriteAccess(session, resource, { id }, existing);
    const ok = await deleteResource(resource, session.orgId, id);
    if (ok) await recordAuditEvent({ session, action: `${resource}.deleted`, entityType: resource, entityId: id, route: `/api/v1/${resource}`, method: "DELETE", request });
    return NextResponse.json({ ok });
  } catch (error) {
    return errorResponse(error);
  }
}
