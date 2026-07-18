import { createHash, randomBytes, randomUUID } from "crypto";
import { findUserByEmail, sql, type Row } from "@/src/lib/server/db";

const RESET_TTL_MINUTES = 30;
const REQUEST_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 3;
const RESEND_TEST_SENDER = "Neptune <onboarding@resend.dev>";
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "proton.me",
  "protonmail.com"
]);

type PasswordResetRequestResult =
  | null
  | { rateLimited: true; user: Row }
  | {
      rateLimited: false;
      user: Row;
      token: string;
      expiresAt: string;
      resetUrl: string;
    };

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

function senderAddress(value: string) {
  const angleMatch = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  return (angleMatch?.[1] || value.trim()).toLowerCase();
}

function resolvePasswordResetSender() {
  const configured = String(process.env.PASSWORD_RESET_FROM_EMAIL || "").trim();
  if (!configured) return RESEND_TEST_SENDER;

  const address = senderAddress(configured);
  const domain = address.split("@")[1] || "";
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) {
    console.warn(`PASSWORD_RESET_FROM_EMAIL uses an unverified public email domain (${domain || "unknown"}); using Resend test sender until a custom domain is verified.`);
    return RESEND_TEST_SENDER;
  }

  return configured;
}

function ownerTestRecipient(result: any) {
  const message = String(result?.message || "");
  const match = message.match(/own email address \(([^()\s]+@[^()\s]+)\)/i);
  return match?.[1]?.toLowerCase() || null;
}

function resetEmailContent(input: {
  name?: string | null;
  resetUrl: string;
  accountEmail: string;
  deliveredToOwnerInbox?: boolean;
}) {
  const safeName = escapeHtml(input.name?.trim() || "Neptune operator");
  const safeUrl = escapeHtml(input.resetUrl);
  const safeAccountEmail = escapeHtml(input.accountEmail);
  const ownerNote = input.deliveredToOwnerInbox
    ? `<p style="color:#e4bb5f;line-height:1.65">This recovery email was delivered to the Neptune owner inbox because the custom sending domain is not verified yet. The link resets <b>${safeAccountEmail}</b>.</p>`
    : "";

  return {
    subject: input.deliveredToOwnerInbox ? "Reset the Neptune owner account" : "Reset your Neptune password",
    text: `${input.deliveredToOwnerInbox ? `This recovery link resets the Neptune owner account ${input.accountEmail}.\n\n` : ""}Open this secure link within ${RESET_TTL_MINUTES} minutes: ${input.resetUrl}\n\nIf you did not request this change, ignore this email.`,
    html: `
      <div style="background:#07111e;padding:32px;font-family:Arial,sans-serif;color:#eaf1f8">
        <div style="max-width:620px;margin:auto;background:#0c1929;border:1px solid #26384d;border-radius:22px;padding:30px">
          <div style="font-size:12px;letter-spacing:.18em;color:#e4bb5f;font-weight:700">NEPTUNE · SECURE ACCOUNT RECOVERY</div>
          <h1 style="font-size:32px;line-height:1.15;margin:18px 0 10px">Reset your password</h1>
          <p style="color:#c4d0dc;line-height:1.65">Hello ${safeName}, a password reset was requested for your Neptune account.</p>
          ${ownerNote}
          <p style="color:#c4d0dc;line-height:1.65">This one-time link expires in ${RESET_TTL_MINUTES} minutes.</p>
          <p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#e4bb5f;color:#07111e;text-decoration:none;font-weight:800;padding:14px 20px;border-radius:12px">Choose a new password</a></p>
          <p style="color:#8fa1b5;font-size:13px;line-height:1.6">If you did not request this change, ignore this email. Your existing password will remain active.</p>
        </div>
      </div>
    `
  };
}

async function deliverResetEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  accountEmail: string;
  name?: string | null;
  resetUrl: string;
  ownerInbox?: boolean;
}) {
  const content = resetEmailContent({
    name: input.name,
    resetUrl: input.resetUrl,
    accountEmail: input.accountEmail,
    deliveredToOwnerInbox: input.ownerInbox
  });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `password-reset-${tokenHash(`${input.resetUrl}|${input.to}`).slice(0, 32)}`
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: content.subject,
      text: content.text,
      html: content.html,
      tags: [{ name: "category", value: input.ownerInbox ? "owner-password-reset" : "password-reset" }]
    }),
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
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
}): Promise<PasswordResetRequestResult> {
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
  ownerRecovery?: boolean;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("EMAIL_NOT_CONFIGURED");

  const from = resolvePasswordResetSender();
  const primary = await deliverResetEmail({
    apiKey,
    from,
    to: input.to,
    accountEmail: input.to,
    name: input.name,
    resetUrl: input.resetUrl
  });

  if (primary.response.ok) return primary.result;

  const testRecipient = ownerTestRecipient(primary.result);
  if (input.ownerRecovery && from === RESEND_TEST_SENDER && primary.response.status === 403 && testRecipient) {
    const fallback = await deliverResetEmail({
      apiKey,
      from,
      to: testRecipient,
      accountEmail: input.to,
      name: input.name,
      resetUrl: input.resetUrl,
      ownerInbox: true
    });
    if (fallback.response.ok) return fallback.result;
    throw new Error(`EMAIL_DELIVERY_FAILED:${fallback.response.status}:${JSON.stringify(fallback.result).slice(0, 500)}`);
  }

  throw new Error(`EMAIL_DELIVERY_FAILED:${primary.response.status}:${JSON.stringify(primary.result).slice(0, 500)}`);
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
