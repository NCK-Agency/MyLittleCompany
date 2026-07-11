# API and Service Contracts

## 1. General rules

- All external payloads are validated with Zod.
- Company and actor identity come from trusted server session context, not from an untrusted request body.
- Responses use stable domain DTOs, not raw DynamoDB or AWS SDK objects.
- Mutation endpoints support idempotency where duplicate submission is plausible.
- Errors return a safe code and message; detailed provider errors remain server-side.

## 2. Response envelope

Success:

```json
{
  "data": {},
  "meta": {
    "requestId": "req_..."
  }
}
```

Error:

```json
{
  "error": {
    "code": "MODEL_UNAVAILABLE",
    "message": "This assistant model is temporarily unavailable.",
    "retryable": true
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

## 3. Web route contracts

Exact routing may use Next.js route handlers or server actions. Preserve these logical contracts.

### Authentication and membership routes

- `GET|POST /api/auth/[...nextauth]` handles Auth.js demo or Cognito login.
- `POST /api/waitlist` accepts a validated public waitlist request. It creates no
  identity or membership and returns the same success shape for new and duplicate emails.
- `GET /api/me` returns the actor resolved from the current active membership.
- `GET /api/memberships` lists members for an owner.
- `POST /api/memberships` invites an identity with roles and scoped grants.
- `PATCH /api/memberships/{userId}` updates non-owner roles, grants, or status.
- `POST /api/memory-candidates` creates a source-backed manual suggestion when
  the actor has `SUGGEST` for the submitted scope.

Missing sessions return `UNAUTHENTICATED`/401. Authenticated requests without the
required current grant return `FORBIDDEN`/403. Identity, company, roles, and grants
from request bodies are ignored for ordinary product operations.

### MCP OAuth and tool contracts

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `POST /oauth/register`
- `GET|POST /oauth/authorize`
- `POST /oauth/token`
- `POST /oauth/revoke`
- `GET /oauth/jwks`
- `GET|POST|DELETE /mcp` — stateless Streamable HTTP

Auth.js owns the Cognito callback at `/api/auth/callback/cognito`; the OAuth
broker reuses that signed-in session instead of handling Cognito credentials.
Authorization requests require PKCE S256, the exact registered callback, the
canonical `/mcp` resource, and `knowledge:read` and/or `knowledge:suggest`.

The MCP server publishes exactly these tools:

```ts
search({ query }): { results: Array<{ id, title, url }> }
fetch({ id }): { id, title, text, url, metadata? }
suggest_company_knowledge({ content, idempotencyKey, scope? }):
  | { status: "NO_DURABLE_KNOWLEDGE", message }
  | { status: "PROPOSED", candidate: { id, title, statement, relation, reviewUrl } }
