import { z } from "zod";

function optionalSecret(minLength = 1) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const maskedCharacters = value.match(/\*/g)?.length ?? 0;
      const isProviderMask = maskedCharacters >= 8 && maskedCharacters >= value.length / 2;
      return value.length < minLength || isProviderMask ? undefined : value;
    },
    z.string().min(minLength).optional(),
  );
}

const commonEnvironment = z.object({
  AUTH_MODE: z.enum(["demo", "cognito"]).default("demo"),
  AUTH_SECRET: optionalSecret(32),
  AUTH_URL: z.url().optional(),
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_REGION: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_SECRET: optionalSecret(),
  COGNITO_ISSUER: z.url().optional(),
  COGNITO_DOMAIN: z.url().optional(),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  MCP_ENABLED: z.enum(["true", "false"]).default("false"),
  MCP_OAUTH_PRIVATE_JWK: optionalSecret(),
  MCP_OAUTH_KEY_ID: z.string().min(1).default("mlc-mcp-1"),
  DEMO_COMPANY_ID: z.string().min(1).default("demo-salon"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("My Little Company"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("true"),
  MODEL_PROVIDER: z.enum(["fixture", "openai"]).default("fixture"),
  OPENAI_API_KEY: optionalSecret(20),
  OPENAI_MODEL_FAST: z.string().min(1).default("gpt-5.6-luna"),
  OPENAI_MODEL_BALANCED: z.string().min(1).default("gpt-5.6-terra"),
  OPENAI_MODEL_BEST: z.string().min(1).default("gpt-5.6-sol"),
  WAITLIST_STORAGE_MODE: z.enum(["local", "dynamodb"]).default("local"),
  AWS_REGION: z.string().min(1).optional(),
  DYNAMODB_TABLE_NAME: z.string().min(1).optional(),
  MLC_AWS_ACCESS_KEY_ID: optionalSecret(16),
  MLC_AWS_SECRET_ACCESS_KEY: optionalSecret(),
  MLC_AWS_REGION: z.string().min(1).optional(),
});

function requireAwsCredentialPair(
  value: z.infer<typeof commonEnvironment>,
  context: z.RefinementCtx,
): void {
  if (Boolean(value.MLC_AWS_ACCESS_KEY_ID) === Boolean(value.MLC_AWS_SECRET_ACCESS_KEY)) return;
  context.addIssue({
    code: "custom",
    path: [value.MLC_AWS_ACCESS_KEY_ID ? "MLC_AWS_SECRET_ACCESS_KEY" : "MLC_AWS_ACCESS_KEY_ID"],
    message: "Both app-specific AWS credential values must be provided together.",
  });
}

function requireDurableWaitlist(
  value: z.infer<typeof commonEnvironment>,
  context: z.RefinementCtx,
): void {
  if (value.WAITLIST_STORAGE_MODE !== "dynamodb") return;
  if (!value.DYNAMODB_TABLE_NAME) {
    context.addIssue({
      code: "custom",
      path: ["DYNAMODB_TABLE_NAME"],
      message: "DYNAMODB_TABLE_NAME is required for DynamoDB waitlist storage.",
    });
  }
  if (!value.MLC_AWS_REGION && !value.AWS_REGION) {
    context.addIssue({
      code: "custom",
      path: ["MLC_AWS_REGION"],
      message: "MLC_AWS_REGION or AWS_REGION is required for DynamoDB waitlist storage.",
    });
  }
}

function requireOpenAi(
  value: z.infer<typeof commonEnvironment>,
  context: z.RefinementCtx,
): void {
  if (value.MODEL_PROVIDER !== "openai") return;
  if (!value.OPENAI_API_KEY) {
    context.addIssue({
      code: "custom",
      path: ["OPENAI_API_KEY"],
      message: "OPENAI_API_KEY is required when MODEL_PROVIDER=openai.",
    });
  }
}

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
  requireAwsCredentialPair(value, context);
  requireDurableWaitlist(value, context);
  requireOpenAi(value, context);
  requireCognito(value, context);
  requireMcpSigningKey(value, context);
});

const awsEnvironmentSchema = commonEnvironment.extend({
  APP_MODE: z.literal("aws"),
  AWS_REGION: z.string().min(1).optional(),
  DYNAMODB_TABLE_NAME: z.string().min(1),
  S3_BUCKET_NAME: z.string().min(1),
}).superRefine((value, context) => {
  if (!value.MLC_AWS_REGION && !value.AWS_REGION) {
    context.addIssue({
      code: "custom",
      path: ["MLC_AWS_REGION"],
      message: "MLC_AWS_REGION or AWS_REGION is required in AWS mode.",
    });
  }
  if (value.MODEL_PROVIDER !== "openai") {
    context.addIssue({
      code: "custom",
      path: ["MODEL_PROVIDER"],
      message: "MODEL_PROVIDER=openai is required in hosted AWS persistence mode.",
    });
  }
  requireAwsCredentialPair(value, context);
  requireDurableWaitlist(value, context);
  requireOpenAi(value, context);
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
