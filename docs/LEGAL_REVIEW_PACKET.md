# Neptune Enterprise Legal Review Packet

This packet identifies the customer-facing documents and decisions required before broad enterprise contracting. It deliberately does not invent legal commitments that depend on Neptune's final company entity, customer jurisdictions, infrastructure providers, insurance, or negotiated terms.

## Documents to finalize with qualified counsel

### Terms of Service / Master Subscription Agreement

Confirm:
- contracting entity and address;
- permitted users and acceptable use;
- customer responsibility for user/device administration;
- maritime safety disclaimer and official-system precedence;
- subscription, fees, taxes, renewal, suspension, and termination;
- customer data ownership/license needed to operate the service;
- confidentiality;
- intellectual property;
- warranties/disclaimers;
- limitations of liability;
- indemnities where appropriate;
- force majeure;
- governing law/venue;
- dispute process;
- order-of-precedence among MSA, order form, DPA, SLA, and security exhibits.

### Privacy Policy

Confirm:
- data controller/business identity and contact;
- categories of personal data;
- purposes/legal bases where applicable;
- cookies/session/local storage use;
- emergency/geolocation data treatment;
- sharing/subprocessors;
- international transfers;
- retention;
- data-subject rights and request process;
- children's/minor data position;
- security disclosures at an appropriate level;
- effective date/change process.

### Data Processing Agreement

Confirm:
- processor/controller roles;
- documented processing instructions;
- confidentiality obligations;
- security measures;
- subprocessors and notification process;
- assistance with data-subject requests;
- incident/breach notification obligations;
- return/deletion after termination;
- audit/assurance rights;
- cross-border transfer mechanism if applicable;
- annex describing data subjects, data types, purpose, and processing duration.

### Service Level Agreement

Do not set an uptime number until production monitoring, provider architecture, support staffing, backup/PITR, and measured recovery results support it.

If an SLA is offered, define:
- covered production service;
- uptime calculation and exclusions;
- maintenance windows;
- severity levels;
- support response targets;
- service credits/remedies;
- incident communication;
- dependencies/exclusions for customer devices, satellite/network connectivity, identity providers, and external maritime feeds.

### Security Addendum

Use the implemented controls in:
- `docs/SECURITY_OPERATIONS.md`;
- `docs/ASVS_READINESS.md`;
- `docs/THREAT_MODEL.md`;
- `docs/DISASTER_RECOVERY.md`;
- `docs/DATA_GOVERNANCE.md`.

Do not state SOC 2, ISO 27001, penetration-test completion, WCAG conformance, specific RPO/RTO, or backup guarantees until corresponding evidence exists.

## Maritime-specific legal/safety review

Counsel and qualified maritime operational reviewers should specifically review:
- Maritime Intelligence disclaimer;
- No Other Master operational-reference content;
- emergency GPS language;
- MRCC/authority contact presentation;
- insurance/family-support information;
- Future EV proposed/future material;
- any automated recommendation that could be mistaken for navigation, distress, regulatory, class, flag, or legal advice.

## Commercial and insurance review

Before material enterprise revenue, review whether Neptune should carry or document:
- technology errors & omissions / professional liability;
- cyber liability;
- general commercial liability;
- contractual indemnity requirements;
- incident-response vendors;
- business interruption implications.

This list is for business review and is not insurance advice.

## Required factual inputs before final documents

- legal company name/entity;
- registered/business address;
- privacy/security contact;
- support contact;
- production Vercel account/entity arrangement;
- production PostgreSQL provider and region;
- Resend account/entity/region details as applicable;
- Stripe contracting entity;
- maritime data providers actually enabled in production;
- OIDC/SSO providers used by customers;
- approved retention periods;
- approved backup/PITR retention;
- measured restore test result;
- approved support hours/severity response targets;
- customer countries/jurisdictions targeted at launch.

## Launch decision

The repository may be technically release-ready while these legal/commercial documents are still pending. Neptune should not execute enterprise contracts or publish unsupported compliance/security promises until the applicable documents and evidence have been reviewed and approved by the business and qualified counsel.
