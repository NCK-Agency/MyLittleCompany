# UX Specification

## 1. Experience goal

My Little Company should feel like talking to a capable team member who also helps the company document what matters.

The interface must not feel like:

- A vector database console.
- A prompt editor.
- A wiki administration tool.
- An agent orchestration dashboard.
- A document-management system.

The owner should understand the product through use:

> “I talk about my business, My Little Company notices something worth keeping, I approve it, and the company uses it later.”

## 2. Primary navigation

Use four top-level destinations:

1. **Home** — public product statement, trust story, company-neutral proof, and project handoff.
2. **Chat** — Marketing, Operations, and Employee conversations.
3. **Review** — suggested company knowledge awaiting a decision.
4. **Playbook** — approved company knowledge.

For the current public demo, **Home** is the statement-led root landing page. The
demo-company workspace remains available from the persistent company badge at
`/workspace`. This preserves the four-item primary navigation while keeping
profile editing and reset controls one clear click away.

Keep settings behind a secondary menu. Do not create separate top-level pages for agents, embeddings, sources, or analytics in the MVP.

## 3. Visual direction

- Warm, calm, and trustworthy rather than futuristic or robotic.
- Generous spacing and clear hierarchy.
- One primary action per card or section.
- Neutral surfaces with restrained accent color.
- Rounded cards are acceptable, but avoid excessive dashboard chrome.
- Icons support labels; they never replace important text.
- Status must use text and iconography, not color alone.

## 4. Language rules

Use plain business language.

Use the full product name, **My Little Company**, in customer-facing copy. Do not
abbreviate it to “MLC” in navigation, page copy, form labels, status messages,
demo narration, or other audience-facing material. When repeating the full name
would sound awkward, prefer a natural phrase such as “your company” or “the
Playbook” rather than the acronym. Internal code and technical identifiers may
continue to use `mlc`.

| Avoid | Prefer |
|---|---|
| Memory candidate | Suggested company knowledge |
| RAG result | Relevant company knowledge |
| Vector index | Searchable company playbook |
| Agent configuration | Assistant settings |
| Ingestion job | Adding to the playbook |
| Conflict classification | Possible conflict |
| Hallucination | Answer not supported by company knowledge |
| Tenant | Company |

Use direct, helpful copy:

- “Here’s something worth remembering.”
- “This will become company knowledge after you approve it.”
- “I found a possible conflict with an existing rule.”
- “I could not find an approved company rule for this.”
- “Saved, but still being added to search.”
- “The knowledge was approved, but it is not available to assistants yet. Retry.”

Avoid anthropomorphic claims such as “I know everything about your company.”

## 5. Screen specifications

### 5.1 Public Home

#### Purpose

Explain the product promise to a first-time owner or judge and make joining the
private-beta waitlist the obvious next action while registration is closed.

#### Required content

- Primary statement: “Explain it once. Your company remembers.”
- One-line explanation that normal owner conversations become human-approved,
  reusable company knowledge.
- A company-neutral proof directly after the hero showing one owner statement
  changing Marketing, Operations, and Employee behavior.
- The owner problem: repeated explanations, improvised employee answers, and AI
  work that forgets company context.
- The governed-memory loop: conversation, suggestion, approval, Playbook, reuse.
- The trust boundary inside that explanation: AI suggests; a human decides;
  authoritative answers remain source-backed.
- One primary action, “Join the waitlist,” linked to `/waitlist`, plus `Sign in`
  for people who already have an invitation.

Do not expose direct demo controls or a direct anonymous product-entry action on
the public landing page while registration remains closed.

Do not add pricing, invented testimonials, generic feature grids, or optional
integration catalogs to the MVP landing page.

### 5.1.1 Demo company workspace

#### Purpose

Orient the demo owner, expose company controls, and make the next useful product
action obvious after the public story has been understood.

#### Route

`/workspace`, linked from the persistent demo-company badge.

#### Required content

