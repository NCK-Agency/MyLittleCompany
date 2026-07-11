# Product Specification

## 1. Summary

My Little Company turns owner conversations into approved, reusable company knowledge for AI assistants and employees.

### One-line description

Turn the knowledge in a business owner’s head into trusted memory for every employee and AI assistant.

### Value proposition

- Owners explain less often.
- Employees receive consistent answers.
- AI work follows current company rules.
- Decisions retain their rationale and source.
- Knowledge survives tool changes and staff turnover.

## 2. Goals

### MVP goals

- Demonstrate one end-to-end organizational-memory loop.
- Make approval clear and easy for a non-technical owner.
- Reuse one approved decision across Marketing, Operations, and Employee modes.
- Preserve rationale, source, scope, approval, and version.
- Use AWS AI/ML meaningfully in the deployed path.
- Provide a polished, resettable judge demo.

### Success criteria

The MVP is successful when a judge can observe all of the following without explanation from the developer:

1. MLC understands the company context.
2. It recognizes a durable decision in normal conversation.
3. It does not silently save that decision.
4. The owner can approve it easily.
5. Future AI work follows the approved decision.
6. An employee answer cites the decision and its rationale.
7. Unapproved information is not treated as company truth.

## 3. Functional requirements

### FR-01 Company setup

The user can load or create a company profile containing:

- Company name.
- Description.
- Services or products.
- Primary customers.
- Differentiators.
- Brand voice.
- Important existing rules.

**MVP implementation:** load the salon demo fixture and allow editing basic fields.

**Acceptance criteria:**

- The profile is associated with one `companyId`.
- Empty required fields are explained in plain language.
- Saved profile context is available to the Marketing Assistant.

### FR-02 Conversational workspace

The owner can send messages to the Marketing Assistant and receive a response using approved company context.

**Acceptance criteria:**

- Messages persist within the conversation.
- The response clearly separates approved company context from new recommendations.
- Relevant sources appear as source chips when available.
- Failure states do not lose the owner’s draft message.

### FR-03 Suggested company knowledge

After a conversation turn, MLC can produce zero or more structured suggestions.

Each suggestion includes:

- Type.
- Title.
- Canonical statement.
- Rationale or an explicit missing-rationale marker.
- Roles or teams affected.
- Source reference.
- Confidence.
- Possible relationship to existing approved memory.

**Acceptance criteria:**

- Casual or temporary statements may produce no suggestion.
- Suggestions are visibly labeled as awaiting review.
- Model output is validated before display or persistence.
- Invalid output fails safely and can be retried.

### FR-04 Review and approval

The owner can approve, edit, or ignore a suggestion.

**Acceptance criteria:**

- Approval requires an authenticated or demo-authorized owner action on the server.
- Approval records the actor and timestamp.
- Editing creates the approved canonical content actually chosen by the owner.
- Ignored suggestions cannot become searchable company truth.
- The UI confirms whether indexing succeeded, is pending, or failed.

### FR-05 Company Playbook

The user can browse approved company knowledge by type and open a detail page.

**Acceptance criteria:**

- Only approved or explicitly archived entries appear according to the chosen filter.
- Each detail shows current statement, rationale, source, applicable roles, approver, approval date, and version.
- Superseded versions remain available in history but are not shown as current truth.

### FR-06 Approved-memory retrieval

The system retrieves relevant approved knowledge for a role and company.

**Acceptance criteria:**

- Retrieval is always scoped by `companyId`.
- Retrieval excludes proposed, rejected, archived, and superseded records by default.
- Retrieval respects role scope.
- Returned context includes memory ID, version, title, statement, rationale, and source IDs.
- If no adequate context exists, the assistant says it lacks an approved company rule.

### FR-07 Marketing Assistant

The assistant creates campaign ideas grounded in approved company knowledge.

**Acceptance criteria:**

- The revised Tuesday offer follows the 15% maximum discount rule.
- It prefers a complimentary add-on when appropriate.
- It explains which approved rules influenced the recommendation.
- It does not label its recommendation as an approved policy.

### FR-08 Operations Assistant

The assistant creates an SOP from an approved campaign or decision.

**Acceptance criteria:**

