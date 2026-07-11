# Prioritized Backlog

## How to use this backlog

- Complete P0 in order unless a dependency requires a small reordering.
- Each ticket should produce a reviewable, tested change.
- Update status and links to commits or pull requests when available.
- Do not start P2 work while any blocking P0 acceptance criterion is incomplete.

Status values: `TODO`, `IN_PROGRESS`, `BLOCKED`, `DONE`.

## P0 — Required for the demo

### MLC-001 Repository bootstrap — DONE

**Goal:** Create a maintainable Next.js foundation.

**Acceptance criteria:**

- pnpm, Next.js App Router, strict TypeScript, and Tailwind configured.
- Lint, typecheck, test, E2E, and build scripts exist.
- Environment variables validated server-side.
- Folder structure follows `docs/ARCHITECTURE.md`.
- Required verification commands pass.

### MLC-002 Domain schemas and state machine — DONE

**Depends on:** MLC-001

**Acceptance criteria:**

- Zod schemas for candidate, memory record, memory version, and SOP.
- Candidate approval and memory/index state transitions implemented as pure functions.
- Illegal transitions return typed errors.
- Tests cover proposed, approval, rejection, supersession, archive, index failure, and retry.

### MLC-003 Ports and local adapters — DONE

**Depends on:** MLC-002

**Acceptance criteria:**

- Explicit repository, index, model, source, and telemetry interfaces.
- Local implementations require no credentials.
- Local index returns only eligible current approved memories.
- Tests cover company, role, status, and version filtering.

### MLC-004 Demo fixture and reset — DONE

**Depends on:** MLC-003

**Acceptance criteria:**

- Salon company, owner, employee, approved brand context, and initial conversation state seeded.
- No pre-existing 15% discount decision.
- Reset is deterministic and limited to `demo-salon`.
- One command and one UI action can reset the demo.

### MLC-005 Application shell and navigation — DONE

**Depends on:** MLC-001, MLC-004

**Acceptance criteria:**

- Home, Chat, Review, and Playbook routes.
- Responsive navigation.
- Demo company is clearly identified.
- Empty and loading states match `docs/UX_SPEC.md`.

### MLC-006 Marketing chat local flow — DONE

**Depends on:** MLC-003, MLC-005

**Acceptance criteria:**

- Owner can send the Tuesday campaign request.
- Local assistant returns a polished campaign idea.
- Conversation persists locally.
- Source area clearly shows whether approved memory influenced the response.

### MLC-007 Memory extraction and review card — DONE

**Depends on:** MLC-006

**Acceptance criteria:**

- Owner’s 15% and free-add-on statement creates one decision suggestion.
- Card shows statement, rationale, roles, type, and source.
- AI does not approve it.
- Edit and Ignore work.
- Invalid candidate output is not persisted.

### MLC-008 Approval and Playbook — DONE

**Depends on:** MLC-007

**Acceptance criteria:**

- Owner approves the suggestion.
- Approved memory and immutable version are created.
- Approver, time, source, rationale, and role scope are visible.
- Playbook shows the current record.
- Proposed and rejected suggestions are absent from Playbook.

### MLC-009 Approved-memory reuse — DONE

**Depends on:** MLC-008

**Acceptance criteria:**

- Marketing Assistant revises the campaign without exceeding 15%.
- It prefers a complimentary add-on.
- Response shows the approved decision as a source.
- Test fails if proposed memory is substituted for approved memory.

### MLC-010 Operations SOP — DONE

**Depends on:** MLC-009

**Acceptance criteria:**

- Operations Assistant produces a structured Tuesday Promotion SOP.
- SOP cites the pricing decision.
- SOP contains purpose, owner, prerequisites, steps, checks, and escalation.
- Saving it creates a suggestion, not an automatic approval.

### MLC-011 Employee grounded answer — DONE

**Depends on:** MLC-009

**Acceptance criteria:**

- Employee asks whether 25% off is allowed.
- Answer begins with a clear “No.”
- It states the 15% limit and add-on preference.
- It displays source title and approval date.
- Missing-context test produces `NO_APPROVED_CONTEXT` rather than invention.

### MLC-012 Local E2E demo test — DONE

**Depends on:** MLC-004 through MLC-011

**Acceptance criteria:**

- Test resets demo.
- Completes campaign conversation.
- Approves suggested knowledge.
- Generates SOP.
- Asks employee question.
- Verifies source and 15% rule.
- Passes repeatedly without external services.

### MLC-013 Bedrock model adapter — DONE

**Depends on:** MLC-003, MLC-012

**Acceptance criteria:**

- Bedrock model calls occur only server-side.
- Model ID is configurable.
- Prompts load from versioned files.
- Structured outputs are validated and repaired at most once.
- Timeouts and safe errors exist.
- Local adapter still works.

### MLC-014 DynamoDB and S3 adapters — IN_PROGRESS

**Depends on:** MLC-003, MLC-008

**Acceptance criteria:**

- Required access patterns implemented without runtime scans.
- Messages and memory versions use company-prefixed child partitions; tests prove
  identical IDs in different companies cannot collide.
- Conditional approval prevents double writes.
- Versions are immutable.
- S3 objects are private and company-prefixed.
- Audit events exist for approval and index changes.

### MLC-015 Bedrock Knowledge Base adapter — IN_PROGRESS

**Depends on:** MLC-013, MLC-014

**Acceptance criteria:**

- Approved version rendered deterministically.
- Direct ingestion uses stable document ID.
- Metadata includes company, memory, version, roles, type, status, and sensitivity where supported.
- Missing, malformed, or cross-company index metadata fails closed before hydration.
- Retrieval hits are hydrated and revalidated from DynamoDB.
- Index state supports pending, ready, failed, and retry.

### MLC-016 AWS smoke test — BLOCKED

