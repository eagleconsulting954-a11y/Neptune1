# Neptune Enterprise Threat Model

## Scope

This threat model covers Neptune's customer application, authentication, organization/vessel authorization, offline PWA storage, emergency GPS, billing integration, platform administration, transactional email, external maritime providers, and deployment/database boundaries.

It is an engineering baseline. It should be reviewed by the independent penetration-testing provider before enterprise launch and updated after material architecture changes.

## Assets

- User identities, password hashes, MFA secrets, passkey public credentials, and active sessions.
- Organization, vessel, maintenance, certificate, incident, delegation, safety, emergency, and maritime-intelligence records.
- Emergency GPS chronology and offline device queues.
- Subscription/customer identifiers and billing state.
- Immutable audit evidence and application error evidence.
- Designated CRM/platform-admin access.
- Provider API credentials and production database credentials.

## Trust boundaries

1. Public browser/device to Neptune HTTPS application.
2. Authenticated browser/PWA to protected Neptune APIs.
3. Device-local IndexedDB/service-worker storage to synchronized PostgreSQL records.
4. Neptune server runtime to PostgreSQL.
5. Neptune server runtime to Stripe, Resend, weather/ocean, congestion, bunker-price, and OIDC providers.
6. Customer organization roles/vessel scopes to designated Neptune platform administrators.
7. GitHub source/CI to Vercel production deployment.

## Primary threats and controls

### Credential theft and account takeover

Threats:
- password reuse/phishing;
- brute-force/credential stuffing;
- stolen session cookie;
- compromised authenticator recovery code;
- malicious password-reset request.

Controls:
- bcrypt password hashing;
- verified-email requirement;
- login rate limit and temporary lockout;
- TOTP MFA with encrypted server-side secret;
- one-use hashed recovery codes;
- WebAuthn passkeys requiring user verification;
- HTTP-only secure cookies in production;
- persisted revocable sessions and device inventory;
- generic password-reset responses and expiring one-use tokens;
- exact-admin emails cannot self-register publicly.

Residual risk:
- endpoint/device compromise can still expose an authenticated session;
- compromised email/identity-provider accounts may affect recovery/SSO.

### Cross-tenant and cross-vessel data access

Threats:
- identifier guessing;
- changing `org_id`/vessel IDs in client requests;
- using an emergency event ID from another vessel;
- fleet-wide activity/billing leakage to vessel-scoped users.

Controls:
- server session supplies organization identity;
- database access methods filter by organization;
- vessel permission lookups are server-side;
- generic resource reads/writes are vessel-scoped;
- emergency event/position APIs validate vessel permission;
- organization-wide activity/billing/history restricted to organization managers;
- database-backed CI tests exercise cross-organization and unassigned-vessel denial.

### Privilege escalation to CRM/platform administration

Threats:
- organization-admin role treated as platform admin;
- environment variable widens allowlist;
- public signup claims a privileged email;
- hidden UI relied upon as authorization.

Controls:
- exact two-email hard-coded allowlist;
- allowlist not configurable from environment;
- public signup reserves both identities;
- CRM/API/admin pages enforce identity on server;
- customer plans no longer sell CRM/platform-admin as an entitlement;
- secondary administrator provisioning is primary-admin-only and invitation based.

### CSRF and cross-site browser requests

Threats:
- another site attempts authenticated state-changing requests.

Existing controls:
- session cookie uses SameSite=Lax;
- sensitive actions use JSON/fetch requests;
- CSP/frame denial reduce several browser attack surfaces.

Launch review requirement:
- validate Origin/Sec-Fetch-Site behavior for state-changing authenticated API calls in the independent security test;
- add explicit origin enforcement if any supported browser/client path weakens SameSite protection.

### XSS/content injection

Threats:
- user-controlled vessel/incident/comment values rendered as active content;
- compromised provider response reaches HTML.

Controls:
- React escaping for normal UI output;
- CSP restricting script/object/frame sources;
- server report HTML explicitly escapes values;
- no customer-supplied raw HTML rendering should be added without sanitization.

### Offline device theft or local-data exposure

Threats:
- stolen vessel tablet exposes last-synced operational data;
- queued writes/GPS records remain after user loses access;
- browser storage is not encrypted by Neptune itself.

Controls:
- company-controlled-device requirement;
- OS encryption/access-control requirement;
- logout/account switch clears local private data;
- managed device revocation and reconnect-triggered wipe request;
- queue/sync status visible in Security Center;
- offline storage does not substitute for official navigation/distress systems.

Residual risk:
- a powered-off/stolen device cannot receive a remote wipe until it reconnects;
- browser IndexedDB confidentiality depends materially on the endpoint/OS security boundary.

### Offline synchronization conflict or replay

Threats:
- duplicate creates;
- temporary-ID replay;
- shore and vessel edit same record while disconnected;
- emergency GPS batch duplicated.

Controls:
- ordered offline queue;
- temporary-to-server ID mapping;
- emergency GPS sequence numbers and idempotent record identifiers;
- audit trail of synchronized changes.

Residual risk:
- Neptune currently uses ordered replay, not a full three-way conflict-merging engine. Experimental conflict-resolution flag is reserved for future rollout and must not be represented as complete.

### Emergency/GPS misuse

Threats:
- stale/inaccurate/spoofed device position treated as authoritative;
- locally stored emergency data assumed transmitted;
- user accesses another vessel's GPS trail.

Controls:
- visible offline/not-transmitted state;
- accuracy/fix-age/anomaly warnings;
- vessel RBAC on events and position trails;
- Neptune explicitly does not replace GMDSS, EPIRB, VHF/DSC, AIS/LRIT, ECDIS, or official bridge procedures.

### Billing/webhook manipulation

Threats:
- forged subscription webhook;
- customer manually changes plan in client.

Controls:
- Stripe signature verification;
- server-side entitlement lookup;
- fail-closed webhook when secret not configured;
- CI verifies fail-closed behavior without secrets.

### Database compromise/corruption

Threats:
- credential exposure;
- weak TLS;
- destructive migration;
- audit tampering;
- provider outage.

Controls:
- explicit TLS configuration;
- versioned transactional migrations and advisory lock;
- append-only audit trigger;
- disaster-recovery runbook;
- production backup/PITR requirement.

External launch gate:
- provider backup/PITR must actually be enabled and restore-tested before an RPO/RTO or backup claim is made.

### Supply-chain compromise

Threats:
- vulnerable npm dependency;
- malicious source change;
- committed secret;
- untested production deployment.

Controls:
- pinned Next/React/WebAuthn versions;
- high-severity npm audit gate;
- Dependabot;
- TypeScript/build/security/HTTP/database/accessibility CI;
- repository secret regression scan;
- CycloneDX SBOM artifact generation;
- Vercel deployment traceability to Git SHA.

## Highest-risk residual items before broad enterprise launch

1. Independent penetration test and remediation.
2. Production backup/PITR enablement and successful restore exercise.
3. Physical device/offline/GPS acceptance drill.
4. Manual WCAG 2.2 AA assessment and remediation before any conformance claim.
5. Privacy/contract/DPA/subprocessor review by qualified counsel.
6. OIDC provider-specific acceptance testing before enabling SSO for a customer.
7. Full offline simultaneous-edit conflict strategy if enterprise requirements demand deterministic merge rather than ordered replay.
