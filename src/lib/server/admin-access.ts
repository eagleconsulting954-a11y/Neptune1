import type { Session } from "@/src/lib/server/auth";

const DEFAULT_ADMIN_EMAIL = "francis@canalclear.org";

export function designatedAdminEmail() {
  return String(process.env.NEPTUNE_OWNER_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
}

export function isDesignatedAdminEmail(email?: string | null) {
  return Boolean(email && String(email).trim().toLowerCase() === designatedAdminEmail());
}

export function assertDesignatedAdmin(session: Pick<Session, "email">) {
  if (!isDesignatedAdminEmail(session.email)) throw new Error("FORBIDDEN");
  return session;
}
