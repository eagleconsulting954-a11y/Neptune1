# Neptune Security Policy

## Reporting a security issue

Do not open a public GitHub issue for a suspected vulnerability that could expose Neptune customer, vessel, credential, billing, emergency, or administrative data.

Until a dedicated security mailbox is published on the production domain, contact the Neptune operator through the private business contact channel already used for the account and clearly mark the message **Security Report**.

A useful report should include:

- affected URL or component;
- vulnerability category;
- reproduction steps;
- proof of impact using only accounts/data you are authorized to test;
- browser/device/version where relevant;
- whether the issue affects online, offline/PWA, emergency GPS, billing, identity, or platform administration;
- suggested remediation if known.

Do not include credentials, private keys, full customer datasets, or unnecessary personal information in the report.

## Safe testing expectations

Security research must not:

- access or modify data belonging to another customer, organization, vessel, or user;
- interfere with vessel operations, emergency communications, safety systems, or maritime infrastructure;
- perform denial-of-service or high-volume automated attacks;
- exfiltrate credentials or secrets beyond what is necessary to prove the issue;
- send unsolicited communications to Neptune customers or crew;
- attack third-party services such as Stripe, Resend, Vercel, database providers, identity providers, or maritime-data providers.

Use a dedicated test organization and test vessels whenever possible.

## Response process

Neptune will triage security reports by reproducibility, exploitability, affected data/actions, tenant boundary impact, privilege impact, and operational/safety risk. Material fixes should pass the enterprise CI workflow and targeted regression tests before production deployment.

Critical and high-severity production dependency findings are treated as release blockers unless there is a documented, reviewed risk acceptance.

## Supported version

The supported version is the current production deployment from the `main` branch. Older preview deployments and historical releases are not separately maintained unless a customer contract states otherwise.

## Security claims

This repository contains security controls and readiness documentation, but it does not by itself constitute SOC 2, ISO 27001, OWASP ASVS certification, penetration-test attestation, or a legal/compliance opinion. Such claims require the applicable independent assessment and evidence.
