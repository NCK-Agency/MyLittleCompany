# Decision Log

**Canonical decision record**
**Last consolidated:** 2026-07-11

Use this file for durable product, trust, experience, architecture, deployment,
and scope decisions. Add a dated ADR when a material choice changes. Do not edit
an old decision to hide a reversal: mark it superseded and add the replacing ADR.

## Current decision index

| ID | Accepted decision | Area |
|---|---|---|
| ADR-001 | Organizational memory is the product, not an agent workforce | Product |
| ADR-002 | AI suggests; a human approves company truth | Trust |
| ADR-003 | Only current approved memory is authoritative | Trust |
| ADR-004 | Preserve rationale, source, approver, scope, time, and version | Trust |
| ADR-005 | The MVP uses Marketing, Operations, and Employee experiences | Scope |
| ADR-006 | Domain services use local/AWS ports and adapters | Architecture |
| ADR-007 | DynamoDB is structured truth; the Knowledge Base is derived | Architecture |
| ADR-008 | Approved versions are rendered to S3 and directly ingested | Architecture |
| ADR-009 | Model choice remains environment configuration | AI |
| ADR-010 | Website imports are optional, untrusted sources | Integrations |
| ADR-011 | Implement one primary observability approach first | Operations |
| ADR-012 | Demo authentication may be simple; server authorization may not | Security |
| ADR-013 | Use webpack for verified production builds for now | Build |
| ADR-014 | Runtime mode selects one complete local or AWS dependency set | Architecture |
| ADR-015 | assistant-ui supplies chat mechanics; MLC owns data and actions | Experience |
| ADR-016 | The Company Playbook is directly editable and versioned | Product |
| ADR-017 | Use the bold blue kinetic-editorial identity | Design |
| ADR-018 | The public entry page leads with the product promise | Product story |
| ADR-019 | Netlify may host the app; AWS remains the durable AI/data core | Deployment |
| ADR-020 | The pitch hands off to live product proof within 90 seconds | Demo |
| ADR-021 | External tools never become authoritative company truth | Integrations |
| ADR-022 | Customer-facing copy uses the full product name | Brand language |
| ADR-023 | Use a console-first, configurable AWS demo foundation | Deployment |
| ADR-024 | Use one scoped knowledge hierarchy with persistent conversation history | Product architecture |
| ADR-025 | Use webpack for both verified development and production rendering | Build |
| ADR-026 | Add topic views and in-chat context without making documents primary | Product experience |
| ADR-027 | Cognito proves identity; memberships grant scoped knowledge access | Security |
| ADR-028 | Client-neutral MCP reuses membership authorization through a consent-only OAuth broker | Integrations |
| ADR-029 | Onboarding proves one imported fact before expanding connector breadth | Product architecture |
| ADR-030 | Pool AWS resources while company-prefixing every business-data partition | Security architecture |

## Standing boundaries

These constraints are already accepted and should not be reopened during normal
MVP work unless a new ADR explicitly supersedes them:

- Product promise: **“Explain it once. Your company remembers.”**
- Primary user: a busy, non-technical small-business owner; the salon is the
  demonstration vertical, not a permanent product limitation.
- Primary navigation: **Home, Chat, Review, Playbook**.
- Required implementation baseline: strict TypeScript, Next.js App Router,
  React, Tailwind CSS, pnpm, Zod, AWS SDK v3, Bedrock, Bedrock Knowledge Bases,
  DynamoDB, and S3.
- The core proof is the complete governed-memory loop, not feature breadth.
- Real AWS and Cognito smoke validation remains pending until the deployment
  resources and external accounts are available.
- Voice, broad integration catalogs, billing, marketplaces, mobile apps, and
  additional assistants remain deferred.

## Current experience decision map

This map makes the accepted route and narrative decisions explicit. It is a
summary of ADR-005, ADR-016, ADR-017, ADR-018, and ADR-022 rather than a separate
source of truth.

| Surface | Accepted purpose | Primary action or boundary |
|---|---|---|
| `/` | Public statement-led landing page | Explain the promise, trust loop, and salon proof; open Marketing demo |
| `/workspace` | Demo-company home and controls | Edit the company profile, inspect recent knowledge, and reset demo state |
| `/chat` | Marketing, Operations, and Employee work | Work naturally while approved context and suggestions remain visible |
| `/review` | Human approval inbox | Approve, edit, or ignore suggested company knowledge |
| `/playbook` | Current approved company truth | Browse, source-check, and explicitly version approved knowledge |

