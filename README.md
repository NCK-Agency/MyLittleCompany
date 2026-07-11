# My Little Company — Codex Kickstart Pack

> **Explain it once. Your company remembers.**

My Little Company is a conversational organizational-memory product for non-technical small-business owners. It captures useful knowledge from everyday conversations, asks a human to approve it, and makes the approved knowledge available to AI assistants and employees.

This pack is intentionally **spec-first**. Put it in a new Git repository, open the repository in Codex, and begin with `START_HERE.md`. The root `AGENTS.md` contains the durable repository rules Codex should follow on every task.

## The MVP in one sentence

A salon owner tells the Marketing Assistant that promotions must stay at or below 15% and should prefer free add-ons; My Little Company proposes that as company knowledge, the owner approves it, and the Marketing Assistant, Operations Assistant, and a future employee all reuse the approved rule with its rationale and source.

## Repository map

```text
AGENTS.md                 Codex working agreements and non-negotiable rules
START_HERE.md              Exact prompts for the first implementation stages
PLANS.md                   Living execution plan
.env.example               Runtime configuration contract
docs/PROJECT_MEMORY.md     Durable product context
docs/PRODUCT_SPEC.md       Product requirements and acceptance criteria
docs/UX_SPEC.md            User experience and screen behavior
docs/ARCHITECTURE.md       System components and flows
docs/DATA_MODEL.md         Domain and persistence model
docs/API_CONTRACTS.md      Server-side interface contracts
docs/AI_BEHAVIOR.md        AI extraction, retrieval, and grounding rules
docs/SECURITY.md           Threat model and safeguards
docs/BUILD_PLAN.md         Phased implementation sequence
docs/BACKLOG.md            Prioritized implementation tickets
docs/DEMO_SCRIPT.md        Judge-facing demo flow
docs/DECISION_LOG.md       Canonical index of all accepted project decisions
docs/NETLIFY_DEPLOY.md     Git-connected Netlify deployment steps
prompts/                   Version-controlled prompt templates
schemas/                   JSON schemas for AI and domain outputs
fixtures/                  Deterministic salon demo data
```

## Intended application commands

Codex should create and maintain these commands:

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm seed:demo
pnpm reset:demo
pnpm smoke:aws
pnpm bootstrap:cognito
```

## Connect AI agents through MCP

Set `APP_BASE_URL` to the deployed HTTPS origin, configure the OAuth signing JWK,
and enable `MCP_ENABLED=true`. The remote MCP URL is:

```text
https://your-domain.example/mcp
```

ChatGPT, Codex, Claude Code, Gemini CLI, Kiro, and other compatible MCP clients
use the same discovery and OAuth flow. The client proves consent; the application
still reloads the person's My Little Company membership for every request.

The connector can search and fetch approved knowledge or propose new knowledge.
Approval always stays in the My Little Company Review screen.
Follow the full private-client smoke path in
[`docs/MCP_CONNECT.md`](docs/MCP_CONNECT.md).
For the exact ChatGPT Draft app profile and acceptance prompts, use
[`docs/CHATGPT_APP.md`](docs/CHATGPT_APP.md).

## Product truth

For the complete, dated product, trust, UX, architecture, visual, deployment,
and scope record, read [`docs/DECISION_LOG.md`](docs/DECISION_LOG.md).

- Chat is the input.
- Approved company memory is the product.
- Agents and employees are consumers of that memory.
- AI may suggest knowledge but may never approve it.
- Only approved, current, company-scoped, role-allowed records may be retrieved as authoritative context.
- Every important response should reveal where its company-specific claims came from.

## Core technology direction

- Next.js, TypeScript, Tailwind CSS, pnpm
- Amazon Bedrock
- Amazon Bedrock Knowledge Bases
- Amazon DynamoDB
- Amazon S3
- AWS SDK for JavaScript v3
- Amazon Cognito managed login with application-owned scoped memberships
- Waitlist-only public access with owner-invited account creation
- Netlify or another suitable web deployment target
- Optional after MVP: Apify, Langfuse, Antitech, Agora, Notion

## Start

Open `START_HERE.md` and use the first Codex prompt. Do not begin with optional integrations.

## Deploy the foundation

The repository owns its Netlify build settings in `netlify.toml`. Follow
[`docs/NETLIFY_DEPLOY.md`](docs/NETLIFY_DEPLOY.md) to connect the Git repository
and deploy in credential-free local mode. For the durable AWS-backed demo, follow
`docs/AWS_SETUP.md` and the Functions-scope variables in `docs/NETLIFY_DEPLOY.md`.
