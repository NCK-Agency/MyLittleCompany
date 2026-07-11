# Connect compatible AI agents

This is the real deployment smoke path for the private My Little Company MCP
connector. It is intentionally separate from the automated local contract tests.

## Before connecting

Deploy over HTTPS and configure:

```text
AUTH_MODE=cognito
AUTH_URL=https://<your-origin>
APP_BASE_URL=https://<your-origin>
MCP_ENABLED=true
MCP_OAUTH_PRIVATE_JWK=<secret JSON RSA private JWK>
MCP_OAUTH_KEY_ID=mlc-mcp-1
```

Generate a deployment key with `pnpm generate:mcp-key`. Store the private JWK as
a secret environment value; do not commit it or paste it into support messages.

Register `https://<your-origin>/api/auth/callback/cognito` and the application
logout URL in Cognito. Confirm the following return JSON before testing a client:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/oauth/jwks`

The MCP resource URL is `https://<your-origin>/mcp`. Do not treat the external
agent account as company identity: the browser flow must reach the My Little
Company Cognito login and consent screen.

## Compatibility contract

The connector does not identify clients by product name. A compatible client
must support remote Streamable HTTP MCP, OAuth discovery, Authorization Code with
PKCE S256, resource indicators, and dynamic client registration.

Dynamic registration accepts exact HTTPS callbacks for hosted clients and exact
HTTP loopback callbacks on `localhost`, `127.0.0.1`, or `::1` for native clients.
Other insecure HTTP callbacks, embedded credentials, fragments, and callback
changes after registration are rejected.

## ChatGPT Developer Mode smoke

Use the complete app profile and acceptance prompts in `docs/CHATGPT_APP.md`.

1. Enable Developer Mode in ChatGPT and create a private connector using the MCP
   resource URL.
2. Complete the My Little Company sign-in and allow only the requested read
   and/or suggestion consent.
3. Ask ChatGPT to search for an approved salon rule, then fetch one returned ID.
   Confirm the answer links to the authenticated canonical Playbook URL.
4. State a durable company rule and explicitly ask ChatGPT to suggest it. Confirm
   the result says `PROPOSED` and links to Review.
5. Confirm the suggestion is absent from search. Approve it in Review, wait for
   repository search to become `READY`, then search again and confirm it appears.
6. Revoke the connector or disable the membership and confirm the next request
   cannot access company data.

## Codex smoke

Add the same Streamable HTTP URL as a remote MCP server in Codex, then complete
the OAuth login for that server. Keep write approval enabled:

```toml
default_tools_approval_mode = "writes"

[mcp_servers.my_little_company]
url = "https://<your-origin>/mcp"
```

Run the same search, fetch, suggestion, pre-approval exclusion, Review approval,
and post-approval search checks. Confirm Codex asks for normal write approval before
calling `suggest_company_knowledge`, while `search` and `fetch` remain read-only.

## Claude Code smoke

```bash
claude mcp add --transport http my-little-company https://<your-origin>/mcp
```

Open `/mcp` in Claude Code and complete the browser OAuth flow. Run the same
search, fetch, and suggestion checks. Use **Clear authentication** in `/mcp` to
verify reauthentication and revocation behavior.

## Gemini CLI smoke

```bash
gemini mcp add my-little-company https://<your-origin>/mcp --transport http
```

Run `/mcp auth my-little-company` if authentication does not begin automatically.
Gemini should discover OAuth, register its loopback callback, open the browser,
and refresh tokens when needed. Keep the server untrusted so write-tool approval
is not bypassed.

## Kiro smoke

Add a remote server in Kiro's MCP settings or configuration:

```json
{
  "mcpServers": {
    "my-little-company": {
      "url": "https://<your-origin>/mcp",
      "oauthScopes": ["knowledge:read", "knowledge:suggest"],
      "autoApprove": ["search", "fetch"]
    }
  }
}
```

Kiro should use dynamic client registration and a local loopback callback. Leave
`suggest_company_knowledge` outside `autoApprove` so it remains a confirmed write.

## Other MCP clients

Point any compatible client at the same `/mcp` URL. If it cannot perform OAuth
discovery, PKCE, resource binding, or dynamic client registration, use a
client-side MCP gateway that can; do not weaken the server or paste long-lived
bearer tokens into project configuration.

## Permission persona checks

- Maya can search, fetch, and suggest in every scope. There is still no MCP
  approval tool.
- Minh can search and suggest Marketing knowledge when the department scope is
  supplied. A company-default suggestion is denied.
- An can read Operations knowledge because `APPROVE` includes `READ`, but cannot
  suggest without a `SUGGEST` grant. Approval remains in Review.
- Lina can search and fetch permitted Front Desk and inherited company knowledge,
  but cannot suggest or approve.

For every persona, select an assistant role that differs from the person's
business role once and confirm it does not expand retrieval or suggestion access.

## Evidence to retain

Record the deployment origin, test date, persona, client, tool, result, and safe
request ID. Never copy access/refresh tokens, full external evidence, or Cognito
credentials into test notes.
