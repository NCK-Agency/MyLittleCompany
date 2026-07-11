import { BedrockAgentClient } from "@aws-sdk/client-bedrock-agent";
import { BedrockAgentRuntimeClient } from "@aws-sdk/client-bedrock-agent-runtime";
import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { CognitoIdentityAdmin } from "@/adapters/aws/cognito-identity-admin";
import { BedrockKnowledgeIndex } from "@/adapters/aws/bedrock-knowledge-index";
import { BedrockModelGateway } from "@/adapters/aws/bedrock-model-gateway";
import { DynamoRepositories } from "@/adapters/aws/dynamodb-repositories";
import { DynamoOAuthRepository } from "@/adapters/aws/dynamodb-oauth-repository";
import { DynamoImportRepository } from "@/adapters/aws/dynamodb-import-repository";
import { S3SourceRepository } from "@/adapters/aws/s3-source-repository";
import { S3SourceImporter } from "@/adapters/aws/s3-source-importer";
import { LocalCompanyRepository } from "@/adapters/local/company-repository";
import { LocalConversationRepository } from "@/adapters/local/conversation-repository";
import { FixtureModelGateway } from "@/adapters/local/fixture-model-gateway";
import { LocalKnowledgeIndex } from "@/adapters/local/knowledge-index";
import { LocalIdentityAdmin } from "@/adapters/local/identity-admin";
import { LocalImportRepository } from "@/adapters/local/import-repository";
import { LocalMembershipRepository } from "@/adapters/local/membership-repository";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import { LocalOAuthRepository } from "@/adapters/local/oauth-repository";
import { LocalSourceRepository } from "@/adapters/local/source-repository";
import { LocalSourceImporter } from "@/adapters/local/source-importer";
import { env } from "@/lib/env";
import type { CompanyRepository } from "@/ports/company-repository";
import type { ConversationRepository } from "@/ports/conversation-repository";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { IdentityAdmin } from "@/ports/identity-admin";
import type { ImportRepository } from "@/ports/import-repository";
import type { MembershipRepository } from "@/ports/membership-repository";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { ModelGateway } from "@/ports/model-gateway";
import type { OAuthRepository } from "@/ports/oauth-repository";
import type { SourceRepository } from "@/ports/source-repository";
import { AssistantService } from "@/services/assistant-service";
import { CompanyService } from "@/services/company-service";
import { ConversationService } from "@/services/conversation-service";
import { ConnectedSuggestionService } from "@/services/connected-suggestion-service";
import { MemoryRetrievalService } from "@/services/memory-retrieval-service";
import { MemoryService } from "@/services/memory-service";
import { MembershipService } from "@/services/membership-service";
import { OnboardingService } from "@/services/onboarding-service";
import { OAuthService } from "@/oauth/oauth-service";
import { SopService } from "@/services/sop-service";

interface Dependencies {
  companies: CompanyRepository;
  conversations: ConversationRepository;
  memories: MemoryRepository;
  memberships: MembershipRepository;
  index: KnowledgeIndex;
  model: ModelGateway;
  sources: SourceRepository;
  imports: ImportRepository;
}

function localDependencies(): Dependencies {
  return {
    companies: new LocalCompanyRepository(),
    conversations: new LocalConversationRepository(),
    memories: new LocalMemoryRepository(),
    memberships: new LocalMembershipRepository(),
    index: new LocalKnowledgeIndex(),
    model: new FixtureModelGateway(),
    sources: new LocalSourceRepository(),
    imports: new LocalImportRepository(),
  };
}

function awsDependencies(): Dependencies {
  if (env.APP_MODE !== "aws") throw new Error("CONFIGURATION_ERROR");
  const sdkConfig = { region: env.AWS_REGION, maxAttempts: 3 };
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient(sdkConfig), {
      marshallOptions: { removeUndefinedValues: true },
    });
  const dynamo = new DynamoRepositories(
    documentClient,
    env.DYNAMODB_TABLE_NAME,
  );
  return {
    companies: dynamo,
    conversations: dynamo,
    memories: dynamo,
    memberships: dynamo,
    sources: new S3SourceRepository(new S3Client(sdkConfig), env.S3_BUCKET_NAME),
    index: new BedrockKnowledgeIndex(
      new BedrockAgentClient(sdkConfig),
      new BedrockAgentRuntimeClient(sdkConfig),
      env.BEDROCK_KNOWLEDGE_BASE_ID,
      env.BEDROCK_DATA_SOURCE_ID,
    ),
    model: new BedrockModelGateway(new BedrockRuntimeClient(sdkConfig), env.BEDROCK_MODEL_ID),
    imports: new DynamoImportRepository(documentClient, env.DYNAMODB_TABLE_NAME),
  };
}

const dependencies = env.APP_MODE === "aws" ? awsDependencies() : localDependencies();
const sourceImporter = env.APP_MODE === "aws"
  ? new S3SourceImporter(dependencies.sources)
  : new LocalSourceImporter(dependencies.sources);
const identityAdmin: IdentityAdmin = env.AUTH_MODE === "cognito"
  ? new CognitoIdentityAdmin(
    new CognitoIdentityProviderClient({ region: env.COGNITO_REGION!, maxAttempts: 3 }),
    env.COGNITO_USER_POOL_ID!,
  )
  : new LocalIdentityAdmin();
const retrievalService = new MemoryRetrievalService(dependencies.index, dependencies.memories);

function oauthRepository(): OAuthRepository {
  if (env.APP_MODE !== "aws") return new LocalOAuthRepository();
  const documentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: env.AWS_REGION, maxAttempts: 3 }),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return new DynamoOAuthRepository(documentClient, env.DYNAMODB_TABLE_NAME);
}

export const oauthService = new OAuthService(oauthRepository(), {
  issuer: env.APP_BASE_URL,
  resource: `${env.APP_BASE_URL.replace(/\/$/, "")}/mcp`,
  signingKeyId: env.MCP_OAUTH_KEY_ID,
  privateJwk: env.MCP_OAUTH_PRIVATE_JWK,
  consentSecret: env.AUTH_SECRET ?? "demo-only-mcp-disabled-consent-secret",
  identityProvider: env.AUTH_MODE === "cognito" ? "COGNITO" : "DEMO",
});

export const connectedSuggestionService = new ConnectedSuggestionService(
  dependencies.memories,
  retrievalService,
  dependencies.model,
  dependencies.sources,
  dependencies.companies,
);
export const conversationService = new ConversationService(
  dependencies.conversations,
  retrievalService,
  dependencies.model,
  dependencies.sources,
  connectedSuggestionService,
);
export const memoryService = new MemoryService(
  dependencies.memories,
  dependencies.index,
  dependencies.sources,
  dependencies.conversations,
  dependencies.companies,
  connectedSuggestionService,
);
export const assistantService = new AssistantService(retrievalService, dependencies.model);
export const sopService = new SopService(retrievalService, dependencies.model, dependencies.memories);
export const companyService = new CompanyService(dependencies.companies);
export const onboardingService = new OnboardingService(
  dependencies.imports,
  dependencies.sources,
  dependencies.memories,
  dependencies.model,
  sourceImporter,
);
export const membershipService = new MembershipService(
  dependencies.memberships,
  identityAdmin,
  dependencies.companies,
  dependencies.memories,
);
export { retrievalService };
