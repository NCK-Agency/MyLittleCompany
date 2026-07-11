# Decision Log

Use this file for durable product and architecture decisions. Add a dated entry when a material choice changes.

## ADR-001 — Organizational memory is the product

**Status:** Accepted  
**Decision:** Position MLC as an owner-controlled organizational-memory layer, not primarily as an AI-agent workforce platform.  
**Reason:** The strongest differentiation is turning tacit owner knowledge into approved, reusable company capability.  
**Consequence:** Agent-management, marketplace, and workforce-analytics features are outside the MVP.

## ADR-002 — Human approval is mandatory

**Status:** Accepted  
**Decision:** AI may propose company knowledge but may never approve it.  
**Reason:** Silent memory creation creates trust, poisoning, and governance risks.  
**Consequence:** Every durable memory path includes an owner review state.

## ADR-003 — Only approved current memory is authoritative

**Status:** Accepted  
**Decision:** Proposed, rejected, superseded, and archived records are excluded from authoritative retrieval.  
**Reason:** Clear truth states prevent accidental reuse of drafts and obsolete rules.  
**Consequence:** Retrieval results are revalidated against the structured repository.

## ADR-004 — Preserve rationale and provenance

**Status:** Accepted  
**Decision:** Decisions and policies retain rationale, source, approver, timestamp, scope, and version.  
**Reason:** Future employees need context for judgment, not only a final sentence.  
**Consequence:** The data model and approval UI require these fields or explicit missing values.

## ADR-005 — Two assistants plus employee mode

**Status:** Accepted  
**Decision:** Build Marketing and Operations assistants, plus Employee Q&A.  
**Reason:** This is enough to prove cross-role reuse without expanding into a full agent OS.  
**Consequence:** Additional assistants are P2.

## ADR-006 — Local-first ports and adapters

**Status:** Accepted  
**Decision:** Domain and application services depend on interfaces with local and AWS adapters.  
**Reason:** Product development and testing must not be blocked by cloud setup, while the submitted path still uses AWS.  
**Consequence:** AWS SDK imports are confined to adapters.

## ADR-007 — DynamoDB is structured truth; Knowledge Base is a derived index

**Status:** Accepted  
**Decision:** Persist canonical structured memory and version state in DynamoDB. Use Bedrock Knowledge Bases as retrieval infrastructure.  
**Reason:** Search indexes can be stale or fail independently; approval and version truth require deterministic records.  
**Consequence:** Index hits are hydrated and verified before use.

## ADR-008 — Direct ingestion after approval

**Status:** Accepted  
**Decision:** Render each approved memory version and directly ingest it into the configured Bedrock Knowledge Base, while keeping a canonical S3 copy.  
**Reason:** Approved knowledge should become searchable without a full source sync.  
**Consequence:** Approval and indexing use separate statuses and idempotent retry.

## ADR-009 — Model choice is configuration

**Status:** Accepted  
**Decision:** Do not hardcode one foundation model into domain logic.  
**Reason:** Availability, cost, and model quality change; Bedrock exposes multiple choices.  
**Consequence:** Prompt behavior and schemas must be model-portable.

## ADR-010 — Website import is optional and untrusted

**Status:** Accepted  
**Decision:** Apify website onboarding is P1. Imported content can produce suggestions but cannot become approved memory directly.  
**Reason:** Easy onboarding supports the product promise, but import creates prompt-injection and data-quality risks.  
**Consequence:** The core demo cannot depend on website import.

## ADR-011 — One primary observability implementation

**Status:** Accepted  
**Decision:** Implement either Langfuse or AWS-native observability first, behind a Telemetry interface.  
**Reason:** Duplicating telemetry integrations adds scope without improving the product demo.  
**Consequence:** The second adapter remains optional.

## ADR-012 — Demo authentication may be simplified, authorization may not

**Status:** Accepted  
**Decision:** Use seeded demo sessions if necessary, but derive company and role scope on the server.  
**Reason:** Full authentication can distract from the hackathon, but client-trusted roles would invalidate the governance story.  
**Consequence:** Production Cognito integration is deferred; server-side actor context is still required.

## ADR-013 — Use webpack for production builds during Phase 1

**Status:** Accepted

**Decision:** Run `next build --webpack` for local and Netlify production builds while keeping the default Next.js development builder.

**Reason:** Next.js 16.2.10 Turbopack compiled the application but failed during route page-data collection with a Zod module-initialization error. The supported webpack builder completes the same strict type check and all routes successfully.

**Consequence:** Deployment remains a normal Next.js build behind `pnpm build`. Re-evaluate the flag after a Next.js or Zod upgrade rather than carrying an unverified workaround indefinitely.
