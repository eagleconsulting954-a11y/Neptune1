# Neptune Production Environment Contract

Do not commit production secret values. Configure them in the deployment platform's encrypted environment-variable store and use separate values for preview/staging and production.

## Core application

```text
NEXT_PUBLIC_APP_URL=https://<production-domain>
AUTH_SECRET=<at-least-64-random-characters>
DATABASE_URL=postgresql://...
ALLOW_DEMO_LOGIN=false
```

`AUTH_SECRET` protects session signatures and derives application cryptographic keys. Rotate it only through a planned incident/change procedure because rotation invalidates current signed sessions and affects encrypted MFA-secret recovery.

## PostgreSQL TLS

```text
PG_SSL_MODE=verify-full
PG_SSL_REJECT_UNAUTHORIZED=true
PG_SSL_CA_BASE64=<provider-CA-bundle-if-required>
```

Do not use the CI-only `PG_SSL_MODE=disable` setting in production.

## Transactional security email

```text
RESEND_API_KEY=re_...
SECURITY_FROM_EMAIL=Neptune Security <security@verified-domain>
PASSWORD_RESET_FROM_EMAIL=Neptune <account@verified-domain>
```

Use a verified domain before customer launch.

## Stripe

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CAPTAIN=price_...
STRIPE_PRICE_FLEETOPS=price_...
STRIPE_PRICE_FULL_VESSEL_ACCESS=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

Production launch requires an end-to-end live/test-mode lifecycle exercise appropriate to the environment: checkout, subscription creation/update/cancel, webhook signature verification, entitlement update, expired/past-due behavior, and restore after payment.

## Maritime providers

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

Only enable providers under production terms/licensing appropriate to commercial customer use.

## Optional enterprise OIDC SSO

```text
OIDC_ISSUER_URL=https://<customer-or-broker-idp>
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid email profile
```

The provider must register:

```text
https://<production-domain>/api/auth/sso/callback
```

Do not enable for a customer before provider-specific acceptance testing. SSO authenticates only pre-provisioned Neptune users; Neptune remains the source of organization, role, vessel, CRM, and platform-admin authorization.

## Controlled feature rollout

```text
NEPTUNE_FEATURE_FLAGS={"global":{"experimental_reports":false},"organizations":{}}
```

See `docs/FEATURE_FLAGS.md`. Feature flags never replace server authorization.

## Vercel/Git metadata

Vercel-provided release metadata such as `VERCEL_GIT_COMMIT_SHA` is read when available and should not be manually spoofed in normal production deployments.

## Privileged access

There are intentionally no production environment variables for CRM or platform-admin emails. Those privileges are restricted in application code to exactly:

```text
francis@canalclear.org
rajput.jaspal@yahoo.in
```

Do not reintroduce `PLATFORM_ADMIN_EMAILS`, `NEPTUNE_OWNER_EMAIL`, or another environment-driven privileged allowlist.

## External infrastructure settings to document outside Git

The following are provider/account settings rather than application environment variables:

- Vercel project/team access and MFA;
- production domain/DNS/TLS;
- PostgreSQL network access, region, encryption, automated backup, PITR, retention, and restore test;
- Stripe account users/webhook endpoints;
- Resend domain verification;
- GitHub branch protection and administrator access;
- production monitoring/on-call destinations;
- provider support/escalation contacts.
