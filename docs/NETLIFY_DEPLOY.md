# Deploy to Netlify

The Phase 0 application is configured for a Git-connected Netlify deployment.
Build settings live in `netlify.toml`, so no custom dashboard build command is
required.

## First deployment

1. Push this repository to a Git provider supported by Netlify.
2. In Netlify, choose **Add new project → Import an existing project**.
3. Select the repository. Netlify will read `netlify.toml` and use:
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
   MCP_ENABLED=false
   DEMO_COMPANY_ID=demo-salon
   NEXT_PUBLIC_APP_NAME=My Little Company
   NEXT_PUBLIC_DEMO_MODE=true
   ```

5. Deploy the site. Later pushes to the selected production branch will build
   automatically.

No AWS or sponsor credentials are required for the local-mode fallback.
Do not add private values to `netlify.toml` or commit `.env.local`.

## Durable AWS demo deployment

Provision the resources in `docs/AWS_SETUP.md`, then open **Project
configuration → Environment variables** in Netlify. Add these variables with
Functions runtime scope:

```text
APP_MODE=aws
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
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=amazon.nova-lite-v1:0
BEDROCK_KNOWLEDGE_BASE_ID=<knowledge-base-id>
BEDROCK_DATA_SOURCE_ID=<data-source-id>
DYNAMODB_TABLE_NAME=<table-name>
S3_BUCKET_NAME=<bucket-name>
AWS_ACCESS_KEY_ID=<secret>
AWS_SECRET_ACCESS_KEY=<secret>
```

Keep the existing demo and public variables. Netlify does not expose variables
declared only in `netlify.toml` to the generated Next.js runtime functions, so
configure the values in the UI (or Netlify CLI/API) and redeploy after every
environment change. Do not give AWS credentials Build scope unless the build
actually requires them; this application uses them at Functions runtime.

After redeploying, reset the demo from a clean browser session and complete the
salon flow. Confirm the approved rule survives a page reload and is visible to a
separate employee-answer request.

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
