# Official Technical References

These references support the project decisions. Re-check them before implementing provider-specific behavior because cloud APIs evolve.

## Codex

- AGENTS.md project instructions: https://developers.openai.com/codex/guides/agents-md
- Codex best practices: https://developers.openai.com/codex/learn/best-practices

## OpenAI

- Responses API reference: https://developers.openai.com/api/reference/resources/responses/methods/create
- Structured Outputs guide: https://developers.openai.com/api/docs/guides/structured-outputs
- Model overview: https://developers.openai.com/api/docs/models

## AWS persistence and identity

- DynamoDB single-table design: https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-modeling-nosql.html
- S3 blocking public access: https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html
- S3 Lifecycle configuration: https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html
- Cognito managed login: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-managed-login.html

## Notes reflected in the architecture

- Codex reads root and nested `AGENTS.md` instruction files and applies more specific guidance closer to the working directory.
- Keeping detailed context in `docs/` and practical working rules in the root instruction file avoids bloating the automatically loaded project guidance.
- OpenAI Structured Outputs constrain response shape, while application-side Zod,
  business-rule, authorization, citation, and human-approval checks remain
  mandatory.
- Model output and imported or repository-retrieved text remain untrusted data.
- DynamoDB owns approved structured truth; private S3 documents preserve source
  provenance and are not a retrieval authority.
