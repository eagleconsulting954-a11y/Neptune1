import { sql, type Row } from "@/src/lib/server/db";

export type EmergencyEventInput = {
  id?: string;
  vessel_id?: string | null;
  title?: string;
  status?: string;
  source_device_id?: string | null;
  started_at?: string;
  ended_at?: string | null;
  notes?: string | null;
};

export type EmergencyPositionInput = {
  id: string;
  sequence_no: number;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  altitude_m?: number | null;
  speed_mps?: number | null;
  heading_deg?: number | null;
  recorded_at: string;
};

const id = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
const eventIdPattern = /^emg_[A-Za-z0-9_-]{8,}$/;
const pointIdPattern = /^gps_[A-Za-z0-9_-]{8,}$/;

function finite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validDate(value: unknown, fallback = new Date().toISOString()) {
  const parsed = new Date(String(value || fallback));
  if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_RECORDED_AT");
  return parsed.toISOString();
}

export async function ensureEmergencySchema() {
  await sql(`
    create table if not exists emergency_events (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      vessel_id text references vessels(id) on delete set null,
      title text not null default 'Emergency GPS tracking',
      status text not null default 'Active',
      source_device_id text,
      started_at timestamptz not null default now(),
      ended_at timestamptz,
      last_latitude double precision,
      last_longitude double precision,
      last_accuracy_m numeric,
      last_fix_at timestamptz,
      point_count int not null default 0,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create table if not exists emergency_positions (
      id text primary key,
      org_id text not null references organizations(id) on delete cascade,
      event_id text not null references emergency_events(id) on delete cascade,
      sequence_no int not null,
      latitude double precision not null,
      longitude double precision not null,
      accuracy_m numeric,
      altitude_m numeric,
      speed_mps numeric,
      heading_deg numeric,
      recorded_at timestamptz not null,
      created_at timestamptz not null default now(),
      unique(event_id, sequence_no)
    );
    create index if not exists idx_emergency_events_org_started on emergency_events(org_id, started_at desc);
    create index if not exists idx_emergency_positions_event_sequence on emergency_positions(event_id, sequence_no asc);
    create index if not exists idx_emergency_positions_org_recorded on emergency_positions(org_id, recorded_at desc);
  `);
}

export async function listEmergencyEvents(orgId: string, limit = 20) {
  await ensureEmergencySchema();
  return sql(`select * from emergency_events where org_id=$1 order by started_at desc limit $2`, [orgId, Math.min(Math.max(limit, 1), 100)]);
}

export async function createEmergencyEvent(orgId: string, input: EmergencyEventInput) {
  await ensureEmergencySchema();
  const eventId = input.id && eventIdPattern.test(input.id) ? input.id : id("emg");
  const startedAt = validDate(input.started_at);
  const title = String(input.title || "Emergency GPS tracking").slice(0, 180);
  const status = String(input.status || "Active").slice(0, 40);
  const [created] = await sql(`
    insert into emergency_events(id, org_id, vessel_id, title, status, source_device_id, started_at, ended_at, notes)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict(id) do update set
      vessel_id=excluded.vessel_id,
      title=excluded.title,
      status=excluded.status,
      source_device_id=excluded.source_device_id,
      ended_at=excluded.ended_at,
      notes=excluded.notes,
      updated_at=now()
    where emergency_events.org_id=excluded.org_id
    returning *
  `, [
    eventId,
    orgId,
    input.vessel_id || null,
    title,
    status,
    input.source_device_id || null,
    startedAt,
    input.ended_at ? validDate(input.ended_at) : null,
    input.notes ? String(input.notes).slice(0, 4000) : null
  ]);
  if (!created) throw new Error("EVENT_ID_CONFLICT");
  return created;
}

