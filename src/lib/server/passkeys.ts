import { randomUUID } from "crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
  type WebAuthnCredential
} from "@simplewebauthn/server";
import { isoUint8Array } from "@simplewebauthn/server/helpers";
import type { Session } from "@/src/lib/server/auth";
import { findUserByEmail, sql, type Row } from "@/src/lib/server/db";
import { recordAuditEvent } from "@/src/lib/server/security";

const RP_NAME = "Neptune Vessel Command";
const CHALLENGE_TTL_MINUTES = 5;

type PasskeyRow = Row & {
  credential_id: string;
  public_key: Buffer | Uint8Array;
  counter: string | number | bigint;
  transports: string[] | null;
};

function relyingParty(appUrl: string) {
  const parsed = new URL(appUrl);
  return {
    rpID: parsed.hostname,
    origin: parsed.origin,
    rpName: RP_NAME
  };
}

async function replaceChallenge(userId: string, purpose: "register" | "authenticate", challenge: string) {
  await sql("update webauthn_challenges set used_at=coalesce(used_at,now()) where user_id=$1 and purpose=$2 and used_at is null", [userId, purpose]);
  await sql(`
    insert into webauthn_challenges(id,user_id,purpose,challenge,expires_at)
    values($1,$2,$3,$4,now() + ($5::int * interval '1 minute'))
  `, [`wch_${randomUUID()}`, userId, purpose, challenge, CHALLENGE_TTL_MINUTES]);
}

async function currentChallenge(userId: string, purpose: "register" | "authenticate") {
  const [row] = await sql<Row>(`
    select id,challenge from webauthn_challenges
    where user_id=$1 and purpose=$2 and used_at is null and expires_at > now()
    order by created_at desc limit 1
  `, [userId, purpose]);
  return row || null;
}

async function consumeChallenge(id: string) {
  await sql("update webauthn_challenges set used_at=now() where id=$1 and used_at is null", [id]);
}

export async function listUserPasskeys(userId: string) {
  return sql<Row>(`
    select id,credential_id,label,device_type,backed_up,transports,last_used_at,created_at
    from webauthn_credentials where user_id=$1 order by created_at desc
  `, [userId]);
}

async function rawUserPasskeys(userId: string) {
  return sql<PasskeyRow>("select * from webauthn_credentials where user_id=$1 order by created_at desc", [userId]);
}

export async function beginPasskeyRegistration(session: Pick<Session, "userId" | "orgId" | "email">, appUrl: string) {
  const [user] = await sql<Row>("select id,email,name,email_verified_at,is_active from users where id=$1 and org_id=$2", [session.userId, session.orgId]);
  if (!user || user.is_active === false || !user.email_verified_at) throw new Error("PASSKEY_USER_NOT_ELIGIBLE");
  const existing = await rawUserPasskeys(user.id);
  const rp = relyingParty(appUrl);
  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userName: user.email,
    userDisplayName: user.name || user.email,
    userID: isoUint8Array.fromUTF8String(user.id),
    attestationType: "none",
    excludeCredentials: existing.map(item => ({
      id: item.credential_id,
      transports: Array.isArray(item.transports) ? item.transports as any : undefined
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "required"
    },
    supportedAlgorithmIDs: [-7, -257]
  });
  await replaceChallenge(user.id, "register", options.challenge);
  return options;
}

