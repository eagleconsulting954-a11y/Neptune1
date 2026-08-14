# Neptune Vessel Command

Neptune1 is a full-stack maritime vessel-operations platform for captains, heads of department, fleet managers, safety teams, engineers, crewing, procurement, shore operations, and designated Neptune platform administrators.

## Production identity and access

Neptune uses layered authorization rather than relying on hidden UI controls:

- New organization accounts require verified email ownership before login.
- Signup passwords require at least 12 characters.
- Login attempts are rate limited by email and network source with temporary lockout after repeated failures.
- Authenticator MFA (TOTP) supports encrypted secrets and one-time recovery codes.
- WebAuthn passkeys support phishing-resistant registration and login with required user verification.
- Signed HTTP-only session cookies are linked to revocable server-side session records.
- Users can revoke individual sessions or every other device session.
- Organization managers can invite, deactivate, reactivate, and assign roles to users.
- Vessel-scoped users receive explicit vessel view/edit permissions enforced by protected APIs.
- Deactivation revokes the affected user's active sessions.
- Managed devices can be revoked or marked for offline-data wipe on their next successful connection.
- Security-sensitive changes are written to an append-only organization audit table protected from UPDATE and DELETE by a PostgreSQL trigger.

CRM, CRM analytics, `/admin`, and `/platform-admin` are not customer subscription modules. They are restricted in code to exactly two designated Neptune administrator identities:

```text
francis@canalclear.org
rajput.jaspal@yahoo.in
```

The allowlist is intentionally not configurable through production environment variables or organization roles.

## Production data and trial policy

- Every new organization receives a clean workspace with no sample vessels, synthetic duties, demo analytics, or invented emergency contacts.
- Dashboard totals, alerts, readiness, port intelligence, and operational views are calculated only from records belonging to that organization and permitted vessels.
- The public `/demo` workspace remains isolated in browser storage and never writes demo information into production organization records.
- A real signup creates a 14-day trial in PostgreSQL, sends an email-verification link, and withholds workspace login until verification succeeds.
- Trial and paid access are checked by middleware and protected APIs. When the trial expires, the workspace is paused and redirected to `/trial-expired`.
- Organization records remain stored after cutoff and return after a verified paid subscription.
- Writes are rejected when `DATABASE_URL` is not configured.
- MRCC contacts require an authoritative source URL and verification date before they can be stored.
- Weather, wave, current, congestion, and bunker-price information is planning support only and must not replace official bridge, GMDSS, VTS, ECDIS, NAVTEX, SafetyNET, or charted information.

## Offline ocean operations

Neptune is installable as a Progressive Web App and can continue operating after a vessel loses satellite, cellular, or port connectivity.

- The application shell and last authenticated workspace page are cached after a successful online visit.
- Successful API responses are stored locally in IndexedDB for the signed-in device.
- Previously synchronized vessel, delegation, maintenance, certificate, incident, activity, EV-project, duty-setup, safety, emergency-GPS, and maritime-intelligence records can remain readable offline when previously loaded.
- Supported operational writes are accepted locally with temporary offline IDs and placed into an ordered synchronization queue.
- Queued creates, updates, and deletes synchronize automatically when connectivity returns.
- Offline-created records are mapped to permanent PostgreSQL IDs after synchronization.
- Emergency GPS positions are stored locally and synchronized in ordered batches after reconnection.
- The interface displays offline, queued-change, and synchronization state.
- Local offline records and queued writes are cleared on logout/account switch and can be cleared by a managed-device wipe request when the device reconnects.
- Live weather, ocean, congestion, external bunker pricing, and authority information remain last-known data until connectivity returns.
- Initial login, first-time data download, subscription verification, password recovery, Stripe billing, passkey enrollment, invitations, and external-provider refreshes require connectivity.

Offline use requires one successful authenticated online load on that device before sailing outside coverage. Offline storage is device-local and should only be enabled on company-controlled hardware with operating-system encryption and access controls.

## Enterprise security center

Authenticated users can access:

```text
/security-center
/passkeys
```

The security center provides:

- verified-email and MFA state;
- active session inventory and revocation;
- organization profile controls;
- secure user invitations;
- role and vessel-permission administration;
- user deactivation/reactivation;
- managed-device status, GPS permission, queue depth, last sync, revocation, and wipe requests;
- immutable audit evidence.

The passkey workspace supports WebAuthn registration, device/security-key user verification, credential inventory, removal, and passwordless passkey login from `/login`.

## Database migrations and PostgreSQL TLS

