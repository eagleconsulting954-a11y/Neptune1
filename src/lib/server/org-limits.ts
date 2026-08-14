import { planDefinition } from "@/src/lib/plans";
import { sql, type Row } from "@/src/lib/server/db";

const MANAGER_ROLES = new Set(["admin", "owner", "org_admin", "fleet_manager"]);

export function roleUsesAdministratorSeat(role: unknown) {
  return MANAGER_ROLES.has(String(role || "").trim().toLowerCase());
}

export async function assertAdministratorCapacity(orgId: string, plan: unknown, proposedRole: unknown, excludingUserId?: string | null) {
  if (!roleUsesAdministratorSeat(proposedRole)) return;
  const limit = planDefinition(plan).limits.administrators;
  if (limit === null) return;

  const params: unknown[] = [orgId];
  let exclusion = "";
  if (excludingUserId) {
    params.push(excludingUserId);
    exclusion = "and id<>$2";
  }

  const [active] = await sql<Row>(`
    select count(*)::int as count
    from users
    where org_id=$1 and is_active=true and lower(role)=any($${params.length + 1}::text[]) ${exclusion}
  `, [...params, Array.from(MANAGER_ROLES)]);

  const [pending] = await sql<Row>(`
    select count(*)::int as count
    from user_invitations
    where org_id=$1
      and accepted_at is null
      and revoked_at is null
      and expires_at > now()
      and lower(role)=any($2::text[])
  `, [orgId, Array.from(MANAGER_ROLES)]);

  if (Number(active?.count || 0) + Number(pending?.count || 0) >= limit) {
    throw new Error("ADMINISTRATOR_LIMIT_REACHED");
  }
}