export async function updateEmergencyEvent(orgId: string, input: EmergencyEventInput & { id: string }) {
  await ensureEmergencySchema();
  const allowed: Record<string, unknown> = {};
  if (Object.prototype.hasOwnProperty.call(input, "vessel_id")) allowed.vessel_id = input.vessel_id || null;
  if (Object.prototype.hasOwnProperty.call(input, "title")) allowed.title = String(input.title || "Emergency GPS tracking").slice(0, 180);
  if (Object.prototype.hasOwnProperty.call(input, "status")) allowed.status = String(input.status || "Active").slice(0, 40);
  if (Object.prototype.hasOwnProperty.call(input, "ended_at")) allowed.ended_at = input.ended_at ? validDate(input.ended_at) : null;
  if (Object.prototype.hasOwnProperty.call(input, "notes")) allowed.notes = input.notes ? String(input.notes).slice(0, 4000) : null;
  const fields = Object.keys(allowed);
  if (!fields.length) throw new Error("NO_UPDATE_FIELDS");
  const set = fields.map((field, index) => `${field}=$${index + 1}`).join(",");
  const values = fields.map(field => allowed[field]);
  values.push(input.id, orgId);
  const [updated] = await sql(`update emergency_events set ${set}, updated_at=now() where id=$${fields.length + 1} and org_id=$${fields.length + 2} returning *`, values);
  return updated || null;
}

export async function listEmergencyPositions(orgId: string, eventId: string, limit = 2000) {
  await ensureEmergencySchema();
  return sql(`
    select p.* from emergency_positions p
    join emergency_events e on e.id=p.event_id and e.org_id=p.org_id
    where p.org_id=$1 and p.event_id=$2
    order by p.sequence_no asc
    limit $3
  `, [orgId, eventId, Math.min(Math.max(limit, 1), 5000)]);
}

export async function insertEmergencyPositions(orgId: string, eventId: string, rawPositions: EmergencyPositionInput[]) {
  await ensureEmergencySchema();
  const [event] = await sql(`select id from emergency_events where id=$1 and org_id=$2 limit 1`, [eventId, orgId]);
  if (!event) throw new Error("EVENT_NOT_FOUND");

  const positions = rawPositions.slice(0, 250).map((position, index) => {
    const latitude = finite(position.latitude);
    const longitude = finite(position.longitude);
    if (latitude === null || longitude === null || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) throw new Error("INVALID_COORDINATES");
    const sequence = Number(position.sequence_no);
    if (!Number.isInteger(sequence) || sequence < 1) throw new Error("INVALID_SEQUENCE");
    return {
      id: pointIdPattern.test(String(position.id || "")) ? position.id : id(`gps${index}`),
      sequence_no: sequence,
      latitude,
      longitude,
      accuracy_m: finite(position.accuracy_m),
      altitude_m: finite(position.altitude_m),
      speed_mps: finite(position.speed_mps),
      heading_deg: finite(position.heading_deg),
      recorded_at: validDate(position.recorded_at)
    };
  });

  if (!positions.length) return { inserted: 0 };
  const params: unknown[] = [];
  const rows = positions.map(position => {
    const start = params.length;
    params.push(position.id, orgId, eventId, position.sequence_no, position.latitude, position.longitude, position.accuracy_m, position.altitude_m, position.speed_mps, position.heading_deg, position.recorded_at);
    return `(${Array.from({ length: 11 }, (_, offset) => `$${start + offset + 1}`).join(",")})`;
  });

  const inserted = await sql(`
    insert into emergency_positions(id, org_id, event_id, sequence_no, latitude, longitude, accuracy_m, altitude_m, speed_mps, heading_deg, recorded_at)
    values ${rows.join(",")}
    on conflict do nothing
    returning id
  `, params);

  await sql(`
    with latest as (
      select latitude, longitude, accuracy_m, recorded_at
      from emergency_positions
      where org_id=$1 and event_id=$2
      order by sequence_no desc
      limit 1
    ), totals as (
      select count(*)::int as point_count
      from emergency_positions
      where org_id=$1 and event_id=$2
    )
    update emergency_events e set
      last_latitude=latest.latitude,
      last_longitude=latest.longitude,
      last_accuracy_m=latest.accuracy_m,
      last_fix_at=latest.recorded_at,
      point_count=totals.point_count,
      updated_at=now()
    from latest, totals
    where e.id=$2 and e.org_id=$1
  `, [orgId, eventId]);

  return { inserted: inserted.length };
}

export type EmergencyRow = Row;
