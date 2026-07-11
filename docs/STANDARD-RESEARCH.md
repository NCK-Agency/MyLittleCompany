# My Little Company: Knowledge Memory Standards Export

Date: 2026-07-11

## Purpose

This document summarizes research findings for My Little Company (MLC): a simple, conversation-first knowledge system for non-technical business owners.

MLC gives owners one place to talk about their business, make decisions, and document how work should be done. Instead of requiring folders, wikis, prompts, or workflow configuration, MLC starts with conversation and turns useful business knowledge into approved company memory.

The core product loop is:

> Conversation -> decision -> approval -> company memory -> reusable action

## Positioning

Suggested positioning statement:

> Your team used to rely on one favorite ChatGPT chat. Now every employee has a team of AI assistants working from the same structured, approved company memory.

MLC is not just a chatbot or document repository. It is an approved business memory system that helps owners turn informal conversations into reusable operating knowledge.

## What Cabinet and Paperclip Suggest

### Cabinet

Cabinet treats a company as a portable, file-system-native structure for AI teams. It uses folders, Markdown, YAML, agents, scheduled jobs, and knowledge files.

Useful lesson for MLC:

- Company memory should be portable.
- Knowledge should be structured enough for agents to use.
- Agents need shared context, not isolated chat history.
- Files are a good export format, even if normal users never manage files directly.

MLC should not copy Cabinet's technical user experience. Cabinet is a good inspiration for internal structure and exportability, but MLC should hide folders, YAML, and agent configuration from business owners.

Source: https://github.com/cabinetai/cabinets

### Paperclip

Paperclip is also close in spirit: self-hosted agent teams, org charts, goals, budgets, tickets, governance, and company operating context.

Useful lesson for MLC:

- Agents need roles and responsibilities.
- Company memory should guide work, not just answer questions.
- Governance matters: agents should not freely invent company policy.

MLC should simplify this into owner-friendly flows: propose, approve, use, update.

Source: https://paperclip.ing/

## Alternative Product Landscape

These products are useful references, not exact replacements.

| Product | Main Lesson for MLC | Why It Matters |
|---|---|---|
| Slite | Verified knowledge for humans and agents | Strong reference for simple AI-ready knowledge base and approved context. |
| Guru | Governed company knowledge | Strong reference for trust, verification, permissions, ownership, and stale knowledge detection. |
| Notion AI | Familiar workspace plus AI agents | Good reference for non-technical UX and teams already used to writing in workspaces. |
| Dust | Custom assistants over company data | Good reference for agent teams using shared company context. |
| Glean | Enterprise search and agents | Good reference for permissions, source grounding, connectors, and enterprise retrieval. |
| Atlassian Rovo | Agents inside existing work systems | Good reference if company knowledge lives around tickets, docs, and projects. |
| Tettra | Simple Slack-first company Q&A | Good reference for reducing repeated employee questions. |

Recommended product lesson:

MLC should be simpler than all of these. The owner should not think: "I am maintaining a knowledge base." The owner should think: "I am talking through my business, and MLC is remembering the important parts after I approve them."

Sources:

- Slite: https://slite.com/
- Guru: https://www.getguru.com/
- Notion AI: https://www.notion.com/product/ai
- Dust: https://docs.dust.tt/docs/intro
- Glean: https://www.glean.com/
- Atlassian Rovo: https://www.atlassian.com/software/rovo
- Tettra: https://tettra.com/

## Standards and Patterns to Use

There is no single standard for MLC's full loop, but MLC can combine proven standards.

