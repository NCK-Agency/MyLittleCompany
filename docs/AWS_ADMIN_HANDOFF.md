# AWS admin handoff for durable hosting

The active demo needs AWS only for DynamoDB, private S3, and Cognito. Generation
uses OpenAI and retrieval reads approved structured records through the active
memory repository. Do not create or grant access to an AWS model runtime,
embedding service, vector store, or managed knowledge-search resource.

The `MyLittleCompanyDeveloperRole` created the DynamoDB table and Cognito
resources, but AWS denied `iam:GetRole`. Do not broaden that developer role. An
administrator should create only the scoped Netlify runtime identity below.

## Resources already ready

| Resource | Value |
|---|---|
| Region | `us-east-1` |
| DynamoDB table | `my-little-company-demo` |
| Table GSI / TTL | `GSI1` active / `ttl` enabled |
| Private source bucket | `my-little-company-392300786566-us-east-1` |
| Source prefixes | `sources/`, `imports/`, `memories/`, `artifacts/` |
| Cognito pool | `us-east-1_EsaGXBUCL` |
| Netlify origin | `https://my-little-company-demo.netlify.app` |

Only synthetic salon data is in scope.

## 1. Create the Netlify runtime identity

Create a dedicated IAM user named `my-little-company-netlify-demo`. Replace
`<ACCOUNT_ID>` in this policy and attach no broader permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
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
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:PutObjectTagging",
        "s3:DeleteObject"
      ],
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
      "Action": [
        "cognito-idp:AdminGetUser",
        "cognito-idp:AdminCreateUser"
      ],
      "Resource": "arn:aws:cognito-idp:us-east-1:<ACCOUNT_ID>:userpool/us-east-1_EsaGXBUCL"
    }
  ]
}
```

The policy intentionally contains no model, embedding, vector, or managed-search
actions. OpenAI credentials are separate Netlify secrets and never belong in an
AWS IAM policy.

## 2. Apply private-source retention

Add the S3 Lifecycle rules documented in `docs/AWS_SETUP.md` for objects under
`imports/`:

- `retention=zero-candidate-24-hours`: expire after one day.
- `retention=all-ignored-7-days`: expire after seven days.
- `retention=unapproved-30-days`: expire after 30 days.
- `retention=approved`: do not expire automatically.

Keep all public-access blocks and encryption enabled. Do not grant bucket-wide
listing or public object access.

## 3. Store runtime credentials

Create one access key. Enter it directly into Netlify as non-readable Functions
secrets named `MLC_AWS_ACCESS_KEY_ID` and `MLC_AWS_SECRET_ACCESS_KEY`. Netlify
reserves the standard AWS credential names.

Store `OPENAI_API_KEY` separately as a non-readable Functions secret. Configure
the three non-secret, server-only allowed model IDs as described in
`docs/NETLIFY_DEPLOY.md`. Do not paste any secret into chat, terminal output,
`.env.local` committed to Git, or deployment logs.

Delete or rotate the AWS access key immediately after the presentation.

## 4. Completion evidence

Return only:

- confirmation that the scoped runtime policy was attached;
- confirmation that the S3 Lifecycle rules are active;
- confirmation that the AWS runtime access key and OpenAI API key were stored as
  non-readable Netlify Functions secrets.

Do not return either secret value.
