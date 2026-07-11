import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env";

describe("parseEnvironment", () => {
  it("defaults to credential-free local demo mode", () => {
    expect(parseEnvironment({})).toMatchObject({
      APP_MODE: "local",
      AUTH_MODE: "demo",
      DEMO_COMPANY_ID: "demo-salon",
      NEXT_PUBLIC_DEMO_MODE: "true",
      WAITLIST_STORAGE_MODE: "local",
    });
  });

  it("treats provider-masked empty, short, or redacted secrets as absent in local demo mode", () => {
    const parsed = parseEnvironment({
      AUTH_SECRET: "masked",
      COGNITO_CLIENT_SECRET: "",
      MCP_OAUTH_PRIVATE_JWK: "****************7I\"}",
    });
    expect(parsed).toMatchObject({ APP_MODE: "local", AUTH_MODE: "demo", MCP_ENABLED: "false" });
    expect(parsed.AUTH_SECRET).toBeUndefined();
    expect(parsed.MCP_OAUTH_PRIVATE_JWK).toBeUndefined();
    expect(parseEnvironment({
      AUTH_SECRET: "",
      COGNITO_CLIENT_SECRET: "",
      MCP_OAUTH_PRIVATE_JWK: "",
    })).toMatchObject({ APP_MODE: "local", AUTH_MODE: "demo", MCP_ENABLED: "false" });
  });

  it("rejects an unsupported application mode", () => {
    expect(() => parseEnvironment({ APP_MODE: "unsupported" })).toThrow();
  });

  it("requires every AWS resource identifier in AWS mode", () => {
    expect(() => parseEnvironment({ APP_MODE: "aws" })).toThrow();
    expect(parseEnvironment({
      APP_MODE: "aws",
      MLC_AWS_REGION: "us-east-1",
      BEDROCK_MODEL_ID: "amazon.nova-lite-v1:0",
      BEDROCK_KNOWLEDGE_BASE_ID: "kb-id",
      BEDROCK_DATA_SOURCE_ID: "source-id",
      DYNAMODB_TABLE_NAME: "mlc-demo",
      S3_BUCKET_NAME: "mlc-demo-bucket",
    })).toMatchObject({ APP_MODE: "aws", MLC_AWS_REGION: "us-east-1" });
  });

  it("requires app-specific AWS credentials as a complete pair", () => {
    expect(() => parseEnvironment({ MLC_AWS_ACCESS_KEY_ID: "AKIAEXAMPLEONLY1" })).toThrow();
    expect(parseEnvironment({
      MLC_AWS_ACCESS_KEY_ID: "AKIAEXAMPLEONLY1",
      MLC_AWS_SECRET_ACCESS_KEY: "secret-value",
    })).toMatchObject({ MLC_AWS_ACCESS_KEY_ID: "AKIAEXAMPLEONLY1" });
  });

  it("can keep the app local while persisting the public waitlist in DynamoDB", () => {
    expect(() => parseEnvironment({ WAITLIST_STORAGE_MODE: "dynamodb" })).toThrow();
    expect(parseEnvironment({
      WAITLIST_STORAGE_MODE: "dynamodb",
      MLC_AWS_REGION: "us-east-1",
      DYNAMODB_TABLE_NAME: "mlc-demo",
    })).toMatchObject({
      APP_MODE: "local",
      WAITLIST_STORAGE_MODE: "dynamodb",
      DYNAMODB_TABLE_NAME: "mlc-demo",
    });
  });

  it("requires every Cognito session and provider value in Cognito mode", () => {
    expect(() => parseEnvironment({ AUTH_MODE: "cognito" })).toThrow();
    expect(() => parseEnvironment({ AUTH_MODE: "cognito", AUTH_SECRET: "masked" })).toThrow();
    expect(parseEnvironment({
      AUTH_MODE: "cognito",
      AUTH_SECRET: "a-secure-auth-secret-with-at-least-32-characters",
      AUTH_URL: "https://example.com",
      COGNITO_REGION: "us-east-1",
      COGNITO_USER_POOL_ID: "us-east-1_example",
      COGNITO_CLIENT_ID: "client-id",
      COGNITO_CLIENT_SECRET: "client-secret",
      COGNITO_ISSUER: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_example",
      COGNITO_DOMAIN: "https://example.auth.us-east-1.amazoncognito.com",
    })).toMatchObject({ AUTH_MODE: "cognito", APP_MODE: "local" });
  });

  it("requires a session secret and persistent signing key for an HTTPS MCP deployment", () => {
    expect(() => parseEnvironment({ MCP_ENABLED: "true", APP_BASE_URL: "https://example.com" })).toThrow();
    expect(() => parseEnvironment({
      MCP_ENABLED: "true",
      APP_BASE_URL: "https://example.com",
      AUTH_SECRET: "a-secure-auth-secret-with-at-least-32-characters",
      MCP_OAUTH_PRIVATE_JWK: "****************7I\"}",
    })).toThrow();
    expect(parseEnvironment({
      MCP_ENABLED: "true",
      APP_BASE_URL: "https://example.com",
      AUTH_SECRET: "a-secure-auth-secret-with-at-least-32-characters",
      MCP_OAUTH_PRIVATE_JWK: JSON.stringify({ kty: "RSA", n: "test", e: "AQAB", d: "private" }),
    })).toMatchObject({ MCP_ENABLED: "true", APP_BASE_URL: "https://example.com" });
  });
});
