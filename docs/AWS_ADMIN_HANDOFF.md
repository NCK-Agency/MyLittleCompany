# AWS admin handoff for the hosted demo

The `MyLittleCompanyDeveloperRole` created the DynamoDB table and Cognito
resources, but AWS denied `iam:GetRole`. Do not broaden that developer role.
An administrator should create only the two identities below, then create the
Knowledge Base with the existing resources.

## Resources already ready

| Resource | Value |
|---|---|
| Region | `us-east-1` |
| DynamoDB table | `my-little-company-demo` |
| Table GSI / TTL | `GSI1` active / `ttl` enabled |
| Source bucket | `my-little-company-392300786566-us-east-1` |
| Source prefix | `memories/` |
| Imported-source prefix | `imports/` |
| S3 Vectors bucket | `my-little-company-vectors-392300786566-us-east-1` |
| S3 Vectors index | `my-little-company-memory-index` |
| Vector dimensions | `1024` |
| Embedding model | `amazon.titan-embed-text-v2:0` |
| Generation model | `amazon.nova-lite-v1:0` |
| Cognito pool | `us-east-1_EsaGXBUCL` |
| Netlify origin | `https://my-little-company-demo.netlify.app` |

Only synthetic salon data is in scope.

## 1. Create the Knowledge Base service role

Create `AmazonBedrockExecutionRoleForKB-MLC` with this trust policy. Replace
`<ACCOUNT_ID>` once; do not replace the wildcard with a different service.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "bedrock.amazonaws.com" },
    "Action": "sts:AssumeRole",
    "Condition": {
      "StringEquals": { "aws:SourceAccount": "<ACCOUNT_ID>" },
      "ArnLike": {
        "aws:SourceArn": "arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:knowledge-base/*"
      }
    }
  }]
}
```

Attach this inline policy as `MyLittleCompanyKnowledgeBaseAccess`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EmbedWithTitanV2",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-embed-text-v2:0"
    },
    {
      "Sid": "ListMemorySourcePrefix",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::my-little-company-392300786566-us-east-1",
      "Condition": {
        "StringLike": { "s3:prefix": ["memories", "memories/*"] }
      }
    },
    {
      "Sid": "ReadMemorySources",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::my-little-company-392300786566-us-east-1/memories/*"
    },
    {
      "Sid": "UseExistingVectorIndex",
      "Effect": "Allow",
      "Action": [
        "s3vectors:GetIndex",
        "s3vectors:GetVectors",
        "s3vectors:PutVectors",
        "s3vectors:DeleteVectors",
        "s3vectors:QueryVectors"
      ],
      "Resource": "arn:aws:s3vectors:us-east-1:<ACCOUNT_ID>:bucket/my-little-company-vectors-392300786566-us-east-1/index/my-little-company-memory-index"
    }
  ]
}
```

## 2. Create the Knowledge Base and data source

Create a vector Knowledge Base named `my-little-company-memory`:

- service role: `AmazonBedrockExecutionRoleForKB-MLC`;
- Titan Text Embeddings V2;
- embedding dimensions: `1024`, data type `FLOAT32`;
- existing S3 Vectors index `my-little-company-memory-index`;
- no new vector bucket or index.

Attach an S3 data source named `my-little-company-memories`:

- bucket: `my-little-company-392300786566-us-east-1`;
- inclusion prefix: `memories/`;
- chunking: **No chunking**;
- deletion policy: retain.

No chunking is intentional because each canonical memory document is compact,
structured, and independently versioned. Changing chunking requires replacing
the data source.

Start one ingestion job and wait for `COMPLETE`. Record the Knowledge Base ID and
data source ID; Codex will then run `pnpm smoke:aws` and a filtered retrieval.

## 3. Create the Netlify runtime identity

Create a dedicated IAM user named `my-little-company-netlify-demo`. Attach this
policy after replacing `<ACCOUNT_ID>`, `<KB_ID>`, and `<DATA_SOURCE_ID>`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "GenerateWithNovaLite",
      "Effect": "Allow",
      "Action": "bedrock:InvokeModel",
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0"
    },
    {
      "Sid": "UseApprovedMemoryIndex",
      "Effect": "Allow",
      "Action": [
        "bedrock:Retrieve",
        "bedrock:IngestKnowledgeBaseDocuments",
        "bedrock:GetKnowledgeBaseDocuments",
        "bedrock:DeleteKnowledgeBaseDocuments"
      ],
      "Resource": "arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:knowledge-base/<KB_ID>"
    },
    {
      "Sid": "UseDemoTable",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:TransactWriteItems"
      ],
      "Resource": [
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/my-little-company-demo",
        "arn:aws:dynamodb:us-east-1:<ACCOUNT_ID>:table/my-little-company-demo/index/GSI1"
      ]
    },
    {
      "Sid": "UseDemoSourcePrefixes",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:PutObjectTagging", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::my-little-company-392300786566-us-east-1/sources/*",
        "arn:aws:s3:::my-little-company-392300786566-us-east-1/imports/*",
        "arn:aws:s3:::my-little-company-392300786566-us-east-1/memories/*",
        "arn:aws:s3:::my-little-company-392300786566-us-east-1/artifacts/*"
      ]
    },
    {
      "Sid": "InviteDemoMembersOnly",
      "Effect": "Allow",
      "Action": ["cognito-idp:AdminGetUser", "cognito-idp:AdminCreateUser"],
      "Resource": "arn:aws:cognito-idp:us-east-1:<ACCOUNT_ID>:userpool/us-east-1_EsaGXBUCL"
    }
  ]
}
```

Before enabling proof-first onboarding, add the S3 Lifecycle rules documented in
`docs/AWS_SETUP.md` for objects under `imports/`: expire objects tagged
`retention=zero-candidate-24-hours` after one day,
`retention=all-ignored-7-days` after seven days, and
`retention=unapproved-30-days` after 30 days. Objects tagged
`retention=approved` must not expire automatically.

Create one access key. Enter it directly into Netlify as non-readable production
secrets named `MLC_AWS_ACCESS_KEY_ID` and `MLC_AWS_SECRET_ACCESS_KEY`. Netlify
reserves the standard AWS credential names. Do not paste the secret into chat,
a terminal transcript, `.env.local`, or Git.

Delete or rotate the access key immediately after the presentation.

## 4. Completion evidence

Return only:

- the Knowledge Base ID;
- the data source ID;
- confirmation that the ingestion job completed;
- confirmation that the Netlify runtime access key was stored in Netlify.

Do not return the secret access key.