export async function finishPasskeyRegistration(input: {
  session: Pick<Session, "userId" | "orgId" | "email">;
  appUrl: string;
  response: RegistrationResponseJSON;
  label?: string | null;
  request?: Request | null;
}) {
  const challenge = await currentChallenge(input.session.userId, "register");
  if (!challenge) throw new Error("PASSKEY_CHALLENGE_EXPIRED");
  const rp = relyingParty(input.appUrl);
  const verification = await verifyRegistrationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error("PASSKEY_REGISTRATION_FAILED");
  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const [stored] = await sql<Row>(`
    insert into webauthn_credentials(
      id,user_id,org_id,credential_id,public_key,counter,device_type,backed_up,transports,label
    ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    on conflict(credential_id) do update set
      user_id=excluded.user_id,
      org_id=excluded.org_id,
      public_key=excluded.public_key,
      counter=excluded.counter,
      device_type=excluded.device_type,
      backed_up=excluded.backed_up,
      transports=excluded.transports,
      label=coalesce(excluded.label,webauthn_credentials.label)
    returning id,credential_id,label,device_type,backed_up,transports,created_at
  `, [
    `passkey_${randomUUID()}`,
    input.session.userId,
    input.session.orgId,
    credential.id,
    Buffer.from(credential.publicKey),
    credential.counter,
    credentialDeviceType,
    credentialBackedUp,
    JSON.stringify(credential.transports || []),
    String(input.label || "Passkey").slice(0, 160)
  ]);
  await consumeChallenge(challenge.id);
  await recordAuditEvent({ session: input.session, action: "security.passkey_registered", entityType: "passkey", entityId: stored.id, route: "/api/v1/security-center", method: "POST", request: input.request, metadata: { deviceType: credentialDeviceType, backedUp: credentialBackedUp } });
  return stored;
}

export async function removePasskey(session: Pick<Session, "userId" | "orgId" | "email">, passkeyId: string, request?: Request | null) {
  const [removed] = await sql<Row>("delete from webauthn_credentials where id=$1 and user_id=$2 and org_id=$3 returning id,label", [passkeyId, session.userId, session.orgId]);
  if (!removed) throw new Error("PASSKEY_NOT_FOUND");
  await recordAuditEvent({ session, action: "security.passkey_removed", entityType: "passkey", entityId: removed.id, route: "/api/v1/security-center", method: "POST", request });
  return removed;
}

export async function beginPasskeyAuthentication(email: string, appUrl: string) {
  const user = await findUserByEmail(email.trim().toLowerCase());
  if (!user || user.is_active === false || !user.email_verified_at) return null;
  const credentials = await rawUserPasskeys(user.id);
  if (!credentials.length) return null;
  const rp = relyingParty(appUrl);
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
    allowCredentials: credentials.map(item => ({
      id: item.credential_id,
      transports: Array.isArray(item.transports) ? item.transports as any : undefined
    }))
  });
  await replaceChallenge(user.id, "authenticate", options.challenge);
  return { user, options };
}

export async function finishPasskeyAuthentication(input: {
  email: string;
  appUrl: string;
  response: AuthenticationResponseJSON;
  request?: Request | null;
}) {
  const user = await findUserByEmail(input.email.trim().toLowerCase());
  if (!user || user.is_active === false || !user.email_verified_at) throw new Error("PASSKEY_AUTH_FAILED");
  const challenge = await currentChallenge(user.id, "authenticate");
  if (!challenge) throw new Error("PASSKEY_CHALLENGE_EXPIRED");
  const [row] = await sql<PasskeyRow>("select * from webauthn_credentials where user_id=$1 and credential_id=$2 limit 1", [user.id, input.response.id]);
  if (!row) throw new Error("PASSKEY_AUTH_FAILED");
  const rp = relyingParty(input.appUrl);
  const credential: WebAuthnCredential = {
    id: row.credential_id as any,
    publicKey: new Uint8Array(row.public_key),
    counter: Number(row.counter || 0),
    transports: Array.isArray(row.transports) ? row.transports as any : undefined
  };
  const verification = await verifyAuthenticationResponse({
    response: input.response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    credential,
    requireUserVerification: true
  });
  if (!verification.verified) throw new Error("PASSKEY_AUTH_FAILED");
  await sql("update webauthn_credentials set counter=$1,last_used_at=now() where id=$2", [verification.authenticationInfo.newCounter, row.id]);
  await consumeChallenge(challenge.id);
  return { user, passkeyId: row.id };
}
