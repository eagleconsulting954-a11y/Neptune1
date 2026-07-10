# Neptune Vessel Command CRM

Neptune1 is a full-stack Next.js maritime CRM and vessel operations platform for captains, heads of department, fleet managers, safety teams, engineers, crewing, procurement, and commercial administrators.

## Production data policy

- No sample vessels, sample CRM accounts, sample incidents, sample certificates, sample work orders, or synthetic analytics are included.
- The admin dashboard displays only records stored for the signed-in organization.
- CRM charts are calculated from actual CRM record creation dates and values.
- Platform activity is calculated from actual activity records.
- Writes are rejected when `DATABASE_URL` is not configured, preventing nonpersistent browser or server-memory data from being mistaken for production data.
- Legacy sample record IDs and `.example` CRM addresses are removed automatically when the schema initializes.

## Included

- Premium responsive landing page, pricing, resources, signup, login, checkout, vessel dashboard, and administrator dashboard.
- Multi-tenant organization and user model.
- Signed HTTP-only session authentication.
- PostgreSQL persistence.
- Stripe subscription checkout and webhook support.
- CRUD APIs for vessels, delegation duties, work orders, certificates, incidents, CRM accounts, activity events, and subscriptions.
- CRM pipeline, weighted pipeline, stage distribution, CSV export, operational analytics, and audit activity.
- Hot-work and inspection delegation workflows.

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

The schema initializes automatically when the application first accesses the backend. It can also be initialized with `GET /api/bootstrap`.