The landing narrative order is also fixed: **promise → problem → governed-memory
loop → human trust boundary → salon proof → live demo action**. Pricing tables,
generic testimonials, broad feature inventories, and speculative integrations do
not belong on the MVP landing page.

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

## ADR-014 — Ship one complete AWS dependency set

**Status:** Accepted

**Decision:** `APP_MODE` selects either the complete credential-free local adapter
set or the complete Bedrock, DynamoDB, S3, and Knowledge Base adapter set once in
the server composition root.

**Reason:** Adding Bedrock alone would leave Netlify state ephemeral and would not
prove durable governed memory. Mixed modes also hide configuration errors and
make retrieval authority ambiguous.

**Consequence:** AWS mode validates every required resource ID at startup. Index
hits remain untrusted until hydrated from DynamoDB, and approval writes structured
truth transactionally before S3/Knowledge Base indexing.

## ADR-015 — Use assistant-ui as the chat interaction layer

**Status:** Accepted; conversation-history scope superseded by ADR-024

**Decision:** Add the MIT-licensed `@assistant-ui/react@0.14.26` package and use
its external-store runtime plus composable thread primitives inside the existing
Next.js application. MLC continues to own message state, REST calls, knowledge
suggestions, approval actions, and persistence. Do not configure assistant-cloud,
Vercel AI SDK, or another chat backend.

**Reason:** assistant-ui supplies polished, accessible conversation mechanics
without introducing LibreChat's second application, MongoDB store, authentication
boundary, or maintained fork. This keeps the hackathon demo focused on MLC's
governed-memory loop rather than general chatbot infrastructure.

**Consequence:** Chat presentation depends on assistant-ui, but all authoritative
company data and network operations remain behind current MLC services and routes.
Custom knowledge cards and internal source chips remain MLC-owned components.

**Implementation boundary:**

- Use `ExternalStoreRuntime` around MLC-owned message state and existing REST
  endpoints. Do not add a second conversation service or public API contract.
- Keep one active conversation for each of Marketing, Operations, and Employee.
  Each assistant retains its own transcript and unsent draft when the owner
  switches roles.
- Map existing domain messages, source references, and memory candidates through
  a UI-only adapter. Suggested knowledge is attached to its originating turn as
  a named data part and rendered as an inline MLC card.
- Approval, editing, ignoring, and indexing retry remain explicit application
  actions. They are never model-executed tools, and approval does not falsely
  imply that Knowledge Base indexing has completed.
- Display approval and indexing separately as Approved, Adding to Playbook,
  Ready, or Needs retry. Internal sources use MLC source chips rather than being
  treated as public web links.
- Preserve the current role-specific APIs, server-side company and role scope,
  idempotency keys, and server-only Bedrock configuration.
- Keep the visual language MLC-branded. The goal is familiar, polished chat
  behavior, not a visual copy of ChatGPT.

**Alternatives considered:** LibreChat was investigated but not adopted because
it would introduce a second application, persistence model, authentication
boundary, and a larger customization surface. Continuing the hand-built chat was
also rejected because assistant-ui provides the required accessible conversation
mechanics with less bespoke maintenance.

**Deferred:** Searchable thread history, branching, attachments, voice, model
selection, assistant-cloud persistence, and true token streaming. The external
runtime boundary should allow streaming later without replacing the interface.

ADR-024 now implements first-party searchable conversation history while keeping
branching, attachments, voice, model selection, assistant-cloud persistence, and
true token streaming deferred.

## ADR-016 — The Company Playbook is directly editable

**Status:** Accepted

**Decision:** Let an authorized owner amend approved company knowledge directly
from its Playbook page. Each save is an explicit human approval action that
creates a new immutable approved version, preserves prior versions and sources,
adds the direct edit as a manual source, and refreshes the derived Knowledge Base
document.

**Reason:** Owners need to see and maintain company knowledge as a living company
workspace, similar to a familiar document system. Requiring every correction to
begin in chat would make the governed memory layer feel hidden and cumbersome.

**Consequence:** Direct edits never mutate a stored version in place. DynamoDB
advances the current version conditionally, stale saves are rejected, and a
Knowledge Base failure leaves the structured Playbook version intact with a
visible retry state.

## ADR-017 — Use the bold blue kinetic-editorial identity