Neptune runs versioned migrations from `src/lib/server/migrations.ts` using:

- a `schema_migrations` ledger;
- a PostgreSQL advisory lock to prevent concurrent migration application;
- one transaction per migration;
- additive identity, session, MFA, passkey, invitation, vessel-permission, audit, and managed-device schema changes.

Production PostgreSQL uses an explicit TLS posture rather than ambiguous connection-string aliases. `PG_SSL_REJECT_UNAUTHORIZED=true` is the default expectation. Use `PG_SSL_CA_BASE64` when your provider requires a specific CA bundle.

## Included product areas

- Command dashboard and vessel registry.
- Maritime Intelligence for weather, ocean conditions, ports, congestion, bunkering planning, and verified MRCC contacts.
- Delegation, hot-work, and inspection workflows.
- Maintenance and work orders.
- Certificate tracking.
- Incident and corrective-action records.
- Activity and audit evidence.
- Future EV vessel program workspace.
- No Other Master safety, welfare, insurance, and emergency workspace.
- Emergency GPS recorder with offline local persistence and reconnect synchronization.
- Installable offline-capable PWA.
- Stripe subscription billing.
- Secure password recovery and transactional email.
- Global application error reporting and designated-admin platform monitoring.

## Password recovery

```text
/forgot-password
/reset-password?token=<one-time-token>
```

Password-reset requests use generic responses to limit account enumeration. Tokens are stored as SHA-256 hashes, expire after 30 minutes, and become unusable immediately after successful password update.

## Platform owner portal

The designated Neptune platform administrators can use:

```text
/platform-admin
```

It includes organization and signup metrics, subscription status, conversion, production configuration health, system-error monitoring, and bug-resolution controls.

## Security and CI gates

The repository includes `.github/workflows/build.yml` and `scripts/security-smoke.mjs`.

Every main-branch and pull-request CI run performs:

```text
npm install
npm run typecheck
npm run test:security
npm run build
npm run test:http
npm run audit:high
```

The static security regression suite checks exact administrator access, CRM restrictions, verified signup, lockout, MFA, passkeys, revocable sessions, versioned migrations, append-only audit protection, role/vessel authorization, device controls, browser security headers, and pinned framework versions.

The HTTP integration suite boots the production Next.js build and verifies security headers plus anonymous rejection/redirect behavior for protected application and API routes.

Dependabot monitors npm and GitHub Actions dependencies.

## Local development

```bash
npm install
npm run dev
```

Use Node.js 22 for parity with CI.

## Required production environment variables

See `.env.example`. Minimum production categories are:

```text
NEXT_PUBLIC_APP_URL=https://your-domain.com
AUTH_SECRET=<long-random-secret>
DATABASE_URL=postgres://...
PG_SSL_MODE=verify-full
PG_SSL_REJECT_UNAUTHORIZED=true
PG_SSL_CA_BASE64=
ALLOW_DEMO_LOGIN=false
RESEND_API_KEY=re_...
SECURITY_FROM_EMAIL=Neptune Security <security@your-verified-domain.com>
PASSWORD_RESET_FROM_EMAIL=Neptune <account@your-verified-domain.com>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CAPTAIN=price_...
STRIPE_PRICE_FLEETOPS=price_...
STRIPE_PRICE_FULL_VESSEL_ACCESS=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

There are deliberately no environment variables for widening CRM/platform-admin access.

## Provider configuration

Open-Meteo endpoints are configured by default for development. Review commercial licensing and use appropriate customer endpoints/API credentials for paid production use when required.

```text
OPEN_METEO_API_KEY=
OPEN_METEO_WEATHER_BASE_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_MARINE_BASE_URL=https://marine-api.open-meteo.com/v1/marine
OPEN_METEO_GEOCODING_BASE_URL=https://geocoding-api.open-meteo.com/v1/search

MARINETRAFFIC_API_KEY=
MARINETRAFFIC_PORT_CONGESTION_URL=

BUNKER_PRICE_PROVIDER_NAME=
BUNKER_PRICE_API_KEY=
BUNKER_PRICE_API_URL=
```

## Disaster recovery

Application-level controls do not replace infrastructure backups. Production launch requires the PostgreSQL provider to have encrypted automated backups and point-in-time recovery enabled, plus a tested restore procedure and documented RPO/RTO. See `docs/DISASTER_RECOVERY.md` after provisioning infrastructure.

The database schema initializes automatically on backend access and applies outstanding migrations. `/api/bootstrap` exists only for the two designated Neptune administrators and is not a public initialization endpoint.
