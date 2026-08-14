# Neptune Disaster Recovery Runbook

## Purpose

This runbook defines the application-level recovery procedure for Neptune. It does not itself enable database backups. Production launch requires the PostgreSQL hosting provider to have encrypted automated backups and point-in-time recovery (PITR) enabled.

## Required production targets

Before launch, the operations owner must record and approve:

- Recovery Point Objective (RPO): target maximum acceptable data loss.
- Recovery Time Objective (RTO): target maximum acceptable service-restoration time.
- Backup retention period.
- PITR retention window.
- Backup region and encryption policy.
- Named primary and secondary incident owners.
- Last successful restore-test timestamp.

Recommended initial operating target for a commercial SaaS pilot is an RPO measured in minutes and an RTO measured in hours, subject to the guarantees of the selected database provider and customer contracts. Do not advertise an SLA until the infrastructure has been measured and contractually reviewed.

## Backup requirements

1. Enable automated encrypted PostgreSQL backups at the database provider.
2. Enable PITR/WAL retention where supported.
3. Keep backups logically separate from the active production database.
4. Protect backup-provider accounts with MFA and least privilege.
5. Restrict production database credentials to the application and authorized operators.
6. Never copy production database credentials into source control, issues, support tickets, or client logs.
7. Record the provider backup policy and retention period in the internal security register.

## Recovery procedure

### 1. Declare the incident

- Record UTC incident start time.
- Identify whether the failure affects application compute, database availability, data integrity, authentication, external providers, or multiple layers.
- Freeze nonessential production changes.
- Open an internal incident record and assign an incident commander.

### 2. Preserve evidence

- Preserve Vercel runtime/build logs.
- Preserve PostgreSQL provider event logs.
- Preserve Neptune `system_errors` and append-only `audit_events` where available.
- Record the deployed Git commit SHA and database migration state.
- Do not modify or delete audit evidence during recovery.

### 3. Select recovery point

For data corruption or destructive changes, choose the most recent verified restore point before the incident. Compare the proposed point against the approved RPO and document any expected data gap.

### 4. Restore into an isolated environment first

- Restore the database to a new isolated database instance when the provider supports it.
- Configure a temporary non-production Neptune deployment against that restored instance.
- Run migrations through the normal versioned migration runner.
- Execute the enterprise CI/security smoke checks where applicable.
- Validate organization, user, vessel, subscription, emergency-event, and audit table integrity.
- Validate the two designated administrator identities without changing the allowlist.

### 5. Validate offline reconciliation risk

After a database rollback, vessel devices may contain queued writes created after the selected restore point. Before reconnecting affected devices:

- identify the restore cutoff time;
- review managed-device `last_sync_at` and queue state;
- determine whether queued offline creates/updates could duplicate already restored records;
- coordinate reconnection for affected vessels;
- preserve emergency GPS records and do not discard them merely to simplify reconciliation.

### 6. Promote the restored database

- Update production `DATABASE_URL` only after validation.
- Confirm TLS verification settings.
- Confirm Stripe webhook configuration and application URL.
- Redeploy the verified production commit.
- Validate `/`, `/login`, `/dashboard`, `/security-center`, and key protected APIs.
- Confirm background/offline synchronization behavior with a controlled test account/device.

### 7. Post-recovery verification

Confirm:

- email verification/login/password reset;
- authenticator MFA and passkey login;
- subscription entitlement checks;
- vessel-level RBAC;
- CRM/admin access restricted to the exact two designated emails;
- offline queue synchronization;
- emergency GPS event/position synchronization;
- append-only audit writes;
- managed-device registration;
- Stripe webhook processing;
- external maritime providers.

## Restore testing

Run a restore exercise at least quarterly during early enterprise operation, and after material database/provider architecture changes.

For each exercise record:

- test date;
- backup/PITR point used;
- time to obtain the backup;
- time to restore;
- time to pass application validation;
- achieved RPO;
- achieved RTO;
- defects found;
- corrective actions and owners.

A backup is not considered operationally verified until a restore test has succeeded.

## Communication

Customer and regulatory notification requirements depend on the incident, contracts, jurisdiction, and affected data. Use qualified legal/privacy counsel for notification decisions. Do not make unsupported statements about data loss or breach status before the investigation establishes the facts.