**Status:** Accepted

**Decision:** Use cobalt, deep cobalt, coral, butter, ivory, and graphite with
Instrument Sans, Barlow Condensed, and the four-fragment company-memory mark. The
signature visual behavior is scattered conversation fragments snapping into an
approved whole.

The state semantics are fixed:

- Cobalt anchors navigation, titles, active work, and trusted company context.
- Butter marks suggestions, attention, and knowledge awaiting a decision.
- Coral marks approval and other decisive primary actions.
- Ivory and graphite provide the calm default reading surface.
- The complete fragment mark represents approved or reusable company memory;
  separated fragments appear only when explaining unstructured conversation.

**Reason:** The identity makes the memory transformation visible, performs well
on a hackathon stage, and avoids generic AI-product imagery.

**Consequence:** Product and pitch surfaces follow `DESIGN.md`. Avoid purple
gradients, sparkles, robots, brains, stock imagery, excessive rounding, and
decorative motion that does not explain the governed-memory loop. Product screens
use a disciplined, readable grid; public and presentation surfaces may use larger
editorial type and more negative space. The approved fonts are loaded through the
Next.js font system so deployed pages self-host optimized assets.

## ADR-018 — Lead the public entry page with the product promise

**Status:** Accepted

**Decision:** The root page is a statement-led public landing experience built
around “Explain it once. Your company remembers.” It explains the problem,
governed-memory loop, trust boundary, and salon proof before handing visitors into
the live demo.

The root route and handoff are fixed:

- `/` owns the public product story.
- The primary landing action opens `/chat?assistant=MARKETING` so the first click
  begins the deterministic salon proof rather than another explanation page.
- `/workspace` preserves the demo-company dashboard, profile editing, recent
  knowledge, and reset controls that previously lived at the root.
- The persistent Home, Chat, Review, and Playbook navigation remains small and
  understandable; the demo-company badge links to `/workspace`.

**Reason:** An app dashboard does not explain the product to a first-time judge or
owner. The core idea must be understandable before navigation or demo narration.

**Consequence:** The root page has one clear salon-demo action and no generic
feature-card grid, pricing section, or invented social proof. Home-like company
workspace information stays inside the authenticated/demo product experience at
`/workspace`. The first-screen test asserts both the product promise and the direct
Marketing-demo link.

## ADR-019 — Netlify may host the app; AWS remains the durable core

**Status:** Accepted

**Decision:** Use repository-controlled Netlify deployment for the Next.js web
application when convenient, while Amazon Bedrock, DynamoDB, S3, and Bedrock
Knowledge Bases remain the production AI and organizational-memory foundation.

**Reason:** Netlify enables fast web deployment without weakening the AWS AI/ML
story or coupling domain logic to the hosting provider.

**Consequence:** AWS credentials and resource identifiers remain server-only
environment variables. Credential-free local mode is a development and fallback
demo path, not durable production storage.

## ADR-020 — Hand the pitch to live product proof within 90 seconds

**Status:** Accepted

**Decision:** Use at most three audience-facing setup slides and spend no more
than 90 seconds on them before opening the live salon demo. End on product proof,
not a generic thank-you slide.

**Reason:** The governed-memory loop is more convincing when judges see one owner
statement change later assistant and employee behavior.

**Consequence:** Presentation material emphasizes the problem, the trust loop,
and the salon proof. Feature inventories and long architecture narration are cut.

## ADR-021 — External tools never become authoritative company truth

**Status:** Accepted

**Decision:** Notion, websites, documents, voice transcripts, and future external
integrations may supply untrusted sources or receive exports. MLC's approved,
versioned company memory remains the source of truth.

**Reason:** Delegating authority to an imported page, transcript, or external
system would bypass the human approval and conflict-handling model.

**Consequence:** Imports create suggestions requiring review. Exports do not
transfer governance authority. Notion is an optional import/export destination,
not the backing store for authoritative memory.

## ADR-022 — Use the full product name in customer-facing copy

**Status:** Accepted

**Decision:** Use “My Little Company” in customer- and judge-facing copy. Reserve
“MLC” for internal code, technical identifiers, and backlog ticket IDs. Where
repeating the full name would sound unnatural, use contextual language such as
“your company” or “the Playbook” instead of the acronym.

**Reason:** The full name is warmer, more memorable, and clearer to people who
have not already learned the acronym.

