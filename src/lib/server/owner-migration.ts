import { sql, upsertSubscription, type Row } from "@/src/lib/server/db";

const MIGRATION_ID = "francis-owner-email-2026-07-18";
const PREVIOUS_EMAIL = "feagleston@gmail.com";
const OWNER_EMAIL = "francis@canalclear.org";

export async function migrateFrancisOwnerAccount() {
  await sql(`
    create table if not exists internal_migrations (
      id text primary key,
      completed_at timestamptz not null default now()
    )
  `);

  const [completed] = await sql<Row>("select id from internal_migrations where id=$1", [MIGRATION_ID]);
  if (completed) return { migrated: false, reason: "already-completed" };

  const [target] = await sql<Row>("select * from users where lower(email)=lower($1) limit 1", [OWNER_EMAIL]);
  const [previous] = await sql<Row>("select * from users where lower(email)=lower($1) limit 1", [PREVIOUS_EMAIL]);
  const user = target || previous;

  if (!user) return { migrated: false, reason: "owner-account-not-found" };

  const [updated] = await sql<Row>(`
    update users
    set name=$1,email=$2,role='owner'
    where id=$3
    returning id,org_id,email,name,role
  `, ["Francis Eagleston", OWNER_EMAIL, user.id]);

  if (previous && previous.id !== updated.id) {
    await sql("update users set role='member' where id=$1", [previous.id]);
  }

  await upsertSubscription({
    orgId: updated.org_id,
    plan: "full_vessel_access",
    status: "active",
    currentPeriodEnd: null
  });

  await sql("insert into internal_migrations(id) values($1)", [MIGRATION_ID]);
  return { migrated: true, user: updated };
}
