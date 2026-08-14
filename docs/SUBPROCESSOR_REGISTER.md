# Neptune Provider / Subprocessor Register

This is a technical inventory derived from integrations present in the Neptune repository. A service becomes a contractual subprocessor only when it is actually enabled for production and processes customer personal data. Legal/privacy counsel should classify the final production list.

| Service category | Integration visible in Neptune | Typical purpose | Production status to confirm |
|---|---|---|---|
| Application hosting | Vercel | Web application, server functions, CDN/deployment | Confirm production account/entity, regions, security settings |
| PostgreSQL database | `DATABASE_URL` provider not hard-coded | Customer/operational persistence | Identify provider, region, encryption, backup/PITR, DPA |
| Payment provider | Stripe | Subscription checkout/billing/webhooks | Confirm production account and DPA/privacy terms |
| Transactional email | Resend | Verification, invitations, password reset/security email | Confirm verified production domain/account and DPA/privacy terms |
| Weather/ocean | Open-Meteo endpoints configurable | Atmospheric/marine planning data | Confirm commercial terms/licensing and whether personal data is sent |
| Port congestion | MarineTraffic/Kpler configurable endpoint | Port/congestion planning | Confirm purchased service/entity/terms before production use |
| Bunker pricing | Provider configurable | Fuel-price planning | Identify provider before enabling |
| Enterprise identity | Customer OIDC provider | Optional SSO authentication | Customer/provider-specific; confirm before enabling |
| Source/CI | GitHub | Source control, Actions, security artifacts | Confirm organization/repository access controls |

## Required register fields before enterprise contracting

For each enabled provider record:

- legal provider name;
- service name;
- purpose;
- personal/customer data categories;
- processing/storage locations;
- transfer mechanism if applicable;
- security/assurance documentation;
- DPA/contract link or internal contract reference;
- retention/deletion terms;
- incident notification terms;
- date approved;
- change-notification process.

## Change control

Adding a new production provider that receives customer data should require:

1. technical/security review;
2. data-flow review;
3. contract/DPA/privacy review as applicable;
4. update to this register;
5. customer notification where contract/law requires it;
6. release approval before credentials are enabled.

Do not publish a provider as an active subprocessor merely because optional integration code exists in the repository.
