import { createHash, randomUUID } from "crypto";
import { getSession } from "@/src/lib/server/auth";
import { ensureSchema, hasDatabase, sql, type Row } from "@/src/lib/server/db";

export type SystemErrorInput = {
  orgId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  source?: "client" | "server" | "api" | "webhook";
  severity?: "info" | "warning" | "error" | "critical";
  route?: string | null;
  method?: string | null;
  message: string;
  stack?: string | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown> | null;
};

function platformEmails() {
  return [process.env.PLATFORM_ADMIN_EMAILS, process.env.NEPTUNE_OWNER_EMAIL]
    .filter(Boolean)
    .join(",")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export async function requirePlatformAdmin() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  const roleAllowed = ["platform_admin", "owner", "super_admin"].includes(String(session.role).toLowerCase());
  const emailAllowed = Boolean(session.email && platformEmails().includes(session.email.toLowerCase()));
  if (!roleAllowed && !emailAllowed) throw new Error("FORBIDDEN");
  return session;
}

export async function ensurePlatformSchema() {
  if (!hasDatabase()) return { ok: false, mode: "unconfigured" };
  await ensureSchema();
  await sql(`
    create table if not exists system_errors (
      id text primary key,
      org_id text,
      user_id text,
      user_email text,
      source text not null default 'server',
      severity text not null default 'error',
      route text,
      method text,
      message text not null,
      stack text,
      status_code int,
      fingerprint text,
      metadata jsonb,
      resolved_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_system_errors_created on system_errors(created_at desc);
    create index if not exists idx_system_errors_unresolved on system_errors(resolved_at, created_at desc);
    create index if not exists idx_system_errors_fingerprint on system_errors(fingerprint, created_at desc);
  `);
  return { ok: true, mode: "postgres" };
}

function clean(value: unknown, max = 4000) {
  return String(value || "").replace(/\u0000/g, "").slice(0, max);
}

export async function recordSystemError(input: SystemErrorInput) {
  if (!hasDatabase()) return null;
  try {
    await ensurePlatformSchema();
    const message = clean(input.message, 2000) || "Unknown application error";
    const route = clean(input.route, 500) || null;
    const stack = clean(input.stack, 12000) || null;
    const fingerprint = createHash("sha256")
      .update([input.source || "server", route || "", message].join("|"))
      .digest("hex")
      .slice(0, 24);
    const id = `err_${randomUUID()}`;
    const [created] = await sql(
      `insert into system_errors(
        id,org_id,user_id,user_email,source,severity,route,method,message,stack,status_code,fingerprint,metadata
      ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *`,
      [
        id,
        input.orgId || null,
        input.userId || null,
        clean(input.userEmail, 320) || null,
        input.source || "server",
        input.severity || "error",
        route,
        clean(input.method, 16) || null,
        message,
        stack,
        input.statusCode || null,
        fingerprint,
        input.metadata || null
      ]
    );
    return created || null;
  } catch (error) {
    console.error("Unable to persist system error", error);
    return null;
  }
}

function configHealth() {
  return [
    { key: "database", label: "PostgreSQL", configured: Boolean(process.env.DATABASE_URL), critical: true },
    { key: "auth", label: "Authentication secret", configured: Boolean(process.env.AUTH_SECRET), critical: true },
    { key: "app_url", label: "Production application URL", configured: Boolean(process.env.NEXT_PUBLIC_APP_URL), critical: true },
    { key: "stripe", label: "Stripe billing", configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), critical: false },
    { key: "weather", label: "Weather and ocean provider", configured: Boolean(process.env.OPEN_METEO_WEATHER_BASE_URL || "https://api.open-meteo.com/v1/forecast"), critical: false },
    { key: "congestion", label: "Port congestion provider", configured: Boolean(process.env.MARINETRAFFIC_API_KEY && process.env.MARINETRAFFIC_PORT_CONGESTION_URL), critical: false },
    { key: "bunker", label: "Bunker price provider", configured: Boolean(process.env.BUNKER_PRICE_API_URL), critical: false },
    { key: "owner", label: "Platform administrator", configured: platformEmails().length > 0, critical: true }
  ];
}