**Consequence:** Interface labels, status messages, public pages, and pitch
narration do not introduce or depend on “MLC.” Existing component names, CSS
classes, data-part identifiers, environment fixtures, and ticket IDs remain
unchanged.

## ADR-023 — Use a console-first, configurable AWS demo foundation

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Provision the hackathon AWS foundation through the console in
`us-east-1`, using `amazon.nova-lite-v1:0` as the default Converse model, Titan
Text Embeddings V2 for the Knowledge Base, an S3 data source restricted to
`memories/`, and the console's quick-created S3 Vectors option. Keep the Region,
model ID, Knowledge Base ID, data source ID, table name, and bucket name in
environment variables.

**Reason:** Console-first setup is the fastest path to a working competition demo,
while configuration-owned identifiers preserve the adapter boundaries and allow
the model or vector store to change if account availability requires it.

**Consequence:** Infrastructure-as-code does not block the demo. AWS availability
must be verified before deployment, `pnpm smoke:aws` and `pnpm test:e2e:aws`
remain the acceptance gates, and a different Converse-supported model or
compatible vector store may be selected without changing domain interfaces.

## ADR-024 — Use one scoped knowledge hierarchy with persistent conversation history

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Keep one governed Company Playbook and scope each conversation,
suggestion, approved memory, and immutable version to either the entire company or
one department. Company knowledge is inherited by every department. Department
knowledge is available only inside that department and never silently overrides a
company rule. The workspace lists and reopens first-party conversations, and the
Playbook presents approved entries as owner-created, document-like knowledge pages.

`/save-knowledge` is a client command that opens an owner confirmation form. It is
not a model-executed tool. The final owner submission creates an approved,
source-backed page and then reports Knowledge Base indexing separately.

**Reason:** Separate department stores would fragment company truth, while role
chips alone cannot express where knowledge applies. Persistent chats and a
page-tree Playbook make governed memory visible during normal work without adding
a second source of truth.

**Consequence:** Organizational location, role applicability, and sensitivity are
independent checks. Existing records default to company scope. Owners may create
pages directly or from verified conversation messages; every save creates an
immutable approved version and retains the current indexing failure behavior.

## ADR-025 — Use webpack for verified development and production rendering

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Run both `pnpm dev` and `pnpm build` with Next.js's webpack path.

**Reason:** During the scoped-workspace visual audit, Next.js 16.2.10 Turbopack
served a development stylesheet that omitted the new workspace rules even after a
server restart, while webpack compiled and rendered the same source correctly.

**Consequence:** Local visual work and production builds use the same verified
bundler until a Next.js upgrade proves Turbopack parity. This supersedes the part
of ADR-013 that kept Turbopack as the development default.

## ADR-026 — Add topic views and in-chat context without making documents primary

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Adopt three parts of the conversational knowledge roadmap:

1. Present the seven canonical memory types through five owner-friendly views:
   Company basics, Customers, Brand, Decisions and policies, and How we work.
2. Let chat open a contextual knowledge panel showing approved sources used in
   the conversation, recent eligible knowledge, and suggestions waiting for an
   owner decision.
3. Require the Operations Assistant to use the user's actual request as its SOP
   goal while treating approved memories as constraints.

These topic views are presentation filters, not folders or new record types. The
company/department hierarchy from ADR-024 remains the canonical organizational
scope, and the approved memory record remains the primary governed unit.

**Reason:** Slite and the standards review correctly emphasize visible structure,
cited answers, and low-friction maintenance. Those patterns make the governed
memory loop easier to understand without changing My Little Company's stronger
conversation-first distinction.

**Consequence:** Chat remains the primary work surface and the Playbook remains a
view over governed records. Knowledge owner, review dates, freshness automation,
relationship graphs, and Markdown/YAML export remain deferred until conflict
resolution and the real AWS path are complete; adding them now would widen the
schema without strengthening the salon proof.

## ADR-027 — Cognito identity with application-owned scoped authorization

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Use Amazon Cognito managed login and Auth.js secure cookie sessions
for deployed identity. Keep company authorization in current DynamoDB membership
records, never Cognito groups or browser fields. Owners have full access; members
receive independent `READ`, `SUGGEST`, and `APPROVE` grants for the company or a
department. `APPROVE` includes `READ`, department reads inherit relevant company
knowledge, and confidential knowledge remains owner-only.

