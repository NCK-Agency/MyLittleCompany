# Live OpenAI web demo script

## Demo objective

In five to seven minutes, prove one complete governed-memory loop with real model
output:

> Conversation → live OpenAI suggestion → human approval → versioned Playbook →
> repository retrieval → consistent Marketing, Operations, and Employee work

The salon profile is clearly labelled demo company data. Every assistant answer,
knowledge suggestion, campaign, conflict assessment, and SOP shown in the hosted
journey is generated live; fixture output is never substituted.

## Pre-recording gates

- Production uses `APP_MODE=aws`, `MODEL_PROVIDER=openai`, and the server-only
  OpenAI API key.
- `pnpm smoke:openai` passes Fast, Balanced, and Best.
- The complete hosted salon journey passes once with Balanced.
- The owner can sign in, reset `demo-salon`, and reload without losing state.
- Workspace shows Balanced as the default assistant tier.
- The 15% rule does not exist before the recording.
- Review is empty and no provider console, terminal, or developer tool is needed.
- A provider failure has been rehearsed and visibly offers Retry without fixture
  output.

Private ChatGPT/MCP acceptance is not a gate for this web demonstration.

## Filmed journey

### 1. Reset and choose the assistant — 45 seconds

Sign in as the owner, reset the demo company, and open **Workspace → Assistant
settings**. Show the three plain-language choices: Fast, Balanced, and Best
quality. Keep **Balanced** selected for the primary recording.

Say:

> “The owner chooses a simple speed-and-quality level for the whole company. My
> Little Company maps that choice safely on the server; employees cannot enter
> arbitrary model names.”

### 2. Teach the company through Chat — 60 seconds

Open **Chat → Marketing** and enter:

> “We never discount more than 15%. We prefer offering a free add-on because we
> want to maintain a premium image.”

Wait for the live response. Show the suggested-company-knowledge card: what was
heard, why it matters, source, scope, affected roles, and `Approve / Edit /
Ignore`.

Say:

> “OpenAI produced this suggestion from what I just typed, but it is not company
> truth. The owner still decides what the company remembers.”

### 3. Approve and verify the Playbook — 45 seconds

Approve the suggestion without leaving the conversation, then open its Playbook
entry. Point out:

- the 15% statement and free-add-on preference;
- the margin and premium-positioning rationale;
- the conversation source;
- the affected roles;
- owner approver, approval date, and version 1.

Reload the page and confirm the same approved version remains.

Say:

> “The approved version is durable company knowledge. The model did not approve
> it, and reloading does not erase it.”

### 4. Reuse it in Marketing — 45 seconds

Return to Marketing and ask:

> “Create a Tuesday promotion for quiet afternoons. Keep it premium.”

Show that the live response stays at or below 15%, prefers a complimentary
add-on, and cites the approved pricing decision.

Say:

> “The next request searched the real approved Playbook record and sent only
> authorized current context to the selected OpenAI model.”

### 5. Turn it into an Operations SOP — 60 seconds

Switch to **Operations** and ask:

> “Create an SOP for running this Tuesday promotion from booking to checkout.”

Show the live structured SOP, its source decision, checks, and escalation. If you
save it, point out that it becomes another suggestion requiring approval rather
than approving itself.

### 6. Prove consistent employee guidance — 45 seconds

Switch to the seeded employee and ask:

> “Can I give a customer 25% off?”

The answer must lead with **No**, state the approved 15% maximum and free-add-on
preference, explain the rationale, and show the source title and approval date.

Close with:

> “Explain it once. The owner approves it once. Then the company gives the same
> source-backed answer across Marketing, Operations, and the team.”

## Optional model-selection proof

After the primary take, the owner may change Assistant settings to **Fast**, send
one new harmless request, and show that only the new response uses the new tier.
Restore Balanced afterward. Do not regenerate or imply changes to earlier
messages.

## Truthful failure policy

1. For a transient timeout or rate limit, use the visible Retry action once.
2. If the selected model remains unavailable, open Assistant settings and choose
   another tier manually only if that tier passed the pre-recording smoke.
3. Never hide an error, splice in fixture content, or describe offline behavior
   as live OpenAI output.
4. If Cognito alone is blocked during a private rehearsal, use the clearly
   labelled seeded demo login; keep live OpenAI generation and durable company
   storage unchanged.
5. If the OpenAI live gate does not pass, postpone the real-LLM recording. A
   labelled fixture run may be used for development evidence, not as the promised
   live demo.

## Presenter checklist

- [ ] Fast, Balanced, and Best pass `pnpm smoke:openai`.
- [ ] Balanced is selected at reset and at the start of the take.
- [ ] The 15% rule is absent before the owner types it.
- [ ] The suggestion is visibly proposed before approval.
- [ ] Version 1, source, rationale, approver, and date survive reload.
- [ ] Marketing respects the rule and cites it.
- [ ] The Operations SOP cites approved knowledge and remains unapproved if saved.
- [ ] The employee answer rejects 25% with the approved source.
- [ ] No fixture fallback, provider key, account detail, or developer console is visible.
