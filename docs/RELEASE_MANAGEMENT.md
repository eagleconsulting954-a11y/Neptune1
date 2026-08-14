# Neptune Release Management

## Release model

Neptune uses GitHub `main` as the production source branch. Every pull request and push to `main` must pass the enterprise CI workflow before it is considered a release candidate.

The CI gate covers:

- TypeScript validity;
- static security regression checks;
- production Next.js build;
- production HTTP security/authentication checks;
- accessibility baseline checks;
- PostgreSQL-backed tenant, vessel-permission, emergency-GPS, audit, and entitlement tests;
- high-severity npm dependency audit.

## Environments

Use three logical environments:

1. Development: local developer environment with non-production credentials and database.
2. Preview/Staging: Vercel preview deployment from a pull request or release-candidate branch using isolated non-production data and provider credentials.
3. Production: Vercel production deployment from `main` with production-only credentials.

Never point a preview deployment at the production database.

## Release candidate procedure

1. Freeze feature scope for the candidate.
2. Create or update a pull request against `main`.
3. Confirm enterprise CI passes without ignored failures.
4. Review the Vercel preview deployment.
5. Run the manual accessibility checklist in `docs/ACCESSIBILITY.md`.
6. Run a physical-device offline/offshore workflow test when offline code changed.
7. Run an emergency-GPS drill when emergency code changed.
8. Verify Stripe lifecycle behavior when billing code or price configuration changed.
9. Verify database migrations against staging before production promotion.
10. Record known risks and approved exceptions.
11. Merge to `main` only after release approval.
12. Verify the production deployment, health endpoint, login, Security Center, and critical APIs.

## Feature rollout

Do not expose incomplete customer features merely because code exists in `main`. Prefer one of:

- plan/module entitlement gates;
- role/vessel-permission gates;
- server-side rollout flags for experimental work;
- isolated preview deployments for incomplete features.

Any future feature-flag implementation must be server-authoritative for protected data/actions. Hiding a button is never sufficient authorization.

## Rollback

For application-only regressions:

1. Identify the last verified production deployment and commit SHA.
2. Confirm whether the failed release introduced a database migration.
3. If no incompatible database change exists, use the hosting provider's rollback/redeploy capability to restore the last verified deployment.
4. Re-run health, authentication, RBAC, billing, offline, and emergency checks after rollback.
5. Open an incident record and preserve deployment/runtime evidence.

For releases with database changes:

- do not blindly roll back application code if the previous version cannot operate against the migrated schema;
- prefer backward-compatible additive migrations;
- use a forward-fix when data/schema rollback would increase risk;
- use the disaster-recovery procedure when a database restore is necessary.

## Migration policy

- Migrations must be additive/backward compatible whenever practical.
- Migration IDs are immutable once applied.
- Each migration is transaction-scoped and guarded by the migration advisory lock.
- Destructive changes require a separate data-retention/export plan and staging validation.
- Large data backfills should not block normal web requests; run them as controlled operations with progress/retry evidence.

## Release evidence

Retain:

- Git commit SHA;
- GitHub Actions run;
- Vercel deployment ID/URL;
- database migration state;
- dependency-audit result;
- manual acceptance-test result;
- rollback candidate;
- release approver;
- release date/time.
