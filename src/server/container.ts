import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import OpenAI from "openai";
import { CognitoIdentityAdmin } from "@/adapters/aws/cognito-identity-admin";
import { DynamoRepositories } from "@/adapters/aws/dynamodb-repositories";
import { DynamoOAuthRepository } from "@/adapters/aws/dynamodb-oauth-repository";
import { DynamoImportRepository } from "@/adapters/aws/dynamodb-import-repository";
import { DynamoWaitlistRepository } from "@/adapters/aws/dynamodb-waitlist-repository";
import { S3SourceRepository } from "@/adapters/aws/s3-source-repository";
import { S3SourceImporter } from "@/adapters/aws/s3-source-importer";
import { LocalCompanyRepository } from "@/adapters/local/company-repository";
import { LocalConversationRepository } from "@/adapters/local/conversation-repository";
import { FixtureModelGateway } from "@/adapters/local/fixture-model-gateway";
import { LocalIdentityAdmin } from "@/adapters/local/identity-admin";
import { LocalImportRepository } from "@/adapters/local/import-repository";
import { LocalMembershipRepository } from "@/adapters/local/membership-repository";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import { LocalOAuthRepository } from "@/adapters/local/oauth-repository";
import { LocalSourceRepository } from "@/adapters/local/source-repository";
import { LocalSourceImporter } from "@/adapters/local/source-importer";
import { LocalWaitlistRepository } from "@/adapters/local/waitlist-repository";
import { OpenAIModelGateway } from "@/adapters/openai/openai-model-gateway";
import { RepositoryKnowledgeIndex } from "@/adapters/repository-knowledge-index";
import { appError } from "@/domain/errors";
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
import type { WaitlistRepository } from "@/ports/waitlist-repository";
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
import { WaitlistService } from "@/services/waitlist-service";
import { modelIdForTier } from "@/server/model-catalog";

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

type PersistenceDependencies = Omit<Dependencies, "model">;

function awsSdkConfig(region: string) {
  const credentials = env.MLC_AWS_ACCESS_KEY_ID && env.MLC_AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: env.MLC_AWS_ACCESS_KEY_ID,
        secretAccessKey: env.MLC_AWS_SECRET_ACCESS_KEY,
      }
    : undefined;
  return { region, maxAttempts: 3, credentials };
}

function configuredAwsRegion(): string {
  const region = env.MLC_AWS_REGION ?? env.AWS_REGION;
  if (!region) throw new Error("CONFIGURATION_ERROR");
  return region;
}

function localDependencies(): PersistenceDependencies {
  const memories = new LocalMemoryRepository();
  return {
    companies: new LocalCompanyRepository(),
    conversations: new LocalConversationRepository(),
    memories,
    memberships: new LocalMembershipRepository(),
    index: new RepositoryKnowledgeIndex(memories),
    sources: new LocalSourceRepository(),
    imports: new LocalImportRepository(),
  };
}

function awsDependencies(): PersistenceDependencies {
  if (env.APP_MODE !== "aws") throw new Error("CONFIGURATION_ERROR");
  const sdkConfig = awsSdkConfig(configuredAwsRegion());
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
    index: new RepositoryKnowledgeIndex(dynamo),
    imports: new DynamoImportRepository(documentClient, env.DYNAMODB_TABLE_NAME),
  };
}

const persistence = env.APP_MODE === "aws" ? awsDependencies() : localDependencies();

function modelGateway(): ModelGateway {
  if (env.MODEL_PROVIDER === "fixture") return new FixtureModelGateway();
  if (!env.OPENAI_API_KEY) throw appError("CONFIGURATION_ERROR");
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    maxRetries: 0,
    timeout: 25_000,
  });
  return new OpenAIModelGateway(client, async (companyId) => {
    const company = await persistence.companies.get(companyId);
    if (!company) throw appError("NOT_FOUND");
    return {
      tier: company.assistantModelTier,
      modelId: modelIdForTier(company.assistantModelTier),
    };
  });
}

const dependencies: Dependencies = { ...persistence, model: modelGateway() };
const sourceImporter = env.APP_MODE === "aws"
  ? new S3SourceImporter(dependencies.sources)
  : new LocalSourceImporter(dependencies.sources);
const identityAdmin: IdentityAdmin = env.AUTH_MODE === "cognito"
  ? new CognitoIdentityAdmin(
    new CognitoIdentityProviderClient(awsSdkConfig(env.COGNITO_REGION!)),
    env.COGNITO_USER_POOL_ID!,
  )
  : new LocalIdentityAdmin();
const retrievalService = new MemoryRetrievalService(dependencies.index, dependencies.memories);

function oauthRepository(): OAuthRepository {
  if (env.APP_MODE !== "aws") return new LocalOAuthRepository();
  const documentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient(awsSdkConfig(configuredAwsRegion())),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return new DynamoOAuthRepository(documentClient, env.DYNAMODB_TABLE_NAME);
}

function waitlistRepository(): WaitlistRepository {
  if (env.APP_MODE !== "aws" && env.WAITLIST_STORAGE_MODE !== "dynamodb") {
    return new LocalWaitlistRepository();
  }
  const documentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient(awsSdkConfig(configuredAwsRegion())),
    { marshallOptions: { removeUndefinedValues: true } },
  );
  return new DynamoWaitlistRepository(documentClient, env.DYNAMODB_TABLE_NAME!);
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
export const companyService = new CompanyService(dependencies.companies, env.DEMO_COMPANY_ID);
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
export const waitlistService = new WaitlistService(waitlistRepository());
export { retrievalService };