- Company name and short description.
- The most recently active accessible conversation, with a direct resume action.
- Suggested company knowledge awaiting review, shown only when the viewer can
  approve knowledge in at least one scope.
- A count and concise list of approved knowledge the viewer is allowed to read.
- A clear start-conversation empty state when no prior conversation exists.
- Company profile editing.
- Demo reset action in demo mode only.

#### Empty state

> “Start by describing your company or asking for help with a real task.”

### 5.1.2 Assistant settings

#### Purpose

Let an owner choose a simple company-wide balance of response speed and quality
without turning the product into a model configuration console.

#### Location and access

Assistant settings is an owner-only section inside `/workspace`. It is secondary
to the normal workspace content and does not add a primary-navigation item.

#### Required choices

- **Fast** — “Quick responses for everyday work.”
- **Balanced** — “A dependable mix of speed and quality.” This is the default.
- **Best quality** — “More care for complex or important work.”

Show the server-approved OpenAI model name as muted secondary detail. The browser
may choose only Fast, Balanced, or Best quality; it never accepts a custom model
name or displays the API key.

Saving updates the company setting and applies to the next assistant request.
Existing messages remain unchanged. Employees may not view or change this
control, including through a direct URL or API request.

If the selected model is unavailable, keep the user's draft and show:

> “This assistant model is temporarily unavailable.”

Offer `Retry` and, for owners, `Choose another model` linking back to Assistant
settings. Never switch tiers or use fixture output automatically.

### 5.2 Chat

#### Purpose

Let the user work naturally while making relevant company knowledge visible.

#### Layout

- A persistent left sidebar with `New conversation`, search, assistant shortcuts,
  previous conversations, and the primary workspace navigation.
- A full-height conversation transcript that uses the rest of the page.
- Assistant and knowledge-scope selectors in the conversation header. The scope is
  either the whole company or one department and becomes fixed after the first
  message so the conversation keeps a stable context.
- Composer fixed near the bottom.
- The sidebar becomes a drawer on mobile.
- Inline source chips below grounded assistant claims.
- Inline suggested-knowledge cards after the relevant turn.
- A `Context` action opens a dismissible side panel containing approved pages
  used in this conversation, recently available approved pages for its scope, and
  suggestions still waiting for review. The panel must not replace or shrink the
  normal chat experience when closed.

Previous conversations are persisted, ordered by recent activity, and reopen with
their messages and unresolved knowledge suggestions intact. Starting a new
conversation must not erase or replace earlier work.

#### Composer behavior

- Enter sends; Shift+Enter creates a new line.
- Preserve draft on recoverable failure.
- Disable duplicate submission while the request is active.
- Show clear progress text, such as “Checking the company playbook…”
- Treat `/save-knowledge` as an application command. Open a confirmation dialog
  prefilled from the current conversation; do not send the command to the model.
- Saving requires an owner-confirmed title, statement, rationale, type, audience,
  and company or department scope. The resulting approved page remains
  source-backed by the selected conversation messages.

#### Assistant response sections

When relevant, use:

1. Direct answer or artifact.
2. “Based on your company” with source chips.
3. “New suggestion” for new recommendations.
4. Suggested company knowledge card if durable knowledge was detected.

Do not expose raw retrieved chunks or hidden prompts.

### 5.3 Suggested company knowledge card

#### Required fields

- Type label.
- Clear title.
- Canonical statement.
- Rationale.
- “Applies to” role chips.
- Source reference.
- Possible conflict banner when applicable.
- `Approve`, `Edit`, and `Ignore` actions.

#### Example

```text
PRICING DECISION
Promotional discounts must not exceed 15%

Prefer a complimentary add-on instead of a larger discount.

Why this matters
Protects margins and supports the salon’s premium positioning.

Applies to
Marketing · Sales · Front Desk

Source
Tuesday campaign conversation · Today

[Approve] [Edit] [Ignore]
```

#### Approval behavior

