import { z } from "zod";

const commonEnvironment = z.object({
  AUTH_MODE: z.enum(["demo", "cognito"]).default("demo"),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.url().optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_SECRET: z.string().min(1).optional(),
  COGNITO_ISSUER: z.url().optional(),
  COGNITO_DOMAIN: z.url().optional(),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  MCP_ENABLED: z.enum(["true", "false"]).default("false"),
  MCP_OAUTH_PRIVATE_JWK: z.string().min(1).optional(),
  MCP_OAUTH_KEY_ID: z.string().min(1).default("mlc-mcp-1"),
  DEMO_COMPANY_ID: z.string().min(1).default("demo-salon"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("My Little Company"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("true"),
});

function requireCognito(
  value: z.infer<typeof commonEnvironment>,
  context: z.RefinementCtx,
): void {
  if (value.AUTH_MODE !== "cognito") return;
  for (const key of [
    "COGNITO_USER_POOL_ID",
    "COGNITO_REGION",
    "COGNITO_CLIENT_ID",
    "COGNITO_CLIENT_SECRET",
    "COGNITO_ISSUER",
    "COGNITO_DOMAIN",
    "AUTH_URL",
    "AUTH_SECRET",
  ] as const) {
    if (!value[key]) context.addIssue({ code: "custom", path: [key], message: `${key} is required in Cognito mode.` });
  }
}

function requireMcpSigningKey(
  value: z.infer<typeof commonEnvironment>,
  context: z.RefinementCtx,
): void {
  if (value.MCP_ENABLED === "true" && !value.AUTH_SECRET) {
    context.addIssue({
      code: "custom",
      path: ["AUTH_SECRET"],
      message: "AUTH_SECRET is required when MCP is enabled.",
    });
  }
  if (value.MCP_ENABLED === "true" && value.APP_BASE_URL.startsWith("https://") && !value.MCP_OAUTH_PRIVATE_JWK) {
    context.addIssue({
      code: "custom",
      path: ["MCP_OAUTH_PRIVATE_JWK"],
      message: "MCP_OAUTH_PRIVATE_JWK is required when MCP is enabled outside local HTTP development.",
    });
  }
}

const localEnvironmentSchema = commonEnvironment.extend({
  APP_MODE: z.literal("local"),
}).superRefine((value, context) => {
  requireCognito(value, context);
  requireMcpSigningKey(value, context);
});

const awsEnvironmentSchema = commonEnvironment.extend({
  APP_MODE: z.literal("aws"),
  AWS_REGION: z.string().min(1),
  BEDROCK_MODEL_ID: z.string().min(1),
  BEDROCK_KNOWLEDGE_BASE_ID: z.string().min(1),
  BEDROCK_DATA_SOURCE_ID: z.string().min(1),
  DYNAMODB_TABLE_NAME: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
}).superRefine((value, context) => {
  requireCognito(value, context);
  requireMcpSigningKey(value, context);
});

export type LocalEnvironment = z.infer<typeof localEnvironmentSchema>;
export type AwsEnvironment = z.infer<typeof awsEnvironmentSchema>;
export type AppEnvironment = LocalEnvironment | AwsEnvironment;

export function parseEnvironment(
  input: Record<string, string | undefined>,
): AppEnvironment {
  if (input.APP_MODE !== undefined) z.enum(["local", "aws"]).parse(input.APP_MODE);
  return input.APP_MODE === "aws"
    ? awsEnvironmentSchema.parse(input)
    : localEnvironmentSchema.parse({ ...input, APP_MODE: "local" });
}

export const env = parseEnvironment(process.env);
