# AWS Setup Guide

This guide defines the resources the AWS adapters expect. Provider interfaces should be implemented first so resource setup does not leak into domain code.

## 1. Choose one AWS Region

Use a single Region that supports the Bedrock model and Knowledge Base configuration selected for the demo. Set it in:

```text
AWS_REGION=
```

Keep model selection configurable:

```text
BEDROCK_MODEL_ID=
BEDROCK_EMBEDDING_MODEL_ID=
```

Do not assume a model is available in every Region or account. Verify it in the Bedrock console before debugging application code.

## 2. DynamoDB table

Create one table with:

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

Create a private bucket for sources, canonical memory documents, and generated artifacts.

Required configuration:

- Block all public access.
- Server-side encryption.
- CORS only if the chosen upload flow truly needs direct browser upload.
- Lifecycle rules are optional for the demo.

Set:

```text
S3_BUCKET_NAME=
```

Expected prefixes:

```text
sources/{companyId}/...
memories/{companyId}/...
artifacts/{companyId}/...
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

Create a Knowledge Base and a compatible data source. Direct ingestion must be supported by the selected setup.

Set:

```text
BEDROCK_KNOWLEDGE_BASE_ID=
BEDROCK_DATA_SOURCE_ID=
```

The application path should use:

- `Retrieve` for retrieval.
- `IngestKnowledgeBaseDocuments` for direct ingestion of approved memory documents.
- Stable document identifiers based on company, memory ID, and version.

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

## 6. Suggested application-role capabilities

Use a least-privilege runtime role. The exact policy depends on deployment and implementation, but the application normally needs:

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
- `BatchGetItem` or `BatchWriteItem` only when used
- `ConditionCheckItem` and `TransactWriteItems` if the approval workflow uses transactions
- Access to the configured table and `GSI1`

Avoid runtime `Scan` for product flows. A tightly constrained scan may be acceptable only for a disposable demo-reset script if no better key pattern exists.

### S3

- `GetObject`
- `PutObject`
- `DeleteObject` for reset and cleanup
- `ListBucket` limited by prefix where practical

Limit access to the configured bucket and company prefixes where the deployment model permits it.

## 7. Deployment environment

For a Netlify deployment:

- Store AWS and vendor configuration as server-side environment variables.
- Use a dedicated AWS role or carefully scoped credentials for the demo deployment.
- Never prefix secrets with `NEXT_PUBLIC_`.
- Verify that AWS SDK code executes only in server routes or server actions.

For an AWS-native deployment, use the compute service’s IAM role rather than long-lived access keys.

## 8. Knowledge Base smoke test

Create `pnpm smoke:aws` with these checks:

1. Validate required environment variables.
2. Invoke the configured Bedrock model with a harmless prompt.
3. Write a disposable approved-memory fixture to the structured repository.
4. Render and ingest its canonical document.
5. Retrieve it using the demo company filter.
6. Hydrate and verify the returned memory.
7. Remove disposable data or clearly mark it for cleanup.
8. Return non-zero on any failed check.

Do not run destructive cleanup against non-demo company IDs.

## 9. Common failure classification

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

## 10. AWS setup completion checklist

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
