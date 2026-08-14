import type { Session } from "@/src/lib/server/auth";

const DEFAULT_PRIMARY_ADMIN_EMAIL = "francis@canalclear.org";
const DEFAULT_SECONDARY_ADMIN_EMAIL = "rajput.jaspal@yahoo.in";

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function designatedAdminEmails() {
  const primary = normalized(process.env.NEPTUNE_OWNER_EMAIL || DEFAULT_PRIMARY_ADMIN_EMAIL);
  const secondary = normalized(process.env.NEPTUNE_SECOND_ADMIN_EMAIL || DEFAULT_SECONDARY_ADMIN_EMAIL);
  return Array.from(new Set([primary, secondary].filter(Boolean))).slice(0, 2);
}

export function designatedAdminEmail() {
  return designatedAdminEmails()[0] || DEFAULT_PRIMARY_ADMIN_EMAIL;
}

export function isDesignatedAdminEmail(email?: string | null) {
  const candidate = normalized(email);
  return Boolean(candidate && designatedAdminEmails().includes(candidate));
}

export function assertDesignatedAdmin(session: Pick<Session, "email">) {
  if (!isDesignatedAdminEmail(session.email)) throw new Error("FORBIDDEN");
  return session;
}
