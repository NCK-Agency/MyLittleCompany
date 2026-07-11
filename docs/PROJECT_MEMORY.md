# Project Memory — My Little Company

**Status:** Current product context  
**Product name:** My Little Company  
**Internal short name:** MLC
**Tagline:** Explain it once. Your company remembers.

This document is the durable context for the project. Update it when the product direction changes. Do not use it as a day-to-day task checklist; use `PLANS.md` and `docs/BACKLOG.md` for execution.

## 1. Product thesis

Small-business owners repeatedly explain the same business context to employees and AI assistants. Important knowledge lives in the owner’s head, old chat history, emails, documents, and informal habits. The company loses context when a conversation ends, a tool changes, or a person leaves.

MLC converts normal work conversations into structured, reviewable organizational knowledge. It preserves not just the final rule or process, but also the reason, source, approval, scope, and version.

The distinctive product idea is not an AI-agent team by itself. Agent teams are increasingly common. MLC differentiates through an easy, owner-controlled memory layer that both humans and agents can trust.

## 2. Product promise

> After the owner explains something once, the next employee or AI assistant should be able to act correctly without asking again.

The product loop is:

1. The owner talks or imports source material.
2. MLC detects potentially durable company knowledge.
3. MLC presents a clear suggestion.
4. A human approves, edits, or ignores it.
5. Approved knowledge is versioned and indexed.
6. AI assistants and employees retrieve it when relevant.
7. New work may create additional proposed knowledge.

## 3. Primary user

### Persona

A non-technical owner or manager of a small service business, typically with a small team and limited formal documentation.

### Characteristics

- Knows the business deeply but does not maintain a structured knowledge system.
- Uses chat, email, documents, and messaging tools inconsistently.
- Wants immediate value and dislikes setup work.
- Does not want to learn prompt engineering or configure agents.
- Needs confidence that AI will not silently invent or change company policy.
- Regularly onboards employees or delegates repeatable work.

### Starting vertical

A local salon is the demonstration company. The product must remain generic enough to support other small service businesses later.

## 4. Core problem

Important company capability is trapped in individuals and conversations rather than preserved by the organization.

This causes:

- Repeated explanations.
- Inconsistent decisions.
- Lost rationale.
- Slow onboarding.
- AI outputs that ignore company context.
- Reinvention of workflows and prompts.
- Risk when an employee changes role or leaves.

## 5. Solution

MLC provides:

- A conversational workspace.
- Suggested company knowledge extracted from normal work.
- Human approval and editing.
- A structured Company Playbook.
- Source-backed, versioned memories.
- Role-aware retrieval for Marketing, Operations, and Employee experiences.
- Conflict detection when new information disagrees with approved knowledge.

## 6. Product hierarchy

### The product

Approved, governed organizational memory.

### The input

Conversation, website content, documents, and future integrations.

### The consumers

Human employees and role-based AI assistants.

### The proof use cases

1. Generate an on-brand marketing idea.
2. Convert an approved idea into an SOP.
3. Answer an employee question consistently later.

## 7. MVP demonstration

The salon owner asks:

> “Tuesdays are quiet. Create a promotion to bring more customers in.”

The Marketing Assistant proposes an offer. The owner replies:

> “We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.”

MLC proposes a decision:

- Maximum promotional discount: 15%.
- Prefer complimentary add-ons over deeper discounts.
- Rationale: protect margins and premium positioning.
- Applies to: Marketing, Sales, Front Desk.
- Source: the current campaign conversation.

The owner approves it. The Marketing Assistant revises the campaign. The Operations Assistant creates a Tuesday Promotion SOP. Later, an employee asks:

> “Can I give a customer 25% off?”

MLC answers no and cites the approved decision and rationale.

This proves:

> conversation → decision → approval → organizational memory → cross-role reuse

## 8. Memory taxonomy

The first release supports seven memory types:

1. `COMPANY_FACT` — stable information about the business.
2. `CUSTOMER_INSIGHT` — known customer needs, segments, or behavior.
3. `BRAND_RULE` — voice, positioning, and presentation guidance.
4. `POLICY` — rules that govern behavior.
5. `DECISION` — a choice with context and rationale.
6. `SOP` — a repeatable operating procedure.
7. `LESSON` — a learned practice, edge case, or failure pattern.

Do not add more types without a demonstrated need.

## 9. Trust model

MLC must make a strong distinction among:

- **Source:** raw conversation, document, or imported content.
- **Suggestion:** AI-extracted knowledge awaiting review.
- **Approved memory:** current company truth authorized by a human.
- **Artifact:** generated output such as a campaign or SOP.
- **Recommendation:** new AI advice, not company truth.

Only approved memory may be used as authoritative company context.

## 10. Roles

### Owner

- Can create conversations and sources.
- Can approve, edit, reject, supersede, and archive memory.
- Can see all company memory and audit history.

### Manager

- Future role.
- May approve within authorized domains.

### Employee

- Can read approved knowledge allowed for their role.
- Cannot approve company memory in the MVP.

### Marketing Assistant

- Generates ideas using approved brand, customer, policy, and decision context.
- Must identify recommendations as recommendations.
- Must not change company knowledge.

### Operations Assistant

- Converts approved decisions and artifacts into repeatable SOPs.
- Must cite the rules that shape the SOP.