```

`search` and `fetch` return approved, current, repository-searchable records only. Suggestions
are idempotent, accept no identity or approval fields, and never become visible
to retrieval before Review approval and current-record availability.

### POST `/api/demo/reset`

Restores the demo company fixture.

Response:

```json
{
  "data": {
    "companyId": "demo-salon",
    "resetAt": "2026-07-11T00:00:00.000Z"
  }
}
```

### GET `/api/company`

Returns the current company profile.

### PATCH `/api/company`

Editable fields:

```json
{
  "name": "Maison Lumière Salon",
  "description": "Premium neighborhood salon...",
  "productsOrServices": ["Haircut", "Color", "Treatment"],
  "primaryCustomers": ["Busy professionals"],
  "differentiators": ["Personalized premium service"],
  "brandVoice": ["Warm", "Confident", "Never pushy"]
}
```

### GET `/api/company/assistant-settings`

Owner-only. Returns the provider-neutral current choice and server-approved
options. Model IDs are display-only in this response and cannot be submitted as
settings.

```json
{
  "data": {
    "modelTier": "BALANCED",
    "options": [
      {
        "tier": "FAST",
        "label": "Fast",
        "description": "Quick responses for everyday work.",
        "modelId": "gpt-5.6-luna"
      }
    ]
  }
}
```

### PATCH `/api/company/assistant-settings`

Owner-only. Accepts exactly one provider-neutral tier:

```json
{ "modelTier": "FAST" }
```

Unknown fields, vendor model IDs, non-owner requests, and cross-company writes
are rejected. The response uses the same shape as GET, and the saved tier applies
to the next model operation without changing prior messages.

### POST `/api/conversations`

Request:

```json
{
  "assistantRole": "MARKETING",
  "title": "Tuesday promotion",
  "scope": { "level": "DEPARTMENT", "organizationalUnitId": "dept-marketing" }
}
```

Response contains the conversation.

### GET `/api/conversations`

Returns all conversations visible in the current company, ordered by most recent
activity. Each conversation includes its assistant role and stable company or
department scope so the client can reopen it without reconstructing context.

### GET `/api/conversations/{conversationId}/messages`

Returns ordered messages visible to the current actor.

### POST `/api/conversations/{conversationId}/messages`

Request:

```json
{
  "content": "Tuesdays are quiet. Create a promotion to bring more customers in.",
  "idempotencyKey": "client-generated-key"
}
```

Response:

```json
{
  "data": {
    "ownerMessage": {},
    "assistantMessage": {
      "id": "msg_...",
      "content": "...",
      "sourceRefs": []
    },
    "suggestedKnowledge": []
  }
}
```

Operations responses populate `sop`; employee responses populate
`groundedAnswer`. The same validated structured payload is also stored on the
assistant message so reopening or retrying a completed turn can restore the SOP
or approved-answer card. The top-level value is the immediate-response
convenience view of that stored result. These fields are optional and omitted
from JSON when they do not apply.

```ts
interface SendMessageResult {
  ownerMessage: Message;
  assistantMessage: Message | null;
  suggestedKnowledge: MemoryCandidate[];
  sop?: SopDraft;
  groundedAnswer?: GroundedAnswer;
}
```

Message idempotency is bound to both the trusted conversation and the original
request content:

- a provider failure before a valid result persists no owner turn;
- Retry reuses the original key and text;
- the same key with different text returns `CONFLICT`;
- a completed key returns the stored assistant message, suggestion, SOP, and/or
  grounded answer without another model call; and
- DynamoDB uses a strongly consistent message read before deciding to resume.

The server may return a suggestion with the initial response. If suggestion
extraction failed after the assistant answer was stored, the same idempotent
retry may finish that reviewable suggestion without duplicating either message.

### GET `/api/memory-candidates`

Query parameters:

- `status=PROPOSED|APPROVED|REJECTED`
- `relation=CONTRADICTION|UPDATE|...`
- `limit`
- `cursor`

Default: unresolved suggestions for the current company.

### GET `/api/memory-candidates/{candidateId}`

Returns one candidate plus hydrated related memories.

### PATCH `/api/memory-candidates/{candidateId}`

Edit a proposed candidate before approval.

Request:

```json
{
  "title": "Promotional discounts must not exceed 15%",
  "statement": "Promotional discounts must not exceed 15%. Prefer complimentary add-ons over deeper discounts.",
  "rationale": "Protect margins and maintain premium brand positioning.",
  "appliesToRoles": ["MARKETING", "SALES", "FRONT_DESK"],
  "tags": ["pricing", "promotion"]
}
```

Edits are allowed only while status is `PROPOSED`.

### POST `/api/memory-candidates/{candidateId}/approve`

Request:

```json
{
  "expectedCandidateVersion": 1,
  "resolution": {
    "mode": "CREATE_NEW"
  },
  "idempotencyKey": "approve-..."
}
```

Conflict resolution modes:

```ts
type Resolution =
  | { mode: "CREATE_NEW" }
  | { mode: "NEW_VERSION"; memoryId: string }
  | { mode: "SUPERSEDE"; memoryId: string }
  | { mode: "EXCEPTION"; memoryId: string; condition: string };
