# AWS Setup Guide

This console-first guide creates the resources expected by the implemented AWS
adapters. It does not create resources automatically.

## 1. Choose one AWS Region

Use `us-east-1` for the demo. In **Amazon Bedrock → Model catalog**, open
**Amazon Nova Lite**, enable access if the account requires it, and verify one
request in the Converse playground before configuring the app.

```text
AWS_REGION=us-east-1
```

Keep model selection configurable:

```text
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_EMBEDDING_MODEL_ID=amazon.titan-embed-text-v2:0
```

Do not assume a model is available in every Region or account. Verify it in the Bedrock console before debugging application code.

## 2. DynamoDB table

In **DynamoDB → Tables → Create table**, create one table with:

- Partition key: `PK` as String.
- Sort key: `SK` as String.
- Billing mode: on-demand for the hackathon.
- Point-in-time recovery if convenient.
- GSI named `GSI1`:
  - Partition key: `GSI1PK` as String.
  - Sort key: `GSI1SK` as String.

Set:

```text
DYNAMODB_TABLE_NAME=
```

The application should use condition expressions for candidate edits, approval transitions, and index-status updates.

## 3. S3 bucket

In **S3 → Create bucket**, create a private bucket for sources, canonical memory
documents, and generated artifacts.

Required configuration:

- Block all public access.
- Server-side encryption.
- CORS only if the chosen upload flow truly needs direct browser upload.
- Lifecycle rules are optional for the demo.

Set:

```text
S3_BUCKET_NAME=
```

Create or reserve these prefixes:

```text
sources/
memories/
artifacts/
```

## 4. Bedrock model access

The runtime role needs model-inference permission for the selected model or inference profile. The minimum common action for non-streaming Converse or InvokeModel usage is:

```text
bedrock:InvokeModel
```

Add streaming or inference-profile permissions only when used by the implementation.

Optional Guardrail configuration:

```text
BEDROCK_GUARDRAIL_ID=
BEDROCK_GUARDRAIL_VERSION=
```

If a Guardrail is used, grant only the required Guardrail actions and resources.

## 5. Bedrock Knowledge Base

In **Amazon Bedrock → Knowledge Bases**, create a vector Knowledge Base:

1. Choose the S3 data-source path.
2. Select Titan Text Embeddings V2 (`amazon.titan-embed-text-v2:0`).
3. Use the console's quick-create S3 Vectors option.
4. Add the private bucket as the data source and restrict its inclusion prefix
   to `memories/`.
5. Save both the Knowledge Base ID and data source ID.
6. Confirm the data source supports direct document ingestion.

Set:

```text
BEDROCK_KNOWLEDGE_BASE_ID=
BEDROCK_DATA_SOURCE_ID=
```

The application path should use:

- `Retrieve` for retrieval.
- `IngestKnowledgeBaseDocuments` for direct ingestion of approved memory documents.
- Stable S3 objects at `memories/{companyId}/{memoryId}/v{version}.md`.

The AWS documentation lists these direct-ingestion actions:

```text
bedrock:StartIngestionJob
bedrock:IngestKnowledgeBaseDocuments
bedrock:GetKnowledgeBaseDocuments
bedrock:ListKnowledgeBaseDocuments
bedrock:DeleteKnowledgeBaseDocuments
```

The runtime only needs the subset the implementation actually calls. For retrieval, grant:

```text
bedrock:Retrieve
```

Scope Bedrock permissions to the configured Knowledge Base and model resources whenever the service supports that scope.

## 6. Cognito managed login

Create a user pool app client with a secret, authorization-code grant, `openid
email profile` scopes, the Auth.js callback URL
`/api/auth/callback/cognito`, and the configured post-logout URL. Configure the
pool to use email as the sign-in alias and create a managed-login domain.

The runtime role needs `cognito-idp:AdminGetUser` and
`cognito-idp:AdminCreateUser` on this user pool for owner invitations. Configure
the `COGNITO_*`, `AUTH_URL`, and `AUTH_SECRET` values from `.env.example`, then run:

```bash
BOOTSTRAP_OWNER_EMAIL=owner@example.com pnpm bootstrap:cognito
```

This idempotently creates or reuses the first Cognito identity and writes its
owner membership. Ownership is never inferred from an untrusted browser claim.

### Cognito smoke path

1. Open `/login`, continue to Cognito, and complete the owner's temporary-password change.
2. Open **People & access**, invite a second email, and grant one department `READ`.
3. Sign out and confirm Cognito returns to the configured application logout URL.
4. Sign in as the invited user and confirm first login activates the membership.
5. Verify company knowledge and the granted department are readable while a sibling department and Review are denied.
6. As owner, add or remove a grant and confirm the next request reflects it without a new login.
7. Pause the membership and confirm authentication completes but the app shows the no-access state.
8. Restore access and confirm the member can use the permitted scope again.

## 7. Suggested application-role capabilities

Create a dedicated hackathon runtime IAM user. Do not reuse an administrator.
Attach a least-privilege policy limited to the selected model or inference
profile, table and GSI, bucket prefixes, Knowledge Base, and data source. The
implemented runtime uses only the actions below.