- Optimistically show that the owner action was received only after the server confirms the state transition.
- Then show assistant availability separately: Updating, Available, or Needs retry.
- Repository retrieval normally becomes Available with the approved write; never
  show it before the server confirms the current record can be retrieved.

### 5.4 Review

#### Purpose

Provide a focused inbox for unresolved suggestions.

#### Filters

- Needs review.
- Possible conflicts.
- Recently handled.

#### Sorting

- Conflicts first.
- Then newest first.

#### Bulk actions

No bulk approval in the MVP. Each decision deserves explicit review.

#### Empty state

> “You’re caught up. New suggestions will appear here as you work.”

### 5.5 Conflict resolution

When a suggestion overlaps approved knowledge, show both side by side.

#### Required choices

- **Replace current rule** — create a newer current version and supersede the old one.
- **Keep as an exception** — require scope or condition explaining when it applies.
- **Edit suggestion** — clarify before approval.
- **Ignore** — leave current knowledge unchanged.

Never use a vague “Resolve” button without explaining the result.

### 5.6 Playbook

#### Purpose

Make approved company knowledge browsable and trustworthy.

#### List view

- A Notion-like page tree with the company at the root and departments beneath it.
- Search across title and statement.
- Company and department filters with page counts.
- Five business-language topic views: Company basics, Customers, Brand, Decisions
  and policies, and How we work. These group the existing memory types for
  navigation only.
- Rows showing title, type, short statement, version, scope, and approval date.
- Current entries by default.
- An owner-only `New page` action that opens the same governed knowledge form used
  by `/save-knowledge`. Pages created outside chat use a manual owner source.

Company-scoped pages are the shared baseline. Department-scoped pages are visible
and retrievable only within that department. A department page never silently
overrides a company page; conflicting knowledge still follows the explicit
conflict-resolution flow.

#### Detail view

- Current statement.
- Rationale.
- Type and tags.
- Applicable roles.
- Effective date.
- Approver and approval timestamp.
- Source references.
- Version history.
- Related artifacts.
- Archive or replace actions for owner only.
- A clear `Edit entry` action for the owner.
- Document-style editing of the title, current statement, rationale, and applicable roles.
- Copy that explains saving creates a new approved version rather than overwriting history.
- Plain-language assistant-search status: `Available to assistants`, `Updating`, or `Needs attention`.

Direct owner edits are an explicit human approval action. After saving, keep the
owner on the entry, show the new version number, and make the former wording
available in version history. Do not expose search implementation details; put
the derived assistant-search document identifier behind `Search details`.

### 5.7 SOP view

Show a structured document with:

- Title.
- Purpose.
- Owner.
- Trigger.
- Prerequisites.
- Ordered steps.
- Quality checks.
- Exceptions and escalation.
- Inputs and outputs.
- Source decisions.
- Status: suggested or approved.

A generated SOP remains a suggestion until approved.

### 5.8 Employee answer

Lead with the direct answer.

Example:

> **No. The current approved promotion policy caps discounts at 15%.** The salon prefers complimentary add-ons because they protect margins and premium positioning.

Below the answer, show:

- Source title.
- Approval date.
- Link to Playbook entry.
- A small “Ask the owner” action when context is missing or conflicting.

### 5.9 Login and People & access

`/login` is the invite-only company-account entry point and hands credentials,
temporary-password changes, and recovery to Cognito managed login. It never
collects a password inside My Little Company. The page asks only for an email
address and passes it to Cognito as a sign-in hint. It does not advertise or link
to demo access. `/login-demo` is a separate, clearly marked seeded-account picker
for the credential-free local product path.
Protected routes choose the correct entry point from the server authentication
mode. `/workspace/access` is owner-only and secondary to the four primary
navigation items.

The access screen shows each person's name, email, status, business roles, and a
plain matrix of `Read`, `Suggest`, and `Approve` against `Entire company` and each
department. Owner access is displayed as full and cannot be paused. Non-owners
never see controls they cannot use; direct URLs still rely on server checks.

