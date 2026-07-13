# Neptune Vessel Command CRM

Neptune1 is a full-stack Next.js maritime CRM and vessel operations platform for captains, heads of department, fleet managers, safety teams, engineers, crewing, procurement, commercial administrators, and the Neptune platform owner.

## Production data and trial policy

- Every new organization receives a clean workspace with no sample vessels, fake CRM contacts, synthetic duties, demo analytics, or invented emergency contacts.
- Dashboard totals, alerts, readiness, CRM analytics, port intelligence, and operational views are calculated only from records entered by that organization.
- The public `/demo` workspace remains isolated in browser storage and never writes demo information into production organization records.
- A real signup starts one 14-day trial in PostgreSQL and redirects directly to `/dashboard`.
- Trial and paid access are checked by middleware and protected APIs. When the trial expires, the workspace is automatically paused and redirected to `/trial-expired`.
- Organization records remain stored after cutoff and are restored after a verified paid subscription.
- Writes are rejected when `DATABASE_URL` is not configured.
- MRCC contacts require an authoritative source URL and verification date before they can be stored.
- Weather, wave, current, congestion, and bunker-price information is planning support only and must not replace official bridge, GMDSS, VTS, ECDIS, NAVTEX, SafetyNET, or charted information.

## Included

- Premium responsive landing page, pricing, resources, signup, login, checkout, vessel dashboard, public demo, tenant CRM admin, and platform owner administration.
- Multi-tenant organization and user model with signed HTTP-only sessions.
- PostgreSQL persistence and Stripe subscription billing.
- Secure forgot-password flow with hashed one-time tokens, 30-minute expiry, request throttling, one-use enforcement, and Resend email delivery.
- CRUD APIs for vessels, delegation duties, work orders, certificates, incidents, CRM accounts, activity events, subscriptions, ports, bunkering plans, MRCC contacts, and port-congestion snapshots.
- Hot-work and inspection delegation workflows.
- CRM pipeline, weighted pipeline, stage distribution, CSV export, operational analytics, and audit activity.
- Global client error reporting, recoverable application error boundary, system error fingerprinting, and owner bug-resolution workflow.
- Maritime Intelligence workspace with:
  - Current weather by coordinates or searched location.
  - Seven-day atmospheric forecast.
  - Wave height, wave direction, swell, period, sea-surface temperature, and ocean-current forecast.
  - Port information, terminal notes, maximum draft, anchorage notes, bunkering availability, and live congestion-provider connection.
  - Bunkering voyage calculation, reserve, recommended lift, estimated cost, and saved plans.
  - Verified MRCC/JRCC contact directory and nearest-contact calculation.
  - Premium lighthouse, compass, route, buoy, radar, and horizon visuals designed to engage younger maritime professionals.

## Password recovery

```text
/forgot-password
/reset-password?token=<one-time-token>
```

The password-reset request endpoint returns the same success message whether or not an account exists, limiting account enumeration. Tokens are stored as SHA-256 hashes, expire after 30 minutes, and become unusable immediately after a successful password update.

Required email variables:

```text
RESEND_API_KEY=re_...
PASSWORD_RESET_FROM_EMAIL=Neptune <account@your-verified-domain.com>
```

## Platform owner portal

The separate owner portal is available at:

```text
/platform-admin
```

It includes:

- Total organizations and signup counts for today, 7 days, and 30 days.
- Fourteen-day signup trend.
- Active trials, expired trials, active paid accounts, billing attention, and paid conversion rate.
- Searchable organization list with administrator, trial end, plan, status, vessel count, duty count, and port count.
- CSV signup export.
- Immediate application bug feed, critical and unresolved counts, recurring error fingerprints, and resolve/reopen controls.
- Production configuration health for PostgreSQL, authentication, application URL, Stripe, weather, congestion, bunker pricing, and platform-owner access.

Only users with role `platform_admin`, `owner`, or `super_admin`, or emails configured in `PLATFORM_ADMIN_EMAILS`, can load the platform API.

## Maritime intelligence endpoints

```text
GET  /api/v1/intelligence/geocode?q=Miami
GET  /api/v1/intelligence/weather?lat=25.7617&lon=-80.1918
GET  /api/v1/intelligence/port-congestion?portId=<saved-port-id>
GET  /api/v1/intelligence/bunker-plan
POST /api/v1/intelligence/bunker-plan
GET  /api/v1/intelligence/mrcc?lat=25.7617&lon=-80.1918
POST /api/v1/intelligence/mrcc
```

The generic authenticated API also supports:

```text
/api/v1/ports
/api/v1/bunker_plans
/api/v1/mrcc_contacts
/api/v1/port_congestion_snapshots
```

## Local development

```bash
npm install
npm run dev
```

## Required production environment variables

```text
NEXT_PUBLIC_APP_URL=https://your-domain.com
AUTH_SECRET=long-random-secret
DATABASE_URL=postgres://user:password@host:5432/neptune
PLATFORM_ADMIN_EMAILS=comma-separated-owner-emails
ALLOW_DEMO_LOGIN=false
RESEND_API_KEY=re_...
PASSWORD_RESET_FROM_EMAIL=Neptune <account@your-verified-domain.com>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CAPTAIN=price_...
STRIPE_PRICE_FLEETOPS=price_...
STRIPE_PRICE_ENTERPRISE=price_...
```

## Weather and ocean provider

Open-Meteo endpoints are configured by default for development. Review commercial licensing and use customer endpoints/API credentials for paid production use when required.

```text
OPEN_METEO_API_KEY=
OPEN_METEO_WEATHER_BASE_URL=https://api.open-meteo.com/v1/forecast
OPEN_METEO_MARINE_BASE_URL=https://marine-api.open-meteo.com/v1/marine
OPEN_METEO_GEOCODING_BASE_URL=https://geocoding-api.open-meteo.com/v1/search
```

## Port congestion provider

MarineTraffic/Kpler exposes port-congestion services through API-key authentication. Configure the exact purchased service URL. The URL template supports `{portId}`, `{providerPortId}`, `{unlocode}`, `{latitude}`, and `{longitude}`.

```text
MARINETRAFFIC_API_KEY=
MARINETRAFFIC_PORT_CONGESTION_URL=
```

## Bunker-price provider

The planner works with a manually entered price immediately. An external price feed can be added through a configurable URL template using `{port}` and `{fuelType}`.

```text
BUNKER_PRICE_PROVIDER_NAME=
BUNKER_PRICE_API_KEY=
BUNKER_PRICE_API_URL=
```

The database schema initializes automatically when the application first accesses the backend. It can also be initialized with `GET /api/bootstrap`.
