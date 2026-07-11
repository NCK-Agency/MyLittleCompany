# Design System — My Little Company

## Product context

- **What this is:** A conversational organizational-memory product that turns normal owner conversations into human-approved company knowledge.
- **Who it is for:** Busy, non-technical small-business owners and their employees.
- **Memorable idea:** Scattered words click into place and become something the company can trust and reuse.
- **Project type:** Warm, trustworthy web application with a bold hackathon presentation identity.
- **Brand naming:** Always write **My Little Company** in audience-facing copy. Never shorten the name to **MLC**. The abbreviation is reserved for internal code identifiers only.

## Aesthetic direction

- **Direction:** Kinetic editorial utility.
- **Mood:** Confident, optimistic, capable, and unusually memorable without looking like a generic AI product.
- **Decoration:** Intentional. Oversized geometric fragments and strong type do the work.
- **Reference:** `public/brand/mlc-brand-board-blue.png`.
- **Avoid:** Purple gradients, AI sparkles, robots, brains, circuit imagery, stock photography, bubbly SaaS cards, and excessive decorative chrome.

## Logo system

- Four knowledge fragments form a protected square.
- One fragment carries a speech-tail cut; one carries the approval check.
- The fragments may appear separated only when illustrating unstructured conversation.
- Approval snaps the fragments into the completed company-memory mark.
- Use the complete mark for the app icon, Playbook source marker, and final state.
- Keep the production logo to cobalt, butter, coral, and negative space; do not add gradients or shadows.

## Typography

- **Custom wordmark:** Bold condensed uppercase lockup, stacked when space permits.
- **Display and deck titles:** Barlow Condensed ExtraBold or the closest available condensed grotesk.
- **Interface and body:** Instrument Sans.
- **Data and metadata:** Instrument Sans with tabular numbers.
- **Scale:** 64/68 display, 48/52 hero, 36/42 section, 24/30 subheading, 18/26 body, 14/20 metadata.

## Color

| Token | Value | Use |
|---|---:|---|
| Cobalt | `#1746D1` | Primary brand, titles, active fragments |
| Deep cobalt | `#12318A` | Dark presentation surfaces and strong contrast |
| Living coral | `#ED654F` | Approval, decisive actions, memorable accent |
| Warm butter | `#F4D77A` | Suggestions, attention, optimistic energy |
| Soft ivory | `#FAF7EF` | Default background |
| Graphite | `#293331` | Body text and neutral foreground |

Color should remain purposeful: cobalt anchors, butter suggests, coral confirms.

## Layout and spacing

- **Base unit:** 8px.
- **Density:** Comfortable in the product; dramatic and spacious in presentation materials.
- **App layout:** Disciplined grid with clear hierarchy and one primary action per section.
- **Presentation layout:** Radical scale contrast, cropped oversized fragments, and confident negative space.
- **Radius:** 6px small controls, 12px cards, 20px major surfaces. Do not round every object.

## Motion

- **Core transition:** Fragments orbit loosely during conversation, snap together after approval, then pulse outward into Playbook sources and downstream actions.
- **Micro interactions:** 120–180ms.
- **State transitions:** 240–360ms with an ease-out arrival.
- **Approval moment:** One decisive 420ms sequence; energetic but not playful or bouncy.
- Motion must explain the governed-memory loop, never decorate idle screens.

## Presentation rules

- Keep setup slides under 90 seconds total.
- Use audience-facing claims, not feature inventories.
- The logo and process should be readable on a projector from the back of a room.
- End the deck by opening the product; do not end on a generic thank-you slide.

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-11 | Adopt bold blue kinetic identity | Strongest stage visibility and clearest transformation metaphor |
| 2026-07-11 | Use fragments snapping into place as the signature motion | Makes “the company remembers” visible during the demo |
| 2026-07-11 | Give colors fixed product-state meaning | Cobalt anchors, butter suggests, and coral confirms, so status remains consistent across every surface |
| 2026-07-11 | Use a statement-led public root page | First-time owners and judges must understand the product promise before entering the app |
| 2026-07-11 | Keep the public story separate from demo controls | `/` explains and hands off to Marketing; `/workspace` preserves profile, recent knowledge, and reset actions |
| 2026-07-11 | Tell the landing story through the salon proof | A concrete owner statement changing Marketing, Operations, and Employee behavior is stronger than a feature inventory |