### Bedrock

- Invoke the configured model.
- Retrieve from the configured Knowledge Base.
- Directly ingest, inspect, and delete documents only as required.
- Apply the configured Guardrail only when enabled.

### DynamoDB

- `GetItem`
- `PutItem`
- `UpdateItem`
- `DeleteItem` for demo reset and controlled cleanup
- `Query`
- `TransactWriteItems`
- Access to the configured table and `GSI1`

Avoid runtime `Scan` for product flows. A tightly constrained scan may be acceptable only for a disposable demo-reset script if no better key pattern exists.

### S3

- `GetObject`
- `PutObject`
- `DeleteObject` for reset and cleanup
- `ListBucket` is not required by the current runtime.

Limit access to the configured bucket and company prefixes where the deployment model permits it.

Configure S3 Lifecycle rules for imported raw sources using the tags written by
the application:

- `retention=zero-candidate-24-hours`: expire after one day.
- `retention=all-ignored-7-days`: expire after seven days.
- `retention=unapproved-30-days`: expire after 30 days.
- `retention=approved`: do not expire automatically.

The application also stores the exact `deleteAfter` timestamp as source metadata.
Owner deletion replaces the object with a metadata-only tombstone; it does not
remove the citation checksum or source label.

## 8. Deployment environment

For a Netlify deployment:

- Store AWS and vendor configuration as server-side environment variables.
- Create one access key for the dedicated hackathon IAM user.
- Keep credentials only in a local AWS profile and Netlify secret variables with
  Functions scope. Never place them in `.env.example`, `netlify.toml`, or Git.
- Never prefix secrets with `NEXT_PUBLIC_`.
- Verify that AWS SDK code executes only in server routes or server actions.

Rotate or delete the access key and IAM user immediately after the demo. For an
AWS-native deployment, use the compute service's IAM role instead of long-lived
access keys.

## 9. Knowledge Base smoke test

Run `pnpm smoke:aws`. It performs these checks:

1. Validate required environment variables.
2. Invoke Nova Lite with Converse using the configured model ID.
3. Run the real onboarding extraction prompt and verify a bounded source-backed candidate list.
4. Write a disposable approved-memory fixture to the structured repository.
5. Render and ingest its canonical document.
6. Retrieve it using the disposable company filter.
7. Hydrate and verify the returned memory.
8. Delete only its unique Knowledge Base document, S3 object, and DynamoDB items.
9. Return non-zero on any failed check.

Every smoke company ID starts with `smoke-` and a UUID. The script never queries
or deletes an existing company partition.

## 10. Common failure classification

Map provider errors into safe internal codes:

| Provider symptom | Internal code |
|---|---|
| Model permission or access failure | `MODEL_UNAVAILABLE` |
| Model returns invalid structured output | `MODEL_OUTPUT_INVALID` |
| Knowledge Base retrieval denied or unavailable | `KNOWLEDGE_RETRIEVAL_FAILED` |
| Direct ingestion fails | `MEMORY_INDEX_FAILED` |
| DynamoDB conditional write fails | `STALE_WRITE` or `CONFLICT` |
| S3 write fails | `SOURCE_STORAGE_FAILED` |

Log provider request IDs server-side, but do not expose raw stack traces or credentials to users.

## 11. AWS setup completion checklist

- [ ] Selected model can be invoked in the chosen Region.
- [ ] DynamoDB table and `GSI1` exist.
- [ ] S3 bucket is private.
- [ ] Knowledge Base and data source exist.
- [ ] Direct ingestion succeeds from a test script.
- [ ] Retrieval returns the test document.
- [ ] Application role is least privilege.
- [ ] `.env.local` is ignored by Git.
- [ ] `pnpm smoke:aws` passes.
- [ ] The salon end-to-end flow passes in AWS mode.
- [ ] Cognito callback and logout URLs match the deployed `AUTH_URL`.
- [ ] `pnpm bootstrap:cognito` creates or finds the immutable first owner.
- [ ] An owner invitation reaches the recipient and first login activates access.
- [ ] `APP_BASE_URL` is the deployed HTTPS origin and `MCP_ENABLED=true` only
  after OAuth discovery and callback checks pass.
- [ ] `MCP_OAUTH_PRIVATE_JWK` contains a deployment secret RSA private JWK and
  `/oauth/jwks` exposes only its public fields.
- [ ] DynamoDB TTL is enabled on the `ttl` attribute for OAuth cleanup.
- [ ] ChatGPT Developer Mode completes search/fetch and creates a Review-only
  suggestion; Codex, Claude Code, Gemini CLI, and Kiro connect to the same `/mcp`
  resource through their hosted or loopback OAuth callbacks.

Use `docs/MCP_CONNECT.md` for the exact client and persona smoke sequence.

After the smoke test passes, run `pnpm test:e2e:aws`. It starts the same Next.js
application with `APP_MODE=aws` and executes the salon story serially.
