# Neptune Security Operations

## Scope

This document describes the controls implemented in the Neptune repository and the operational work required around them. It is an engineering/security operations document, not a certification claim, legal opinion, or substitute for an independent penetration test.

## Implemented application controls

### Identity

- Verified-email ownership for new organization signups.
- Minimum 12-character password policy for newly created accounts.
- Rate-limited login attempts with temporary lockout.
- Authenticator MFA with encrypted TOTP secret storage and one-time recovery codes.
- WebAuthn passkeys with required user verification.
- Server-side revocable sessions linked to signed HTTP-only cookies.
- User deactivation revokes active sessions.

### Authorization

- Organization-scoped data access.
- Role-based organization management.
- Explicit vessel view/edit permissions for scoped operators.
- Protected API enforcement for vessel-scoped data.
- Emergency GPS event and trail access tied to vessel permission.
- CRM/admin/platform-admin allowlist hard-coded to the two approved designated administrator identities.

### Audit and accountability

- Security and material CRUD changes append to `audit_events`.
- PostgreSQL trigger rejects UPDATE and DELETE of audit events.
- Audit records include actor, organization, action, entity, request route/method, source, success state, time, and selected metadata.

### Device and offline controls

- Authenticated devices register into the managed-device inventory.
- Device state includes platform, app version, offline capability, GPS permission, queue depth, storage estimate, last sync, and last seen.
- Managers can revoke a managed device.
- Managers can request device-local Neptune data wipe on the next successful connection.
- Offline data remains device-local and requires company-controlled OS/device security.

### Web/API boundary

- Content Security Policy.
- HSTS in production.
- frame denial.
- MIME sniffing protection.
- referrer policy.
- permissions policy.
- cross-origin opener/resource policies.
- protected database bootstrap route.

### Supply chain and deployment

- Next.js and React versions are pinned to audited patched releases in `package.json`.
- GitHub Actions runs TypeScript, security-regression tests, production build, HTTP integration checks, and high-severity npm audit.
- Dependabot monitors npm and GitHub Actions dependencies.
- Versioned database migrations use a migration ledger, advisory lock, and transactions.

## Launch-required external work

The repository cannot independently establish these controls; they must be completed and evidenced operationally:

1. Enable encrypted PostgreSQL backups and point-in-time recovery with the selected provider.
2. Complete and record a successful restore test.
3. Configure a verified production email domain for account/security email.
4. Configure production Stripe keys/webhook and test subscription lifecycle.
5. Validate production database TLS with the provider's CA requirements.
6. Configure production maritime provider licensing/credentials where applicable.
7. Run an independent application penetration test against a release candidate.
8. Remediate material penetration-test findings before broad enterprise rollout.
9. Complete privacy/terms/DPA/subprocessor documentation with qualified counsel before contractual enterprise use where required.
10. Establish support/on-call ownership and customer incident-escalation contacts.
11. Define and approve backup RPO/RTO and any customer-facing SLA.
12. Run a physical-device offshore/offline acceptance test and emergency GPS drill.

## Vulnerability handling

- Critical/high vulnerabilities affecting exploitable production dependencies are release blockers unless a documented risk acceptance exists.
- Dependabot PRs and npm-audit findings should be triaged by exploitability, affected runtime path, vendor patch availability, and regression risk.
- Security fixes should pass the full enterprise CI workflow before deployment.
- Do not apply forced breaking dependency upgrades directly in production without CI and functional validation.

## Incident response sequence

1. Triage severity and affected systems.
2. Preserve Vercel, database-provider, Stripe/provider, `system_errors`, and `audit_events` evidence.
3. Revoke compromised sessions/devices and deactivate affected accounts where appropriate.
4. Rotate exposed credentials through provider controls; never commit replacement secrets to Git.
5. Contain unauthorized access before restoring normal operation.
6. Use `docs/DISASTER_RECOVERY.md` when data restoration is required.
7. Validate identity, RBAC, billing, offline sync, and emergency functions after remediation.
8. Record timeline, root cause, affected records, corrective actions, and owner.
9. Handle customer/regulatory notification according to contracts, applicable law, and qualified legal/privacy guidance.

## Release candidate evidence

Before tagging a release candidate, retain:

- CI run URL and commit SHA;
- dependency audit result;
- production build result;
- migration version list;
- backup/restore evidence;
- penetration-test report or executive summary when available;
- physical-device offline test result;
- Stripe lifecycle test result;
- provider configuration checklist;
- known-risk register and approved exceptions.
