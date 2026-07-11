# Deploy to Netlify

The application supports a manual Netlify CLI deployment from the current
working tree. GitHub authentication and a Git push are not prerequisites for the
filmed demo. Build settings live in `netlify.toml`.

## First deployment

1. Authenticate the Netlify CLI and create or link one site from this working
   tree.
2. Deploy the safe local/demo configuration once to obtain the permanent HTTPS
   origin. Do not continue with a draft-deploy URL.
3. Netlify reads `netlify.toml` and uses:
   - Build command: `pnpm build`
   - Publish directory: `.next`
   - Node.js: 22
   - pnpm: the version in `package.json`
4. Before deploying, add these environment variables in Netlify:

   ```text
   APP_MODE=local
   AUTH_MODE=demo
   AUTH_SECRET=<at-least-32-random-characters>
   AUTH_URL=https://<your-site>.netlify.app
   APP_BASE_URL=https://<your-site>.netlify.app
   WAITLIST_STORAGE_MODE=dynamodb
   MLC_AWS_REGION=us-east-1
   DYNAMODB_TABLE_NAME=<table-name>
   MLC_AWS_ACCESS_KEY_ID=<functions-secret>
   MLC_AWS_SECRET_ACCESS_KEY=<functions-secret>
   MCP_ENABLED=false
   DEMO_COMPANY_ID=demo-salon
   NEXT_PUBLIC_APP_NAME=My Little Company
   NEXT_PUBLIC_DEMO_MODE=true
   ```

5. Deploy to production and record the exact `https://<site>.netlify.app`
   origin. Use it consistently for `AUTH_URL`, `APP_BASE_URL`, Cognito callback
   and logout URLs, OAuth metadata, Playbook citations, and `/mcp`.

`APP_MODE=local` keeps assistant and company state on the credential-free demo
path. The public waitlist is deliberately independent and must use DynamoDB on a
public Netlify deployment so a successful submission survives cold starts. Keep
the two app-specific AWS values in non-readable Functions secrets. For a private
developer-only deployment that does not collect real leads, set
`WAITLIST_STORAGE_MODE=local` and treat its temporary waitlist as disposable.
Do not add private values to `netlify.toml` or commit `.env.local`.

## Durable AWS demo deployment

Provision the resources in `docs/AWS_SETUP.md`, then open **Project
configuration → Environment variables** in Netlify. Add these variables with
Functions runtime scope:

```text
APP_MODE=aws
WAITLIST_STORAGE_MODE=dynamodb
AUTH_MODE=cognito
AUTH_SECRET=<at-least-32-random-characters>
AUTH_URL=https://<your-site>.netlify.app
APP_BASE_URL=https://<your-site>.netlify.app
MCP_ENABLED=true
MCP_OAUTH_PRIVATE_JWK=<secret-json-rsa-private-jwk>
MCP_OAUTH_KEY_ID=mlc-mcp-1
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=<pool-id>
COGNITO_CLIENT_ID=<app-client-id>
COGNITO_CLIENT_SECRET=<secret>
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/<pool-id>
COGNITO_DOMAIN=https://<domain>.auth.us-east-1.amazoncognito.com
MLC_AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_KNOWLEDGE_BASE_ID=<knowledge-base-id>
BEDROCK_DATA_SOURCE_ID=<data-source-id>
DYNAMODB_TABLE_NAME=<table-name>
S3_BUCKET_NAME=<bucket-name>
MLC_AWS_ACCESS_KEY_ID=<secret>
MLC_AWS_SECRET_ACCESS_KEY=<secret>
```

Keep the existing demo and public variables. Netlify does not expose variables
declared only in `netlify.toml` to the generated Next.js runtime functions, so
configure the values in the UI (or Netlify CLI/API) and redeploy after every
environment change. Do not give AWS credentials Build scope unless the build
actually requires them; this application uses them at Functions runtime.

Use build visibility for public/non-sensitive build variables. Mark Cognito
client secrets, the OAuth private JWK, AWS access credentials, and `AUTH_SECRET`
as secrets with server runtime/Functions visibility only. Do not print their
values into deployment logs.

After redeploying, reset the demo from a clean browser session and complete the
filmed path in `docs/DEMO_SCRIPT.md`. Confirm onboarding, approval, Playbook
version history, Review state, and the current version survive a page reload.

Before connecting ChatGPT, verify:

```text
/.well-known/oauth-protected-resource
/.well-known/oauth-authorization-server
/oauth/jwks
/brand/mlc-app-icon.svg
/mcp
```

The first four paths must be public and valid. An unauthenticated `/mcp` request
must return `401` with a `WWW-Authenticate` resource-metadata challenge.

## Local verification

Run the same production build used by Netlify:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Netlify's current Next.js runtime is detected during the build. This project does
not install the legacy Netlify Next.js plugin directly.

## Tomorrow AWS cutover gate

Do not switch the public modes merely because the resources exist. The account
hit its Bedrock daily token quota on 2026-07-11, so the verified public fallback
must remain `APP_MODE=local`, `AUTH_MODE=demo`, `MCP_ENABLED=false`, and
`NEXT_PUBLIC_DEMO_MODE=true` until a fresh smoke passes. Keep
`WAITLIST_STORAGE_MODE=dynamodb`; public lead durability is independent of the
Bedrock cutover.

When capacity is available:

1. Run `pnpm smoke:aws` with the configured AWS profile and resource IDs.
2. Start the initial data-source ingestion and wait for `COMPLETE`.
3. Run `AUTH_MODE=demo pnpm test:e2e:aws` before involving Cognito.
4. Set `APP_MODE=aws`, `AUTH_MODE=cognito`, `MCP_ENABLED=true`, and
   `NEXT_PUBLIC_DEMO_MODE=false` in Netlify.
5. Deploy with `--skip-functions-cache`, then verify Cognito login, reset/reload
   persistence, OAuth discovery, `/oauth/jwks`, and the unauthenticated `/mcp`
   challenge.
6. Only then connect ChatGPT and run search, fetch, and suggestion acceptance.

If any gate fails, restore all four fallback values together and redeploy. Never
present a mixed adapter state or hide the Demo mode label.
