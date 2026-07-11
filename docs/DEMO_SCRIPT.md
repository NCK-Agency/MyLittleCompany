# Demo Script

## Demo objective

Show that MLC turns one normal owner statement into approved organizational memory that changes future work for both AI assistants and a human employee.

Do not spend the demo explaining infrastructure before the product value is visible.

## Pre-demo state

- Demo company reset to Maison Lumière Salon.
- Owner is signed in or represented by the demo owner session.
- General company profile and brand context exist.
- The 15% promotional-discount rule does not exist yet.
- AWS mode is configured for the submitted demo, with local mode available as fallback.
- Review inbox is empty.

## Opening

Say:

> “In a small business, the owner is often the operating system. Important decisions live in their head or disappear inside chat history. My Little Company turns everyday conversation into approved company memory that both AI assistants and employees can reuse.”

## Step 1 — Ask for a marketing idea

Open **Chat → Marketing**.

Enter:

> “Tuesdays are quiet. Create a promotion to bring more customers in.”

Point out that the assistant already uses approved company context such as premium positioning and customer profile.

Do not over-explain the first answer.

## Step 2 — Teach the company naturally

Enter:

> “We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.”

MLC shows a suggested company knowledge card.

Say:

> “This is the key difference from normal chat history. MLC recognized something useful beyond this conversation, but it did not silently turn it into company truth.”

Briefly show:

- Maximum 15% discount.
- Prefer free add-ons.
- Rationale.
- Applies-to roles.
- Source conversation.

Click **Approve**.

## Step 3 — Show the approved Playbook entry

Open the entry or its success state.

Point out:

- Approved by the owner.
- Version 1.
- Source.
- Rationale.
- Roles.
- Search/index readiness.

Say:

> “The company now remembers both what was decided and why.”

## Step 4 — Reuse it in Marketing

Ask the Marketing Assistant to revise the promotion.

Expected result:

- No offer above 15%.
- Complimentary add-on preferred.
- Premium tone.
- Source chip for the approved pricing decision.

Say:

> “The approved memory now changes future AI work without the owner rewriting a prompt.”

## Step 5 — Turn it into an SOP

Open **Chat → Operations** or click **Create SOP**.

Generate the Tuesday Promotion SOP.

Show:

- Purpose.
- Front-desk steps.
- Eligibility and offer setup.
- Quality checks.
- Tracking and review.
- Source decision.

Say:

> “The same memory moves from an idea into repeatable operations.”

Mention that the SOP remains a suggestion until approved.

## Step 6 — Show employee reuse

Open **Chat → Employee**.

Ask:

> “Can I give a customer 25% off?”

Expected answer:

> “No. The current approved promotion policy caps discounts at 15%. The salon prefers complimentary add-ons because they protect margins and premium positioning.”

Show the source and approval date.

Say:

> “A future employee gets the same answer and the reason behind it, even if the owner is not present.”

## Closing

Say:

> “Chat is the input. Approved company memory is the product. My Little Company helps a business explain something once, preserve the decision, and apply it consistently across its human-and-AI team.”

## Optional technical close

Only after the product story:

> “Amazon Bedrock extracts and generates the AI outputs. DynamoDB stores the structured approval and version state. S3 stores sources and canonical memory documents. Bedrock Knowledge Bases retrieves approved, company-scoped context for every assistant.”

## Backup plan

If external AI generation fails:

- Switch to local demo mode only if the submission and presentation allow it.
- State that local mode uses deterministic fixtures while the same domain workflow normally uses AWS adapters.
- Do not pretend a local response came from AWS.

If indexing fails:

- Use the visible retry state as evidence of trustworthy failure handling.
- Retry once.
- If needed, use a pre-indexed approved fixture and explain the limitation honestly.

## Presenter checklist

- [ ] Reset demo.
- [ ] Confirm the 15% memory is absent.
- [ ] Confirm Review is empty.
- [ ] Confirm AWS environment health.
- [ ] Confirm employee persona can read but not approve.
- [ ] Keep the browser zoom and window size readable.
- [ ] Avoid opening provider consoles unless asked.
- [ ] End on the employee answer or the product promise, not a terminal.
