# Neptune Vessel Command CRM

Neptune1 is a full-stack Next.js maritime CRM and vessel operations platform for captains, heads of department, fleet managers, safety teams, engineers, crewing, procurement, and commercial administrators.

## Production data policy

- No sample vessels, sample CRM accounts, sample incidents, sample certificates, sample work orders, synthetic analytics, or invented emergency contacts are included in production.
- The dashboard displays only records stored for the signed-in organization.
- Writes are rejected when `DATABASE_URL` is not configured.
- MRCC contacts require an authoritative source URL and verification date before they can be stored.
- Weather, wave, current, congestion, and bunker-price information is planning support only and must not replace official bridge, GMDSS, VTS, ECDIS, NAVTEX, SafetyNET, or charted information.

## Included

- Premium responsive landing page, pricing, resources, signup, login, checkout, vessel dashboard, public demo, and administrator dashboard.
- Multi-tenant organization and user model with signed HTTP-only sessions.
- PostgreSQL persistence and Stripe subscription billing.
- CRUD APIs for vessels, delegation duties, work orders, certificates, incidents, CRM accounts, activity events, subscriptions, ports, bunkering plans, MRCC contacts, and port-congestion snapshots.
- Hot-work and inspection delegation workflows.
- CRM pipeline, weighted pipeline, stage distribution, CSV export, operational analytics, and audit activity.
- Maritime Intelligence workspace with:
  - Current weather by coordinates or searched location.
  - Seven-day atmospheric forecast.
  - Wave height, wave direction, swell, period, sea-surface temperature, and ocean-current forecast.
  - Port information, terminal notes, maximum draft, anchorage notes, bunkering availability, and live congestion-provider connection.
  - Bunkering voyage calculation, reserve, recommended lift, estimated cost, and saved plans.
  - Verified MRCC/JRCC contact directory and nearest-contact calculation.
  - Premium lighthouse, compass, route, buoy, radar, and horizon visuals designed to engage younger maritime professionals.

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
ALLOW_DEMO_LOGIN=false
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
