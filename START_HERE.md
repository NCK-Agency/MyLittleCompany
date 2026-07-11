# Start here in Codex

This repository is a spec-first kickstart pack for **My Little Company**.

Codex automatically reads the root `AGENTS.md`. The detailed project memory lives in `docs/` so the root instruction file stays practical and within normal context limits.

## First Codex prompt

Paste the following into Codex from the repository root:

```text
Read AGENTS.md and then read the project documents in the order it specifies.

First, give me a concise implementation brief covering:
1. the product promise,
2. the non-negotiable trust rules,
3. the exact MVP vertical slice,
4. the proposed repository structure,
5. the main technical risks.

Then update PLANS.md with an executable plan for Phase 0 and Phase 1 only.

Implement Phase 0 and Phase 1:
- initialize a pnpm Next.js App Router project with TypeScript strict mode and Tailwind,
- create the domain types and Zod schemas,
- create repository and model interfaces with local adapters,
- build the demo salon seed data,
- build Home, Chat, Review, and Playbook navigation,
- implement the local end-to-end flow from chat to suggested company knowledge to approval to retrieval,
- use deterministic local fixtures for AI operations at first,
- add tests for approval state transitions and exclusion of unapproved memory,
- ensure pnpm lint, pnpm typecheck, pnpm test, and pnpm build pass.

Do not add AWS integration yet. Do not add authentication, voice, website import, or optional sponsor integrations. Keep the UI polished and demoable. Record assumptions and verification results in PLANS.md.
```

## Second Codex prompt: add live OpenAI and durable hosting

Use this only after the local vertical slice works:

```text
Read AGENTS.md, PLANS.md, docs/ARCHITECTURE.md, docs/DATA_MODEL.md, docs/AI_BEHAVIOR.md, and docs/SECURITY.md.

Implement live generation and durable hosting behind the existing interfaces without changing the governed user flow:
- OpenAI Responses API model gateway with strict Structured Outputs and Zod validation,
- companyId on every model operation so the gateway can resolve owner-selected Fast, Balanced, or Best quality tiers,
- owner-only Assistant settings inside Workspace, defaulting companies and demo reset to Balanced,
- DynamoDB repositories for company, conversation, candidate, memory, version, and audit data,
- S3 source and rendered-memory storage,
- repository-backed approved-memory retrieval over the active local or DynamoDB repository,
- server-side company, role, department, sensitivity, status, and version checks after retrieval,
- truthful provider failure and retry handling with no silent fixture or model-tier fallback,
- source citations in agent responses,
- environment validation and a live OpenAI smoke script covering all configured tiers.

Keep local adapters and deterministic fixture tests working. Use environment variables, never hardcode vendor model IDs in domain logic, and never expose OpenAI or AWS credentials to the browser. OpenAI File Search, embeddings, and a remote vector store are out of scope. Update tests and documentation. Run all verification commands before stopping.
```

## Third Codex prompt: demo hardening

```text
Read AGENTS.md and the entire docs folder. Review the implemented product against every P0 acceptance criterion in docs/BACKLOG.md.

Fix the highest-impact gaps, then add:
- conflict detection for duplicate, update, contradiction, and exception,
- a clear conflict-resolution UI,
- prompt-injection defenses for imported or retrieved content,
- the complete salon demo scenario in an end-to-end test,
- graceful empty, loading, and error states,
- a one-click demo reset,
- observability hooks through the Telemetry interface,
- a deployment checklist.

Do not start P2 features. Produce a final readiness report with passed checks, known limitations, and exact demo steps.
```

## Optional integration prompts

Add these only after the core demo is stable.

### Apify website onboarding

```text
Implement website onboarding behind a SourceImporter interface using Apify. Treat all extracted content as untrusted. Show extracted facts as suggestions requiring approval. Never write imported content directly to approved memory.
```

### Langfuse observability

```text
Implement a Langfuse Telemetry adapter that records extraction, retrieval, generation, latency, token usage, prompt version, and source IDs. Do not record secrets or raw sensitive content.
```

### Antitech assessment support

```text
Add a repeatable security-test fixture and documentation for prompt injection, memory poisoning, conflicting policy, and cross-company leakage. Keep assessment tooling separate from runtime application behavior.
```
