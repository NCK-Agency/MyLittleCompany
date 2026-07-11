# PLANS.md

This is the live execution plan. Codex must update it before and during multi-file work. Keep completed items and verification evidence so future sessions can understand what actually happened.

## Active plan: MVP vertical slice

### Completed checkpoint: Phase 0 Netlify-ready foundation

**Outcome:** Create the smallest deployable Next.js App Router foundation and make
Netlify deployment a repository-driven build with no dashboard-only build settings.

**Affected files:** `package.json`, `pnpm-lock.yaml`, framework configuration,
`src/app/`, `netlify.toml`, `.nvmrc`, `.env.example`, and deployment documentation.

**Implementation steps:**

- [x] Bootstrap a minimal pnpm Next.js App Router app without overwriting the existing spec assets.
- [x] Pin the package-manager and Node runtime expectations used locally and by Netlify.
- [x] Add a repository-owned Netlify build command and publish directory.
- [x] Document Git-connected deployment and required environment-variable setup.
- [x] Run lint, typecheck, tests, E2E smoke test, and a production build.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` must
pass. The production build must use only local-mode configuration and must not
require AWS or sponsor credentials.

**Rollback:** Revert only the files added or changed for this checkpoint. There
are no database, cloud-resource, or data migrations to undo.

**Scope guard:** This checkpoint does not add AWS adapters, authentication,
voice, website import, sponsor integrations, or Phase 1 product behavior.

**Verification results (2026-07-11):**

```text
pnpm install --frozen-lockfile: PASS
pnpm lint:                    PASS
pnpm typecheck:               PASS
pnpm test:                    PASS (2 files, 3 tests)
pnpm test:e2e:                PASS (1 Chromium test)
pnpm build:                   PASS (Next.js 16.2.10, static / route)
git diff --check:             PASS
```

**Remaining deployment step:** Connect the Git repository in Netlify and set the
documented local-mode environment variables. A remote deploy was not started
because no Netlify site or Git remote was placed in scope.

### Current checkpoint: Phase 1 local organizational-memory loop

**Outcome:** Complete the deterministic salon flow from Marketing conversation
through human-approved company knowledge to Marketing, Operations, and Employee
reuse, without external services.

**Affected areas:** `src/domain/`, `src/ports/`, `src/adapters/local/`,
`src/services/`, App Router pages and route handlers, UI components, fixtures,
unit/integration tests, and `e2e/salon-demo.spec.ts`.

**Verification:** Each domain boundary receives focused unit tests. Completion
requires `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and
`pnpm build`, followed by results recorded below.

**Rollback:** Revert Phase 1 files to the verified Netlify foundation. Runtime
state is process-local and can also be restored through the demo reset action.

**Scope guard:** Local adapters and deterministic fixtures only. No AWS,
authentication provider, voice, website import, sponsor integration, deployment,
or full conflict-resolution workflow.

### Outcome

Build a polished local-first vertical slice that proves the product loop before adding AWS infrastructure.

### Scope

- Next.js application shell.
- Demo salon company.
- Marketing chat.
- Deterministic local memory extraction.
- Suggested-knowledge review and approval.
- Approved-memory retrieval.
- Operations SOP generation.
- Employee policy question with source.
- Unit and end-to-end tests.

### Out of scope

- Authentication.
- Website import.
- Voice.
- Notion sync.
- Production multi-tenancy.
- Agent marketplace.
- Billing.
- Autonomous external actions.

### Planned steps

- [x] Inspect all project documents and note conflicts or missing decisions.
- [x] Initialize pnpm, Next.js App Router, TypeScript strict mode, and Tailwind.
- [x] Add linting, type checking, unit-test, E2E-test, and build commands.
- [x] Create the intended repository structure.
- [x] Implement domain types, Zod schemas, and state transitions.
- [x] Implement local repositories and deterministic model fixtures.
- [x] Seed the salon demo company and existing approved context.
- [x] Build navigation and page shells.
- [x] Build Marketing Assistant chat.
- [x] Build suggested-knowledge card and approval flow.
- [x] Build Playbook list and memory detail.
- [x] Build Operations Assistant SOP flow.
- [x] Build employee policy-question flow with source chips.
- [x] Add loading, empty, success, and failure states.
- [x] Add unit tests for critical domain rules.
- [x] Add the salon E2E demo test.
- [x] Run verification commands and record results.
- [x] Review scope and prepare the next AWS integration plan.

### Expected files

Codex should refine this list after scaffolding:

```text
src/app/
src/components/
src/domain/
src/services/
src/adapters/local/
src/adapters/aws/
src/lib/
src/prompts/
tests/
e2e/
```

### Verification

Record the exact result of each command:

```text
pnpm lint:       PASS
pnpm typecheck:  PASS
pnpm test:       PASS (8 files, 13 tests)
pnpm test:e2e:   PASS (2 tests; 4/4 with repeat-each=2 in serial mode)
pnpm build:      PASS (Next.js 16.2.10 webpack production build)
```

### Risks and mitigations

| Risk | Mitigation | Status |
|---|---|---|
| UI work starts before domain rules are clear | Implement schemas and state transitions first | Mitigated |
| AI behavior is nondeterministic during UI development | Use deterministic local fixtures first | Mitigated |
| Unapproved memory leaks into answers | Centralize retrieval eligibility in domain service and test it | Mitigated |
| AWS setup blocks product progress | Keep adapters behind interfaces; wire AWS after local loop | Mitigated |
| Scope expands into an agent platform | Enforce non-goals in `AGENTS.md` | Mitigated |

### Decisions made during execution

Add dated entries here and mirror durable decisions in `docs/DECISION_LOG.md`.

### Surprises and discoveries

- Next.js development route bundles did not reliably share one process-global demo store. The local adapter was changed to a file-backed store in development and remains isolated in memory during unit tests.
- Next.js 16.2.10 Turbopack compiled Phase 1 but failed while collecting API route data because of a Zod module-initialization error. The supported webpack production builder passes; ADR-013 records the temporary build choice.

### Outcome and remaining work

Phase 0 and Phase 1 are complete. The local salon flow resets, creates the owner
conversation, extracts one source-backed decision suggestion, requires explicit
owner approval, indexes it locally, reuses it in Marketing and Operations, and
answers the employee's 25%-off question with the approved source and rationale.

Remaining work begins at Phase 2: implement Amazon Bedrock, DynamoDB/S3, and
Bedrock Knowledge Base adapters behind the existing ports. The Netlify-hosted
local demo uses ephemeral file-backed state and may reset on a cold function;
durable deployed state requires the planned AWS adapters.
