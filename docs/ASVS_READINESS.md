# Neptune OWASP ASVS Level 2 Readiness

Neptune uses OWASP ASVS Level 2 as an engineering verification target for the commercial application. This file is a readiness matrix, not a third-party ASVS certification.

## Implemented or directly testable in the repository

### Architecture and threat modeling

- Security-sensitive modules are separated server-side.
- Organization, vessel, designated-admin, and provider trust boundaries are documented in `docs/THREAT_MODEL.md`.
- Customer authorization does not rely on UI visibility.

### Authentication

- Verified email before normal account login.
- Strong new-account password minimum.
- bcrypt password hashes.
- Generic password-reset response.
- One-time expiring reset tokens.
- Login throttling and lockout.
- TOTP MFA and recovery codes.
- WebAuthn passkeys requiring user verification.
- Revocable server-side sessions.

### Session management

- HTTP-only session cookie.
- Secure cookie in production.
- SameSite=Lax.
- Server-side session expiry/revocation.
- Logout revokes current session.
- User deactivation revokes sessions.
- Device/session inventory exposed to the user/security administrator.

### Access control

- Organization identity comes from the authenticated session.
- Vessel view/edit permission is checked server-side.
- Fleet-wide activity/billing/history is manager-only.
- CRM/platform administration is restricted to an exact two-identity allowlist.
- Emergency GPS APIs enforce vessel permission.
- Package administrator-seat limits are enforced server-side.

### Validation and output encoding

- React escapes standard user-controlled values.
- Report HTML escapes generated content.
- API payload lengths and accepted states are constrained in security-sensitive routes.
- CSP blocks object embedding and limits active-content sources.

### Cryptography

- Passwords use bcrypt.
- MFA secrets use authenticated AES-256-GCM encryption derived from the deployment secret.
- Sensitive one-time codes/tokens are stored as hashes where applicable.
- WebAuthn stores credential public keys, not authenticator private keys.
- Production database TLS is explicitly configurable and defaults toward verification.

### Error handling and logging

- Global system-error capture exists.
- Security/material changes append to `audit_events`.
- Audit records cannot be updated/deleted through normal SQL because of a database trigger.
- Sensitive authentication responses avoid unnecessary account enumeration.

### Data protection

- Tenant filtering is enforced in the data/API layer.
- Vessel-scoped users receive only assigned-vessel operational data.
- Device-local offline data is cleared on logout/account switch and can receive a reconnect-triggered wipe request.
- The product documentation explicitly requires company-managed endpoint encryption/access controls for offline use.

### Communication security

- HTTPS is assumed by production deployment.
- HSTS is emitted in production.
- Security headers include CSP, frame denial, referrer policy, MIME sniffing protection, COOP/CORP, and permissions policy.

### Malicious code / supply chain

- High-severity npm audit is a CI gate.
- Dependabot monitors npm and GitHub Actions.
- Secret regression scan runs in CI.
- CycloneDX SBOM is generated as a CI artifact.
- Framework security versions are pinned.

### Business logic

- Subscription entitlements are server authoritative.
- Customer plans and CRM/platform-admin identity rules are separate.
- Approval sign-off requires authenticated actor, configured role, revision, explicit acknowledgment, and append-only action evidence.
- Emergency GPS is visibly separated from official distress transmission.

## Requires release-candidate verification

These areas cannot be closed solely by source review and must be verified against the deployed release candidate:

- full ASVS endpoint inventory;
- browser-specific CSRF/Origin/SameSite behavior;
- CSP compatibility and absence of unsafe unexpected execution paths;
- authorization fuzzing/IDOR testing;
- password-reset and email-verification abuse testing;
- WebAuthn authenticator compatibility;
- OIDC provider-specific validation;
- offline cache confidentiality on target managed devices;
- upload/file handling if added later;
- race conditions in billing, invitations, approvals, and offline replay;
- denial-of-service behavior under abusive request patterns;
- infrastructure firewall/database-network controls.

## External verification gate

Before broad enterprise rollout, commission an independent penetration test scoped to at least:

- authentication and account recovery;
- MFA/passkeys/SSO;
- tenant and vessel authorization;
- CRM/platform-admin privilege boundaries;
- offline/PWA storage and synchronization;
- emergency GPS APIs;
- Stripe lifecycle/webhook handling;
- report/approval evidence integrity;
- security headers/browser attack surface;
- business-logic abuse.

Track all material findings to remediation commits and rerun the enterprise CI and targeted regression tests before release approval.
