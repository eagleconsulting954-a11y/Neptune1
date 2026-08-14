import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];

function assert(name, condition, detail) {
  checks.push({ name, ok: Boolean(condition), detail });
  if (!condition) throw new Error(`${name}: ${detail}`);
}

const adminAccess = read("src/lib/server/admin-access.ts");
assert("exact admin 1", adminAccess.includes('"francis@canalclear.org"'), "primary designated admin missing");
assert("exact admin 2", adminAccess.includes('"rajput.jaspal@yahoo.in"'), "secondary designated admin missing");
assert("admin list immutable", !adminAccess.includes("process.env.NEPTUNE_OWNER_EMAIL") && !adminAccess.includes("PLATFORM_ADMIN_EMAILS"), "admin access must not be widened by environment variables");

const siteHeader = read("components/SiteHeader.tsx");
assert("no public admin nav", !siteHeader.includes('href="/admin"') && !siteHeader.includes('href="/platform-admin"'), "public navigation exposes an admin link");
assert("no public CRM branding", !siteHeader.includes("Vessel Command CRM"), "public brand still advertises CRM");

const resourceApi = read("app/api/v1/[resource]/route.ts");
assert("CRM identity enforcement", resourceApi.includes('resource === "crm_accounts"') && resourceApi.includes("isDesignatedAdminEmail"), "CRM API lacks designated-admin enforcement");
assert("vessel write enforcement", resourceApi.includes("assertResourceWriteAccess"), "resource API lacks vessel-level write authorization");
assert("resource audit", resourceApi.includes("recordAuditEvent"), "resource mutations are not audited");

const dashboardApi = read("app/api/v1/dashboard/route.ts");
assert("CRM stripped from customers", dashboardApi.includes("data.crm = []") && dashboardApi.includes("adminAccess"), "customer dashboard does not strip CRM");
assert("dashboard vessel scope", dashboardApi.includes("scopeDashboardForSession"), "dashboard is not vessel-permission scoped");

const bootstrap = read("app/api/bootstrap/route.ts");
assert("bootstrap protected", bootstrap.includes("isDesignatedAdminEmail") && bootstrap.includes("403"), "database bootstrap is not admin protected");

const signup = read("app/api/auth/signup/route.ts");
assert("verified signup", signup.includes("createEmailVerification") && signup.includes("verificationRequired"), "new organizations do not require email verification");
assert("strong signup password", signup.includes("password.length < 12"), "signup password policy is below 12 characters");
assert("reserved admin signup", signup.includes("isDesignatedAdminEmail(email)"), "designated admin identities can be self-registered");

const login = read("app/api/auth/login/route.ts");
assert("login lockout", login.includes("assertLoginAllowed") && login.includes("noteLoginFailure"), "login lockout controls missing");
assert("MFA login", login.includes("verifyUserMfa") && login.includes("MFA_REQUIRED"), "MFA is not enforced at login");
assert("revocable sessions", login.includes("setSession") && login.includes("deviceLabel"), "device-aware persisted sessions missing");

const auth = read("src/lib/server/auth.ts");
assert("session validation", auth.includes("validateAuthSession") && auth.includes("revokeAuthSession"), "signed sessions are not revocable");

const migrations = read("src/lib/server/migrations.ts");
assert("versioned migrations", migrations.includes("schema_migrations") && migrations.includes("pg_advisory_lock"), "versioned migration runner missing");
assert("immutable audit", migrations.includes("trg_neptune_audit_immutable") && migrations.includes("before update or delete on audit_events"), "audit mutation block missing");
assert("managed devices schema", migrations.includes("create table if not exists managed_devices"), "managed device schema missing");

const security = read("src/lib/server/security.ts");
assert("TOTP MFA", security.includes("otpauth://totp") && security.includes("mfa_recovery_codes"), "TOTP MFA implementation missing");
assert("encrypted MFA secret", security.includes("aes-256-gcm"), "MFA secrets are not encrypted");
assert("audit service", security.includes("insert into audit_events"), "append-only audit writer missing");

const orgAccess = read("src/lib/server/org-access.ts");
assert("organization invitations", orgAccess.includes("user_invitations") && orgAccess.includes("sendInvitationEmail"), "secure invitations missing");
assert("vessel permissions", orgAccess.includes("user_vessel_permissions") && orgAccess.includes("can_edit"), "vessel permissions missing");
assert("invitation edit permission", orgAccess.includes("can_edit_vessels") && orgAccess.includes("Boolean(invitation.can_edit_vessels)"), "invited vessel edit access is not preserved");
assert("user deactivation", orgAccess.includes("revokeAllAuthSessions") && orgAccess.includes("is_active"), "user deactivation does not revoke sessions");
assert("device revocation", orgAccess.includes("wipe_requested_at") && orgAccess.includes("revoked_at"), "managed device revoke/wipe controls missing");

const nextConfig = read("next.config.mjs");
for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "Permissions-Policy", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy"]) {
  assert(`security header ${header}`, nextConfig.includes(header), `${header} is missing`);
}

const packageJson = JSON.parse(read("package.json"));
assert("secure Next.js line", packageJson.dependencies.next === "16.3.1", "Next.js is not pinned to the audited secure release");
assert("patched React", packageJson.dependencies.react === "19.2.8" && packageJson.dependencies["react-dom"] === "19.2.8", "React RSC security patch is not pinned");

console.log(`Neptune security smoke checks passed: ${checks.length}`);
for (const check of checks) console.log(`✓ ${check.name}`);
