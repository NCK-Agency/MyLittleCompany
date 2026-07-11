# Demo conversation fixture

## Initial owner request

**Owner:** Tuesdays are quiet. Create a promotion to bring more customers in.

## Expected initial Marketing Assistant behavior

- Uses the salon’s premium and warm brand context.
- May suggest an offer, but does not know a discount ceiling yet.
- Labels the offer as a recommendation.

## Owner teaches a durable rule

**Owner:** We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.

## Expected extracted suggestion

- Type: DECISION
- Title: Promotional discounts must not exceed 15%
- Statement: Promotional discounts must not exceed 15%. Prefer complimentary add-ons over deeper discounts.
- Rationale: Protect margins and maintain premium brand positioning.
- Roles: MARKETING, SALES, FRONT_DESK
- Relation: UNRELATED
- Source: the owner message above

## Expected behavior before approval

- The suggestion appears in Review.
- The Marketing Assistant must not treat it as approved company truth in a new conversation.

## Expected behavior after approval

- Playbook contains version 1.
- Revised campaign stays at or below 15% and prefers a free add-on.
- Operations Assistant creates a Tuesday Promotion SOP using the decision.
- Employee asks: “Can I give a customer 25% off?”
- Employee Assistant answers no, explains the 15% maximum and rationale, and shows the approved source.
