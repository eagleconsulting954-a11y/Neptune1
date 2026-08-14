import type { Pool } from "pg";

const migrations = [
  {
    id: "20260813_001_enterprise_identity_security",
    sql: `
      alter table users add column if not exists email_verified_at timestamptz;
      alter table users add column if not exists is_active boolean not null default true;
      alter table users add column if not exists mfa_enabled boolean not null default false;
      alter table users add column if not exists mfa_secret_enc text;
      alter table users add column if not exists last_login_at timestamptz;
      alter table users add column if not exists updated_at timestamptz not null default now();
      update users set email_verified_at=coalesce(email_verified_at,created_at) where email_verified_at is null;

      alter table organizations add column if not exists updated_at timestamptz not null default now();

      create table if not exists email_verification_tokens (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        token_hash text unique not null,
        expires_at timestamptz not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_email_verification_user on email_verification_tokens(user_id,created_at desc);
      create index if not exists idx_email_verification_expiry on email_verification_tokens(expires_at);

      create table if not exists auth_sessions (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        org_id text not null references organizations(id) on delete cascade,
        user_agent text,
        ip_hash text,
        device_label text,
        last_seen_at timestamptz not null default now(),
        expires_at timestamptz not null,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_auth_sessions_user on auth_sessions(user_id,revoked_at,expires_at);
      create index if not exists idx_auth_sessions_org on auth_sessions(org_id,last_seen_at desc);

      create table if not exists auth_login_attempts (
        key text primary key,
        failures int not null default 0,
        first_failed_at timestamptz not null default now(),
        last_failed_at timestamptz not null default now(),
        locked_until timestamptz
      );

      create table if not exists mfa_recovery_codes (
        id text primary key,
        user_id text not null references users(id) on delete cascade,
        code_hash text not null,
        used_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_mfa_recovery_user on mfa_recovery_codes(user_id,used_at);

      create table if not exists user_invitations (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        email text not null,
        role text not null default 'member',
        vessel_ids jsonb not null default '[]'::jsonb,
        invited_by text references users(id) on delete set null,
        token_hash text unique not null,
        expires_at timestamptz not null,
        accepted_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_user_invitations_org on user_invitations(org_id,created_at desc);
      create index if not exists idx_user_invitations_email on user_invitations(lower(email),expires_at);

      create table if not exists user_vessel_permissions (
        user_id text not null references users(id) on delete cascade,
        vessel_id text not null references vessels(id) on delete cascade,
        org_id text not null references organizations(id) on delete cascade,
        can_view boolean not null default true,
        can_edit boolean not null default false,
        created_at timestamptz not null default now(),
        primary key(user_id,vessel_id)
      );
      create index if not exists idx_user_vessel_permissions_org on user_vessel_permissions(org_id,user_id);

      create table if not exists audit_events (
        id text primary key,
        org_id text references organizations(id) on delete set null,
        user_id text references users(id) on delete set null,
        user_email text,
        action text not null,
        entity_type text,
        entity_id text,
        route text,
        method text,
        success boolean not null default true,
        source text not null default 'web',
        ip_hash text,
        user_agent text,
        metadata jsonb,
        created_at timestamptz not null default now()
      );
      create index if not exists idx_audit_events_org_created on audit_events(org_id,created_at desc);
      create index if not exists idx_audit_events_user_created on audit_events(user_id,created_at desc);
      create index if not exists idx_audit_events_action on audit_events(action,created_at desc);

      create table if not exists managed_devices (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        user_id text references users(id) on delete set null,
        device_key text not null,
        label text,
        platform text,
        user_agent text,
        app_version text,
        installed boolean not null default false,
        offline_capable boolean not null default false,
        gps_permission text,
        storage_bytes bigint,
        queue_depth int not null default 0,
        last_sync_at timestamptz,
        last_seen_at timestamptz not null default now(),
        revoked_at timestamptz,
        wipe_requested_at timestamptz,
        created_at timestamptz not null default now(),
        unique(org_id,device_key)
      );
      create index if not exists idx_managed_devices_org_seen on managed_devices(org_id,last_seen_at desc);
    `
  },
  {
    id: "20260813_002_security_indexes",
    sql: `
      create index if not exists idx_users_org_active on users(org_id,is_active);
      create index if not exists idx_users_email_verified on users(lower(email),email_verified_at);
      create index if not exists idx_auth_sessions_expiry on auth_sessions(expires_at,revoked_at);
    `
  },
  {
    id: "20260813_003_immutable_audit",
    sql: `
      create or replace function neptune_prevent_audit_mutation() returns trigger as $$
      begin
        raise exception 'audit_events are append-only';
      end;
      $$ language plpgsql;

      do $$
      begin
        if not exists (select 1 from pg_trigger where tgname='trg_neptune_audit_immutable') then
          create trigger trg_neptune_audit_immutable
          before update or delete on audit_events
          for each row execute function neptune_prevent_audit_mutation();
        end if;
      end $$;
    `
  }
] as const;

export async function runMigrations(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(89173142)");
    await client.query(`
      create table if not exists schema_migrations (
        id text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    for (const migration of migrations) {
      const applied = await client.query("select 1 from schema_migrations where id=$1", [migration.id]);
      if (applied.rowCount) continue;
      await client.query("begin");
      try {
        await client.query(migration.sql);
        await client.query("insert into schema_migrations(id) values($1)", [migration.id]);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw error;
      }
    }
  } finally {
    try { await client.query("select pg_advisory_unlock(89173142)"); } catch {}
    client.release();
  }
}
