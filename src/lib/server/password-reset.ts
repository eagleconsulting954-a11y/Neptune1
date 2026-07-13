import { createHash, randomBytes, randomUUID } from "crypto";
import { findUserByEmail, sql, type Row } from "@/src/lib/server/db";

const RESET_TTL_MINUTES = 30;
const REQUEST_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 3;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function requestFingerprint(value: string | null | undefined) {
  if (!value) return null;
  return createHash("sha256")
    .update(`${process.env.AUTH_SECRET || "neptune"}|${value}`)
    .digest("hex")
    .slice(0, 32);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character] || character);
}

export async function ensurePasswordResetSchema() {
  await sql(`
    create table if not exists password_reset_tokens (
      id text primary key,
      user_id text not null references users(id) on delete cascade,
      token_hash text unique not null,
      requested_ip_hash text,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    );
    create index if not exists idx_password_reset_user_created on password_reset_tokens(user_id, created_at desc);
    create index if not exists idx_password_reset_expiry on password_reset_tokens(expires_at);
  `);
}

export async function createPasswordResetRequest(input: {
  email: string;
  appUrl: string;
  requestIp?: string | null;
}) {
  await ensurePasswordResetSchema();
  const user = await findUserByEmail(input.email);
  if (!user) return null;

  const [recent] = await sql<Row>(`
    select count(*)::int as count
    from password_reset_tokens
    where user_id=$1 and created_at >= now() - interval '${REQUEST_WINDOW_MINUTES} minutes'
  `, [user.id]);

  if (Number(recent?.count || 0) >= MAX_REQUESTS_PER_WINDOW) {
    return { rateLimited: true, user };
  }

  await sql(`update password_reset_tokens set used_at=coalesce(used_at,now()) where user_id=$1 and used_at is null`, [user.id]);

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();
  await sql(`
    insert into password_reset_tokens(id,user_id,token_hash,requested_ip_hash,expires_at)
    values($1,$2,$3,$4,$5)
  `, [
    `pwd_${randomUUID()}`,
    user.id,
    tokenHash(token),
    requestFingerprint(input.requestIp),
    expiresAt
  ]);

  return {
    rateLimited: false,
    user,
    token,
    expiresAt,
    resetUrl: `${input.appUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`
  };
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string | null;
  resetUrl: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_NOT_CONFIGURED");

  const from = process.env.PASSWORD_RESET_FROM_EMAIL || "Neptune <onboarding@resend.dev>";
  const safeName = escapeHtml(input.name?.trim() || "Neptune operator");
  const safeUrl = escapeHtml(input.resetUrl);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: "Reset your Neptune password",
      text: `A password reset was requested for your Neptune account. Open this secure link within ${RESET_TTL_MINUTES} minutes: ${input.resetUrl}\n\nIf you did not request this change, ignore this email.`,
      html: `
        <div style="background:#07111e;padding:32px;font-family:Arial,sans-serif;color:#eaf1f8">
          <div style="max-width:620px;margin:auto;background:#0c1929;border:1px solid #26384d;border-radius:22px;padding:30px">
            <div style="font-size:12px;letter-spacing:.18em;color:#e4bb5f;font-weight:700">NEPTUNE · SECURE ACCOUNT RECOVERY</div>
            <h1 style="font-size:32px;line-height:1.15;margin:18px 0 10px">Reset your password</h1>
            <p style="color:#c4d0dc;line-height:1.65">Hello ${safeName}, a password reset was requested for your Neptune account.</p>
            <p style="color:#c4d0dc;line-height:1.65">This one-time link expires in ${RESET_TTL_MINUTES} minutes.</p>
            <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#e4bb5f;color:#07111e;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px">Choose a new password</a></p>
            <p style="color:#8fa1b5;font-size:13px;line-height:1.6">If you did not request this change, ignore this email. Your existing password will remain active.</p>
          </div>
        </div>
      `,
      tags: [{ name: "category", value: "password-reset" }]
    }),
    signal: AbortSignal.timeout(15_000)
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`EMAIL_DELIVERY_FAILED:${response.status}:${JSON.stringify(result).slice(0, 500)}`);
  }
  return result;
}

export async function consumePasswordResetToken(token: string, passwordHash: string) {
  await ensurePasswordResetSchema();
  const [updated] = await sql<Row>(`
    with claimed as (
      update password_reset_tokens
      set used_at=now()
      where token_hash=$1
        and used_at is null
        and expires_at > now()
      returning user_id
    )
    update users u
    set password_hash=$2
    from claimed c
    where u.id=c.user_id
    returning u.id,u.org_id,u.email,u.name,u.role
  `, [tokenHash(token), passwordHash]);

  if (!updated) return null;
  await sql(`update password_reset_tokens set used_at=coalesce(used_at,now()) where user_id=$1`, [updated.id]);
  return updated;
}