## 11. Current product decisions

The canonical, dated record is `docs/DECISION_LOG.md`. This section is a compact
product-only view; when a decision changes, add or supersede an ADR there first.

- Primary hackathon track: Organizational AI Memory.
- Secondary track: AWS AI/ML.
- The agent-workforce concept supports the story but is not the primary product.
- Two assistants are enough: Marketing and Operations.
- An Employee Q&A mode demonstrates human reuse.
- Human approval is mandatory before a memory becomes authoritative.
- The app is chat-first but not chat-only; Review and Playbook are first-class.
- The public root route leads with “Explain it once. Your company remembers.” and
  tells the story in this order: problem, governed-memory loop, trust boundary,
  salon proof, and live demo action.
- The primary landing action opens the Marketing salon conversation directly.
  Demo-company profile, recent-knowledge, and reset controls live at `/workspace`.
- The approved visual system is kinetic editorial utility: cobalt anchors, butter
  suggests, coral confirms, and the four-fragment mark represents approved memory.
- The Company Playbook is an editable workspace, not a read-only audit screen. An owner may directly amend approved knowledge; each save creates a new approved, source-backed version and refreshes assistant retrieval.
- Company and department knowledge live in one governed Playbook. Company pages
  are inherited; department pages remain department-scoped; role applicability
  and sensitivity are enforced separately.
- The app workspace uses persistent, reopenable conversations. `/save-knowledge`
  opens an owner confirmation form and can create a source-backed approved page
  from verified conversation messages.
- The Playbook offers five business-language topic views over the seven canonical
  memory types. They do not create folders or a second taxonomy.
- Chat can open a contextual panel showing approved sources used, eligible recent
  knowledge, and suggestions awaiting an owner decision. Operations always uses
  the owner's actual request as the SOP goal.
- Knowledge ownership, review dates, freshness automation, relationship graphs,
  and portable export remain deferred until the core conflict and AWS paths are
  complete.
- Cognito proves deployed user identity, while active company memberships remain
  the source of authorization truth. Owners have full access; other users receive
  independent company/department `READ`, `SUGGEST`, and `APPROVE` grants that are
  reloaded on every request. Demo mode uses Maya, Minh, An, and Lina to exercise
  owner, contributor, approver, and read-only behavior.
- ChatGPT, Codex, Claude Code, Gemini CLI, Kiro, and other compatible clients may
  connect through the remote tool-only MCP endpoint. The
  OAuth bridge records consent but never grants company access; every tool call
  reloads the membership. Connected assistants may retrieve approved knowledge
  or create Review suggestions, never approve company truth.
- Signed-in owners onboard through one proof-first loop: choose a real question,
  paste text or select one ChatGPT conversation locally, approve suggested company
  knowledge, and receive a cited answer from that import. Search indexing remains
  a separate visible state; imported context never creates folders or silently
  changes the Company profile.
- AWS Bedrock and Bedrock Knowledge Bases are core, not incidental hosting.
- Production data uses pooled AWS resources with company-prefixed DynamoDB child
  partitions, company-prefixed S3 objects, mandatory Knowledge Base company
  metadata, and structured hydration that fails closed before model use.
- The hackathon AWS foundation is console-first in `us-east-1`, with Nova Lite,
  Titan Text Embeddings V2, and S3 Vectors as configurable demo defaults.
- Local adapters must keep development unblocked.
- Website onboarding through Apify is optional after the memory loop works.
- Voice onboarding through Agora is a stretch feature.
- Notion is an optional import/export destination, not the source of truth.
- Observability should use one primary approach at a time: Langfuse or AWS-native tracing.
- Customer- and judge-facing copy uses “My Little Company.” Reserve “MLC” for
  internal code, technical identifiers, and backlog ticket IDs.

## 12. Non-goals

MLC is not currently:

- A generic chatbot wrapper.
- A document folder with search.
- A full project-management system.
- A human-talent marketplace.
- An AI-agent marketplace.
- A large autonomous-agent orchestration platform.
- A CRM, ERP, or billing platform.
- A fully autonomous policy engine.

## 13. Product principles

1. **Talk naturally.** Capture knowledge during useful work.
2. **Ask before remembering.** AI suggests; people approve.
3. **Preserve why.** Rationale improves future judgment.
4. **Show your sources.** Trust requires provenance.
5. **Keep one current truth.** Versions and conflicts must be visible.
6. **Make memory operational.** Knowledge should change future work.
7. **Hide technical complexity.** The owner should not manage AI infrastructure.
8. **Fail safely.** Missing knowledge is better than invented policy.
9. **Start narrow.** One complete workflow beats many shallow features.

## 14. North-star question

For every feature, ask:

> Does this help the company remember something once and apply it correctly later?

If the answer is no, it is probably outside the MVP.

## 15. Vocabulary used in code and UI

| Internal term | UI wording |
|---|---|
| Memory candidate | Suggested company knowledge |
| Memory record | Company knowledge / Playbook entry |
| Conflict relation | Possible conflict |
| Retrieve | Find relevant company knowledge |
| Source reference | Source |
| Superseded | Replaced by a newer version |
| Agent | Assistant |

The code may use precise domain terminology. The interface must stay approachable.
