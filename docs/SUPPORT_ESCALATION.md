# Neptune Enterprise Support & Escalation

This runbook defines an internal operating model. Customer-facing response-time commitments must not be marketed as an SLA until staffing, monitoring, contracts, and measured operating capability support them.

## Severity model

### SEV-1 — Critical service/safety impact

Examples:
- confirmed cross-tenant data exposure;
- unauthorized platform-admin/CRM access;
- production authentication unavailable for a material customer population;
- widespread loss/corruption of production customer records;
- offline emergency GPS records cannot synchronize after connectivity returns due to a Neptune defect;
- active exploitation of a critical vulnerability.

Internal handling target:
- immediate paging of primary engineering/security owner;
- assign incident commander;
- preserve evidence and begin containment;
- consider change freeze/rollback;
- use legal/privacy escalation if personal/customer data may be affected.

### SEV-2 — Major degradation

Examples:
- important fleet workflow unavailable with no acceptable workaround;
- repeated failed offline synchronization affecting a vessel/fleet;
- Stripe subscription state not updating correctly;
- significant maritime-provider integration degradation where Neptune is at fault;
- high-severity security defect with limited exploitability.

### SEV-3 — Standard defect

Examples:
- noncritical module malfunction;
- reporting/export problem;
- role/permission configuration issue with workaround;
- UI/accessibility issue not blocking core operations.

### SEV-4 — Request / question

Examples:
- product guidance;
- feature request;
- data migration question;
- configuration assistance.

## Escalation roles

Before launch, name individuals for:

- Primary incident commander.
- Secondary incident commander.
- Security lead.
- Application engineering lead.
- Database/provider owner.
- Billing/Stripe owner.
- Customer communications owner.
- Legal/privacy escalation contact.
- Maritime operational reviewer for safety-sensitive content.

## Required operational channels

Before enterprise launch configure:

- monitored support intake;
- private security intake;
- internal incident channel;
- paging/on-call mechanism appropriate to promised support hours;
- customer status/incident communication process;
- vendor escalation contacts for Vercel, PostgreSQL provider, Stripe, Resend, and active maritime data providers.

## Incident lifecycle

1. Detect and assign severity.
2. Create incident timeline in UTC.
3. Preserve logs, deployment SHA, DB/provider evidence, audit events, and affected request IDs.
4. Contain unauthorized access or failing change.
5. Communicate verified facts only.
6. Restore through rollback/forward-fix/DR procedure as appropriate.
7. Validate authentication, RBAC, billing, offline sync, emergency GPS, reports, and audit integrity after recovery.
8. Document root cause and corrective actions.
9. Add regression test for reproducible software failures.
10. Close only when remediation and follow-up owners are recorded.

## Customer communication rules

- Do not imply Neptune has transmitted a maritime distress alert when it has only stored data locally.
- Do not blame external providers before evidence supports the cause.
- Do not disclose another customer's identity or records during incident communications.
- Do not make legal conclusions such as “no breach occurred” before the relevant investigation/review.
- Use exact affected dates/times, services, and mitigations when known.

## SLA conversion

If Neptune later offers contractual support response targets, derive them from actual staffed coverage and historical response measurements. The internal severity framework can be mapped to contractual targets only after business/legal approval.
