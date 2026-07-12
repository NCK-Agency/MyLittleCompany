# PLANS.md

This is the live execution plan. Codex must update it before and during multi-file work. Keep completed items and verification evidence so future sessions can understand what actually happened.

## Active checkpoint: preserve complete conversation context during conversion

**Outcome:** When My Little Company turns a conversation into an assistant response
or suggested company knowledge, provide the complete persisted transcript (with
stable message IDs and speakers) to the server-side model boundary. Keep the
latest owner message explicit, treat transcript content as data rather than
instructions, and retain every model-selected owner message as candidate
provenance.

**Affected files:** `src/ports/model-gateway.ts`, conversation and suggestion
services, local and OpenAI model adapters, assistant prompts, focused model and
conversation tests, and this plan. No approved-memory retrieval, client API,
or storage schema change is intended.

**Implementation steps:**

- [x] Pass the persisted transcript plus the current message through every
  conversation generation and extraction call.
- [x] Serialize the transcript with stable IDs, roles, timestamps, and content;
  validate selected user-message provenance before persistence.
- [x] Update prompts and fixture behavior so transcript context is useful but
  cannot override application instructions or approved company knowledge.
- [x] Add regression tests for multi-turn response and knowledge extraction,
  then run the required repository gates.

**Verification results (2026-07-12):** `pnpm lint`, `pnpm typecheck`, `pnpm
test` (32 files, 138 tests), `pnpm build`, and `git diff --check` pass. Fixture
browser coverage also passes 10 local journeys; three live OpenAI journeys are
correctly skipped in fixture mode. Regression coverage proves a second chat turn
receives the first owner message, its assistant response, and the new owner
message; OpenAI extraction receives prior owner and assistant turns while a
candidate can cite only supplied owner message IDs.

**Rollback:** Revert this checkpoint only. Conversation persistence and approved
memory records are unchanged, so no data rollback is required.

## Active checkpoint: render chat markdown correctly

**Outcome:** Render assistant and user chat text as readable markdown in the conversation UI, including headings, emphasis, lists, code, and links, while preserving the existing data-message cards and keeping rendering safe.

**Affected files:** `src/components/assistant-ui/mlc-thread.tsx`, `package.json`, `pnpm-lock.yaml`, and this plan.

**Implementation steps:**

- [x] Add the assistant-ui markdown renderer dependency.
- [x] Replace the plain text message part with the markdown renderer and scoped styling.
- [x] Verify lint, typecheck, tests, and build; record any remaining risk.

**Verification results (2026-07-12):** `pnpm lint`, `pnpm typecheck`, all 31
unit-test files and 134 tests, and `pnpm build` pass. Markdown is rendered by
`@assistant-ui/react-markdown` with `remark-gfm`; raw HTML remains disabled by
the renderer defaults, and the existing source, SOP, and knowledge cards are
unchanged. The first sandboxed build attempt could not resolve Google Fonts;
the same build passed with the repository's existing network-enabled build
path. An unrelated untracked description file remains untouched.

**Rollback:** Restore the previous plain text message component and remove the markdown dependency.

## Active checkpoint: enable the private ChatGPT MCP app on Netlify

**Outcome:** Activate the already implemented tool-only My Little Company MCP
connector on the linked Netlify production site, deploy the current MCP-capable
revision, verify the public OAuth discovery and protected-resource boundary, and
hand the owner an exact ChatGPT Developer Mode connection sequence. Preserve the
existing rule that connected assistants may search/fetch approved knowledge and
create Review suggestions, but may never approve company truth.

**Affected files and external state:** This plan, `netlify.toml`, plus the linked
Netlify production environment and deploy state. No MCP domain, OAuth, retrieval,
membership, or UI code change is required. The canonical connector origin is
`https://my-little-company-demo.netlify.app` because the existing Auth.js and
Cognito callback configuration already use that exact stable origin.

**Implementation steps:**

- [x] Confirm the repository already exposes stateless Streamable HTTP at
  `/mcp`, OAuth discovery/DCR/PKCE/JWKS, `search`, `fetch`, and the governed
  `suggest_company_knowledge` write with no approval tool.
- [x] Verify the Netlify production context has durable AWS persistence,
  Cognito auth, OpenAI configuration, a stable Auth.js secret, and a stable MCP
  signing JWK without printing secret values.
- [x] Run focused MCP/OAuth tests and the required repository verification gates.
- [x] Explicitly enable Netlify's official Next.js runtime plugin so App Router
  route handlers are packaged as serverless functions instead of publishing
  `.next` as a static folder.
- [x] Set production `MCP_ENABLED=true`, deploy the current revision, and keep
  secrets restricted to the Netlify Functions runtime.
- [x] Verify discovery and JWKS responses, then confirm unauthenticated `/mcp`
  returns the expected `401` bearer challenge rather than data or a `404`.
- [ ] Complete the owner-run ChatGPT OAuth link and acceptance prompts from
  `docs/CHATGPT_APP.md`; record any interactive step that cannot be completed
  from this workspace as an explicit handoff rather than a simulated success.

**Verification:** Run the focused environment, OAuth, MCP, and scoped-access
tests first; then `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`. After deployment, check the two OAuth discovery documents,
JWKS, icon, and unauthenticated MCP challenge at the permanent origin. The final
ChatGPT acceptance sequence is search, fetch, suggest after confirmation,
pre-approval exclusion, Review approval, and post-approval retrieval.

**Verification results (2026-07-12):** Focused environment, OAuth, MCP, and
scoped-access coverage passes (4 files, 22 tests). `pnpm lint`, `pnpm
typecheck`, all 31 unit-test files and 134 tests, `pnpm build`, and the 13
Playwright journeys pass; the browser suite required the normal elevated local
port permission after the sandbox rejected `0.0.0.0:3000`. Netlify production
has `MCP_ENABLED=true` while protected values remain non-readable through the
CLI. Commit `e4fc595` adds only the official `@netlify/plugin-nextjs` runtime
declaration. Production deploy `6a52ddd40830630009a2ccdb` is ready and contains
one server function plus one edge function.

At `https://my-little-company-demo.netlify.app`, the application and icon return
`200`; both OAuth discovery documents and JWKS return `200` with resource
`https://my-little-company-demo.netlify.app/mcp`, scopes `knowledge:read` and
`knowledge:suggest`, PKCE S256, and signing key ID `mlc-mcp-1`.
Unauthenticated `/mcp` returns `401`, `Cache-Control: no-store`, and the exact
protected-resource challenge. A live dynamic-client registration returns `201`
with Authorization Code, rotating refresh-token, PKCE, and public-client
metadata. The remaining unchecked item is intentionally interactive: the owner
must create the ChatGPT Draft app and complete Cognito sign-in in their ChatGPT
account; it was not simulated from this workspace.

**Rollback:** Set production `MCP_ENABLED=false` and redeploy. This removes the
public MCP/OAuth surface without deleting clients, tokens, memberships,
suggestions, approved knowledge, or ordinary web-app data. If the new deploy has
an unrelated regression, restore the prior published Netlify deploy after the
flag is disabled.

## Active checkpoint: reconcile the OpenAI architecture documentation

**Outcome:** Make the documented hosted architecture match the completed
Bedrock-to-OpenAI implementation, including the conversation persistence and
retry boundary that was added during final release review. Keep the explanation
clear enough for a non-technical owner while preserving exact engineering
contracts for contributors.

