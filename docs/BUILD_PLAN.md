# Build Plan

## 1. Strategy

Build the smallest complete proof of organizational memory first. Use local adapters until the user journey is polished, then replace the infrastructure behind interfaces.

The sequence is deliberately vertical:

1. Make the product understandable.
2. Make the memory rules correct.
3. Make the local demo reliable.
4. Wire AWS without changing the flow.
5. Harden trust, security, and presentation.
6. Add optional integrations only when the core is stable.

## 2. Phase 0 — Repository foundation

### Deliverables

- pnpm workspace or single app initialized.
- Next.js App Router, React, TypeScript strict mode, and Tailwind.
- Intended directory structure.
- Environment validation.
- Formatting, linting, type-checking, unit test, E2E test, and build commands.
- Basic error and result types.
- CI workflow if it does not slow initial delivery.

### Required commands

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

### Exit gate

- A minimal app loads.
- All required verification commands exist.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
- No business feature has imported an AWS SDK directly.

## 3. Phase 1 — Local organizational-memory loop

### Deliverables

#### Domain

- Types and Zod schemas for company, conversation, message, source, candidate, memory, version, SOP, and audit event.
- Pure state-transition functions.
- Retrieval-eligibility function.
- Deterministic memory document renderer.

#### Local adapters

- In-memory or file-backed repositories.
- Deterministic `ModelGateway` fixture behavior for the salon scenario.
- Local knowledge index restricted to approved memories.
- No credentials required.

#### UI

- Home, Chat, Review, and Playbook navigation.
- Marketing conversation.
- Suggested-knowledge card.
- Edit, approve, and ignore actions.
- Playbook list and detail.
- Operations SOP generation.
- Employee question and grounded source display.
- Reset demo.

#### Tests

- State transition tests.
- Retrieval eligibility tests.
- Local demo E2E test.

### Exit gate

The full salon story works locally from reset to employee answer, and no proposed memory appears as authoritative context.

## 4. Phase 2 — Amazon Bedrock model integration

### Deliverables

- Bedrock `ModelGateway` adapter.
- Configurable model ID or inference profile.
- Prompt loader from `prompts/`.
- Structured-output parsing and Zod validation.
- One repair attempt on invalid output.
- Timeout, bounded retry, and typed errors.
- Prompt version and telemetry metadata.
- Local model adapter remains available.

### Implementation order

1. Marketing response generation.
2. Memory extraction.
3. SOP generation.
4. Conflict classification.
5. Employee answer generation.

### Exit gate

The AWS model path reproduces the salon flow with valid structured outputs and safe failures.

## 5. Phase 3 — DynamoDB and S3 persistence

### Deliverables

- DynamoDB table and AWS repository adapters.
- Conditional writes for candidate edit and approval.
- Immutable memory versions.
- Audit events.
- S3 source storage.
- Canonical memory-document rendering and S3 storage.
- Seed and reset scripts constrained to the demo company.

### Exit gate

- Reloading the app preserves the conversation, candidate, approval, and Playbook state.
- Double approval is prevented.
- Reset restores only the demo company.
- S3 objects are private.

## 6. Phase 4 — Bedrock Knowledge Base retrieval

### Deliverables

- Knowledge Base adapter.
- Direct ingestion of approved memory versions.
- Metadata for company, type, roles, status, version, and sensitivity.
- Retrieval with company and role filters where supported.
- DynamoDB hydration and eligibility verification after index retrieval.
- Source citations.
- Separate index status with retry.
- Real-AWS smoke test.

### Exit gate

- Approved 15% decision is retrieved and influences Marketing, Operations, and Employee modes.
- Proposed, rejected, superseded, and cross-company records are excluded.
- Index failure is visible and retryable.

## 7. Phase 5 — Conflict, trust, and security hardening

### Deliverables

- Related-memory retrieval for candidate comparison.
- Duplicate, update, contradiction, and exception relations.
- Conflict-resolution UI.
- Prompt-injection fixture.
- Unknown-citation validation.
- Secret-pattern checks.
- Role and sensitivity checks.
- Input size limits and rate-limit strategy.
- Security assessment notes.

### Exit gate

The malicious import fixture cannot modify approved memory, and a 25% conflicting rule requires explicit owner resolution.

## 8. Phase 6 — Demo and submission polish

### Deliverables

- Deterministic demo reset.
- Clear demo-mode label.
- Polished loading and failure states.
- Seeded owner and employee personas.
- Demo script rehearsed against deployed environment.
- Architecture diagram.
- Submission copy aligned with actual features.
- Public demo link and repository documentation.
- Known limitations documented honestly.

### Exit gate

A presenter can run the complete demo without developer tools, database editing, or manual recovery.

## 9. Phase 7 — Optional integrations

Only begin after every P0 issue is complete.

### Apify

- Import a website.
- Store normalized text as an untrusted source.
- Extract suggestions requiring approval.

### Langfuse or AWS-native observability

- Implement one primary Telemetry adapter.
- Trace extraction, retrieval, generation, approval, and indexing.

### Antitech

- Run repeatable security assessment fixtures.
- Add report to Optional Links.

### Notion

- Import existing pages as sources or export approved SOPs.
- Do not use Notion as authoritative memory storage.

### Agora

- Voice input for owner onboarding or chat.
- Speech transcript follows the same suggestion and approval flow.

## 10. Feature-cut order under pressure

Cut in this order:

1. Voice.
2. Notion.
3. Website import.
4. Advanced telemetry UI.
5. Multiple demo companies.
6. Manager role.
7. Full conflict-resolution variants.
8. Campaign artifact history.

Do not cut:

- Human approval.
- Approved-only retrieval.
- Source and rationale.
- The cross-role reuse demo.
- Clear failure state.
- AWS Bedrock and Knowledge Base path for the submitted demo.

## 11. Implementation review questions

After every phase, answer:

- Can a non-technical owner understand the next action?
- Can unapproved content influence an authoritative answer?
- Can a cross-company record leak through this path?
- Is rationale preserved without being invented?
- Is indexing state reported truthfully?
- Does the demo prove reuse across at least two roles?
- Did this phase add anything outside the north-star question?
