# Neptune Feature Flags

Neptune includes a server-only feature flag service in `src/lib/server/feature-flags.ts`. Flags are evaluated on the server and can be overridden globally or for a specific organization through the deployment environment.

## Configuration

Use `NEPTUNE_FEATURE_FLAGS` as JSON:

```json
{
  "global": {
    "passkeys": true,
    "managed_devices": true,
    "experimental_reports": false,
    "experimental_sso": false,
    "experimental_offline_conflict_resolution": false
  },
  "organizations": {
    "org_example": {
      "experimental_reports": true
    }
  }
}
```

Organization-specific values override global values. Global values override repository defaults.

## Current defaults

- `passkeys`: enabled
- `managed_devices`: enabled
- `trust_center`: enabled
- `experimental_reports`: disabled
- `experimental_sso`: disabled
- `experimental_offline_conflict_resolution`: disabled

The experimental flags reserve controlled rollout gates; they do not imply those future features are complete.

## Administration

The two designated Neptune platform administrators can inspect effective flags through:

```text
GET /api/platform-admin/feature-flags
GET /api/platform-admin/feature-flags?orgId=<organization-id>
```

Flag changes are intentionally deployment-controlled rather than customer-editable. Update the production environment only after review and redeploy through the normal CI/release process.

## Security rule

A feature flag may control whether a capability is enabled, but it must never replace authorization. Protected data/actions must still enforce session, organization, role, vessel, plan, and designated-admin checks on the server.