**Affected files:** `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
`docs/API_CONTRACTS.md`, `docs/AI_BEHAVIOR.md`, `docs/SECURITY.md`, and this
plan. Runtime code, environment values, cloud resources, deployment state,
versioning, commits, and unrelated license work are unchanged.

**Implementation steps:**

- [x] Audit the implemented OpenAI, repository, persistence, settings, and
  recovery surfaces against the canonical architecture and operational docs.
- [x] Update the architecture sequences and durable-hosting explanation for
  stable request keys, deferred persistence, structured result storage, and
  strongly consistent replay.
- [x] Align the Message data model and conversation API response/retry contracts
  with persisted SOP and grounded-answer payloads.
- [x] Align AI and security guidance with the same provider-retry versus
  user-retry boundary, then verify cross-document terminology, Mermaid syntax,
  links, and diff hygiene.

**Verification (2026-07-12):** The audit cross-checked the documentation against
`Message`, `ConversationService`, the local and DynamoDB conversation
repositories, `OpenAIModelGateway`, the assistant-settings route, and runtime
composition. The reference layer now covers persisted `sop` and
`groundedAnswer` fields, the content-bound idempotency marker, and the complete
conversation response. The architecture explanation distinguishes the one
gateway transport retry from a later user Retry, documents deferred owner-turn
persistence, and shows strongly consistent replay. AI and security rules use the
same boundary. README and `START_HERE.md` already link the architecture and need
no additional discoverability change; the hosted Mermaid overview already names
OpenAI, repository retrieval, owner settings, DynamoDB, S3, and Cognito.

All five edited documents have balanced fenced blocks, no active Bedrock,
Knowledge Base, or S3 Vectors language, and `git diff --check` passes. The 25
focused tests for provider routing/retry, durable conversation recovery, and
DynamoDB replay pass. No runtime file, dependency, version, environment value,
deployment, commit, or unrelated license change was made in this documentation
checkpoint.

**Rollback:** Revert only this documentation checkpoint and its five factual doc
edits. No runtime or external-state rollback is required.

## Active checkpoint: MIT repository license

**Outcome:** Make the repository explicitly available under the standard MIT
License, with GitHub-detectable license text and matching package and README
metadata.

**Affected files:** `LICENSE`, `package.json`, `README.md`, and this plan. No
runtime code, dependencies, product behavior, data, or deployment state changes.

**Implementation steps:**

- [x] Add the canonical MIT License text with the 2026 NCK Agency copyright.
- [x] Declare `MIT` in package metadata and link the README to the license.
- [x] Validate the package metadata, license text, and diff hygiene; run the
  repository lint, typecheck, unit-test, and production-build gates.

**Verification (2026-07-12):** The license text matches SPDX's canonical MIT
terms, `package.json` parses with `license: "MIT"`, every direct production
dependency declares MIT, Apache-2.0, or ISC, the README link resolves locally,
and `git diff --check`, `pnpm lint`, the final sequential `pnpm typecheck`, and
`pnpm build` pass. The unit suite passes 127 of 128 tests; the unrelated,
already-modified conversation implementation fails its existing idempotency
expectation in `tests/local-salon-flow.test.ts:104`, including when isolated.
The license and metadata changes do not touch runtime or test code.

**Rollback:** Remove `LICENSE`, remove the package `license` field and README
license section, and delete this checkpoint. No application or external-state
rollback is required.

## Active checkpoint: migrate Bedrock to OpenAI with owner model selection

**Outcome:** Replace every active Bedrock model and Knowledge Base dependency
with real OpenAI Responses API generation plus repository-backed retrieval. Keep
DynamoDB, private S3, Cognito, Netlify hosting, the governed-memory boundary, and
the seeded salon company. Let an owner choose a company-wide Fast, Balanced, or
Best quality model tier from Workspace settings without exposing credentials or
accepting arbitrary provider model IDs from the browser.

**Affected files:** Model and knowledge-index composition; company schema,
repository persistence, owner settings service/API/UI; OpenAI configuration and
smoke coverage; Bedrock adapters, dependencies, scripts, tests, diagrams, and
active deployment/product documentation. Historical decisions remain recorded
and are marked superseded rather than erased.

**Implementation steps:**

- [x] Add the OpenAI Responses API gateway for every `ModelGateway` operation,
  with strict structured outputs, Zod validation, citation filtering, bounded
  timeout/retry behavior, safe metadata, and no fixture fallback in OpenAI mode.
- [x] Make model provider selection independent from persistence, use the
  repository index with local or DynamoDB memory storage, and remove all active
  Bedrock Runtime, Knowledge Base, S3 Vectors, quota, and configuration paths.
- [x] Persist the provider-neutral `FAST | BALANCED | BEST` tier on the company,
  expose an owner-only settings API, and add the plain-language selector to the
  existing Workspace secondary settings surface.
- [x] Replace AWS/Bedrock smoke and release documentation with an OpenAI smoke
  across the three configured models, update the durable ADRs/specs/runbooks,
  and keep MCP/ChatGPT acceptance outside this migration gate.
- [x] Run focused security/provider/settings tests, then lint, strict types, all
  unit tests, production build, the full browser suite, and live OpenAI smoke.

**Implementation and verification (2026-07-12):** The official OpenAI SDK now
implements all seven model operations through the Responses API with strict
Structured Outputs, Zod/business validation, one schema-repair attempt, one
bounded transient retry with jitter, safe provider metadata, and server-side
citation filtering. Every operation resolves the current company tier before
the request. OpenAI mode has no fixture or model fallback. Operations SOPs with
no validated approved source fail safely, and retryable turns retain a stable
idempotency key, reject changed request bodies, avoid orphaned provider-failure
turns, and replay stored SOP/grounding data without regeneration. DynamoDB uses
a strongly consistent message read for that immediate replay boundary.

The active Bedrock Runtime, Knowledge Base, S3 Vectors, SDK, adapter, test,
smoke, skill, and configuration paths are removed. DynamoDB remains structured
truth, private S3 remains source retention, Cognito remains hosted identity, and
`RepositoryKnowledgeIndex` searches approved local or DynamoDB records. ADR-038
supersedes the applicable Bedrock decisions while their historical text remains.

`pnpm smoke:openai` passed Fast (`gpt-5.6-luna`), Balanced
(`gpt-5.6-terra`), and Best quality (`gpt-5.6-sol`). The semantic live browser
proof passed the complete Marketing suggestion → owner approval → approved
retrieval → compliant promotion → grounded SOP → cited employee answer loop on
all three tiers (3/3). The final deterministic release gates pass: `pnpm lint`,
`pnpm typecheck`, 31 unit-test files and 134 tests, `pnpm build`, and
`pnpm test:e2e` with 10 journeys passed and the three credential-gated live
journeys intentionally skipped. Owner settings, employee rejection, persistence,
reset-to-Balanced, model routing, provider failure, retry replay, source/citation
filtering, prompt injection, and tenant/role isolation all have focused coverage.
The final independent pre-landing audit and `git diff --check` found no remaining
migration blocker.

**Deployment gate (2026-07-12):** The linked Netlify production configuration
now has the non-secret `APP_MODE=aws`, `MODEL_PROVIDER=openai`, model-tier,
durable-waitlist, and `AUTH_MODE=cognito` values; its existing DynamoDB, S3,
AWS, Auth.js, and Cognito configuration is present. Netlify still has no
server-only `OPENAI_API_KEY`. Credential policy correctly prevented copying the
local key into a third-party service automatically, so no draft or production
deploy was performed and no hosted claim is made. The current public root and
demo-login routes remain HTTP 200. After the owner adds the key directly in the
Netlify dashboard, create a draft with the production context, run the hosted
Balanced salon journey, promote only if it passes, then remove the now-unused
historical Bedrock environment variables.

**Rollback:** Revert the migration as one reviewed change. Restore the prior
Bedrock adapters and environment contract only through an explicit revert; do
not silently select fixtures or another model when an OpenAI request fails. No
existing DynamoDB company records or S3 source objects are deleted or rewritten
by this migration.

## Active checkpoint: hackathon submission README

**Outcome:** Replace the obsolete kickstart-pack README with a judge-facing
project overview that presents the working product, makes the governed-memory
demo reproducible, links directly to the seeded demo, and distinguishes verified
local behavior from the AWS/ChatGPT path that still requires live acceptance.

**Affected files:** `README.md`, three real product screenshots under `docs/assets/`,
and this plan. Runtime code, demo state, deployment configuration, and cloud
resources are unchanged.

**Implementation steps:**

- [x] Audit the existing README against the canonical product, UX, architecture,
  security, backlog, decision, and current verification records.
- [x] Rewrite the narrative around the product promise, approval boundary,
  exact 15% cross-role proof, runtime modes, local setup, and repository guide.
- [x] Capture a real screenshot from the deterministic local suggestion flow and
  replace the illustrative brand board in the README.
- [x] Capture the deployed landing page's complete first section and place it at
  the top of the README while keeping the approval screenshot with the demo.
- [x] Capture the deployed owner Playbook without changing demo knowledge and
  add it beside the README explanation of visible, approved company knowledge.
- [x] Validate links and Markdown hygiene; run lint, typecheck, unit tests,
  production build, and the complete browser suite.

**Verification (2026-07-12):** The documented public site and seeded `/login-demo`
route both return HTTP 200, and the live demo page exposes Maya with no password.
The new `docs/assets/governed-memory-demo.png` is a 1440×800, 132 KB real local
capture of the 15% suggestion awaiting approval. All referenced local files
exist; `git diff --check`, `pnpm lint`, `pnpm typecheck`, all 30 unit-test files
and 116 tests, `pnpm build`, and all nine Chromium product journeys pass. The
browser suite independently re-proved the exact Marketing → approval → Operations
→ Employee flow described in the README.

The follow-up `docs/assets/landing-page-hero.png` is a 1376×997 element-level
capture of the live HTTP 200 landing hero at a 1440 px desktop viewport. It
includes the public navigation, product promise, CTA, approved-company-truth
visual, and the five-step governed-memory loop without including the second
landing section. A clean reload produced no console errors, and every fresh page,
font, stylesheet, script, and prefetched route request returned HTTP 200.

The final `docs/assets/playbook-page.png` is a 1440×900 deployed-demo viewport
showing the approved-only Playbook, company/department hierarchy, topic views,
scope, and version metadata. Maya's seeded owner session was used read-only; no
company knowledge or demo state was changed. The page and API calls returned
HTTP 200 and the browser reported no console errors.

**Rollback:** Restore the previous `README.md`, remove the three screenshots, and
delete this checkpoint. No application data or external state requires rollback.

## Active checkpoint: secondary link-button contrast

**Outcome:** Keep secondary link-buttons readable when they appear inside a
light-on-dark container, including the dashboard's `New conversation` action.

**Affected files:** Global anchor/button cascade, the dashboard action classes,
the focused workspace browser regression, and this plan.

**Implementation steps:**

- [x] Add a browser assertion for the rendered foreground and background colors.
- [x] Remove the unlayered anchor color override so the button component color wins.
- [x] Remove the ineffective one-off utility override from the dashboard action.
- [x] Run focused browser verification, lint, typecheck, tests, and build.

**Verification (2026-07-11):** The browser regression first failed with the
actual white foreground (`rgb(255, 255, 255)`), then passed after the cascade
fix with cobalt-deep text (`rgb(18, 49, 138)`) on the surface background
(`rgb(255, 253, 248)`). Focused E2E, lint, typecheck, and production build pass.
The full unit run passed 113 of 114 tests; the unrelated, concurrently changed
repository knowledge-index test expects score `2` but receives `3`. Production
deployment was intentionally not run while that repository-wide gate is red and
the working tree contains unrelated changes. The current live Netlify CSS was
confirmed to still contain the pre-fix unlayered anchor color override.

**Rollback:** Restore the global anchor color declaration and the prior dashboard
class. No data, authentication, or infrastructure state changes.

## Active checkpoint: consolidate Codex work and assess demo readiness

**Outcome:** Preserve all intentional repository work, verify the current product
against the complete salon demo and trust requirements, resolve any verified
release blockers, consolidate every `codex/*` branch into `main`, and publish the
result to GitHub without force-pushing or dropping history.

**Affected files:** This live plan plus only files required to fix verified
pre-landing findings; local `codex/*` and `main` refs; `origin/main`. Existing
AWS resources, Netlify state, credentials, and application data are not changed.

**Implementation steps:**

- [x] Audit the current implementation and tests against all ten salon-demo steps,
  the P0 backlog, security boundaries, and the latest durable decisions.
- [x] Inspect every local and remote `codex/*` branch, confirm ancestry and merge
  order, and review all tracked and untracked work for secrets or generated noise.
- [x] Run focused pre-landing review, fix verified blockers, and execute lint,
  typecheck, unit tests, production build, E2E, and diff-hygiene checks.
- [x] Commit the complete intentional working tree, fast-forward or merge it into
  `main`, verify the final tree, and push `main` to GitHub.
- [x] Record exact verification, commit, push, remaining demo gaps, and rollback
  evidence in this checkpoint.

**Pre-landing review (2026-07-11):** The deterministic local product implements
and passes the complete ten-step salon proof: load the company, teach Marketing
the 15% maximum and free-add-on preference, review and approve the suggestion,
persist and retrieve approved truth, generate a compliant promotion and SOP, and
answer an employee's 25%-off question with the approved source and rationale.
The review also fixed role and company-scope leaks, historical-version exposure,
irrelevant retrieval, unsupported citations, secret retention, source-less SOPs,
import retention, demo reset scope, public waitlist durability, and the missing
prompt-injection regression.

**Verification before integration (2026-07-11):** Focused trust and persistence
regressions pass (10 files, 61 tests). `pnpm lint`, `pnpm typecheck`, all 116 unit
tests, `pnpm build`, all nine Playwright flows, `git diff --check`, and the full
comparison against `origin/main` pass. The secret scan found only deliberately
fake credentials in screening tests. `deno.lock` was confirmed as unrelated
generated output and excluded. There is one worktree, no stash, and no remote
`codex/*` branch; both local Codex branches started from the same commit already
contained by local `main`.

**Integration evidence (2026-07-11):** The reviewed tree was committed on
`codex/onboarding-proof-first` as `52d46d2` (`feat: consolidate the demo-ready
product`). `codex/aws-vertical-slice` was already an ancestor at `8c0087b`, so
no divergent change or conflict needed resolution. `main` fast-forwarded to
`52d46d2` and was pushed to `origin/main`; the local and GitHub refs then matched
exactly with divergence `0 0`. Both local `codex/*` branches are reported as
merged into `main`. No force-push, branch deletion, stash mutation, deployment,
or cloud-data change was performed.

**Remaining demo gaps:** The local competition path is demo-ready, but the
hosted AWS plus private ChatGPT claim remains gated by a successful live AWS
smoke, Bedrock quota and prompt-injection evaluation, Cognito/OAuth browser
proof, and ChatGPT's exact three-tool acceptance sequence. Before broad public
launch, add edge rate limiting for the waitlist. Before treating hosted reset as
reliable, delete or quarantine its derived S3 and Bedrock documents. Chat turns
also need resumable state so a retry can recover after a mid-turn provider
failure. The presenter script should be reconciled with the canonical salon
sequence before recording the final demo.

**Rollback:** Keep the consolidated commit reachable from its `codex/*` branch.
If a post-merge issue appears, create an explicit revert commit on `main`; do not
rewrite or force-push shared history. No cloud or production-data rollback is
required for this repository-only consolidation.

## Active checkpoint: waitlist-aligned landing story

**Outcome:** Make the public landing page tell one honest conversion story while
registration remains closed: visitors understand the product through the
concrete company-rule proof, then join the waitlist instead of entering the demo
or seeing public demo controls.

**Affected files:** Landing component and landing-only styles; public header and
focused Home/browser assertions; durable product, UX, design, and decision
documentation; this live plan. Existing waitlist persistence, invited-user sign
in, product routes, and demo data remain unchanged.

**Implementation steps:**

- [x] Route every anonymous landing-page primary action to `/waitlist` with the
  label `Join the waitlist`; retain `Sign in` for invited users.
- [x] Tighten the hero explanation, add a private-beta expectation, move the
  concrete company-rule proof directly below the hero, and remove the public
  demo-controls link.
- [x] Merge the repeated approval and AI-trust sections into one shorter
  governed-memory explanation.
- [x] Update focused unit/browser assertions and the superseding public-CTA
  decision, then run lint, typecheck, tests, build, and responsive live QA.

**Verification (2026-07-11):** `pnpm lint`, `pnpm typecheck`, all 107 unit tests,
`pnpm build`, and the two focused public landing/waitlist Playwright flows pass.
Responsive local QA passed at 375, 768, and 1280 pixels. The browser flow also
found and verified the fix for the Demo mode badge intercepting the header CTA;
the badge now sits outside the header at the bottom-right and ignores pointer
events. Netlify deploy `6a527186a64fe8a011396055` is live at
`https://my-little-company-demo.netlify.app`. Live DOM verification confirms all
three main CTAs point to `/waitlist`, the concrete proof follows the hero, and no
public demo-control link remains. An independent Playwright capture confirmed the
public visual render after the audit browser produced a corrupted screenshot.

**Rollback:** Restore the prior `Start a company project` links and section order,
reinstate the standalone trust section and demo-controls link, and revert the
associated assertions and documentation together. No waitlist records, accounts,
memberships, or deployment secrets are changed by this checkpoint.

## Active checkpoint: separate Cognito and demo login entry points

**Outcome:** Move the seeded local account picker from `/login` to
`/login-demo`, and make `/login` a focused, invite-only entry point that hands
authentication, password recovery, and account recovery to Amazon Cognito
Managed Login through the existing Auth.js provider.

**Affected files:** Login routes and shared return-path handling, protected-route
redirect behavior, browser coverage, authentication UX/product decisions,
environment guidance, and this plan. Existing identity providers, membership
authorization, Cognito resources, and company data remain unchanged.

**Implementation steps:**

- [x] Add `/login-demo` with the existing seeded account picker and make its
  demo-only purpose explicit.
- [x] Replace `/login` with a branded Cognito Managed Login handoff, safe error
  copy, closed-registration guidance, and a truthful local-mode fallback.
- [x] Route unauthenticated demo traffic to `/login-demo` while keeping Cognito
  traffic on `/login`; preserve validated same-origin return paths.
- [x] Update browser tests and durable UX/decision documentation for the split.
- [x] Run focused tests, then lint, typecheck, unit tests, build, E2E, and diff
  hygiene; record verification results and remaining risks.

**Verification:** Focused login-navigation tests; `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, `pnpm test:e2e`, and `git diff --check`. A real
Cognito browser smoke remains environment-dependent and must not be reported as
passed without completing Managed Login.

**Verification results (2026-07-11):**

```text
Focused navigation tests: PASS (4 tests)
pnpm lint:              PASS
pnpm typecheck:         PASS
pnpm test:              PASS (27 files, 105 tests)
pnpm build:             PASS (/login and /login-demo both emitted)
Focused login E2E:      PASS (3 tests, including the route split)
Full pnpm test:e2e:     UNSTABLE under concurrent workspace edits
Scoped git diff check:  PASS
Real Cognito smoke:     NOT RUN (current environment is demo mode)
```

The login-separation browser test passed on every run. The latest full suite ran
nine tests and passed seven, including the login test, but failed one onboarding
navigation and one salon response assertion while Next.js reported a Fast
Refresh full reload. Files and tests from the separate Bedrock/workspace work
changed during verification, including a new browser spec appearing between full
runs. A prior full run passed seven of eight and failed at a different salon
step after a development-server JSON parse error. These failures are not being
treated as login regressions or reported as a passing full E2E gate. Repo-wide
`git diff --check` also reports pre-existing trailing blank lines in concurrently
restored Bedrock files; every file scoped to this login checkpoint is clean.

**Login-page refinement (2026-07-11):** Remove the secure-handoff explanation
and local demo-access callout from `/login`. Replace them with one validated
email field that passes the address to Cognito as an OAuth `login_hint`;
Cognito continues to handle authentication. Keep `/login-demo` available only
through its direct route and demo-mode protected-route redirects.

**Refinement verification:** Targeted lint, typecheck, four focused navigation
tests, production build, and the focused login browser test pass. Repository-wide
lint remains blocked by the concurrent `react-hooks/set-state-in-effect` finding
in `src/components/waitlist-form.tsx`; the login files are clean.

**Rollback:** Restore the combined environment-aware `/login` page, point demo
protected-route redirects back to `/login`, remove `/login-demo`, and revert the
route-specific tests and documentation. No identity or company data migration is
required.

## Active checkpoint: reliable Netlify rebuild and favicon

**Outcome:** Redeploy the current public site without rotating the production
session secret, and expose the existing four-fragment brand mark as the browser
favicon.

**Affected files:** Environment normalization, focused environment tests, root
metadata, and this plan. No production secret value, authentication mode, or
company data changes.

**Implementation steps:**

- [x] Treat provider-masked secrets shorter than their contract or redacted with
  asterisks as unavailable during optional local/demo builds while preserving
  required-mode failures.
- [x] Add the existing SVG brand mark to Next.js favicon metadata.
- [x] Run focused tests and the production build.
- [x] Deploy to Netlify production and verify the live favicon, homepage, and waitlist.

**Verification (2026-07-11):** `pnpm lint`, `pnpm typecheck`, all 90 unit tests,
the focused six-test environment suite, and `pnpm build` pass. Netlify deploy
`6a526976dde9e769b6744bd2` is live at
`https://my-little-company-demo.netlify.app`. The public homepage and `/waitlist`
return `200` and emit both `icon` and `shortcut icon` links to
`/brand/mlc-app-icon.svg`; the SVG returns `200` as `image/svg+xml`. No production
secret was changed or rotated.

**Rollback:** Restore exact-empty-only secret normalization and remove the icon
metadata. The prior successful Netlify deployment remains available for rollback.

## Superseded checkpoint: remove Bedrock and simplify the runtime

Superseded by the presenter-approved hosted AWS and ChatGPT checkpoint and
ADR-035. Preserve this section as decision history; do not execute its removal
steps.

**Outcome:** Stop treating AWS AI/ML as a competition requirement. Remove the
Amazon Bedrock model and Knowledge Base implementations, configuration, tests,
smoke path, and setup guidance. Keep the governed-memory product loop unchanged:
human approval remains authoritative, deterministic fixture behavior handles the
demo, and a small repository-backed lexical index makes approved knowledge
available without embeddings or external model capacity.

**Affected files:** Composition and environment configuration; model/index
adapters and focused tests; package dependencies and scripts; repository working
agreements; product, architecture, data, security, build, deployment, demo, and
decision documentation. Existing DynamoDB, S3, Cognito, waitlist, OAuth/MCP,
domain, and UI work remains in place unless a Bedrock-specific dependency makes a
targeted adjustment necessary.

**Implementation steps:**

- [ ] Add a superseding architecture decision and align durable product truth
  with the local-first, provider-neutral direction.
- [ ] Replace the Bedrock model/index composition with the fixture model and a
  repository-backed lexical index in every runtime mode.
- [ ] Remove Bedrock SDK packages, adapters, tests, environment variables, AWS
  smoke scripts, and obsolete Knowledge Base handoff material.
- [ ] Update customer-facing search wording and deployment/demo guidance so no
  surface claims Bedrock, vectors, embeddings, or a real model-backed path.
- [ ] Run focused tests, then `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm build`, and `git diff --check`; record results and remaining risks.

**Verification:** Repository/index and environment tests; full lint, typecheck,
unit, and production-build checks; `git diff --check`. The existing local E2E
salon journey remains the acceptance proof when browser execution is available.

**Rollback:** Restore the removed Bedrock adapters, dependencies, tests, scripts,
and documentation together, then reinstate the prior environment contract. No
AWS resource is modified or deleted by this checkpoint.

## Active checkpoint: tomorrow-ready hosted AWS and ChatGPT demo

**Outcome:** Turn the already verified product and connector code into one
resettable filmed demo running on real Bedrock, DynamoDB, private S3, Bedrock
Knowledge Bases with the existing S3 Vectors index, Cognito, Netlify, and a
private ChatGPT Developer Mode app. Preserve local mode as an explicitly labelled
fallback; never simulate a successful external connection.

**Affected files:** AWS demo bootstrap and package scripts; deployment, AWS,
ChatGPT, demo-script, backlog, and live-plan documentation; focused bootstrap
tests where practical. Existing domain types, public routes, seven memory types,
and MCP tool contracts remain unchanged.

**Implementation steps:**

- [x] Add an idempotent AWS demo bootstrap that creates the demo company profile
  and seeded demo memberships without overwriting approved knowledge.
- [x] Make Cognito owner bootstrap fail clearly when the company profile has not
  been created, preventing an orphaned membership.
- [ ] Provision and verify the missing DynamoDB, Bedrock Knowledge Base/data
  source, Cognito, runtime-identity, and Netlify resources using the existing S3
  bucket, S3 Vectors index, Nova Lite, and Titan Embeddings V2 configuration.
- [ ] Run the real AWS smoke and AWS-backed browser flow, then verify public OAuth
  discovery, MCP authentication, Cognito login, reset/reload persistence, and the
  exact ChatGPT search/fetch/suggest contract.
- [x] Replace the broad demo script with the agreed onboarding, chat, approval,
  Playbook version, and ChatGPT sequence; record truthful fallback and post-demo
  credential cleanup instructions.

**Current evidence (2026-07-11):** local lint, typecheck, 105 tests, production
build, nine browser tests against the stable production server, and diff hygiene
pass. DynamoDB
`my-little-company-demo` is active with `GSI1` and TTL;
`bootstrap:aws-demo` is idempotent and produced only one profile plus four demo
memberships. Cognito pool, confidential client, managed-login domain, confirmed
Maya owner, and OAuth JWK exist. Knowledge Base `U5Z8X6SINM`, no-chunking data
source `Z575GQ7BCZ`, the exact-trust Bedrock service role, and the dedicated
Netlify runtime user/key exist. App-specific AWS credentials are stored as
non-readable Netlify production secrets because Netlify reserves the standard
AWS credential names.

The AWS smoke gate failed before writing disposable data because Nova returned
`Too many tokens per day`. Initial Knowledge Base ingestion also received Titan
429 throttling. Per the fallback ladder, the public deployment remains
`APP_MODE=local`, `AUTH_MODE=demo`, `MCP_ENABLED=false`, and visibly labelled
**Demo mode**. Verified fallback deploy `6a527036d813d38f9b86c536` is live at
`https://my-little-company-demo.netlify.app`; `/mcp` truthfully returns `404`.
The ignored `.env.local` contains only the AWS profile and non-secret resource
IDs, and `pnpm smoke:aws` loads it automatically for the next quota-window retry.
The permanent Cognito authorize URL accepts the exact Netlify callback and
redirects to managed login. The local browser hydration race found during final
verification is fixed by keeping onboarding and waitlist controls disabled until
hydration. ADR-035 supersedes the conflicting Bedrock-removal decision.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
`pnpm smoke:aws`, `AUTH_MODE=demo pnpm test:e2e:aws`, `pnpm test:e2e`, public
OAuth/MCP endpoint checks, manual Cognito sign-in, ChatGPT search/fetch/suggest,
and `git diff --check`.

**Rollback:** Disable `MCP_ENABLED`, return the app to `APP_MODE=local` and
`AUTH_MODE=demo`, unlink or remove only the new Netlify demo site, and delete only
resources created for this checkpoint. Existing S3 source/vector buckets,
approved local data, and application contracts remain untouched. Rotate or
delete any disposable Netlify AWS access key immediately after the presentation.

## Active checkpoint: hackathon AWS architecture refresh

**Outcome:** Replace the broad implementation-oriented architecture document with
a judge-readable, hackathon-first schema that keeps AWS visibly central to the
governed-memory loop: Bedrock Converse for generation, DynamoDB for approved
truth, S3 for canonical documents, and Bedrock Knowledge Bases backed by S3
Vectors for derived retrieval. Record an evidence-based critique and the
improvements required before the real-AWS smoke test.

**Affected files:** `docs/ARCHITECTURE.md`, this plan, and a rendered architecture
diagram under `diagrams/`. No application behavior, AWS resource, credential, or
deployment change is in scope.

**Implementation steps:**

- [x] Reconcile the actual ports, AWS adapters, data model, security boundaries,
  and current Bedrock/Knowledge Base guidance into one concise architecture.
- [x] Render a source-controlled architecture diagram that distinguishes the
  approval write path, derived indexing path, and grounded retrieval path.
- [x] Critique current complexity and reliability risks; adopt only improvements
  that strengthen the live demo without broadening product scope.
- [x] Record the resulting architecture target and verify the document,
  Mermaid source, rendered artifacts, and repository diff are internally
  consistent.

**Verification:** Inspect the rendered diagram, validate Mermaid rendering,
review the revised architecture against the existing ports and adapters, and run
`git diff --check`. This documentation-only checkpoint does not alter runtime
code, so the existing application verification evidence remains authoritative.

**Rollback:** Revert only this checkpoint's documentation and diagram artifacts.
The application, AWS account, and existing canonical memory data remain unchanged.

**Verification results (2026-07-11):** The refreshed schema was checked against
the current composition root, MemoryService, retrieval service, Bedrock model
gateway, Knowledge Base adapter, data model, and security constraints. Current
Bedrock documentation was consulted through Context7. Mermaid rendered
successfully into an editable Excalidraw scene plus SVG and PNG, and the PNG was
visually inspected. `git diff --check` passes. This checkpoint identifies, but
does not implement, two follow-up hardening changes: separate approval confirmation
from indexing work and use a stable current search document rather than one
search document per immutable version.

## Active plan: MVP vertical slice

### Current checkpoint: pooled multi-company isolation hardening

**Outcome:** Keep the hackathon's shared DynamoDB, S3, and Bedrock Knowledge Base
foundation while making company scope part of every business-data partition key
and rejecting incomplete or cross-company retrieval metadata before structured
hydration. Two companies must be able to reuse the same parent and child IDs
without overwriting, listing, or retrieving one another's data.

**Affected files:** AWS DynamoDB and Bedrock Knowledge Base adapters; AWS smoke
script; focused DynamoDB/retrieval tests; architecture, data-model, security,
project-memory, decision, backlog, and live-plan documentation.

**Implementation steps:**

- [x] Prefix message and memory-version partitions with the trusted `companyId`
  while preserving existing repository interfaces and access patterns.
- [x] Update demo reset and AWS smoke cleanup for the new tenant-prefixed child
  partitions without adding runtime table scans.
- [x] Make Knowledge Base hit validation fail closed when required company,
  approval, role, sensitivity, memory, or version metadata is absent or malformed.
- [x] Add collision fixtures that deliberately reuse conversation, message,
  memory, and version identifiers across two companies.
- [x] Record the pooled-isolation decision and run focused verification.
- [x] Run the complete unit, production-build, and browser verification suite.

**Verification:** Focused DynamoDB and retrieval tests, then `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`, and
`git diff --check`. Real AWS smoke remains subject to the already documented
external resource and quota blockers.

**Rollback:** Revert this checkpoint's key builders, smoke keys, strict metadata
checks, tests, and documentation together. No remote migration or AWS resource
mutation is performed. The repository has no production data migration in scope;
seeded/demo data can be recreated after the key-shape change.

**Verification results (2026-07-11):** Focused isolation/retrieval tests PASS
(3 files, 24 tests); `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS
(24 files, 93 tests); `pnpm build` PASS (Next.js 16.2.10, webpack);
`pnpm test:e2e` PASS (6 Chromium journeys); `node --check
scripts/smoke-aws.mjs` PASS; old unprefixed child-key audit PASS; `git diff
--check` PASS. The first sandboxed browser run could not bind localhost port
3000 (`EPERM`); the approved non-sandboxed rerun passed. Real AWS smoke was not
run because it mutates configured cloud resources and the existing AWS
resource/quota blockers remain outside this checkpoint.

### Current checkpoint: proof-first company onboarding

**Outcome:** Give an already signed-in owner a guided path from one pasted or
selected ChatGPT conversation to source-backed knowledge suggestions, explicit
approval, and a proof answer that cites at least one memory approved during the
same onboarding session. The answer may use the structured-memory fallback while
Knowledge Base indexing is still updating, but the UI must not claim search is
ready.

**Affected files:** Onboarding/import domain types, schemas, repositories,
services, local/AWS composition, prompts, and route contracts; workspace and
Playbook entry points; session-based onboarding pages and client-side ChatGPT
export parsing; focused unit/component/E2E tests; canonical product, UX,
architecture, data, security, API, backlog, and decision documentation.

**Implementation steps:**

- [x] Add source-provider, onboarding-session, import-batch, and imported-item
  schemas plus explicit lifecycle and retention rules.
- [x] Add import/source repository contracts and local/AWS persistence without
  changing the existing seven memory types or five Playbook presentation groups.
- [x] Add bounded paste and selected ChatGPT-conversation normalization,
  multi-candidate extraction, ranking, conflict classification, leases,
  cancellation, idempotency, and structured proof retrieval.
- [x] Add owner-scoped session/import/proof/source-deletion APIs with safe error
  envelopes and company isolation.
- [x] Add workspace and empty-Playbook entry points plus Goal, Source, Review,
  and Prove onboarding screens with resume, empty, loading, failure, and mobile
  states.
- [x] Add parser, lifecycle, security, service, UI, and end-to-end coverage; then
  run all required verification commands and record results here.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`. The E2E path must prove an owner imports one selected source,
approves one item, receives a cited answer using that newly approved memory, and
sees indexing status separately. AWS smoke remains explicit and may be blocked
only by missing external resources already documented for this repository.

**Rollback:** Remove the onboarding entry points, routes, services, adapters,
and additive DynamoDB/S3 item types. Existing company, conversation, candidate,
memory, membership, OAuth, and index records remain valid; no destructive
migration or automatic approval is introduced.

**Verification results (2026-07-11):** `pnpm lint`, `pnpm typecheck`, `pnpm test`
(24 files, 84 tests), `pnpm build`, and `pnpm test:e2e` (6 Chromium journeys)
pass. Paste and selected-ChatGPT onboarding both approve a 15% policy and produce
a cited proof answer; mobile width and the original salon loop also pass.
`node --check scripts/smoke-aws.mjs` and `git diff --check` pass. The real AWS
smoke path now includes the onboarding extraction prompt plus Knowledge Base
ingestion/retrieval, but could not run locally because `AWS_REGION`, model,
Knowledge Base/data source, DynamoDB table, and S3 bucket configuration are not
present in the shell environment.

### Current checkpoint: private ChatGPT app package

**Outcome:** Package the existing tool-only MCP connector as a polished private
ChatGPT Developer Mode app named **My Little Company**, with clear server identity,
ChatGPT-oriented tool-selection metadata, branded icon, OAuth/DCR setup, test
prompts, and an operator handoff for creating and refreshing the Draft app.

**Archetype:** `tool-only`. The governed knowledge flow benefits from native
ChatGPT narration and citations; an iframe widget would duplicate Review and
weaken the product boundary that approval happens inside My Little Company.

**Affected files:** MCP server identity and tool descriptors; branded public app
icon; ChatGPT app setup documentation and tests; README and live plan.

**Implementation steps:**

- [x] Add ChatGPT-visible app title, description, icon, concise instructions,
  action-oriented tool descriptions, argument descriptions, and invocation text.
- [x] Preserve the standard company-knowledge `search`/`fetch` schemas and keep
  `suggest_company_knowledge` as the only confirmed write.
- [x] Prepare the exact Draft app profile, Developer Mode setup steps, OAuth
  expectations, test prompts, refresh procedure, and deployment prerequisites.
- [x] Verify the local MCP app contract, OAuth flow, full test/build/E2E suite,
  and identify any external step that requires a deployed HTTPS origin.

**Rollback:** Remove only ChatGPT-facing identity assets and metadata. The
client-neutral MCP/OAuth service and all company knowledge remain unchanged.

**Verification results (2026-07-11):** Static contract review confirms the
`tool-only` archetype, exact standard `search`/`fetch`, one confirmed suggestion
write, OAuth metadata, server title/description/icon, and no unnecessary UI
resource. `pnpm lint` PASS; `pnpm typecheck` PASS; `pnpm test` PASS (22 files,
72 tests); `pnpm build` PASS; `pnpm test:e2e` PASS (4 Chromium tests); authenticated
Streamable HTTP initialization and real tool-call tests PASS; `git diff --check`
PASS.

**External creation status:** The Draft app was not created in a ChatGPT account.
The repository has no configured homepage or GitHub deployment and no public
HTTPS MCP origin is present in the workspace environment. `docs/CHATGPT_APP.md`
contains the exact profile and creation sequence once a deployment URL exists.

### Current checkpoint: client-neutral MCP interoperability

**Outcome:** Make the remote connector work with any compatible MCP client—not
only ChatGPT and Codex—while preserving exact redirect binding, PKCE, explicit
consent, and membership-owned authorization. Verify Claude Code, Gemini CLI, and
Kiro configuration paths against their current official documentation.

**Affected files:** OAuth client/authorization validation and consent copy; OAuth
tests; connector setup documentation; security, architecture, and decision
language.

**Implementation steps:**

- [x] Replace product-name callback allowlists with protocol-based HTTPS and
  native loopback rules; continue rejecting insecure remote callbacks.
- [x] Show the registered client and return host during consent.
- [x] Add generic-client and regression coverage without weakening PKCE,
  resource binding, scope checks, or live membership resolution.
- [x] Document ChatGPT, Codex, Claude Code, Gemini CLI, Kiro, and the generic
  compatibility contract.
- [x] Run lint, typecheck, unit tests, build, E2E, and diff validation.

**Rollback:** Restore the narrower callback allowlist. Existing OAuth clients,
tokens, memberships, candidates, and approved knowledge require no migration.

**Verification results (2026-07-11):** `pnpm lint` PASS; `pnpm typecheck` PASS;
`pnpm test` PASS (22 files, 72 tests); `pnpm build` PASS; `pnpm test:e2e` PASS
(4 Chromium tests); `git diff --check` PASS. OAuth coverage accepts generic HTTPS,
IPv4/IPv6/localhost loopback callbacks and rejects insecure remote HTTP and
credential-bearing callbacks. Current official Claude Code, Gemini CLI, and Kiro
documentation confirms remote HTTP MCP and browser OAuth; Gemini and Kiro
explicitly document dynamic client registration.

### Current checkpoint: Cognito scoped access and two-way MCP integration

**Outcome:** Deliver two release gates on one authorization model: first, real
Cognito/Auth.js login with company/department `READ`, `SUGGEST`, and `APPROVE`
grants; second, a tool-only remote MCP endpoint that lets ChatGPT and Codex search
approved company knowledge and create source-backed suggestions without gaining
approval authority.

**Affected files:** Domain authorization and membership types/schemas; membership,
identity, OAuth, and repository ports plus local/AWS adapters; Auth.js/session and
API actor resolution; People & access UI; candidate/retrieval services; MCP/OAuth
routes; fixtures, tests, environment/deployment configuration, and canonical
product/security/architecture documentation.

**Implementation steps:**

- [x] Add scoped grants, membership persistence, centralized permission checks,
  seeded demo identities, and Cognito invitation administration.
- [x] Add Auth.js Cognito managed login, demo-session parity, server-owned actor
  resolution, and replace hard-coded route actors.
- [x] Enforce permission and conversation ownership checks across retrieval,
  suggestions, approval, company settings, and owner-only operations.
- [x] Add owner-only People & access administration without changing primary
  navigation.
- [x] Add the Cognito-backed MCP OAuth broker, token verification, and persisted
  OAuth client/code/refresh state.
- [x] Add the stateless `/mcp` route with standard `search`/`fetch` tools and an
  idempotent `suggest_company_knowledge` tool.
- [x] Reuse one validated, secret-screened, conflict-aware suggestion pipeline and
  complete explicit conflict resolution in Review.
- [x] Update configuration, setup, API/security/data/architecture decisions, and
  private ChatGPT/Codex connection instructions.
- [x] Run lint, typecheck, unit tests, build, E2E, and MCP contract/runtime checks.

**Verification:** Permission-matrix tests must cover the seeded owner,
contributor, approver, and reader. OAuth tests must cover discovery, redirect
validation, PKCE, resource/scopes, replay, refresh rotation, revocation, and
membership revocation. MCP tests must prove exact company-knowledge schemas,
approved-only retrieval, denied cross-scope access, idempotent suggestions, and
no approval tool. Completion requires `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`, and `pnpm test:e2e`, plus a local `/mcp` initialization/tool smoke.

**Rollback:** Set `MCP_ENABLED=false`, return `AUTH_MODE` to `demo`, remove the
new auth/MCP routes and adapters, and restore demo actor resolution. Existing
company, conversation, candidate, and memory records require no destructive
migration; suggestions created through MCP remain ordinary auditable candidates.

**Verification results (2026-07-11):** `pnpm lint` PASS; `pnpm typecheck`
PASS; `pnpm test` PASS (22 files, 72 tests); `pnpm build` PASS; `pnpm test:e2e`
PASS (4 Chromium tests). MCP contract coverage verifies the exact tool list and
schemas, no approval tool, an authenticated stateless Streamable HTTP
initialization, and a real tool call. OAuth coverage verifies callback allowlists,
PKCE/resource binding, code replay rejection, access-token validation, refresh
rotation, scope non-expansion, and production key configuration. `git diff
--check` PASS.

**Remaining deployment smoke:** Real Cognito email delivery, managed login,
ChatGPT Developer Mode, Codex OAuth, and the AWS-backed repository path require
the external resources and secrets documented in `docs/MCP_CONNECT.md` and
`docs/AWS_SETUP.md`; they were not simulated as successful.

### Current checkpoint: roadmap reconciliation for conversational knowledge

**Outcome:** Incorporate the strongest parts of the earlier knowledge-base review
into the scoped workspace: make the Playbook understandable by business topic,
show the approved knowledge connected to the current conversation, and ensure the
Operations Assistant follows the owner’s actual request.

**Affected files:** Playbook and chat workspace components and styles; model
gateway and Operations prompt inputs; focused unit/E2E tests; product, UX,
project-memory, backlog, and decision documentation.

**Implementation steps:**

- [x] Add five owner-friendly presentation groups over the existing seven memory
  types without creating a second taxonomy or changing authoritative records.
- [x] Add a collapsible conversation knowledge panel showing used sources, recent
  approved knowledge, and unresolved suggestions.
- [x] Pass the actual Operations request to local and Bedrock SOP generation.
- [x] Record which Slite/standards-inspired ideas are adopted now and which remain
  deferred.
- [x] Run lint, typecheck, unit tests, build, E2E, and responsive visual QA.

**Verification:** Category filtering, source-backed context display, Operations
request propagation, drawer accessibility, and mobile overflow must be covered.
Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`.

**Verification results (2026-07-11):** `pnpm lint` PASS; `pnpm typecheck` PASS;
`pnpm test` PASS (16 files, 44 tests); `pnpm build` PASS; `pnpm test:e2e` PASS
(3 tests). Desktop and mobile screenshots confirmed the context drawer and topic
navigation, and the mobile browser assertion found no horizontal overflow.

**Rollback:** Revert this checkpoint's presentation filters, context drawer,
Operations request input, tests, and ADR-026. The company/department hierarchy
and approved memory records remain unchanged.

### Current checkpoint: scoped knowledge workspace and persistent chat

**Outcome:** Make My Little Company feel like one coherent work environment: a
ChatGPT-style persistent conversation workspace, a Notion-like Company Playbook
organized by company and department, and a `/save-knowledge` command that turns
selected conversation context into an owner-confirmed, source-backed knowledge
page.

**Affected files:** domain types and schemas; conversation and memory repository
ports plus local/AWS adapters; conversation, company, and memory services and API
routes; the app shell, chat, assistant-ui, Playbook components, and global styles;
focused unit/component/E2E tests; product, UX, architecture, data-model, backlog,
and decision documentation.

**Implementation steps:**

- [x] Add a company-rooted organizational-unit hierarchy and distinct knowledge
  scope fields without weakening company, role, sensitivity, or approval checks.
- [x] Add conversation listing, reopening, title updates, and persisted message
  loading behind the existing `ConversationRepository`.
- [x] Replace the assistant-card chat shell with persistent thread history and a
  full-height, focused conversation surface.
- [x] Add `/save-knowledge` as a UI command that opens an owner confirmation form;
  never let a model execute approval directly.
- [x] Add owner-created knowledge pages and group the Playbook by company and
  department while preserving immutable versions and indexing truthfulness.
- [x] Update durable decisions and acceptance criteria for hierarchy, inheritance,
  persistent conversations, and the knowledge workspace.
- [x] Run lint, typecheck, unit tests, build, E2E, and desktop/mobile visual QA.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`. Browser verification must cover reopening a chat, using
`/save-knowledge`, manually creating a department page, company/department
retrieval isolation, mobile navigation, no horizontal overflow, and truthful
indexing status.

**Verification results (2026-07-11):** `pnpm lint` PASS; `pnpm typecheck` PASS;
`pnpm test` PASS (16 files, 44 tests); `pnpm build` PASS; `pnpm test:e2e` PASS
(3 tests). Desktop and mobile Chat plus desktop Playbook were visually inspected.
Webpack development mode is used because the current Turbopack development build
did not include newly appended global CSS; ADR-025 records that reliability choice.

**Rollback:** Revert only this checkpoint's scope fields, repository methods, API
routes, workspace components, styles, tests, and documentation. Existing approved
memory versions remain valid because legacy records default to company scope.

### Current checkpoint: customer-facing product naming

**Outcome:** Use “My Little Company” consistently in customer- and
judge-facing copy, while reserving “MLC” for internal code, technical identifiers,
and backlog ticket IDs.

**Affected files:** customer-facing landing, chat, review-card, and pitch copy;
focused UI tests; naming guidance in project and UX documentation.

**Implementation steps:**

- [x] Replace visible “MLC” abbreviations with “My Little Company.”
- [x] Keep internal component names, CSS hooks, data-part names, environment
  fixtures, and ticket IDs unchanged.
- [x] Record the naming rule in durable product and UX documentation.
- [x] Run focused tests, lint, typecheck, and a customer-facing copy audit.

**Verification:** No visible application or pitch-script sentence should use the
acronym. `pnpm lint`, `pnpm typecheck`, focused unit tests, and `git diff --check`
must pass.

**Rollback:** Revert only the naming-copy, test expectation, documentation, and
this checkpoint changes. No data, API, domain, or cloud behavior changes.

**Verification results (2026-07-11):**

```text
Customer-facing app copy audit: PASS (no visible “MLC” strings)
Pitch script copy audit:       PASS
Pitch deck render QA:          PASS (7/7 slides across both decks inspected at full size)
Pitch template fidelity:       PASS
Pitch overflow check:          PASS
pnpm lint:                     PASS
pnpm typecheck:                PASS
pnpm test:                     PASS (16 files, 42 tests)
pnpm build:                    PASS (Next.js 16.2.10, webpack)
pnpm test:e2e:                 PASS (2 Chromium tests)
git diff --check:              PASS
```

The fixed-width process card in the pitch uses “WE SUGGEST” rather than forcing
the full product name into a one-line slot. The same naming rule permits natural
contextual phrases such as “your company” and “the Playbook,” but never introduces
the acronym to customers or judges.

### Current checkpoint: AWS-backed salon vertical slice

**Outcome:** Preserve the verified local demo while adding production-capable
AWS adapters for Bedrock inference, DynamoDB state, S3 canonical documents, and
Bedrock Knowledge Base retrieval behind hardened ports.

**Implementation order:**

- [x] Use the existing Phase 0–1 baseline and create `codex/aws-vertical-slice`.
- [x] Harden repository atomicity, idempotency scope, retrieval hydration, errors, and composition.
- [x] Add validated local/AWS environment modes and server-only AWS SDK clients.
- [x] Implement Bedrock, DynamoDB, S3, and Knowledge Base adapters.
- [x] Add AWS smoke and E2E commands while preserving all local checks.
- [x] Update setup, deployment, architecture, decisions, backlog, and verification evidence.

**Verification:** Existing local commands remain mandatory. AWS commands are
implemented and unit-tested without credentials; real `smoke:aws` and AWS E2E
remain blocked until the documented console resources and credentials exist.

**Rollback:** Switch back to the initial Phase 0–1 commit. No AWS resource
creation or remote deployment is performed by this code implementation.

**Scope guard:** No conflict UX, imports, voice, sponsor integrations, billing,
additional assistants, or production authentication.

**Implementation note:** The earlier audit expected an unborn repository, but the
workspace already contained baseline commit `3efafd5` on `main` with `origin/main`.
That history was preserved; no remote was created, changed, or pushed.

**Current blockers:** Console provisioning, IAM credentials, Netlify Functions
variables, real AWS smoke/E2E, and redeployment require external account access.
MLC-014 and MLC-015 remain IN_PROGRESS until exercised against those resources;
MLC-016 is BLOCKED for the same reason.

**Verification results (2026-07-11):**

```text
pnpm lint:         PASS (0 warnings)
pnpm typecheck:    PASS
pnpm test:         PASS (14 files, 35 tests)
pnpm test:e2e:     PASS (2 Chromium tests, salon flow included)
pnpm build:        PASS (Next.js 16.2.10, webpack)
git diff --check:  PASS
pnpm smoke:aws:    BLOCKED (required AWS variables/resources absent; fail-fast validated)
pnpm test:e2e:aws: BLOCKED (same external AWS setup)
```

**AWS account bootstrap status (2026-07-11):** Local AWS access now uses the
`mlc-developer` profile in `us-east-1`, which assumes
`MyLittleCompanyDeveloperRole` through the login-only
`MyLittleCompanyDeveloperLogin` identity. The identity has no access keys; the
cached root CLI login was removed. Bedrock control-plane access, Knowledge Base
listing, DynamoDB listing, and S3 listing all pass, and Nova Lite plus Titan Text
Embeddings V2 report `ACTIVE`. A capped Nova Lite inference smoke is still
blocked because the new account's applied Nova Lite TPM and daily-token quotas
are both `0`. Quota request `1f6d3668cc8e49aaa0bcbfd00659422aagxiYgGT`
requests the minimum valid cross-region review value (`8,000,001`) and is
`CASE_OPENED` under AWS Support case `178377495500286`. Root-account MFA is
enabled (user-confirmed 2026-07-11). DynamoDB, S3,
Knowledge Base, Cognito, and deployment resources have not yet been provisioned.

### Completed checkpoint: Phase 0 Netlify-ready foundation

**Outcome:** Create the smallest deployable Next.js App Router foundation and make
Netlify deployment a repository-driven build with no dashboard-only build settings.

**Affected files:** `package.json`, `pnpm-lock.yaml`, framework configuration,
`src/app/`, `netlify.toml`, `.nvmrc`, `.env.example`, and deployment documentation.

**Implementation steps:**

- [x] Bootstrap a minimal pnpm Next.js App Router app without overwriting the existing spec assets.
- [x] Pin the package-manager and Node runtime expectations used locally and by Netlify.
- [x] Add a repository-owned Netlify build command and publish directory.
- [x] Document Git-connected deployment and required environment-variable setup.
- [x] Run lint, typecheck, tests, E2E smoke test, and a production build.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` must
pass. The production build must use only local-mode configuration and must not
require AWS or sponsor credentials.

**Rollback:** Revert only the files added or changed for this checkpoint. There
are no database, cloud-resource, or data migrations to undo.

**Scope guard:** This checkpoint does not add AWS adapters, authentication,
voice, website import, sponsor integrations, or Phase 1 product behavior.

**Verification results (2026-07-11):**

```text
pnpm install --frozen-lockfile: PASS
pnpm lint:                    PASS
pnpm typecheck:               PASS
pnpm test:                    PASS (2 files, 3 tests)
pnpm test:e2e:                PASS (1 Chromium test)
pnpm build:                   PASS (Next.js 16.2.10, static / route)
git diff --check:             PASS
```

**Remaining deployment step:** Connect the Git repository in Netlify and set the
documented local-mode environment variables. A remote deploy was not started
because no Netlify site or Git remote was placed in scope.

### Current checkpoint: Phase 1 local organizational-memory loop

**Outcome:** Complete the deterministic salon flow from Marketing conversation
through human-approved company knowledge to Marketing, Operations, and Employee
reuse, without external services.

**Affected areas:** `src/domain/`, `src/ports/`, `src/adapters/local/`,
`src/services/`, App Router pages and route handlers, UI components, fixtures,
unit/integration tests, and `e2e/salon-demo.spec.ts`.

**Verification:** Each domain boundary receives focused unit tests. Completion
requires `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and
`pnpm build`, followed by results recorded below.

**Rollback:** Revert Phase 1 files to the verified Netlify foundation. Runtime
state is process-local and can also be restored through the demo reset action.

**Scope guard:** Local adapters and deterministic fixtures only. No AWS,
authentication provider, voice, website import, sponsor integration, deployment,
or full conflict-resolution workflow.

### Outcome

Build a polished local-first vertical slice that proves the product loop before adding AWS infrastructure.

### Scope

- Next.js application shell.
- Demo salon company.
- Marketing chat.
- Deterministic local memory extraction.
- Suggested-knowledge review and approval.
- Approved-memory retrieval.
- Operations SOP generation.
- Employee policy question with source.
- Unit and end-to-end tests.

### Out of scope

- Authentication.
- Website import.
- Voice.
- Notion sync.
- Production multi-tenancy.
- Agent marketplace.
- Billing.
- Autonomous external actions.

### Planned steps

- [x] Inspect all project documents and note conflicts or missing decisions.
- [x] Initialize pnpm, Next.js App Router, TypeScript strict mode, and Tailwind.
- [x] Add linting, type checking, unit-test, E2E-test, and build commands.
- [x] Create the intended repository structure.
- [x] Implement domain types, Zod schemas, and state transitions.
- [x] Implement local repositories and deterministic model fixtures.
- [x] Seed the salon demo company and existing approved context.
- [x] Build navigation and page shells.
- [x] Build Marketing Assistant chat.
- [x] Build suggested-knowledge card and approval flow.
- [x] Build Playbook list and memory detail.
- [x] Build Operations Assistant SOP flow.
- [x] Build employee policy-question flow with source chips.
- [x] Add loading, empty, success, and failure states.
- [x] Add unit tests for critical domain rules.
- [x] Add the salon E2E demo test.
- [x] Run verification commands and record results.
- [x] Review scope and prepare the next AWS integration plan.

### Expected files

Codex should refine this list after scaffolding:

```text
src/app/
src/components/
src/domain/
src/services/
src/adapters/local/
src/adapters/aws/
src/lib/
src/prompts/
tests/
e2e/
```

### Verification

Record the exact result of each command:

```text
pnpm lint:       PASS
pnpm typecheck:  PASS
pnpm test:       PASS (8 files, 13 tests)
pnpm test:e2e:   PASS (2 tests; 4/4 with repeat-each=2 in serial mode)
pnpm build:      PASS (Next.js 16.2.10 webpack production build)
```

### Risks and mitigations

| Risk | Mitigation | Status |
|---|---|---|
| UI work starts before domain rules are clear | Implement schemas and state transitions first | Mitigated |
| AI behavior is nondeterministic during UI development | Use deterministic local fixtures first | Mitigated |
| Unapproved memory leaks into answers | Centralize retrieval eligibility in domain service and test it | Mitigated |
| AWS setup blocks product progress | Keep adapters behind interfaces; wire AWS after local loop | Mitigated |
| Scope expands into an agent platform | Enforce non-goals in `AGENTS.md` | Mitigated |

### Decisions made during execution

Add dated entries here and mirror durable decisions in `docs/DECISION_LOG.md`.

### Surprises and discoveries

- Next.js development route bundles did not reliably share one process-global demo store. The local adapter was changed to a file-backed store in development and remains isolated in memory during unit tests.
- Next.js 16.2.10 Turbopack compiled Phase 1 but failed while collecting API route data because of a Zod module-initialization error. The supported webpack production builder passes; ADR-013 records the temporary build choice.

### Outcome and remaining work

Phase 0 and Phase 1 are complete. The local salon flow resets, creates the owner
conversation, extracts one source-backed decision suggestion, requires explicit
owner approval, indexes it locally, reuses it in Marketing and Operations, and
answers the employee's 25%-off question with the approved source and rationale.

Remaining work begins at Phase 2: implement Amazon Bedrock, DynamoDB/S3, and
Bedrock Knowledge Base adapters behind the existing ports. The Netlify-hosted
local demo uses ephemeral file-backed state and may reset on a cold function;
durable deployed state requires the planned AWS adapters.

## Active parallel checkpoint: hackathon identity and five-minute pitch

**Outcome:** Lock the approved bold blue visual identity and deliver a three-slide
interactive pitch that uses no more than 90 seconds before handing off to the live
salon demo.

**Affected files:** `DESIGN.md`, `public/brand/`, and pitch deliverables under
`outputs/`. No application or Phase 2 implementation files are in scope.

**Implementation steps:**

- [x] Save the approved blue brand board as the visual reference.
- [x] Record the approved color, typography, logo, and motion rules in `DESIGN.md`.
- [x] Build three audience-facing slides with complete speaker notes.
- [x] Add a clickable local-demo handoff on the final slide.
- [x] Render and inspect every slide at full size.
- [x] Run presentation overflow/overlap checks and record verification.

**Verification:** Render all slides, inspect each slide and the deck montage, run
the presentation layout test, and confirm the exported PowerPoint contains three
slides plus speaker notes.

**Rollback:** Remove only the new brand and pitch artifacts and this checkpoint.
No runtime state, application code, or cloud resources are changed.

**Verification results (2026-07-11):**

```text
Artifact-tool slide render: PASS (3/3 slides inspected at full size)
LibreOffice-compatible render: PASS (3/3 slides inspected at full size)
slides_test.py: PASS (no overflow detected)
Speaker notes: PASS (notesSlide1 through notesSlide3 present)
Live-demo hyperlink: PASS (Marketing URL embedded on slide 3)
```

## Active parallel checkpoint: alternate chat-to-Playbook pitch

**Outcome:** Deliver a second three-slide pitch whose single clear message is:
owners chat normally, My Little Company notices durable business knowledge, a human approves it,
and the approved knowledge is saved to the company Playbook for reuse.

**Affected files:** One new PowerPoint deliverable under `outputs/` plus this plan
entry. The approved visual identity and existing pitch remain unchanged.

**Implementation steps:**

- [x] Add a minimal opening slide with the approved logo, product name, and promise.
- [x] Replace audience-facing “MLC” abbreviations with “My Little Company” across the app, pitch decks, demo script, and public project copy.
- [x] Show the valuable company rule inside a normal chat conversation.
- [x] Show explicit human approval before the rule enters the Playbook.
- [x] Show the saved rule reused by Marketing, Operations, and an employee.
- [x] Include speaker notes and a clickable live-demo handoff.
- [x] Render and inspect all slides, then run overflow verification.

**Verification:** Inspect artifact-tool and PowerPoint-compatible renders at full
size, confirm three speaker-note pages, verify the live-demo hyperlink, and run
the slide overflow test.

**Rollback:** Remove only the alternate deck and this checkpoint. No application
code, data, approved brand assets, or cloud resources are changed.

**Verification results (2026-07-11):**

```text
Artifact-tool render: PASS (4/4 slides inspected at full size)
PowerPoint-compatible render: PASS (4/4 slides inspected at full size)
slides_test.py: PASS (no overflow detected)
Speaker notes: PASS (notesSlide1 through notesSlide4 present)
Live-demo hyperlink: PASS (Marketing URL embedded on slide 4)
```

## Active checkpoint: application visual identity adaptation

**Outcome:** Bring the complete salon demo application into the approved
`DESIGN.md` identity so the live product feels like the same confident system as
the pitch: cobalt-led, editorial, warm, and visibly built around conversation
fragments becoming trusted company knowledge.

**Affected files:** `src/app/layout.tsx`, `src/app/globals.css`, visual components
under `src/components/`, and lightweight loading/error presentation. Domain,
service, repository, API, fixture, and AWS adapter behavior are out of scope.

**Implementation steps:**

- [x] Load Instrument Sans and Barlow Condensed through the App Router font API.
- [x] Replace the legacy beige palette and generic rounded controls with the
  approved cobalt, deep cobalt, coral, butter, ivory, and graphite tokens.
- [x] Add the four-fragment company-memory mark and condensed wordmark to the
  application shell.
- [x] Restyle Home as a strong editorial workspace with a visible governed-memory
  loop and a clear primary path into Marketing.
- [x] Restyle Chat, suggested-knowledge approval, Review, and Playbook with a
  consistent surface hierarchy and purposeful state colors.
- [x] Preserve accessible labels, focus states, 44px touch targets, responsive
  layouts, existing product copy required by tests, and all user flows.
- [x] Run lint, typecheck, unit tests, production build, and E2E tests.
- [x] Inspect desktop and mobile screenshots and record verification results.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`; then inspect Home, Chat, Review, and Playbook at desktop and
mobile widths with no console errors or horizontal overflow.

**Rollback:** Revert only this checkpoint's layout, global style, and visual
component changes. No data model, persisted demo state, API contract, or cloud
resource changes are involved.

**Verification results (2026-07-11):**

```text
pnpm lint:       PASS (0 errors; 5 pre-existing AWS-adapter warnings)
pnpm typecheck:  PASS
pnpm test:       PASS (12 files, 30 tests)
pnpm build:      PASS (Next.js 16.2.10 webpack production build)
pnpm test:e2e:   PASS (2 tests, including the complete salon memory loop)
Visual QA:       PASS (Home, Chat, Review, Playbook at 1440px and 390px)
Overflow audit:  PASS (0 horizontal-overflow routes across 8 renders)
Console audit:   PASS (0 production-render console errors)
Approval card:   PASS (desktop render inspected; no content overflow)
```

The first sandboxed build could not reach Google Fonts. The same production build
passed with normal network access and self-hosts the optimized font assets through
Next.js at runtime.

## Active checkpoint: statement-led landing page

**Outcome:** Replace the app-like root dashboard with a public landing page that
makes the product promise immediately clear, explains the governed-memory loop in
plain language, and hands judges or prospective owners directly into the salon
demo without changing the working Chat, Review, or Playbook flows.

**Core statement:** “Explain it once. Your company remembers.” Supporting copy
will explain that normal owner conversations become human-approved, source-backed
company knowledge reused by employees and assistants.

**Affected files:** the root page component, a new landing-page component, landing
styles in `src/app/globals.css`, the root-aware application shell label, and tests
that assert the first-screen message. Domain, API, adapter, and demo-state behavior
are out of scope.

**Implementation steps:**

- [x] Build a full-bleed editorial hero with one clear salon-demo action.
- [x] Explain the problem in owner language: repeated explanations, improvised
  answers, and AI that forgets company context.
- [x] Show the complete governed-memory loop from conversation through approval
  to consistent action using the approved fragment metaphor.
- [x] Make the trust boundary explicit: AI suggests, a human approves, and every
  authoritative answer stays source-backed.
- [x] End with the concrete salon proof rather than generic feature claims.
- [x] Preserve responsive behavior, accessible navigation, reduced-motion support,
  semantic headings, and 44px interaction targets.
- [x] Update first-screen tests, run all required verification, and inspect desktop
  and mobile production renders.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`; inspect the root page at 1440px and 390px with no horizontal
overflow or production console errors.

**Rollback:** Restore `src/app/page.tsx` to `HomeDashboard`, remove the new landing
component and landing-only styles, and revert the corresponding test assertions.
The salon demo data and product routes remain untouched.

**Verification results (2026-07-11):**

```text
pnpm lint:       PASS
pnpm typecheck:  PASS
pnpm test:       PASS (14 files, 35 tests)
pnpm build:      PASS (Next.js 16.2.10 webpack production build; 11 routes)
pnpm test:e2e:   PASS (2 tests, including the complete salon memory loop)
Visual QA:       PASS (1440px desktop and 390px mobile)
Overflow audit:  PASS (no horizontal overflow)
Console audit:   PASS (no page errors)
```

The design-html methodology influenced the implementation through real copy,
poster-like first-screen composition, scan-first hierarchy, dynamic text flow, and
mobile-specific re-layout. The live Next.js page remains the source of truth; no
separate preview artifact or production dependency was introduced.

## Active checkpoint: assistant-ui chat experience

**Outcome:** Replace the hand-built chat transcript and composer with
`@assistant-ui/react` primitives while preserving the existing MLC brand, REST
contracts, role-specific workflows, governed-memory rules, and AWS boundaries.

**Affected files:** `package.json`, `pnpm-lock.yaml`, chat UI components and
UI-only adapters under `src/components/`, `src/app/globals.css`, focused component
tests, `docs/DECISION_LOG.md`, and this plan. Domain, service, repository, prompt,
and public API contracts are out of scope.

**Implementation steps:**

- [x] Add the pinned MIT-licensed `@assistant-ui/react@0.14.26` dependency.
- [x] Add an external-store runtime adapter for MLC messages, sources, candidates,
  drafts, running states, and existing role-specific submission handlers.
- [x] Render the Marketing transcript with assistant-ui thread, message, composer,
  auto-scroll, scroll-to-bottom, and accessible status primitives.
- [x] Preserve independent Marketing, Operations, and Employee UI state while
  switching assistants.
- [x] Render suggested knowledge and approved sources as MLC-owned custom UI,
  keeping approval outside model tool execution.
- [x] Add focused component coverage for conversion, knowledge rendering,
  keyboard submission, failures, and role-state preservation.
- [x] Run lint, typecheck, unit tests, build, E2E, and inspect desktop/mobile Chat.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`, followed by browser network and responsive checks confirming no
assistant-cloud traffic, no horizontal overflow, and no accessibility regressions.

**Rollback:** Remove the assistant-ui dependency, UI-only adapter/primitives, and
this checkpoint's chat/test/style edits. Restore the current hand-built chat
component without changing any API, domain, persisted demo state, or AWS adapter.

**Verification results (2026-07-11):**

```text
pnpm lint:       PASS (0 warnings)
pnpm typecheck:  PASS
pnpm test:       PASS (16 files, 42 tests)
pnpm build:      PASS (Next.js 16.2.10, webpack)
pnpm test:e2e:   PASS (2 Chromium tests, complete salon memory loop)
git diff --check: PASS
Network audit:   PASS (conversation traffic remained on MLC routes)
Role state:      PASS (Marketing draft and inline candidate survived role switches)
Responsive QA:   PASS (1440px and 390px; composer visible, no horizontal overflow)
```

True token streaming, searchable thread history, branching, attachments, voice,
and model selection remain deferred. No assistant-cloud or alternate chat backend
was configured.

## Active checkpoint: directly editable Company Playbook

**Outcome:** Make approved company memory visible and directly amendable in a
document-like Playbook experience, while preserving owner approval, provenance,
immutable version history, and truthful Knowledge Base indexing state.

**Affected files:** Playbook detail UI, memory API/service/schema/port contracts,
local and DynamoDB memory adapters, focused tests, E2E coverage, and the relevant
product, UX, API, data-model, backlog, and decision documentation.

**Implementation steps:**

- [x] Add owner-only, stale-write-protected amendment of current approved memory.
- [x] Persist each amendment as a new immutable approved version and audit event.
- [x] Preserve prior sources and add the direct owner edit as a source reference.
- [x] Re-render and re-index the new version, exposing pending, ready, and failed states.
- [x] Return and display version history on the Playbook detail page.
- [x] Add a calm document-style edit mode for title, rule, rationale, and role scope.
- [x] Add service, local adapter, DynamoDB transaction, API, and browser coverage.
- [x] Run lint, typecheck, unit tests, build, and E2E; record exact results.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`. The browser flow must edit an approved Playbook entry, show the
new version, preserve the former version in history, and use the amended rule in
a later assistant answer.

**Rollback:** Revert only this checkpoint's Playbook amendment API, repository
version-write methods, UI, tests, and documentation. Existing approved records
and the conversation-to-approval flow remain unchanged.

**Verification results (2026-07-11):**

```text
pnpm lint:       PASS (0 warnings)
pnpm typecheck:  PASS
pnpm test:       PASS (16 files, 42 tests)
pnpm build:      PASS (Next.js 16.2.10, webpack)
pnpm test:e2e:   PASS (2 Chromium tests; amendment and version reuse included)
git diff --check: PASS
Visual QA:       PASS (Playbook detail at 1440px and 390px)
```

The browser scenario approves the 15% salon rule, edits it directly to 10%,
confirms version 1 remains visible, and verifies the Employee assistant cites and
uses version 2. The first sandboxed E2E attempt could not bind port 3000; the same
command passed with the local browser server allowed outside the sandbox.

## Completed checkpoint: Cognito login and scoped knowledge access

**Outcome:** Add real Cognito managed login and a server-owned authorization
model where the owner has full access and other company members receive explicit
`READ`, `SUGGEST`, and `APPROVE` grants for the whole company or one department.

**Affected files:** Authentication/session composition, membership and identity
ports/adapters, domain authorization, application services and API routes, the
workspace access UI, demo fixtures, focused tests and E2E coverage, environment
configuration, AWS setup scripts, and the relevant product/security/architecture
documentation.

**Implementation steps:**

- [x] Add Auth.js Cognito managed login plus a seeded demo-account provider.
- [x] Resolve every request actor from the authenticated identity and current
  active membership; never trust browser-supplied company, role, or grant data.
- [x] Add membership persistence, Cognito invitation administration, and an
  owner-only People & access experience.
- [x] Centralize company/department permission evaluation and enforce it across
  memory, candidate, conversation, assistant, company, and demo-reset flows.
- [x] Separate assistant content targeting from human access authorization.
- [x] Add representative owner, contributor, approver, and read-only demo users.
- [x] Add Cognito bootstrap/configuration guidance, audit access changes, and
  update the canonical decision and security documentation.
- [x] Run lint, typecheck, unit tests, production build, and full E2E verification.

**Verification:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and
`pnpm test:e2e`. Focused coverage must prove company/department grant semantics,
approval-implies-read, confidential owner-only behavior, disabled membership,
conversation isolation, safe invitation retry, and immediate grant revocation.

**Rollback:** Remove the Auth.js/Cognito and membership additions, restore the
seeded server actors in route handlers, and revert permission-aware UI changes.
No destructive data migration is required; existing company, conversation, and
memory records remain valid.

**Verification results (2026-07-11):**

```text
pnpm lint:       PASS (0 warnings)
pnpm typecheck:  PASS
pnpm test:       PASS (22 files, 71 tests)
pnpm build:      PASS (Next.js 16.2.10 webpack; auth/access routes included)
pnpm test:e2e:   PASS (4 Chromium tests)
git diff --check: PASS
```

The browser suite signs in as Maya, Minh, An, and Lina; verifies navigation and
owner administration; asserts a contributor receives 403 for Review; and then
re-runs the complete approval, retrieval, amendment, department-page, desktop,
and mobile salon paths. The first sandboxed E2E attempt could not bind port 3000;
the approved local browser run passed.

## Active checkpoint: consolidated decision documentation

**Outcome:** Make `docs/DECISION_LOG.md` the easy-to-scan canonical record of all
accepted product, trust, UX, architecture, visual, deployment, and scope decisions.

**Affected files:** `docs/DECISION_LOG.md`, `docs/PROJECT_MEMORY.md`,
`docs/UX_SPEC.md`, `DESIGN.md`, `README.md`, and this plan only. No application
behavior changes.

**Implementation steps:**

- [x] Add a dated decision index mapping every detailed ADR by area.
- [x] Record missing accepted decisions for the visual identity, public landing
  narrative, and Netlify-hosted/AWS-backed deployment boundary.
- [x] Record exact route ownership, landing-story sequence, direct Marketing
  handoff, and the `/workspace` location of demo profile and reset controls.
- [x] Record semantic color roles, fragment-mark usage, typography, layout, and
  motion constraints in the canonical ADR and `DESIGN.md`.
- [x] Record the console-first AWS Region, model, embedding, and vector-store
  defaults without hardcoding them into domain logic.
- [x] Add a concise scope and current-limitation section so deferred work is not
  mistaken for an accepted implementation commitment.
- [x] Link the canonical decision record from the repository map and durable
  project memory.
- [x] Align the UX specification with the public Home and demo-workspace split.
- [x] Verify numbering, cross-references, and formatting.

**Verification:** Review every existing ADR, `PROJECT_MEMORY` current decisions,
`DESIGN.md`, active plan commitments, and deployment docs against the consolidated
index; run `git diff --check`.

**Rollback:** Revert only the documentation additions in this checkpoint.

**Verification results (2026-07-11):**

```text
ADR index/detail parity: PASS (ADR-001 through ADR-023)
Experience route map: PASS (/, /workspace, /chat, /review, /playbook)
Landing narrative record: PASS (promise → problem → loop → trust → proof → demo)
Visual semantics record: PASS (cobalt anchors, butter suggests, coral confirms)
README/Project Memory links: PASS
git diff --check: PASS
```

## Active checkpoint: landing-page CTA hierarchy

**Outcome:** Make the live salon demo unmistakably clickable at every landing-page
handoff while preserving the statement-led story and one-primary-action rule.

**Affected files:** `src/components/landing-page.tsx`, landing-only rules in
`src/app/globals.css`, focused home-page tests, and this plan.

**Implementation steps:**

- [x] Replace metaphorical CTA copy with explicit live-demo language.
- [x] Give primary landing actions stronger size, contrast, depth, focus, hover,
  active, and mobile states without changing global app buttons.
- [x] Preserve quiet secondary links for process details and demo controls.
- [x] Verify the landing page at desktop and mobile sizes, then run lint,
  typecheck, tests, build, and the relevant browser flow.

**Verification results (2026-07-11):**

```text
CTA target audit: PASS (three primary actions at 60px high and 16px text)
Responsive QA:    PASS (1280px desktop, 768px tablet, 375px mobile)
CTA browser test: PASS (visible link, correct Marketing route, 60px target)
pnpm lint:        PASS
pnpm typecheck:   PASS
pnpm test:        PASS (24 files, 93 tests)
pnpm build:       PASS (Next.js 16.2.10 webpack production build)
pnpm test:e2e:    FLAKY outside CTA scope (CTA and salon paths pass; login and
                   onboarding navigation intermittently abort or detach in the
                   full suite; the failed onboarding scenario passes alone)
git diff --check: PASS
```

The design-review methodology led to one primary action per section, explicit
live-demo copy, visible default depth rather than hover-only affordance, and
full-width mobile CTAs. No route or product behavior changed.

**Rollback:** Remove the landing CTA modifier styles and restore the prior link
labels. No routes, product behavior, or application data are affected.

## Active checkpoint: waitlist-only public access

**Outcome:** Keep public account registration closed, give interested visitors a
real waitlist flow, and leave account creation exclusively in the existing
owner-invitation path rather than exposing a signup action in public navigation.

**Affected files:** Public header and login copy, a new waitlist page/form/API,
validated waitlist domain and repository boundaries, local and DynamoDB adapters,
focused tests, environment/deployment guidance, and the relevant product, UX,
security, API, data-model, backlog, and decision documentation.

**Implementation steps:**

- [x] Add a validated, idempotent public waitlist submission contract.
- [x] Persist waitlist entries locally and in the configured DynamoDB table.
- [x] Add a visible `Join waitlist` path without adding a visible `Create account` link.
- [x] Keep deployed Cognito self-registration disabled; owners create invited
  accounts through People & access.
- [x] Cover duplicate submissions, bot-trap behavior, UI success/error states,
  and the public route with unit and browser tests.
- [x] Run lint, typecheck, unit tests, build, E2E, and responsive browser checks.

**Verification results (2026-07-11):**

```text
pnpm lint:       PASS
pnpm typecheck:  PASS
pnpm test:       PASS (25 files, 97 tests)
pnpm build:      PASS (Next.js 16.2.10 webpack; /waitlist and /api/waitlist)
pnpm test:e2e:   PASS (7 Chromium tests)
Responsive QA:   PASS (1280px desktop, 768px tablet, 375px mobile)
Overflow audit:  PASS
Console audit:   PASS (no page errors; font preload warnings only after HMR)
Public boundary: PASS (no visible Create account link; waitlist creates no membership)
git diff --check: PASS
```

The AWS SDK v3 guidance shaped the deployed adapter: one reusable DocumentClient,
a bare `PutCommand` with a conditional uniqueness check, a consistent `GetCommand`
on duplicate races, explicit service-exception handling, and Zod validation before
and after persistence.

**Rollback:** Remove the waitlist route, service, adapters, public links, and
documentation. Existing Cognito login, memberships, invitations, and company
access remain unchanged.

## Active checkpoint: business-neutral landing page

**Outcome:** Remove salon-specific language from the public landing page so the
product speaks to any small-business owner. Keep the existing governed-memory
proof and Marketing handoff, but label the primary action explicitly as
`Start a company project`.

**Affected files:** `src/components/landing-page.tsx`, focused Home and browser
tests, `docs/PROJECT_MEMORY.md`, `docs/UX_SPEC.md`, `docs/DECISION_LOG.md`, and
this plan. The demo fixture, chat route, and salon-specific in-product scenario
remain unchanged.

**Implementation steps:**

- [x] Replace every public landing-page use of `salon` with company-neutral
  owner and business language.
- [x] Change all primary landing actions to `Start a company project` while
  preserving the direct Marketing workspace destination.
- [x] Record the revised landing-page scope in the durable product, UX, and
  decision documentation.
- [x] Update focused tests and run lint, typecheck, unit tests, build, and the
  relevant browser flow; record exact results.

**Verification:** Confirm no case-insensitive `salon` reference remains in the
landing component, all three primary actions use the new label and Marketing
route, focused tests pass, and `git diff --check` is clean.

**Verification results (2026-07-11):**

```text
Landing copy audit: PASS (0 salon references; 3 explicit project actions)
pnpm typecheck:     PASS
pnpm test:          PASS (24 files, 90 tests)
pnpm build:         PASS (Next.js 16.2.10 webpack production build)
Focused E2E:        PASS (2 Chromium tests)
git diff --check:   PASS
pnpm lint:          BLOCKED by pre-existing react-hooks/set-state-in-effect in
                    src/components/onboarding/onboarding-goal.tsx:22
Full E2E:           4 passed, 3 unrelated failures in access control,
                    onboarding navigation, and the governed salon workflow
```

**Rollback:** Restore the former salon-specific landing copy, CTA labels, tests,
and documentation decision. No application data, route, or demo fixture changes
are involved.

## Active checkpoint: simple company dashboard

**Outcome:** Refactor `/workspace` into a calm, role-aware dashboard that helps a
person resume their latest conversation, review suggested company knowledge when
they have approval access, and browse the approved knowledge they are allowed to
read.

**Affected files:** `src/components/home-dashboard.tsx`, the conversation deep-link
handoff in `src/components/chat-workspace.tsx`, the mobile signed-in shell treatment
in `src/components/app-shell.tsx`, focused unit and browser tests, `docs/UX_SPEC.md`,
and this plan. Repository, authorization, lifecycle, and API contracts remain
unchanged.

**Implementation steps:**

- [x] Replace the oversized educational workspace hero with a compact company
  overview and three clear dashboard sections.
- [x] Load the already scoped conversation list and expose only its most recently
  active item, with an empty state that starts a new conversation.
- [x] Show suggested knowledge only to people who can approve it; never imply
  that a suggestion is trusted company truth.
- [x] Show a concise list and count of approved knowledge returned by the existing
  server-scoped memory endpoint.
- [x] Add a conversation query parameter so the latest-chat action reopens the
  selected persisted conversation.
- [x] Preserve owner-only profile, onboarding, people/access, and demo-reset
  controls without competing with the main dashboard tasks.
- [x] Run focused tests, lint, typecheck, unit tests, build, and relevant browser
  verification; record exact results.

**Verification:** Check owner, approver, and read-only visibility; verify the
latest-conversation deep link; inspect desktop and mobile layouts; run
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and focused E2E coverage.

**Rollback:** Restore the prior `HomeDashboard`, remove the conversation deep-link
handling and focused tests, and revert this documentation checkpoint. No stored
company data or authorization behavior is affected.

**Verification results (2026-07-11):**

```text
Dashboard unit tests: PASS (2 role-aware tests)
pnpm typecheck:       PASS
pnpm test:            PASS (28 files, 107 tests)
pnpm build:           PASS (Next.js 16.2.10 webpack; /workspace and /chat)
Focused changed lint: PASS
Focused dashboard E2E: PASS (latest chat resume plus 390px overflow audit)
Rendered visual QA:   PASS (desktop and mobile); fixed low-contrast secondary action
Full E2E:             8/9 PASS; unrelated ChatGPT-import onboarding scenario
                      remains flaky during dev reload/hydration
pnpm lint:            BLOCKED by pre-existing react-hooks/set-state-in-effect in
                      src/components/waitlist-form.tsx:15
```

The scoped design review kept the page as an app workspace rather than a card
mosaic: one primary work panel, one conditional review panel, and a list-like
Playbook preview. The full design-review commit workflow was not used because the
working tree already contained substantial uncommitted user changes.