```

Response:

```json
{
  "data": {
    "candidateStatus": "APPROVED",
    "memory": {},
    "indexStatus": "READY"
  }
}
```

Repository-backed indexing normally returns `READY` in the approval response. A
repository or canonical-document failure may return `FAILED` while preserving
the authoritative approved record and a truthful retry path.

### POST `/api/memory-candidates/{candidateId}/reject`

Request:

```json
{
  "reason": "Temporary campaign idea, not a company rule"
}
```

The reason is optional but useful for future extraction quality.

### GET `/api/memories`

Query parameters:

- `type`
- `role`
- `status`
- `query`
- `limit`
- `cursor`

Default: current approved memories visible to the actor.

### POST `/api/memories`

Owner-only. Creates an approved, source-backed knowledge page without first
creating a model suggestion. The server validates company and department scope and
then runs the normal render-and-repository-search flow.

```json
{
  "title": "How we handle late arrivals",
  "statement": "Front desk should call after ten minutes and offer the next available slot.",
  "rationale": "Keeps the day moving while treating the customer fairly.",
  "type": "POLICY",
  "scope": { "level": "DEPARTMENT", "organizationalUnitId": "dept-front-desk" },
  "appliesToRoles": ["FRONT_DESK", "EMPLOYEE"],
  "conversationId": "conversation_...",
  "messageIds": ["message_..."]
}
```

When `conversationId` and `messageIds` are absent, the service creates a manual
owner source. `/save-knowledge` uses this endpoint only after the owner confirms
the form; it is not a model-callable approval tool.

### GET `/api/memories/{memoryId}`

Returns current record, current version, source references, and version history.

### PATCH `/api/memories/{memoryId}`

Owner-only. Creates a new approved version of current company knowledge; it does
not overwrite the existing version.

```json
{
  "expectedMemoryVersion": 1,
  "title": "Promotional discounts must not exceed 10%",
  "statement": "Promotional discounts must not exceed 10%. Prefer complimentary add-ons.",
  "rationale": "Protect margins and premium positioning.",
  "scope": { "level": "COMPANY" },
  "appliesToRoles": ["MARKETING", "SALES", "FRONT_DESK", "EMPLOYEE"]
}
```

The expected version is mandatory. A stale edit returns `STALE_WRITE`. A
successful response contains the current record, the new version, full version
history, and truthful `indexStatus` after the immediate repository-search update.

### POST `/api/memories/{memoryId}/retry-index`

Owner-only in MVP. Idempotently retries canonical rendering and repository-search
readiness for the current version. It does not call a remote vector service.

### POST `/api/sops/generate`

Request:

```json
{
  "request": "Create a Tuesday promotion handoff checklist for the front desk.",
  "saveAsSuggestion": false
}
```

`request` is passed to the Operations model as the SOP goal. Approved memories
remain mandatory constraints. Response contains a structured SOP draft and source
memory references; `saveAsSuggestion=true` creates a candidate rather than
approved knowledge.

### POST `/api/employee/answer`

Request:

```json
{
  "question": "Can I give a customer 25% off?"
}
```

Response:

```json
{
  "data": {
    "answer": "No. The current approved promotion policy caps discounts at 15%...",
    "groundingStatus": "GROUNDED",
    "sourceMemories": [
      {
        "memoryId": "mem_...",
        "version": 1,
        "title": "Promotional discounts must not exceed 15%",
        "approvedAt": "..."
      }
    ]
  }
}
```

`groundingStatus`:

- `GROUNDED`
- `PARTIALLY_GROUNDED`
- `NO_APPROVED_CONTEXT`
- `CONFLICTING_CONTEXT`

## 4. Application service interfaces

These examples are directional. Codex may refine names while preserving responsibilities.

### Model gateway

```ts
interface ModelGateway {
  generateMarketingResponse(input: { companyId: string; /* ... */ }): Promise<GeneratedText>;
  generateEmployeeResponse(input: { companyId: string; /* ... */ }): Promise<GeneratedText>;
  generateProofResponse(input: { companyId: string; /* ... */ }): Promise<GeneratedText>;
  extractCandidate(input: { companyId: string; /* ... */ }): Promise<MemoryCandidate | null>;
  extractOnboardingCandidates(input: { companyId: string; /* ... */ }): Promise<MemoryCandidate[]>;
  classifyRelationship(input: { companyId: string; /* ... */ }): Promise<ConflictResult>;
  generateSop(input: { companyId: string; /* ... */ }): Promise<SopDraft>;
}
```

The trusted `companyId` is mandatory on every operation so the OpenAI adapter
can load the current tier and resolve its allowed server-side model ID.

### Knowledge index

```ts
interface KnowledgeIndex {
  upsert(memory: HydratedMemory, document: CanonicalMemoryDocument):
    Promise<{ documentId: string }>;
  retrieve(query: string, actor: ActorContext, requestedRoles?: CompanyRole[]):
    Promise<KnowledgeIndexHit[]>;
}
```

`RepositoryKnowledgeIndex` uses the active memory repository. `upsert` preserves
the existing lifecycle contract but does not ingest a remote search service.

### Memory repository

```ts
interface MemoryRepository {
  createCandidate(input: CreateCandidateInput): Promise<MemoryCandidate>;
  listCandidates(input: ListCandidatesInput): Promise<Page<MemoryCandidate>>;
  updateProposedCandidate(input: UpdateCandidateInput): Promise<MemoryCandidate>;
  beginApproval(input: BeginApprovalInput): Promise<MemoryCandidate>;
  completeApproval(input: CompleteApprovalInput): Promise<MemoryRecord>;
  rejectCandidate(input: RejectCandidateInput): Promise<MemoryCandidate>;
  getCurrentMemory(input: GetMemoryInput): Promise<HydratedMemory | null>;
  getCurrentMemories(input: ListCurrentMemoriesInput): Promise<HydratedMemory[]>;
  setIndexStatus(input: SetIndexStatusInput): Promise<void>;
}
```

## 5. Error codes

Minimum stable codes:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `STALE_WRITE`
- `NO_APPROVED_CONTEXT`
- `MODEL_UNAVAILABLE`
- `PROVIDER_TIMEOUT`
- `RATE_LIMITED`
- `MODEL_OUTPUT_INVALID`
- `INDEX_FAILED`
- `CONFIGURATION_ERROR`

## 6. Idempotency and concurrency

- Message creation uses a company- and conversation-scoped client key bound to
  the original request text. Completed turns replay their stored structured
  result; mismatched bodies fail with `CONFLICT`.
- Approval uses a candidate version or updated-at precondition.
- Repository indexing addresses the current company, memory, and version; a
  retry does not create another memory version or remote search document.
- Conditional DynamoDB updates reject double approval or stale edits.
- The client treats `409 CONFLICT` as a prompt to reload current state.

## 7. Proof-first onboarding APIs

All routes require an active owner membership and derive `companyId` and actor from the server session.

| Route | Purpose |
|---|---|
| `POST /api/onboarding/sessions` | Create or resume an active session from a proof question. |
| `GET /api/onboarding/sessions` | Load the current actor's active session, if any. |
| `GET /api/onboarding/sessions/{sessionId}` | Load one company- and actor-scoped session view. |
| `POST /api/imports` | Persist one selected paste or ChatGPT conversation and create an idempotent batch. |
| `POST /api/imports/{batchId}/process` | Acquire a 30-second lease and perform one processing stage. |
| `DELETE /api/imports/{batchId}` | Cancel an unfinished batch and tombstone its raw content. |
| `POST /api/onboarding/sessions/{sessionId}/prove` | Answer the proof question using newly approved memories and require a matching citation. |
| `DELETE /api/sources/{sourceId}/content` | Owner-delete raw imported content while retaining citation metadata. |

Paste idempotency combines company, actor, session, provider, and normalized checksum. ChatGPT additionally includes the selected conversation ID. The client key remains accepted for request tracing but does not allow duplicate source batches. Batch and session updates carry optimistic versions; an active lease returns current state without starting a duplicate stage.

The prove response contains `session`, a standard `GroundedAnswer`, and `searchStatus: READY | UPDATING | NEEDS_ATTENTION`. Search status never changes whether the structured approved record is company truth.
