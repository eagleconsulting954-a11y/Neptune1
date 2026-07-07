# Neptune Maritime CRM

A premium, production-ready front-end MVP for Neptune: a maritime CRM and compliance command center built around vessel relationships, transit clearance, filing workflows, document intelligence, and executive visibility.

## What is included

- Premium responsive dashboard with functional sidebar, nested dropdown navigation, and mobile drawer behavior.
- Working pages for command center, voyages, compliance, filing builder, document vault, CRM, analytics, automation, and settings.
- Sprint 3 MVP features: batch filing queue, validation rules, compliance deadline board, document extraction queue, and filing package builder.
- Sprint 4 MVP features: integrations monitor, executive analytics, audit timeline, notification routing, client portal readiness, and role/security controls.
- No backend required for preview. State is stored locally in the browser for demo interactions.

## Run locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Suggested next backend steps

1. Replace local sample data with API routes for vessels, clients, transits, filings, and documents.
2. Add authentication and workspace-level RBAC.
3. Connect OCR/document extraction service.
4. Add notification workers for deadline alerts and filing status changes.
5. Connect payment/subscription and audit log persistence.
