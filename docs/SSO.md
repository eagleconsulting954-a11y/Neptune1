# Neptune Enterprise OpenID Connect SSO

Neptune includes an optional OpenID Connect authorization-code + PKCE login path for pre-provisioned users.

## Security model

SSO authentication does not create customer roles or vessel permissions. The identity provider proves the user's identity; Neptune continues to enforce organization membership, active-user status, subscription entitlement, role, vessel scope, and the exact two-identity CRM/platform-admin rule from its own database.

The SSO callback requires:

- a valid state value tied to an HTTP-only short-lived cookie;
- PKCE S256 authorization-code exchange;
- HTTPS provider discovery/token/userinfo endpoints;
- a verified email returned by the provider;
- an existing active and locally verified Neptune user with the same normalized email.

There is no just-in-time organization creation through SSO.

## Required environment variables

```text
OIDC_ISSUER_URL=https://idp.example.com
OIDC_CLIENT_ID=
OIDC_CLIENT_SECRET=
OIDC_SCOPES=openid email profile
```

`NEXT_PUBLIC_APP_URL` and `AUTH_SECRET` must also be configured.

The provider must register the callback URL:

```text
https://<your-neptune-domain>/api/auth/sso/callback
```

The user-facing entry point is:

```text
/sso
```

## Rollout process

1. Configure the provider in a non-production environment.
2. Provision test users in Neptune before SSO login.
3. Confirm provider UserInfo returns the intended verified email.
4. Test state/PKCE failure behavior and expired login attempts.
5. Validate role/vessel boundaries after SSO login.
6. Test user deactivation and session revocation.
7. Complete provider-specific security review before enabling for a customer.
8. Do not treat an identity-provider administrator as a Neptune platform administrator unless the email is one of the two hard-coded designated Neptune identities.

## Limitations

The generic implementation relies on the provider's OpenID Connect discovery, token, and UserInfo endpoints. Provider-specific claims, group mapping, SCIM provisioning, logout federation, and automatic role mapping are not enabled by default and should be implemented only with explicit customer requirements and security review.