When authentication succeeds without an active membership, show a calm no-access
state with owner-contact guidance and sign out. Do not expose Cognito groups,
tokens, claims, or IAM language.

### 5.10 Public waitlist and closed registration

Anonymous navigation shows `Sign in` and one stronger `Join the waitlist` action.
The login page repeats the waitlist path for people who do not already have an
account. Do not show a public `Create account`, `Sign up`, or registration action.

`/waitlist` explains that new accounts are invite-only, collects a required work
email plus optional name and company, and confirms the request without implying
that an account was created. Duplicate submissions receive the same confirmation.
Existing invited people can return to Sign in.

### 5.11 Connected assistants

The OAuth consent screen uses plain language: a connected assistant may read
approved knowledge and/or create suggestions, subject to the person's existing
company access. It states that the connection cannot approve knowledge.

There is no ChatGPT widget or second Review interface. Successful suggestions
return a link to the existing Review screen. Conflict cards replace the generic
Approve action with the required decision: duplicates can only be edited or
ignored; updates create a new version; contradictions require replace or a
conditioned exception; exceptions require a written condition.

## 6. Responsive behavior

- Mobile supports all primary actions.
- Context panel becomes a drawer.
- Approval cards stack fields vertically.
- Primary action buttons remain reachable without horizontal scrolling.
- Long source titles truncate visually but remain accessible by tooltip or detail view.

## 7. Accessibility

- Use semantic headings in order.
- All controls have visible labels.
- Dialogs trap focus and restore it when closed.
- Status changes use an ARIA live region where appropriate.
- Keyboard users can send, review, edit, and approve.
- Minimum target size should be comfortable for touch.
- Avoid low-contrast secondary text.

## 8. Loading and error states

### AI response loading

Show meaningful stages when available:

- Finding relevant company knowledge.
- Drafting the response.
- Checking for something worth remembering.

### Extraction failure

The conversation response may still succeed. Show:

> “The answer is ready, but I could not check for new company knowledge. Try again.”

### Approval persistence failure

Do not update the card to approved. Preserve edits and show retry.

### Assistant-search failure

The DynamoDB record may be approved while repository retrieval is unavailable. Show:

> “Approved in the Playbook, but not yet available to assistants. Retry.”

### Retrieval failure

Do not fabricate. Show a general response only if clearly labeled, or ask the user to retry.

### Live model failure

Preserve the draft or retryable operation. Show “This assistant model is
temporarily unavailable,” a `Retry` action, and an owner-only link to Assistant
settings. Do not claim that work was generated and do not substitute test fixture
content.

## 9. Demo mode

The demo environment should include:

- A visible but unobtrusive “Demo company” label.
- A reset action available from settings or the Home footer.
- Deterministic salon company and reset data, clearly labelled as demo data.
- Live OpenAI generation for every assistant-produced answer, suggestion,
  campaign, conflict assessment, and SOP in hosted mode.
- Optional presenter shortcuts hidden behind `?presenter=1`, but the normal flow must remain usable without them.

Do not fake external service success. The fixture model is permitted only in
automated tests or an explicitly labelled offline mode; hosted OpenAI failures
remain visible and retryable.

## 10. Proof-first onboarding

Owners enter from `Bring in company context` on Home or an empty Playbook. An unfinished setup replaces that action with `Continue setup · {current step}`.

The session has four calm screens:

- **Goal:** ask one real question and offer practical examples.
- **Source:** paste text or inspect a ChatGPT export locally, then choose exactly one conversation.
- **Review:** show up to three ranked `Suggested company knowledge` cards using the existing Approve, Edit, Ignore, and conflict actions.
- **Proof:** answer the original question only after an approval, show the newly approved source chip and approval date, and separately show whether assistant search is Ready, Updating, or Needs attention.

The source screen explains that imported text is not company truth. It shows the 40,000-character quick-setup limit, useful empty states, retryable failures, and truthful processing status. The proof action appears immediately after the first relevant approval; the owner may leave and resume from the workspace at any point.
