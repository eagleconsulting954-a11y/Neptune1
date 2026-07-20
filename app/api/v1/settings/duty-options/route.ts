import { NextResponse } from "next/server";
import { requireSession } from "@/src/lib/server/auth";
import { sql, type Row } from "@/src/lib/server/db";
import { canAccessModule } from "@/src/lib/plans";

const DEFAULT_OWNERS = [
  "Master",
  "Chief Officer",
  "Safety Officer",
  "Chief Engineer",
  "Second Engineer",
  "Bosun",
  "Deck Officer",
  "Duty Engineer"
];

const DEFAULT_LOCATIONS = [
  "Bridge",
  "Main Deck",
  "Cargo Deck",
  "Engine Room",
  "Workshop",
  "Pump Room",
  "Cargo Hold",
  "Accommodation",
  "Galley",
  "Ballast Tank"
];

function unique(values: unknown[]) {
  const seen = new Set<string>();
  return values
    .map(value => String(value || "").trim())
    .filter(value => value.length > 0 && value.length <= 100)
    .filter(value => {
      const key = value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

async function ensureDutySettingsSchema() {
  await sql(`
    create table if not exists organization_duty_settings (
      org_id text primary key references organizations(id) on delete cascade,
      owners jsonb not null default '[]'::jsonb,
      locations jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    )
  `);
}

async function readDutyOptions(orgId: string) {
  await ensureDutySettingsSchema();
  const [settings] = await sql<Row>("select * from organization_duty_settings where org_id=$1", [orgId]);
  const existing = await sql<Row>(`
    select owner,location from duties
    where org_id=$1 and (coalesce(owner,'')<>'' or coalesce(location,'')<>'')
    order by created_at desc
    limit 100
  `, [orgId]);

  const configuredOwners = Array.isArray(settings?.owners) ? settings.owners : [];
  const configuredLocations = Array.isArray(settings?.locations) ? settings.locations : [];
  const previousOwners = existing.map(item => item.owner);
  const previousLocations = existing.map(item => item.location);

  return {
    owners: unique([...configuredOwners, ...previousOwners, ...DEFAULT_OWNERS]),
    locations: unique([...configuredLocations, ...previousLocations, ...DEFAULT_LOCATIONS]),
    configuredOwners: unique(configuredOwners),
    configuredLocations: unique(configuredLocations),
    isConfigured: Boolean(configuredOwners.length || configuredLocations.length),
    updatedAt: settings?.updated_at || null
  };
}

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (message === "TRIAL_EXPIRED") return NextResponse.json({ error: "Your 14-day trial has ended.", code: "TRIAL_EXPIRED" }, { status: 402 });
  if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "An active Neptune subscription is required.", code: "SUBSCRIPTION_REQUIRED" }, { status: 402 });
  console.error(error);
  return NextResponse.json({ error: "Unable to load duty setup." }, { status: 500 });
}

export async function GET() {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "delegation")) {
      return NextResponse.json({ error: "Delegation is not included in this package.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }
    return NextResponse.json(await readDutyOptions(session.orgId));
  } catch (error) {
    return accessError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    if (!canAccessModule(session.entitlement.plan, "delegation")) {
      return NextResponse.json({ error: "Delegation is not included in this package.", code: "PLAN_UPGRADE_REQUIRED" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const owners = unique(Array.isArray(body.owners) ? body.owners : []);
    const locations = unique(Array.isArray(body.locations) ? body.locations : []);
    if (!owners.length || !locations.length) {
      return NextResponse.json({ error: "Add at least one duty owner and one work location." }, { status: 400 });
    }

    await ensureDutySettingsSchema();
    await sql(`
      insert into organization_duty_settings(org_id,owners,locations,updated_at)
      values($1,$2::jsonb,$3::jsonb,now())
      on conflict(org_id) do update set
        owners=excluded.owners,
        locations=excluded.locations,
        updated_at=now()
    `, [session.orgId, JSON.stringify(owners), JSON.stringify(locations)]);

    return NextResponse.json({ ok: true, ...(await readDutyOptions(session.orgId)) });
  } catch (error) {
    return accessError(error);
  }
}