**Depends on:** MLC-015

**Acceptance criteria:**

- Script invokes configured Bedrock model.
- Approves and indexes a disposable demo memory or verifies an existing fixture.
- Retrieves it with expected company scope.
- Cleans up disposable data where safe.
- Documentation explains required AWS resources and IAM actions.

**Blocker:** The executable smoke path is implemented, but no AWS resources or
runtime credentials are available in the repository environment. Do not mark this
ticket DONE until `pnpm smoke:aws` and `pnpm test:e2e:aws` pass against the
provisioned account.

### MLC-017 Conflict detection — TODO

**Depends on:** MLC-013, MLC-015

**Acceptance criteria:**

- 25% rule against current 15% rule is classified as contradiction.
- Explicit service-recovery allowance can be classified as exception.
- Owner sees both current and proposed statements.
- Approval requires explicit resolution.

### MLC-018 Security fixtures — TODO

**Depends on:** MLC-017

**Acceptance criteria:**

- Malicious imported instructions do not alter application rules.
- Cross-company hit is discarded.
- Unknown citation is rejected.
- Employee cannot approve memory.
- Secrets are not accepted as memory.

### MLC-019 Deployment and demo hardening — TODO

**Depends on:** all previous P0

**Acceptance criteria:**

- Deployed app works from a clean browser session.
- Environment validation fails clearly when misconfigured.
- Demo reset works.
- All verification commands pass.
- Known limitations documented.
- Demo script matches actual behavior.

## P1 — Valuable after the core works

### MLC-101 Apify website onboarding — TODO

- Enter URL.
- Import and normalize content.
- Store as untrusted source.
- Propose facts and brand knowledge for approval.

### MLC-102 Telemetry adapter — TODO

- Implement Langfuse or AWS-native tracing behind `Telemetry`.
- Record safe operation and quality metrics.

### MLC-103 Antitech assessment package — TODO

- Repeatable prompt injection and memory poisoning tests.
- Exportable assessment evidence for Optional Links.

### MLC-104 Playbook search and filters — TODO

- Search by title and statement.
- Type and role filters.
- Current entries by default.

### MLC-105 Memory version comparison — TODO

- Side-by-side differences.
- Clear current version.
- Source and approver per version.

### MLC-106 Direct Playbook amendment — DONE

- Owner edits current approved knowledge from the Playbook detail page.
- Each save creates an immutable approved version with stale-write protection.
- Prior sources remain attached and the direct owner edit is source-backed.
- Version history and assistant-search status are visible.
- The new version is rendered and re-indexed with a retryable failure state.

### MLC-107 Scoped knowledge workspace and persistent chat — DONE

- Conversations persist in a ChatGPT-style history and reopen with their messages.
- Each conversation uses a stable company or department knowledge scope.
- `/save-knowledge` opens an owner confirmation form and never grants approval to
  the model.
- Owners can create source-backed pages directly in a company/department Playbook
  tree.
- Company knowledge is inherited; department knowledge remains department-only,
  with role, sensitivity, approval, and indexing checks still enforced.
- Desktop and mobile flows are covered by the salon E2E path.

### MLC-108 Conversational knowledge context — DONE

- Playbook pages can be viewed through five business-language topic groups without
  changing the canonical seven memory types.
- Chat exposes the approved sources used, recent knowledge eligible for the
  conversation scope, and suggestions awaiting review.
- Operations generation receives and follows the owner's actual request.
- Company/department scope and the approved memory record remain canonical.

### MLC-109 Knowledge ownership and freshness — TODO

- Assign an accountable knowledge owner.
- Add an optional review date or cadence.
- Derive plain-language Current, Review due, and Outdated states.
- Do not automatically change or archive company truth.

### MLC-110 Cognito login and scoped knowledge access — DONE

- Cognito managed login and Auth.js secure sessions establish identity.
- Current memberships grant independent company/department read, suggest, and
  approval access; owner remains unrestricted.
- People & access supports owner invitations, grant changes, pause/restore, and
  auditable access events.
- Demo personas and automated coverage prove contributor, approver, read-only,
  conversation-isolation, and confidential-owner-only behavior.

### MLC-111 Client-neutral MCP connection — DONE

- OAuth discovery, dynamic client registration, PKCE, audience binding, refresh
  rotation, revocation, and membership reload protect the connector.
- Standard `search` and `fetch` expose eligible approved knowledge with canonical
  Playbook URLs; a separate idempotent tool creates reviewable suggestions.
- No external client can approve knowledge or turn OAuth consent into an
  application grant.
- Conflict Review creates versions or conditioned exceptions instead of silently
  duplicating or replacing current knowledge.

### MLC-112 Proof-first company onboarding — DONE

- Owner chooses one proof question, imports pasted text or one selected ChatGPT conversation, and reviews up to three prioritized suggestions.
- ChatGPT account history is parsed locally; only the selected active conversation branch is uploaded and quick setup is capped at 40,000 characters.
- Leased, resumable processing creates no company truth automatically and remains idempotent under retries and cancellation.
- Completion requires a cited answer from knowledge approved from that import, while indexing status remains separately visible.
- Raw imported content follows 24-hour, seven-day, 30-day, approved-retention, and owner-tombstone rules.
- Local and AWS repositories, browser coverage, parser/security coverage, and the existing approval/index path are shared rather than duplicated.

## P2 — Stretch or post-hackathon

### MLC-201 Notion import/export — TODO
### MLC-202 Agora voice onboarding — TODO
### MLC-203 Manager approval scopes — DONE via MLC-110 explicit grants
### MLC-204 Company knowledge analytics — TODO
### MLC-205 Additional assistants — TODO
### MLC-206 Production authentication with Cognito — DONE via MLC-110
### MLC-207 Multi-company administration and billing — TODO