export async function getPlatformOverview() {
  await ensurePlatformSchema();

  const [signupSummary] = await sql<Row>(`
    select
      count(*)::int as total_organizations,
      count(*) filter (where created_at >= current_date)::int as signups_today,
      count(*) filter (where created_at >= now() - interval '7 days')::int as signups_7d,
      count(*) filter (where created_at >= now() - interval '30 days')::int as signups_30d
    from organizations
  `);

  const [subscriptionSummary] = await sql<Row>(`
    select
      count(*) filter (where lower(status) in ('trial','trialing') and current_period_end::timestamptz > now())::int as active_trials,
      count(*) filter (where lower(status) in ('trial','trialing') and (current_period_end is null or current_period_end::timestamptz <= now()))::int as expired_trials,
      count(*) filter (where lower(status) = 'active' and (current_period_end is null or current_period_end::timestamptz > now()))::int as active_paid,
      count(*) filter (where lower(status) in ('past_due','unpaid','canceled','cancelled','incomplete'))::int as billing_attention
    from subscriptions
  `);

  const [bugSummary] = await sql<Row>(`
    select
      count(*) filter (where resolved_at is null)::int as unresolved,
      count(*) filter (where resolved_at is null and severity = 'critical')::int as critical,
      count(*) filter (where created_at >= now() - interval '1 hour')::int as last_hour,
      count(*) filter (where created_at >= now() - interval '24 hours')::int as last_24h
    from system_errors
  `);

  const signupTrend = await sql<Row>(`
    with dates as (
      select generate_series(current_date - interval '13 days', current_date, interval '1 day')::date as day
    )
    select to_char(d.day, 'Mon DD') as label,
      count(o.id)::int as signups
    from dates d
    left join organizations o on o.created_at >= d.day and o.created_at < d.day + interval '1 day'
    group by d.day
    order by d.day
  `);

  const statusDistribution = await sql<Row>(`
    select
      case
        when lower(s.status) in ('trial','trialing') and s.current_period_end::timestamptz > now() then 'Active trial'
        when lower(s.status) in ('trial','trialing') then 'Expired trial'
        when lower(s.status) = 'active' then 'Paid active'
        else initcap(coalesce(s.status,'No subscription'))
      end as status,
      count(*)::int as count
    from organizations o
    left join lateral (
      select * from subscriptions s2 where s2.org_id=o.id order by s2.created_at desc limit 1
    ) s on true
    group by 1
    order by count(*) desc
  `);

  const recentSignups = await sql<Row>(`
    select
      o.id,
      o.name,
      o.created_at,
      u.name as admin_name,
      u.email as admin_email,
      s.plan,
      s.status,
      s.current_period_end,
      (select count(*)::int from vessels v where v.org_id=o.id) as vessels,
      (select count(*)::int from duties d where d.org_id=o.id) as duties,
      (select count(*)::int from ports p where p.org_id=o.id) as ports
    from organizations o
    left join lateral (
      select name,email from users u2 where u2.org_id=o.id order by case when u2.role='admin' then 0 else 1 end, u2.created_at limit 1
    ) u on true
    left join lateral (
      select plan,status,current_period_end from subscriptions s2 where s2.org_id=o.id order by s2.created_at desc limit 1
    ) s on true
    order by o.created_at desc
    limit 100
  `);

  const recentErrors = await sql<Row>(`
    select id,org_id,user_email,source,severity,route,method,message,status_code,fingerprint,metadata,resolved_at,created_at
    from system_errors
    order by created_at desc
    limit 100
  `);

  const topErrors = await sql<Row>(`
    select fingerprint,max(message) as message,max(route) as route,count(*)::int as occurrences,max(created_at) as last_seen
    from system_errors
    where created_at >= now() - interval '7 days'
    group by fingerprint
    order by occurrences desc,last_seen desc
    limit 10
  `);

  const totalOrganizations = Number(signupSummary?.total_organizations || 0);
  const activePaid = Number(subscriptionSummary?.active_paid || 0);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalOrganizations,
      signupsToday: Number(signupSummary?.signups_today || 0),
      signups7d: Number(signupSummary?.signups_7d || 0),
      signups30d: Number(signupSummary?.signups_30d || 0),
      activeTrials: Number(subscriptionSummary?.active_trials || 0),
      expiredTrials: Number(subscriptionSummary?.expired_trials || 0),
      activePaid,
      billingAttention: Number(subscriptionSummary?.billing_attention || 0),
      conversionRate: totalOrganizations ? Number(((activePaid / totalOrganizations) * 100).toFixed(1)) : 0,
      unresolvedBugs: Number(bugSummary?.unresolved || 0),
      criticalBugs: Number(bugSummary?.critical || 0),
      bugsLastHour: Number(bugSummary?.last_hour || 0),
      bugsLast24h: Number(bugSummary?.last_24h || 0)
    },
    signupTrend,
    statusDistribution,
    recentSignups,
    recentErrors,
    topErrors,
    health: configHealth()
  };
}

export async function setErrorResolved(id: string, resolved: boolean) {
  await ensurePlatformSchema();
  const [updated] = await sql(
    `update system_errors set resolved_at=${resolved ? "now()" : "null"} where id=$1 returning *`,
    [id]
  );
  return updated || null;
}
