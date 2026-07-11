# Official Technical References

These references support the project decisions. Re-check them before implementing provider-specific behavior because cloud APIs evolve.

## Codex

- AGENTS.md project instructions: https://developers.openai.com/codex/guides/agents-md
- Codex best practices: https://developers.openai.com/codex/learn/best-practices

## Amazon Bedrock and AgentCore

- Bedrock Knowledge Bases overview: https://docs.aws.amazon.com/bedrock/latest/userguide/knowledge-base.html
- Direct ingestion into a Knowledge Base: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-direct-ingestion.html
- Retrieve API guidance: https://docs.aws.amazon.com/bedrock/latest/userguide/kb-test-retrieve.html
- JavaScript SDK Retrieve command: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-agent-runtime/command/RetrieveCommand/
- AgentCore Memory: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory.html
- AgentCore memory strategies: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/memory-strategies.html
- AgentCore structured metadata: https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/long-term-memory-metadata.html

## Notes reflected in the architecture

- Codex reads root and nested `AGENTS.md` instruction files and applies more specific guidance closer to the working directory.
- Keeping detailed context in `docs/` and practical working rules in the root instruction file avoids bloating the automatically loaded project guidance.
- Bedrock Knowledge Bases supports direct document ingestion for supported data-source types.
- Application code must not assume that guardrails sanitize retrieved Knowledge Base references; retrieved content remains untrusted data.
