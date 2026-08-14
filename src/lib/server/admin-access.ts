import type { Session } from "@/src/lib/server/auth";

const DESIGNATED_ADMIN_EMAILS = [
  "francis@canalclear.org",
  "rajput.jaspal@yahoo.in"
] as const;

function normalized(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function designatedAdminEmails() {
  return [...DESIGNATED_ADMIN_EMAILS];
}

export function designatedAdminEmail() {
  return DESIGNATED_ADMIN_EMAILS[0];
}

export function isDesignatedAdminEmail(email?: string | null) {
  const candidate = normalized(email);
  return Boolean(candidate && DESIGNATED_ADMIN_EMAILS.includes(candidate as (typeof DESIGNATED_ADMIN_EMAILS)[number]));
}

export function assertDesignatedAdmin(session: Pick<Session, "email">) {
  if (!isDesignatedAdminEmail(session.email)) throw new Error("FORBIDDEN");
  return session;
}
