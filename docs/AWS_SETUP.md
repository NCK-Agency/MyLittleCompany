# AWS persistence and identity setup

AWS remains the durable hosting layer for structured company data, private
sources, and invited-user identity. Model generation uses OpenAI and approved
knowledge retrieval reads the structured repository directly. No AWS model,
embedding, vector index, or remote search resource is required.

## 1. Choose one Region

Use one Region for DynamoDB, S3, Cognito, and the application runtime. The demo
currently uses:

```text
MLC_AWS_REGION=us-east-1
```

## 2. DynamoDB table

Create one on-demand table with:

- Partition key `PK` as String.
- Sort key `SK` as String.
- GSI named `GSI1` with String keys `GSI1PK` and `GSI1SK`.
- TTL enabled on the `ttl` attribute.
- Point-in-time recovery when available.

Set:

```text
DYNAMODB_TABLE_NAME=<table-name>
```

The company profile stores the provider-neutral assistant tier. Existing, new,
and reset companies default to `BALANCED`. Conditional writes protect candidate
edits, approval transitions, owner settings changes, and idempotent waitlist
submissions.

Bootstrap only the demo profile and seeded memberships when absent:

```bash
pnpm bootstrap:aws-demo
BOOTSTRAP_OWNER_EMAIL=owner@example.com pnpm bootstrap:cognito
```

The bootstrap must not replace or delete approved knowledge.

## 3. Private S3 bucket

Create one private encrypted bucket for sources, imported content, canonical
memory documents, and artifacts.

Required configuration:

- Block all public access.
- Enable server-side encryption.
- Avoid browser CORS unless a reviewed direct-upload flow actually needs it.
- Keep every object company-prefixed below the application prefix.

Set:

```text
S3_BUCKET_NAME=<bucket-name>
```

Reserve these prefixes:

```text
sources/
imports/
memories/
artifacts/
```

The `memories/` objects are provenance/export copies. Repository-backed
retrieval does not scan or ingest S3 content.

Configure Lifecycle rules for imported raw sources using the tags written by the
application:

- `retention=zero-candidate-24-hours`: expire after one day.
- `retention=all-ignored-7-days`: expire after seven days.
- `retention=unapproved-30-days`: expire after 30 days.
- `retention=approved`: do not expire automatically.

Owner deletion leaves the metadata-only citation tombstone required for audit.

## 4. Cognito managed login

Create a user pool app client with a secret, authorization-code grant,
`openid email profile` scopes, Auth.js callback
`/api/auth/callback/cognito`, and the configured post-logout URL. Use email as
the sign-in alias and create a managed-login domain.

Disable self-service sign-up. Owners invite people through People & access;
public visitors use the waitlist. The runtime identity needs only
`cognito-idp:AdminGetUser` and `cognito-idp:AdminCreateUser` on this user pool for
that invitation flow.

Configure the `COGNITO_*`, `AUTH_URL`, and `AUTH_SECRET` values from
`.env.example`, then run the bootstrap commands above. Ownership comes from the
application membership record, never an identity-provider claim.

### Cognito acceptance path

1. Open `/login`; confirm it hands invited users to managed login and offers no
   public sign-up. `/login-demo` remains a separate labelled seeded-account path.
2. Submit the same waitlist email twice and confirm one DynamoDB entry and the
   same public success response.
3. Complete the owner's first sign-in and temporary-password change.
4. Invite a second person and grant one department `READ`.
5. Confirm first login activates that membership.
6. Confirm the granted company/department knowledge is readable while a sibling
   department and Review remain denied.
7. Change or pause access and confirm the next request reflects it without a new
   login.

## 5. Runtime IAM capabilities

Create a dedicated Netlify runtime identity. Do not reuse an administrator or
the AWS root identity.

### DynamoDB

- `GetItem`
- `PutItem`
- `UpdateItem`
- `DeleteItem` for scoped demo reset and controlled cleanup
- `Query`
- `TransactWriteItems`
- Access only to the configured table and `GSI1`

Avoid runtime `Scan`. Every business-data key remains company-prefixed.

### S3

- `GetObject`
- `PutObject`
- `PutObjectTagging`
- `DeleteObject` for scoped reset, retention, and cleanup
- Access only to the configured private bucket prefixes

The current runtime does not need `ListBucket` for normal product flows.

### Cognito

- `cognito-idp:AdminGetUser`
- `cognito-idp:AdminCreateUser`
- Access only to the configured user pool

There are no model-inference, embedding, vector, or managed-search permissions
in the active AWS runtime policy.

## 6. OpenAI server configuration

OpenAI is not an AWS credential. Store these values separately as Netlify
Functions runtime configuration:

```text
MODEL_PROVIDER=openai
OPENAI_API_KEY=<secret>
OPENAI_MODEL_FAST=gpt-5.6-luna
OPENAI_MODEL_BALANCED=gpt-5.6-terra
OPENAI_MODEL_BEST=gpt-5.6-sol
```

Never prefix them with `NEXT_PUBLIC_`, include them in IAM policies, or accept a
model ID from the browser. See `docs/NETLIFY_DEPLOY.md` for the complete hosted
environment and live smoke gate.

## 7. Deployment credential handling

- Put AWS credentials and `OPENAI_API_KEY` only in local ignored configuration
  or non-readable Netlify Functions secrets.
- Netlify reserves standard AWS credential names; use the application-specific
  `MLC_AWS_ACCESS_KEY_ID` and `MLC_AWS_SECRET_ACCESS_KEY` variables.
- Do not place secrets in `.env.example`, `netlify.toml`, Git, logs, or chat.
- Rotate or delete a demo IAM access key immediately after the presentation.
- Prefer an attached IAM role over long-lived access keys on an AWS-native host.

## 8. Safe failure classification

| Symptom | Internal code |
|---|---|
| Selected OpenAI model unavailable or unauthorized | `MODEL_UNAVAILABLE` |
| OpenAI timeout or rate limit | `PROVIDER_TIMEOUT` or `RATE_LIMITED` |
| OpenAI structured output fails validation and repair | `MODEL_OUTPUT_INVALID` |
| Repository search update fails | `INDEX_FAILED` state/code |
| DynamoDB conditional write fails | `STALE_WRITE` or `CONFLICT` |
| Other S3, DynamoDB, or Cognito provider failure | safe `INTERNAL_ERROR` response |

Log safe provider request IDs server-side when available, but never expose raw
response bodies, stack traces, headers, or credentials to users.

## 9. Completion checklist

- [ ] DynamoDB table and `GSI1` exist; TTL is enabled on `ttl`.
- [ ] Private encrypted S3 bucket and source-retention rules exist.
- [ ] Runtime IAM policy is limited to DynamoDB, the S3 prefixes, and the Cognito pool.
- [ ] Cognito callback/logout URLs match the deployed `AUTH_URL`; self-sign-up is disabled.
- [ ] `pnpm bootstrap:aws-demo` leaves approved knowledge unchanged.
- [ ] `pnpm bootstrap:cognito` creates or finds the first owner membership.
- [ ] `.env.local` is ignored and no secret enters the browser bundle.
- [ ] `pnpm smoke:openai` passes all configured tiers.
- [ ] The hosted Balanced salon flow persists through a reload in `APP_MODE=aws`.
- [ ] Assistant settings rejects non-owners and arbitrary model IDs.
- [ ] `MCP_ENABLED=false` remains until the separate connector acceptance work begins.