| MLC Need | Standard or Pattern | How MLC Should Use It |
|---|---|---|
| Knowledge management governance | ISO 30401 | Use as inspiration for creating, maintaining, reviewing, and improving company knowledge. |
| Business decisions | ADR / Decision Records | Turn owner decisions into durable records with context, rationale, and consequences. |
| Business rules | SBVR | Express business rules in clear business language. |
| Repeatable decisions | DMN | Model rule-based decisions such as discounts, refunds, approvals, pricing, and exceptions. |
| SOPs and workflows | BPMN | Represent repeatable work behind the scenes, while showing users a simple checklist or procedure. |
| Business motivation | BMM | Link rules and decisions to goals, values, risks, and strategies. |
| Provenance and audit trail | W3C PROV-O | Track where knowledge came from, who approved it, and what replaced it. |
| Taxonomy and topics | SKOS | Manage departments, topics, synonyms, and business vocabulary. |
| Agent context delivery | MCP | Expose approved company memory to AI assistants as structured resources, prompts, and tools. |
| Agent collaboration | A2A | Consider later if multiple specialized agents need to coordinate as independent agents. |
| AI governance | NIST AI RMF / ISO 42001 | Use as high-level guidance for risk, accountability, and safe AI operation. |

Sources:

- ISO 30401: https://www.iso.org/standard/68683.html
- ADR: https://adr.github.io/
- SBVR: https://www.omg.org/spec/SBVR/
- DMN: https://www.omg.org/spec/DMN/
- BPMN: https://www.omg.org/spec/BPMN/2.0.2/
- BMM: https://www.omg.org/spec/BMM/1.3/
- W3C PROV-O: https://www.w3.org/TR/prov-o/
- SKOS: https://www.w3.org/TR/skos-reference/
- MCP: https://modelcontextprotocol.io/specification/latest
- A2A: https://a2a-protocol.org/latest/specification/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- ISO 42001: https://www.iso.org/standard/81230.html

## Recommended MLC Standard: Approved Business Memory

The core MLC standard should be an internal format called:

> Approved Business Memory

MLC should not make folders, chats, or documents the primary unit. The primary unit should be a memory record.

## Memory Record Types

Recommended first record types:

- company_fact
- business_decision
- policy
- business_rule
- brand_rule
- communication_preference
- customer_insight
- lesson_learned
- standard_operating_procedure
- role_responsibility
- metric_definition
- exception
- agent_instruction

These can later be grouped into folders or exported as Markdown, but the product should treat each one as a structured, reviewable memory.

## Memory Lifecycle

Recommended lifecycle:

1. Captured
2. Proposed
3. Owner review
4. Approved
5. Active
6. Reviewed
7. Superseded or archived

Rejected records should remain in the audit trail but should not be used by assistants.

Only approved and active memory should be part of trusted assistant context.

## Common Memory Record Schema

Every memory record should support these fields.

```yaml
id: mem_example_001
type: business_decision
status: approved
title: Short human-readable title
statement: The approved company memory in plain business language.
reason: Why this memory exists.
applies_to:
  departments: []
  roles: []
  workflows: []
  channels: []
owner: business_owner
source:
  kind: conversation
  reference: conversation_id_or_url
  excerpt: Short source excerpt
approval:
  approved_by: owner
  approved_at: 2026-07-11
confidence: high
sensitivity: internal
review:
  review_after: 2027-01-11
  review_frequency: every_6_months
relationships:
  supports: []
  contradicts: []
  supersedes: []
  related_to: []
agent_usage:
  can_use_for_answers: true
  can_use_for_actions: true
  requires_human_approval_for_actions: true
```

## Example Memory Record

Owner statement:

> We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.

Structured MLC memory:

```yaml
id: mem_discount_policy_001
type: business_decision
status: approved
title: Promotional discount limit
statement: Promotional discounts must not exceed 15%.
preferred_approach: Offer complimentary add-ons instead of larger discounts.
reason: Protect margins and maintain premium brand positioning.
applies_to:
  departments:
    - Marketing
    - Sales
    - Front Desk
  workflows:
    - Promotions
    - Sales offers
    - Customer retention
owner: business_owner
source:
  kind: conversation
  excerpt: We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.
approval:
  approved_by: owner
  approved_at: 2026-07-11
sensitivity: internal
agent_usage:
  can_use_for_answers: true
  can_use_for_actions: true
  requires_human_approval_for_actions: true
```

## Owner Review UX

When MLC detects useful memory, it should show a simple review card:

```text
MLC found a possible company rule.

Rule:
Promotional discounts must not exceed 15%.

Preferred approach:
Offer complimentary add-ons instead of larger discounts.

Reason:
Protect margins and maintain premium brand positioning.

Applies to:
Marketing, Sales, Front Desk.

[Approve] [Edit] [Reject]
```

The user should not see YAML unless they choose an export or advanced view.

## Agent Usage Model

MLC assistants should use memory in this order:

1. Retrieve approved active memory relevant to the task.
2. Identify any conflicting, expired, or missing memory.
3. Generate an answer, idea, checklist, or SOP grounded in approved memory.
4. Cite the memory records used.
5. Ask for owner approval when new policy, rule, or business decision appears.
6. Propose new memory from the conversation.

Example flow:

1. Marketing Assistant proposes a campaign using brand rules, customer insights, and past decisions.
2. Owner edits the campaign and makes a new decision.
3. MLC captures the new decision as proposed memory.
4. Owner approves it.
5. Operations Assistant turns the approved campaign into an SOP.
6. Future employees ask how to run the campaign and receive answers grounded in approved memory.

## Recommended Internal Architecture

MLC should separate four layers.

### 1. Conversation Layer

Where the owner talks naturally.

Responsibilities:

- Ask clarifying questions.
- Detect possible memories.
- Summarize decisions.
- Avoid silently changing trusted knowledge.

### 2. Memory Proposal Layer

Where MLC structures raw conversation into proposed records.

Responsibilities:

- Classify memory type.
- Extract statement, reason, scope, and source.
- Detect duplicates and conflicts.
- Prepare owner-friendly approval cards.

### 3. Approved Memory Layer

The trusted company context.

Responsibilities:

- Store approved memory.
- Track status, version, provenance, and review dates.
- Support search and retrieval.
- Provide context to employees and assistants.

### 4. Action Layer

Where assistants use approved memory to do work.

Responsibilities:

- Generate ideas.
- Draft SOPs.
- Answer employee questions.
- Create checklists.
- Propose updates when reality changes.

## Retrieval Rules for Assistants

Assistants should follow these rules:

- Use approved active memory first.
- Do not treat rejected, draft, or superseded memory as truth.
- If memory conflicts, show the conflict and ask the owner or manager.
- If a task requires a policy that does not exist, say the policy is missing and propose one.
- Cite the memory records used in important answers.
- Capture new decisions as proposals, not as automatic truth.

## Suggested File Export Structure

Even if users never manage files, MLC should export memory in a portable structure:

```text
company-memory/
  manifest.yaml
  facts/
  decisions/
  policies/
  rules/
  brand/
  customers/
  lessons/
  sops/
  roles/
  agents/
  archive/
```

Each memory can be exported as Markdown with YAML front matter:

```markdown
---
id: mem_discount_policy_001
type: business_decision
status: approved
applies_to: [Marketing, Sales, Front Desk]
approved_at: 2026-07-11
---

# Promotional discount limit

Promotional discounts must not exceed 15%.

Preferred approach: offer complimentary add-ons instead of larger discounts.

Reason: protect margins and maintain premium brand positioning.
```

This gives MLC the portability benefit of Cabinet without making folders the user experience.

## MVP Scope

Recommended MVP:

1. Conversation capture
2. Memory proposal detection
3. Approve / edit / reject workflow
4. Approved memory library
5. Marketing Assistant using approved memory
6. SOP Assistant turning approved ideas into repeatable procedures
7. Employee Q&A grounded in approved memory
8. Export to Markdown/YAML

Do not start with complex workflow builders, visual BPMN editors, agent marketplaces, or multi-agent orchestration. Those can come later.

## Product Principle

The owner should never be asked to maintain a knowledge system.

The owner should simply run the business through conversation, and MLC should turn the important parts into structured, approved, reusable company memory.

## Short Internal Definition

My Little Company is an approved business memory system for non-technical owners.

It turns normal business conversations into trusted company knowledge, then uses that knowledge to help humans and AI assistants make better decisions and perform repeatable work.

