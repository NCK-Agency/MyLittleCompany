# UX Specification

## 1. Experience goal

MLC should feel like talking to a capable team member who also helps the company document what matters.

The interface must not feel like:

- A vector database console.
- A prompt editor.
- A wiki administration tool.
- An agent orchestration dashboard.
- A document-management system.

The owner should understand the product through use:

> “I talk about my business, MLC notices something worth keeping, I approve it, and the company uses it later.”

## 2. Primary navigation

Use four top-level destinations:

1. **Home** — current work, recent activity, and recommended next action.
2. **Chat** — Marketing, Operations, and Employee conversations.
3. **Review** — suggested company knowledge awaiting a decision.
4. **Playbook** — approved company knowledge.

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
- “The knowledge was approved, but search indexing failed. Retry.”

Avoid anthropomorphic claims such as “I know everything about your company.”

## 5. Screen specifications

### 5.1 Home

#### Purpose

Orient the owner and make the next useful action obvious.

#### Required content

- Company name and short description.
- Greeting and primary prompt: “What are you working on today?”
- Three action cards:
  - Create a marketing idea.
  - Document how we do something.
  - Ask about my company.
- Review badge with pending suggestion count.
- Recent approved knowledge.
- Demo reset action in demo mode only.

#### Empty state

> “Start by telling MLC about your company or asking for help with a real task.”

### 5.2 Chat

#### Purpose

Let the user work naturally while making relevant company knowledge visible.

#### Layout

- Assistant selector: Marketing, Operations, Employee.
- Conversation transcript.
- Composer fixed near the bottom.
- Optional right-side context panel on wide screens; collapsible on mobile.
- Inline source chips below grounded assistant claims.
- Inline suggested-knowledge cards after the relevant turn.

#### Composer behavior

- Enter sends; Shift+Enter creates a new line.
- Preserve draft on recoverable failure.
- Disable duplicate submission while the request is active.
- Show clear progress text, such as “Checking the company playbook…”

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
- Then show indexing status separately:
  - Adding to Playbook.
  - Ready.
  - Needs retry.
- Never show “Ready” before the index confirms success.

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

- Search.
- Type filters.
- Role filters.
- Cards or rows showing title, type, short statement, version, and approval date.
- Current entries by default.

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

### Indexing failure

The DynamoDB record may be approved while indexing fails. Show:

> “Approved in the Playbook, but not yet available to assistants. Retry adding it to search.”

### Retrieval failure

Do not fabricate. Show a general response only if clearly labeled, or ask the user to retry.

## 9. Demo mode

The demo environment should include:

- A visible but unobtrusive “Demo company” label.
- A reset action available from settings or the Home footer.
- Deterministic salon fixture data.
- Optional presenter shortcuts hidden behind `?presenter=1`, but the normal flow must remain usable without them.

Do not fake external service success. Demo mode may use local adapters only when clearly configured as local mode.