- The SOP has title, purpose, owner, prerequisites, steps, checks, exceptions, and source references.
- The SOP reflects the approved pricing and brand decision.
- Saving the generated SOP creates a new suggestion requiring approval; it does not become approved automatically.

### FR-09 Employee Q&A

An employee can ask a company-policy question and receive a grounded answer.

**Acceptance criteria:**

- “Can I give a customer 25% off?” receives a clear “No” based on the approved policy.
- The answer includes the 15% maximum and preference for free add-ons.
- The source and approval date are visible.
- If the policy is absent or not approved, the answer must not invent it.

### FR-10 Conflict detection

The system compares a suggestion with potentially related approved memories.

**Relations:**

- `UNRELATED`
- `DUPLICATE`
- `UPDATE`
- `CONTRADICTION`
- `EXCEPTION`

**Acceptance criteria:**

- A possible contradiction cannot be silently approved over an existing record.
- The owner can replace the current memory, keep an explicit exception, edit, or ignore.
- Superseding creates a new version or record link and preserves history.

### FR-11 Audit trail

Material memory actions are recorded.

**Acceptance criteria:**

- Record suggestion creation, edit, approval, rejection, supersession, archive, indexing attempt, and indexing result.
- Audit entries include company, actor, timestamp, action, target, and safe metadata.
- Do not store secrets or full hidden prompts in the audit trail.

### FR-12 Demo reset

The presenter can restore the demo to its initial state.

**Acceptance criteria:**

- Reset requires a deliberate action.
- It affects only the demo company.
- It restores deterministic fixture data and removes demo-generated records.
- It reports success or failure accurately.

## 4. Non-functional requirements

### Simplicity

- The primary path should require no AI configuration.
- A first-time user should understand the approval card without documentation.
- Technical terms are hidden or translated into plain language.

### Trust

- Every authoritative claim is traceable to approved memory.
- The UI visibly distinguishes suggestions, approved knowledge, and generated artifacts.
- Errors never masquerade as successful approval or indexing.

### Security

- Server-side company and role scope.
- Secrets stay server-side.
- Imported and retrieved content is untrusted.
- No automatic promotion from source to approved memory.

### Reliability

- Local demo mode remains usable if AWS is unavailable.
- Network operations use bounded retries and timeouts.
- State transitions are idempotent where practical.

### Accessibility

- Keyboard-accessible primary flows.
- Clear focus states.
- Semantic labels for buttons and forms.
- Status is not conveyed by color alone.

### Performance

- Show immediate local feedback when a message or approval is submitted.
- Long AI and indexing work exposes progress and retry status.
- Avoid loading the entire playbook for a single retrieval query.

## 5. User stories

### Owner

- As an owner, I want to explain a business rule naturally so I do not have to write formal documentation.
- As an owner, I want to approve what the system remembers so it cannot silently change company truth.
- As an owner, I want the reason behind a decision preserved so employees can use judgment later.
- As an owner, I want generated marketing to follow my brand and pricing rules.
- As an owner, I want a campaign turned into a repeatable SOP.

### Employee

- As an employee, I want to ask a question in plain language and receive the current approved answer.
- As an employee, I want to see where the answer came from so I can trust it.
- As an employee, I want ambiguity surfaced instead of receiving a confident invention.

### Presenter

- As a presenter, I want a deterministic resettable demo so the full story works reliably.

## 6. Primary journey

```mermaid
flowchart LR
    A[Owner asks for Tuesday promotion] --> B[Marketing Assistant responds]
    B --> C[Owner states discount and add-on rule]
    C --> D[MLC proposes company knowledge]
    D --> E{Owner decision}
    E -->|Approve| F[Versioned approved memory]
    E -->|Edit| F
    E -->|Ignore| G[Not authoritative]
    F --> H[Marketing Assistant revises campaign]
    F --> I[Operations Assistant creates SOP]
    F --> J[Employee receives grounded answer]
```

## 7. Out-of-scope requirements

Do not treat these as MVP requirements:

- Autonomous social publishing.
- Full user provisioning and SSO.
- Marketplace discovery of humans or agents.
- Complex workflow orchestration.
- Company-wide analytics dashboards.
- Billing and subscription management.
- Voice-first experience.
- Real-time collaborative editing.
- Native mobile application.
