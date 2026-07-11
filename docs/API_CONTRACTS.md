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
    "code": "MEMORY_INDEX_FAILED",
    "message": "The knowledge was approved but could not be added to search.",
    "retryable": true
  },
  "meta": {
    "requestId": "req_..."
  }
}
```

## 3. Web route contracts

Exact routing may use Next.js route handlers or server actions. Preserve these logical contracts.

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

### POST `/api/conversations`

Request:

```json
{
  "assistantRole": "MARKETING",
  "title": "Tuesday promotion"
}
```

Response contains the conversation.

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

The server may return suggestions in the initial response or expose a short polling/status mechanism. Keep the UI behavior consistent.

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
    "indexStatus": "PENDING"
  }
}
```

A later response or refresh may show `READY` or `FAILED`.

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

### GET `/api/memories/{memoryId}`

Returns current record, current version, source references, and version history.

### POST `/api/memories/{memoryId}/retry-index`

Owner-only in MVP. Idempotently retries rendering and ingestion of the current version.

### POST `/api/sops/generate`

Request:

```json
{
  "title": "Tuesday Promotion SOP",
  "goal": "Launch and operate the approved Tuesday promotion",
  "artifactId": "artifact_campaign_...",
  "additionalInstructions": "Keep it simple for front desk staff"
}
```

Response contains a structured SOP draft and source memory references. Saving it as company knowledge creates a candidate.

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
  generateAssistantResponse(
    input: GenerateAssistantResponseInput,
  ): Promise<GenerateAssistantResponseResult>;

  extractMemoryCandidates(
    input: ExtractMemoryCandidatesInput,
  ): Promise<ExtractMemoryCandidatesResult>;

  classifyMemoryRelationship(
    input: ClassifyMemoryRelationshipInput,
  ): Promise<ClassifyMemoryRelationshipResult>;

  generateSop(input: GenerateSopInput): Promise<GenerateSopResult>;
}
```

### Knowledge index

```ts
interface KnowledgeIndex {
  upsertApprovedMemory(
    input: UpsertApprovedMemoryInput,
  ): Promise<{ documentId: string }>;

  deleteMemoryVersion(input: DeleteMemoryVersionInput): Promise<void>;

  retrieve(
    input: RetrieveApprovedMemoryInput,
  ): Promise<KnowledgeIndexHit[]>;
}
```

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
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `STALE_WRITE`
- `MODEL_UNAVAILABLE`
- `MODEL_OUTPUT_INVALID`
- `MEMORY_EXTRACTION_FAILED`
- `MEMORY_APPROVAL_FAILED`
- `MEMORY_INDEX_FAILED`
- `KNOWLEDGE_RETRIEVAL_FAILED`
- `SOURCE_STORAGE_FAILED`
- `DEMO_RESET_FAILED`

## 6. Idempotency and concurrency

- Message creation uses a client-generated idempotency key.
- Approval uses a candidate version or updated-at precondition.
- Direct ingestion uses a stable document ID derived from company, memory, and version.
- Index retries do not create duplicate memory versions.
- Conditional DynamoDB updates reject double approval or stale edits.
- The client treats `409 CONFLICT` as a prompt to reload current state.
