# Neptune Data Governance Baseline

This document describes the technical data categories and controls implemented in Neptune. Retention periods, deletion commitments, data-residency promises, and contractual privacy obligations must be approved for the actual production providers and customer jurisdictions before they are represented as binding policy.

## Data categories

### Account and identity data

Examples:
- user name and email;
- password hash;
- email-verification state;
- MFA/passkey public credential metadata;
- session/device metadata;
- organization role and vessel permissions.

Purpose:
- authenticate users;
- authorize organization/vessel access;
- provide account recovery and security evidence.

### Vessel operational data

Examples:
- vessel profiles and readiness;
- delegation duties;
- maintenance/work orders;
- certificates;
- incidents/corrective actions;
- activity and approval evidence;
- maritime planning records.

Purpose:
- customer vessel/fleet operation and accountability.

### Emergency and geolocation data

Examples:
- emergency event state;
- latitude/longitude;
- accuracy, speed, heading, timestamps;
- local/offline synchronization evidence.

Purpose:
- local operational chronology and Neptune record synchronization.

Safety boundary:
- Neptune emergency GPS is not a maritime distress-transmission system and does not replace official bridge/GMDSS equipment or required procedures.

### Commercial/billing metadata

Examples:
- Stripe customer/subscription identifiers;
- Neptune plan/status/current-period information.

Neptune should not store full payment-card data. Payment collection is delegated to the configured payment provider.

### Security/audit data

Examples:
- login/session events;
- permission/user/device changes;
- append-only audit events;
- system error evidence;
- report generation evidence hashes.

Purpose:
- security monitoring, incident investigation, accountability, and enterprise evidence.

## Tenant and vessel isolation

- Organization identity is taken from the authenticated server session, not from customer-controlled request parameters.
- Normal data reads/writes are filtered by organization.
- Vessel-scoped users receive explicit view/edit assignments.
- Organization-wide activity/billing/history is manager-restricted.
- CRM/platform administration is outside customer role/plan authorization and remains restricted to the exact two designated Neptune administrator identities.

## Encryption and transport

Implemented application posture:
- production application is HTTPS-only through the hosting platform;
- HSTS is emitted in production;
- PostgreSQL transport is explicitly configured for TLS verification in production;
- password values are stored only as bcrypt hashes;
- MFA secrets are encrypted with authenticated encryption derived from the deployment secret;
- one-time account tokens/recovery codes are stored as hashes where appropriate;
- passkey private keys remain with the user's authenticator.

Endpoint/offline posture:
- Neptune does not independently encrypt browser IndexedDB records with a second application key;
- company-controlled vessel devices must use operating-system encryption and access controls;
- managed-device revoke/wipe requests take effect when the device successfully reconnects.

## Retention

No customer-facing fixed retention promise should be made solely from this repository.

Before enterprise launch, approve retention periods for at least:
- active customer operational records;
- records after subscription termination;
- emergency/GPS history;
- audit/security evidence;
- system error logs;
- password-reset and email-verification token rows;
- invitations and expired sessions;
- managed-device records;
- database backups/PITR.

Any automated deletion job should be implemented only after those periods are approved and tested against contractual/legal requirements.

## Deletion/export

Current source provides operational/evidence reports and customer-scoped data access but does not claim a final legal data-subject deletion workflow.

Before contractual enterprise launch:
- define organization-offboarding/export procedure;
- define deletion authorization and hold process;
- define treatment of immutable security/audit evidence;
- define backup expiration after deletion;
- document exceptions required for fraud/security/legal obligations;
- have qualified privacy/legal counsel review the resulting customer commitments.

## Data residency

Do not promise a country/region until the production deployment and PostgreSQL provider region are confirmed. The application repository does not determine final database residency by itself.

## Data minimization

Engineering rules:
- do not store payment-card data in Neptune;
- do not put secrets in audit metadata;
- do not persist authenticator private keys;
- keep error/audit metadata bounded;
- avoid collecting location unless required by an emergency/operational workflow;
- avoid adding sensitive personal/medical information without an explicit purpose, access model, retention policy, and legal review.
