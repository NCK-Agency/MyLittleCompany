# Deploy to Netlify

The hosted web demo uses Netlify for the Next.js application, OpenAI for live
generation, DynamoDB and private S3 for durable company data, and Cognito/Auth.js
for invited-user identity. Build settings remain in `netlify.toml`.

## 1. Bootstrap the site

1. Authenticate the Netlify CLI and create or link one site from this working
   tree.
2. Obtain the permanent `https://<site>.netlify.app` origin before configuring
   Auth.js and Cognito. Do not use a draft-deploy URL for callbacks.
3. Netlify reads:
   - Build command: `pnpm build`
   - Publish directory: `.next`
   - Node.js: 22
   - pnpm: the version in `package.json`
4. Use the permanent origin consistently for `AUTH_URL`, `APP_BASE_URL`, Cognito
   callback/logout URLs, Playbook links, and future MCP metadata.

A temporary bootstrap preview may use `APP_MODE=local`, `AUTH_MODE=demo`, and
`MODEL_PROVIDER=fixture`, but it must remain visibly labelled offline/demo and
must not be presented as the live-model proof.

## 2. Configure the hosted web demo

Provision only the DynamoDB, private S3, IAM, and Cognito resources described in
`docs/AWS_SETUP.md`. In **Project configuration → Environment variables**, add
these values with Functions runtime scope:

```text
APP_MODE=aws
MODEL_PROVIDER=openai
OPENAI_API_KEY=<server-runtime-secret>
OPENAI_MODEL_FAST=gpt-5.6-luna
OPENAI_MODEL_BALANCED=gpt-5.6-terra
OPENAI_MODEL_BEST=gpt-5.6-sol

WAITLIST_STORAGE_MODE=dynamodb
AUTH_MODE=cognito
AUTH_SECRET=<at-least-32-random-characters>
AUTH_URL=https://<your-site>.netlify.app
APP_BASE_URL=https://<your-site>.netlify.app

COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=<pool-id>
COGNITO_CLIENT_ID=<app-client-id>
COGNITO_CLIENT_SECRET=<secret>
COGNITO_ISSUER=https://cognito-idp.us-east-1.amazonaws.com/<pool-id>
COGNITO_DOMAIN=https://<domain>.auth.us-east-1.amazoncognito.com

MLC_AWS_REGION=us-east-1
DYNAMODB_TABLE_NAME=<table-name>
S3_BUCKET_NAME=<bucket-name>
MLC_AWS_ACCESS_KEY_ID=<functions-secret>
MLC_AWS_SECRET_ACCESS_KEY=<functions-secret>

MCP_ENABLED=false
DEMO_COMPANY_ID=demo-salon
NEXT_PUBLIC_APP_NAME=My Little Company
NEXT_PUBLIC_DEMO_MODE=true
```

`APP_MODE` controls persistence; `MODEL_PROVIDER` controls generation. Do not
couple them or configure a hidden fixture fallback. `WAITLIST_STORAGE_MODE`
remains independent so public leads persist in DynamoDB in every public mode.

Keep `OPENAI_API_KEY`, Cognito client secret, AWS access credentials, and
`AUTH_SECRET` restricted to server runtime/Functions. The three model IDs are
non-secret server configuration, but they must not be accepted from browser
requests. Do not commit `.env.local`, print secret values, or give runtime
credentials Build scope unless the build genuinely needs them.

The web migration does not require the private ChatGPT connection. Keep
`MCP_ENABLED=false` until the web demo passes. Enabling MCP later also requires
the OAuth private JWK/key ID and the separate connector acceptance checklist.

## 3. Pre-deploy verification

Run the same production gates used by Netlify:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Then run the live provider gate from a secure environment:

```bash
pnpm smoke:openai
```

The smoke must make one minimal schema-constrained request with Fast, Balanced,
and Best. Do not expose a tier whose configured model fails. The command must not
print the API key or full provider response.

## 4. Deploy and accept

1. Deploy with the durable configuration and a fresh Functions bundle.
2. Sign in as the demo owner and reset only `demo-salon`.
3. Open Workspace → Assistant settings. Confirm Balanced is selected, then save
   Fast and verify the next request records the Fast model. Restore Balanced.
4. Complete the full salon flow in `docs/DEMO_SCRIPT.md`: live extraction,
   approval, reload, compliant promotion, grounded SOP, and cited employee answer.
5. Confirm the approved version, source, and model tier survive a reload.
6. Force or simulate one provider failure and confirm the UI preserves the draft,
   says the model is temporarily unavailable, offers Retry, and returns no
   fixture content.

Only after all three model smokes and the hosted Balanced salon journey pass may
the deployment be described as the working real-LLM demo.

## 5. Failure policy

- A missing or invalid OpenAI key is a configuration failure; fail startup or the
  request clearly.
- A timeout, rate limit, or transient provider error receives at most one retry.
- An unavailable selected model never triggers a tier change or fixture response.
- If DynamoDB or S3 fails, do not report approval or source persistence as
  successful.
- If Cognito is the only blocker during a private rehearsal, seeded demo auth may
  be used temporarily and visibly labelled. It does not waive the live OpenAI,
  durable persistence, or authorization checks.
