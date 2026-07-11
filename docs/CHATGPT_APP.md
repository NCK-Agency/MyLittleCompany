# My Little Company — ChatGPT app

## App profile

| Field | Value |
|---|---|
| Name | My Little Company |
| Type | Private Developer Mode app |
| Archetype | Tool-only company knowledge app |
| Description | Explain it once. Your company remembers. Search approved company knowledge and propose durable knowledge for human review. |
| MCP URL | `https://<your-origin>/mcp` |
| Authentication | OAuth 2.1 through dynamic client registration and PKCE |
| App icon | `https://<your-origin>/brand/mlc-app-icon.svg` |

The app intentionally has no embedded widget. ChatGPT narrates search and fetch
results using canonical Playbook citations. Suggestions return a Review link;
approval remains inside My Little Company.

## Tools ChatGPT receives

### `search` — read only

Searches current, approved, indexed company knowledge visible to the linked My
Little Company member. Use it before making company-specific claims.

### `fetch` — read only

Opens one result returned by `search`, including the approved statement,
rationale, version metadata, and canonical Playbook URL.

### `suggest_company_knowledge` — confirmed write

Creates a source-backed suggestion for Review. It is idempotent and
non-destructive, but it is still a write and should require confirmation. It
cannot approve or index knowledge.

## Production prerequisites

The ChatGPT app cannot connect to a localhost-only server. Before creating the
Draft app:

1. Deploy this Next.js application at a stable public HTTPS origin.
2. Set `APP_BASE_URL` and `AUTH_URL` to that exact origin.
3. Set `AUTH_MODE=cognito` and complete the Cognito configuration.
4. Generate and store the OAuth signing key with `pnpm generate:mcp-key`.
5. Set `MCP_ENABLED=true` and redeploy.
6. Confirm these URLs are publicly reachable:
   - `/.well-known/oauth-protected-resource`
   - `/.well-known/oauth-authorization-server`
   - `/oauth/jwks`
   - `/brand/mlc-app-icon.svg`
7. Confirm an unauthenticated request to `/mcp` returns `401` with a
   `WWW-Authenticate` resource-metadata challenge.

## Create the Draft app in ChatGPT

1. On the ChatGPT web app, open **Settings → Security and login** and enable
   **Developer mode**.
2. Open **Settings → Plugins**, or go to `https://chatgpt.com/plugins`.
3. Select the plus button to create a Developer Mode app.
4. Use **My Little Company** as the app name if ChatGPT asks for one.
5. Enter `https://<your-origin>/mcp` as the remote MCP URL.
6. Choose OAuth with dynamic client registration when an authentication choice
   is shown. Do not enter a static client secret.
7. Complete the My Little Company Cognito sign-in and consent screen.
8. In the app details, verify that `search`, `fetch`, and
   `suggest_company_knowledge` appear. Keep all three enabled.
9. Select **Refresh** whenever server instructions, tool descriptions, schemas,
   or icons change.

The app should appear under **Drafts**. In a conversation, choose Developer mode
from the Plus menu and enable My Little Company for that conversation.

## Acceptance prompts

Use these prompts in a new conversation:

1. `Use My Little Company to find our approved promotion discount rule. Do not use web browsing.`
2. `Open the most relevant result and explain the current rule with its rationale and source.`
3. `Our new lasting rule is that appointment reminders must be sent 24 hours in advance. Offer to suggest this to My Little Company, but do not call the write tool until I confirm.`
4. After confirming the write: `Is that rule approved company policy now?`

Expected behavior:

- Prompts 1–2 call `search` then `fetch`, return version 2 with the current 10%
  maximum and free-add-on preference, and cite a canonical Playbook URL.
- Prompt 3 asks before calling `suggest_company_knowledge`.
- The suggestion result is `PROPOSED` and links to Review.
- Prompt 4 says no: a proposal is not approved truth.
- The suggestion remains absent from search until a scoped reviewer approves it
  and indexing reaches `READY`.

## Access checks

- Maya can read and suggest across the company.
- Minh can read and suggest only within permitted Marketing scope; a company
  default suggestion is denied.
- An can read Operations knowledge through `APPROVE` but cannot suggest without
  `SUGGEST`.
- Lina can read permitted Front Desk knowledge but cannot suggest or approve.

Disabling a membership or removing a grant must affect the next app request.
ChatGPT consent never replaces My Little Company authorization.

## Final connection gate

Do not create the Draft app against a temporary or guessed origin. First obtain
the permanent Netlify HTTPS origin, configure Cognito and OAuth with that exact
origin, deploy, and pass the public endpoint checks above. Then create the app
and verify exactly three tools are present. No approval tool may exist.

Set the app to ask before making changes. The OAuth screen, ChatGPT tool results,
and Review state must be real during the recording; they are never replaced by a
mock or deterministic fixture.
