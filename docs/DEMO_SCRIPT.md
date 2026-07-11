# Tomorrow-ready demo script

## Demo objective

In five to seven minutes, show one complete governed-memory loop:

> Conversation -> suggested company knowledge -> human approval -> versioned
> Playbook -> trusted reuse in ChatGPT

The proof is not merely that AI can answer a question. The proof is that ChatGPT
can read approved knowledge and suggest an addition while only My Little Company
can approve company truth.

## Pre-recording gates

- Production is running with `APP_MODE=aws` and `AUTH_MODE=cognito`.
- The owner can sign in through Cognito and complete a production reset.
- The reset survives a reload and Review is empty.
- The onboarding source below is visibly labelled **Synthetic demo data**.
- The discount rule does not exist before the recording.
- Bedrock generation, DynamoDB persistence, S3 source storage, and Knowledge Base
  retrieval have passed `pnpm smoke:aws`.
- The private ChatGPT app is connected through OAuth and exposes exactly
  `search`, `fetch`, and `suggest_company_knowledge`.
- The ChatGPT app asks before the suggestion tool makes a change.
- No provider consoles, terminals, or developer tools are needed in the filmed
  path.

Keep the existing local recording ready as the guaranteed backup.

## Synthetic onboarding source

Paste this short source during onboarding:

> **Synthetic demo data — Maison Lumière Salon.** We are a premium neighborhood
> salon for busy local professionals and clients preparing for important events.
> Customers choose us for calm personal consultations and consistent service.
> Our communication should feel warm, confident, refined, helpful, and never
> pushy.

Do not upload real customer data or imply that the synthetic source came from a
real business.

## Filmed journey

### 1. Reset, sign in, and onboard — 60 to 90 seconds

Reset the demo company, sign in as the owner, and complete onboarding with the
synthetic source.

Approve the useful brand/customer suggestions. Ask one short proof question and
open its source citation.

Say:

> “This is synthetic demo data. My Little Company has turned a short business
> description into useful suggestions, but the owner still decides what becomes
> trusted company knowledge.”

### 2. Teach the company through Chat — 45 seconds

Open **Chat** and enter:

> “We never discount more than 15%. We prefer offering a free add-on because we
> want to maintain a premium image.”

Show the suggested-company-knowledge card: what was heard, why it matters,
source, scope, affected roles, and the `Approve / Edit / Ignore` actions.

Say:

> “This is the key difference from ordinary chat history. The system recognized
> a lasting rule, but it did not silently make that rule company truth.”

Approve the suggestion without leaving the workflow.

### 3. Inspect version 1 in Playbook — 45 seconds

Open the structured Playbook entry and point out:

- the statement and rationale;
- conversation source;
- company scope and affected roles;
- owner approver and approval date;
- search readiness;
- version 1.

Say:

> “The company remembers both the decision and why it was made.”

### 4. Create version 2 — 45 seconds

Edit the approved entry so the maximum discount is **10%**, preserve the
free-add-on preference and rationale, then save it as version 2. Expand history
and show that version 1 remains preserved.

Say:

> “Changing a rule creates a new approved version. It does not rewrite history.”

Wait until the current entry shows version 2 and search status is ready before
switching to ChatGPT.

### 5. Reuse current truth in ChatGPT — 60 seconds

In a new ChatGPT conversation with the private **My Little Company** app enabled,
enter:

> “Use My Little Company to find our approved promotion discount rule. Do not
> use web browsing.”

Then enter:

> “Open the most relevant result and explain the current rule with its rationale
> and source.”

The result must be version 2, state the 10% maximum, preserve the free-add-on
preference, and link to the canonical Playbook URL.

Say:

> “ChatGPT is reading the current approved version, not a copied prompt or an old
> chat message.”

### 6. Suggest knowledge from ChatGPT — 60 seconds

Enter:

> “Our new lasting rule is that appointment reminders must be sent 24 hours in
> advance. Offer to suggest this to My Little Company, but do not make the change
> until I confirm.”

Confirm only when ChatGPT asks. Show the successful suggestion result and Review
link.

If useful, ask:

> “Is that rule approved company policy now?”

ChatGPT must answer no: the item is only proposed.

### 7. Prove the approval boundary — 30 seconds

Return to **Review** in My Little Company. Show the 24-hour reminder item still
waiting for a human decision. Do not approve it during the close.

Close with:

> “ChatGPT can use and suggest company knowledge, but only the company can
> approve it.”

## Truthful fallback ladder

Timebox each external repair attempt and step down without pretending a fallback
is the hosted path.

1. If Cognito alone is blocked, keep AWS and Netlify real, switch to seeded demo
   authentication, and state that authentication is in demo mode.
2. If Netlify is blocked, run the AWS-backed application through a temporary
   HTTPS tunnel with seeded demo authentication.
3. If Bedrock or Knowledge Base smoke testing still fails after two focused
   repair attempts, run the entire recording in deterministic local mode through
   the tunnel and keep the visible **Demo mode** label.
4. Capture the real ChatGPT scene separately as soon as it passes and splice it
   into the recording. Never fabricate a ChatGPT response or OAuth connection.
5. If the ChatGPT connection never succeeds, omit that claim and use the existing
   local platform recording as the backup.

## Presenter checklist

- [ ] Complete the journey once from reset without consoles or developer tools.
- [ ] Confirm the onboarding source says **Synthetic demo data** on screen.
- [ ] Confirm version 2 is `READY` before the ChatGPT search.
- [ ] Confirm ChatGPT returns the 10% rule, not version 1.
- [ ] Confirm the ChatGPT suggestion remains `PROPOSED` in Review.
- [ ] Keep browser zoom, notifications, bookmarks, and account information safe
  for recording.
- [ ] End on the approval boundary, not infrastructure.