Every request reloads the membership by provider subject. Assistant role remains
content targeting and cannot expand the signed-in person's access. Local and test
mode use the same actor boundary with selectable seeded identities.

**Reason:** Cognito should solve authentication without turning identity claims
into stale company policy. Persisted grants allow immediate revocation, scoped
delegation, auditable owner administration, and safe department boundaries.

**Consequence:** ADR-012's production deferral is superseded. Direct Playbook
creation and amendment remain owner-only; delegated approvers decide suggestions
in scope. Multi-company switching, ownership transfer, SSO, and custom password
flows remain deferred.

## ADR-028 — Client-neutral, consent-only OAuth bridge for MCP

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Expose approved company knowledge to compatible AI clients through a
tool-only, stateless Streamable HTTP MCP server. Auth.js continues to own web
sessions and Cognito sign-in. A narrow OAuth 2.1 broker exists only for MCP
client compatibility and issues audience-bound tokens containing identity
subject and consent scopes, never company IDs, business roles, or grants.

Every MCP call validates the token and reloads the active membership. Standard
`search` and `fetch` tools require both `knowledge:read` consent and application
`READ`; `suggest_company_knowledge` requires both `knowledge:suggest` consent and
application `SUGGEST`. There is no MCP approval scope or tool. Suggestions use
the same secret-screened, source-backed, conflict-aware candidate pipeline and
remain unavailable to retrieval until approved and indexed.

**Reason:** External assistants need a standard connection protocol, but an
agent-vendor session or OAuth consent must never become company authorization. Reusing the
membership boundary gives immediate grant changes, disabling, company isolation,
and the same human-governed truth loop on every client.

**Consequence:** The connector requires one account-link flow, Authorization Code
with PKCE S256, exact registered callbacks, resource binding, short-lived access
tokens, rotating refresh tokens, revocation, and persisted OAuth state. Public
directory submission, widgets, whole-conversation synchronization, and approval
inside an external assistant remain out of scope.

## ADR-029 — Proof-first onboarding before connector breadth

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Activate a signed-in owner by asking one real question, importing one selected conversation, approving one durable item through the existing governed-memory workflow, and answering the question with a citation to that newly approved knowledge. Slice 1 supports pasted text and a client-side-parsed ChatGPT export. Processing is resumable and leased; structured approved memory may answer immediately while Knowledge Base indexing reports its own state.

The Company profile, company/department hierarchy, seven memory types, and five Playbook views remain canonical. Imported company basics are `COMPANY_FACT` suggestions, not silent profile mutations or generated folders.

**Reason:** A fast, visible proof of “Explain it once. Your company remembers.” creates more trust and activation value than asking an owner to configure an integration catalog before seeing a correct answer.

**Consequence:** New-client creation, invited-user welcome, WhatsApp text export, Google Drive snapshots, websites, and Notion remain separately staged. Future connectors must submit selective, source-backed content through the same proposal, approval, retention, and company-scoping boundaries.

## ADR-030 — Pool AWS resources with tenant-prefixed business partitions

**Status:** Accepted
**Date:** 2026-07-11

**Decision:** Use one pooled DynamoDB table, private S3 bucket, and Bedrock
Knowledge Base for the current product, while making the trusted `companyId` part
of every business-data namespace. Root records use `COMPANY#{companyId}`;
messages use `COMPANY#{companyId}#CONVERSATION#{conversationId}`; immutable memory
versions use `COMPANY#{companyId}#MEMORY#{memoryId}`; S3 objects and Knowledge Base
documents retain their company prefix and metadata.

The server derives company scope from the active membership. Bedrock retrieval
must include the company and approved-status filters, reject missing or malformed
security metadata, and hydrate every surviving hit from the company-prefixed
DynamoDB record and current immutable version. Identity and OAuth lookup records
may use global partitions only to locate authorization state; they never return
company content directly.

**Reason:** Globally unique IDs lower the probability of accidental reuse but do
not create a security boundary. Company-prefixed child partitions prevent
physical key collisions, support future `dynamodb:LeadingKeys` restrictions, and
preserve efficient parent-child queries without provisioning one AWS stack per
small business.

**Consequence:** Existing demo or pre-production AWS data using unprefixed
message/version partitions must be recreated or explicitly migrated before this
key shape is deployed. Runtime scans remain prohibited. Physically isolated
tables, buckets, Knowledge Bases, KMS keys, or AWS accounts remain a future
enterprise option rather than the default MVP topology.
