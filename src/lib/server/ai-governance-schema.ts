import { sql } from "@/src/lib/server/db";

const MIGRATION_ID = "20260829_009_ai_governance_control_plane";
let ready: Promise<void> | null = null;

export async function ensureAiGovernanceSchema() {
  if (ready) return ready;
  ready = (async () => {
    const [applied] = await sql("select id from schema_migrations where id=$1 limit 1", [MIGRATION_ID]);
    if (applied) return;

    await sql(`
      create table if not exists ai_systems (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        name text not null,
        module text,
        purpose text,
        provider text,
        model_version text,
        prompt_version text,
        risk_tier text not null default 'Moderate',
        authority_level text not null default 'Recommend',
        owner text,
        environment text not null default 'Production',
        status text not null default 'Draft',
        data_access text,
        human_approval_required boolean not null default false,
        assurance_score int,
        last_review_at date,
        next_review_at date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (risk_tier in ('Low','Moderate','High','Critical')),
        check (authority_level in ('Observe','Recommend','Approve','Execute','Advisory only')),
        check (status in ('Draft','In review','Approved','Restricted','Suspended','Retired')),
        check (assurance_score is null or (assurance_score between 0 and 100))
      );
      create index if not exists idx_ai_systems_org_risk on ai_systems(org_id,risk_tier,status);
      create index if not exists idx_ai_systems_org_review on ai_systems(org_id,next_review_at);

      create table if not exists ai_governance_controls (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        system_id text not null references ai_systems(id) on delete cascade,
        layer_key text not null,
        control_name text not null,
        status text not null default 'Not assessed',
        owner text,
        evidence text,
        last_reviewed_at date,
        next_review_at date,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        unique(org_id,system_id,layer_key,control_name),
        check (status in ('Not assessed','Implemented','Partial','Gap','Not applicable'))
      );
      create index if not exists idx_ai_controls_org_system on ai_governance_controls(org_id,system_id,layer_key);
      create index if not exists idx_ai_controls_status on ai_governance_controls(org_id,status);

      create table if not exists ai_governance_findings (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        system_id text not null references ai_systems(id) on delete cascade,
        layer_key text not null,
        severity text not null default 'Moderate',
        title text not null,
        description text,
        status text not null default 'Open',
        owner text,
        due_at date,
        resolved_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        check (severity in ('Low','Moderate','High','Critical')),
        check (status in ('Open','In progress','Accepted risk','Resolved'))
      );
      create index if not exists idx_ai_findings_org_status on ai_governance_findings(org_id,status,severity);
      create index if not exists idx_ai_findings_system on ai_governance_findings(org_id,system_id,created_at desc);

      create table if not exists ai_assurance_evaluations (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        system_id text not null references ai_systems(id) on delete restrict,
        evaluation_type text not null,
        score int,
        status text not null default 'Completed',
        notes text,
        reviewed_by text,
        created_at timestamptz not null default now(),
        check (score is null or (score between 0 and 100))
      );
      create index if not exists idx_ai_evaluations_system on ai_assurance_evaluations(org_id,system_id,created_at desc);

      create table if not exists ai_decision_records (
        id text primary key,
        org_id text not null references organizations(id) on delete cascade,
        system_id text not null references ai_systems(id) on delete restrict,
        model_version text,
        prompt_version text,
        authority_level text not null,
        input_sources jsonb not null default '[]'::jsonb,
        output_summary text not null,
        confidence int,
        policy_result text,
        human_reviewer text,
        override_status text,
        final_action text,
        created_at timestamptz not null default now(),
        check (authority_level in ('Observe','Recommend','Approve','Execute','Advisory only')),
        check (confidence is null or (confidence between 0 and 100))
      );
      create index if not exists idx_ai_decisions_system on ai_decision_records(org_id,system_id,created_at desc);

      create or replace function neptune_prevent_ai_evidence_mutation() returns trigger as $$
      begin
        raise exception 'AI governance evidence is append-only';
      end;
      $$ language plpgsql;

      do $$
      begin
        if not exists (select 1 from pg_trigger where tgname='trg_neptune_ai_decision_immutable') then
          create trigger trg_neptune_ai_decision_immutable
          before update or delete on ai_decision_records
          for each row execute function neptune_prevent_ai_evidence_mutation();
        end if;
        if not exists (select 1 from pg_trigger where tgname='trg_neptune_ai_evaluation_immutable') then
          create trigger trg_neptune_ai_evaluation_immutable
          before update or delete on ai_assurance_evaluations
          for each row execute function neptune_prevent_ai_evidence_mutation();
        end if;
      end $$;

      insert into schema_migrations(id) values('${MIGRATION_ID}') on conflict(id) do nothing;
    `);
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
