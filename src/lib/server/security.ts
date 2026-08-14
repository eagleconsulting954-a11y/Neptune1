import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import type { Session } from "@/src/lib/server/auth";
import { findUserByEmail, sql, type Row } from "@/src/lib/server/db";

const EMAIL_VERIFY_TTL_HOURS = 24;
const SESSION_HOURS = 12;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function authSecret() {
  return process.env.AUTH_SECRET || "development-secret-change-before-production";
}

export function requestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || null;
}

export function secureHash(value: string, purpose = "generic") {
  return createHmac("sha256", authSecret()).update(`${purpose}|${value}`).digest("hex");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizedEmail(email: string) {
  return email.trim().toLowerCase();
}

function loginKey(kind: "email" | "ip" | "action", value: string) {
  return `${kind}:${secureHash(value, `login-${kind}`).slice(0, 40)}`;
}

async function incrementLimiter(key: string, max: number, windowMinutes: number, lockMinutes: number) {
  const [row] = await sql<Row>(`
    insert into auth_login_attempts(key,failures,first_failed_at,last_failed_at,locked_until)
    values($1,1,now(),now(),null)
    on conflict(key) do update set
      failures=case
        when auth_login_attempts.first_failed_at < now() - ($2::int * interval '1 minute') then 1
        else auth_login_attempts.failures + 1
      end,
      first_failed_at=case
        when auth_login_attempts.first_failed_at < now() - ($2::int * interval '1 minute') then now()
        else auth_login_attempts.first_failed_at
      end,
      last_failed_at=now(),
      locked_until=case
        when (
          case
            when auth_login_attempts.first_failed_at < now() - ($2::int * interval '1 minute') then 1
            else auth_login_attempts.failures + 1
          end
        ) >= $3::int then now() + ($4::int * interval '1 minute')
        else auth_login_attempts.locked_until
      end
    returning *
  `, [key, windowMinutes, max, lockMinutes]);
  return row;
}

export async function assertLoginAllowed(email: string, ip?: string | null) {
  const keys = [loginKey("email", normalizedEmail(email))];
  if (ip) keys.push(loginKey("ip", ip));
  const rows = await sql<Row>(`
    select key,locked_until from auth_login_attempts
    where key=any($1::text[]) and locked_until is not null and locked_until > now()
    limit 1
  `, [keys]);
  if (rows.length) throw new Error("LOGIN_RATE_LIMITED");
}

export async function noteLoginFailure(email: string, ip?: string | null) {
  await incrementLimiter(loginKey("email", normalizedEmail(email)), 5, 15, 15);
  if (ip) await incrementLimiter(loginKey("ip", ip), 20, 15, 30);
}

export async function noteLoginSuccess(email: string) {
  await sql("delete from auth_login_attempts where key=$1", [loginKey("email", normalizedEmail(email))]);
}

export async function consumeActionRateLimit(action: string, identity: string, max: number, windowMinutes: number, lockMinutes = windowMinutes) {
  const row = await incrementLimiter(loginKey("action", `${action}|${identity}`), max + 1, windowMinutes, lockMinutes);
  return Number(row?.failures || 0) <= max && !(row?.locked_until && new Date(row.locked_until).getTime() > Date.now());
}

export async function recordAuditEvent(input: {
  session?: Pick<Session, "userId" | "orgId" | "email"> | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  route?: string | null;
  method?: string | null;
  success?: boolean;
  source?: string;
  request?: Request | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await sql(`
      insert into audit_events(
        id,org_id,user_id,user_email,action,entity_type,entity_id,route,method,success,source,ip_hash,user_agent,metadata
      ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [
      `audit_${randomUUID()}`,
      input.session?.orgId || null,
      input.session?.userId || null,
      input.session?.email || null,
      input.action,
      input.entityType || null,
      input.entityId || null,
      input.route || null,
      input.method || null,
      input.success !== false,
      input.source || "web",
      input.request ? secureHash(requestIp(input.request) || "unknown", "audit-ip").slice(0, 40) : null,
      input.request?.headers.get("user-agent")?.slice(0, 1000) || null,
      input.metadata || null
    ]);
  } catch (error) {
    console.error("Unable to append Neptune audit event", error);
  }
}

export async function createAuthSession(input: {
  userId: string;
  orgId: string;
  userAgent?: string | null;
  ip?: string | null;
  deviceLabel?: string | null;
  hours?: number;
}) {
  const id = `ses_${randomUUID()}`;
  const expiresAt = new Date(Date.now() + (input.hours || SESSION_HOURS) * 60 * 60 * 1000).toISOString();
  await sql(`
    insert into auth_sessions(id,user_id,org_id,user_agent,ip_hash,device_label,expires_at)
    values($1,$2,$3,$4,$5,$6,$7)
  `, [
    id,
    input.userId,
    input.orgId,
    input.userAgent?.slice(0, 1000) || null,
    input.ip ? secureHash(input.ip, "session-ip").slice(0, 40) : null,
    input.deviceLabel?.slice(0, 160) || null,
    expiresAt
  ]);
  return { id, expiresAt, exp: new Date(expiresAt).getTime() };
}

export async function validateAuthSession(sessionId: string, userId: string) {
  const [session] = await sql<Row>(`
    select s.id
    from auth_sessions s
    join users u on u.id=s.user_id
    where s.id=$1 and s.user_id=$2 and s.revoked_at is null and s.expires_at > now() and u.is_active=true
    limit 1
  `, [sessionId, userId]);
  if (!session) return false;
  await sql("update auth_sessions set last_seen_at=now() where id=$1", [sessionId]);
  return true;
}

export async function revokeAuthSession(sessionId: string, userId?: string) {
  await sql(`update auth_sessions set revoked_at=coalesce(revoked_at,now()) where id=$1${userId ? " and user_id=$2" : ""}`, userId ? [sessionId, userId] : [sessionId]);
}

export async function revokeAllAuthSessions(userId: string, exceptSessionId?: string | null) {
  await sql(`
    update auth_sessions set revoked_at=coalesce(revoked_at,now())
    where user_id=$1 and revoked_at is null ${exceptSessionId ? "and id<>$2" : ""}
  `, exceptSessionId ? [userId, exceptSessionId] : [userId]);
}

export async function listAuthSessions(userId: string) {
  return sql<Row>(`
    select id,device_label,user_agent,last_seen_at,expires_at,revoked_at,created_at
    from auth_sessions where user_id=$1 order by created_at desc limit 50
  `, [userId]);
}

export async function createEmailVerification(userId: string, appUrl: string) {
  await sql("update email_verification_tokens set used_at=coalesce(used_at,now()) where user_id=$1 and used_at is null", [userId]);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await sql(`
    insert into email_verification_tokens(id,user_id,token_hash,expires_at)
    values($1,$2,$3,$4)
  `, [`verify_${randomUUID()}`, userId, tokenHash(token), expiresAt]);
  return {
    token,
    expiresAt,
    verificationUrl: `${appUrl.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`
  };
}

function securitySender() {
  return String(process.env.SECURITY_FROM_EMAIL || process.env.PASSWORD_RESET_FROM_EMAIL || "Neptune <onboarding@resend.dev>").trim();
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string; category: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_NOT_CONFIGURED");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `${input.category}-${secureHash(`${input.to}|${input.subject}|${input.text}`, "email").slice(0, 32)}`
    },
    body: JSON.stringify({
      from: securitySender(),
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      tags: [{ name: "category", value: input.category }]
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`EMAIL_DELIVERY_FAILED:${response.status}:${JSON.stringify(result).slice(0, 500)}`);
  return result;
}

export async function sendVerificationEmail(input: { to: string; name?: string | null; verificationUrl: string }) {
  const safeName = String(input.name || "Neptune operator").replace(/[<>&"]/g, "");
  const safeUrl = input.verificationUrl.replace(/"/g, "%22");
  return sendEmail({
    to: input.to,
    category: "email-verification",
    subject: "Verify your Neptune account",
    text: `Verify your Neptune account within ${EMAIL_VERIFY_TTL_HOURS} hours: ${input.verificationUrl}`,
    html: `<div style="background:#07111e;padding:32px;font-family:Arial,sans-serif;color:#eaf1f8"><div style="max-width:620px;margin:auto;background:#0c1929;border:1px solid #26384d;border-radius:22px;padding:30px"><div style="font-size:12px;letter-spacing:.18em;color:#e4bb5f;font-weight:700">NEPTUNE · IDENTITY VERIFICATION</div><h1>Verify your account</h1><p>Hello ${safeName}, confirm this email before accessing your organization workspace.</p><p><a href="${safeUrl}" style="display:inline-block;background:#e4bb5f;color:#07111e;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px">Verify Neptune account</a></p><p style="color:#8fa1b5;font-size:13px">The link expires in ${EMAIL_VERIFY_TTL_HOURS} hours.</p></div></div>`
  });
}

export async function consumeEmailVerification(token: string) {
  const [user] = await sql<Row>(`
    with claimed as (
      update email_verification_tokens
      set used_at=now()
      where token_hash=$1 and used_at is null and expires_at > now()
      returning user_id
    )
    update users u set email_verified_at=coalesce(u.email_verified_at,now()),updated_at=now()
    from claimed c where u.id=c.user_id
    returning u.id,u.org_id,u.email,u.name,u.role,u.email_verified_at
  `, [tokenHash(token)]);
  return user || null;
}

export async function resendEmailVerification(email: string, appUrl: string, ip?: string | null) {
  const identity = `${normalizedEmail(email)}|${ip || "unknown"}`;
  const allowed = await consumeActionRateLimit("verify-email", identity, 3, 30, 30);
  if (!allowed) throw new Error("VERIFICATION_RATE_LIMITED");
  const user = await findUserByEmail(email);
  if (!user || user.email_verified_at) return null;
  const verification = await createEmailVerification(user.id, appUrl);
  await sendVerificationEmail({ to: user.email, name: user.name, verificationUrl: verification.verificationUrl });
  return verification;
}

function base32Encode(buffer: Buffer) {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += BASE32[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index < 0) continue;
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totpCode(secret: string, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const value = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(value % 1_000_000).padStart(6, "0");
}

function verifyTotp(secret: string, code: string) {
  const clean = code.replace(/\D/g, "");
  if (clean.length !== 6) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (const offset of [-1, 0, 1]) {
    const expected = Buffer.from(totpCode(secret, counter + offset));
    const provided = Buffer.from(clean);
    if (expected.length === provided.length && timingSafeEqual(expected, provided)) return true;
  }
  return false;
}

function mfaKey() {
  return createHash("sha256").update(`${authSecret()}|neptune-mfa-v1`).digest();
}

function encryptMfaSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", mfaKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptMfaSecret(value: string) {
  const [ivRaw, tagRaw, encryptedRaw] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", mfaKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, "base64url")), decipher.final()]).toString("utf8");
}

function signMfaSetup(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", authSecret()).update(`mfa-setup|${body}`).digest("base64url");
  return `${body}.${signature}`;
}

function readMfaSetup(token: string) {
  const [body, provided] = token.split(".");
  if (!body || !provided) return null;
  const expected = createHmac("sha256", authSecret()).update(`mfa-setup|${body}`).digest("base64url");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { userId: string; secret: string; exp: number };
  if (!payload.userId || !payload.secret || payload.exp < Date.now()) return null;
  return payload;
}

export function beginMfaSetup(input: { userId: string; email: string }) {
  const secret = base32Encode(randomBytes(20));
  const issuer = encodeURIComponent("Neptune Vessel Command");
  const account = encodeURIComponent(input.email);
  return {
    secret,
    setupToken: signMfaSetup({ userId: input.userId, secret, exp: Date.now() + 10 * 60_000 }),
    otpauthUri: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
  };
}

export async function completeMfaSetup(userId: string, setupToken: string, code: string) {
  const payload = readMfaSetup(setupToken);
  if (!payload || payload.userId !== userId || !verifyTotp(payload.secret, code)) return null;
  await sql("update users set mfa_enabled=true,mfa_secret_enc=$1,updated_at=now() where id=$2", [encryptMfaSecret(payload.secret), userId]);
  await sql("delete from mfa_recovery_codes where user_id=$1", [userId]);
  const recoveryCodes = Array.from({ length: 10 }, () => `${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`);
  for (const recoveryCode of recoveryCodes) {
    await sql("insert into mfa_recovery_codes(id,user_id,code_hash) values($1,$2,$3)", [`mfa_${randomUUID()}`, userId, secureHash(recoveryCode, "mfa-recovery")]);
  }
  return recoveryCodes;
}

export async function disableMfa(userId: string) {
  await sql("update users set mfa_enabled=false,mfa_secret_enc=null,updated_at=now() where id=$1", [userId]);
  await sql("delete from mfa_recovery_codes where user_id=$1", [userId]);
}

export async function verifyUserMfa(user: Row, code: string) {
  if (!user.mfa_enabled) return true;
  if (user.mfa_secret_enc) {
    try {
      if (verifyTotp(decryptMfaSecret(user.mfa_secret_enc), code)) return true;
    } catch {
      return false;
    }
  }
  const hash = secureHash(code.trim().toUpperCase(), "mfa-recovery");
  const [recovery] = await sql<Row>(`
    update mfa_recovery_codes set used_at=now()
    where id=(select id from mfa_recovery_codes where user_id=$1 and code_hash=$2 and used_at is null limit 1)
    returning id
  `, [user.id, hash]);
  return Boolean(recovery);
}

export async function getUserSecurityState(userId: string) {
  const [user] = await sql<Row>("select id,email,name,role,email_verified_at,is_active,mfa_enabled,last_login_at from users where id=$1", [userId]);
  return user || null;
}
