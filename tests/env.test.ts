import { describe, expect, it } from "vitest";
import { parseEnvironment } from "@/lib/env";

describe("parseEnvironment", () => {
  it("defaults to credential-free local demo mode", () => {
    expect(parseEnvironment({})).toMatchObject({
      APP_MODE: "local",
      AUTH_MODE: "demo",
      DEMO_COMPANY_ID: "demo-salon",
      NEXT_PUBLIC_DEMO_MODE: "true",
    });
  });

  it("rejects an unsupported application mode", () => {
    expect(() => parseEnvironment({ APP_MODE: "unsupported" })).toThrow();
  });

  it("requires every AWS resource identifier in AWS mode", () => {
    expect(() => parseEnvironment({ APP_MODE: "aws" })).toThrow();
    expect(parseEnvironment({
      APP_MODE: "aws",
      AWS_REGION: "us-east-1",
      BEDROCK_MODEL_ID: "amazon.nova-lite-v1:0",
      BEDROCK_KNOWLEDGE_BASE_ID: "kb-id",
      BEDROCK_DATA_SOURCE_ID: "source-id",
      DYNAMODB_TABLE_NAME: "mlc-demo",
      S3_BUCKET_NAME: "mlc-demo-bucket",
    })).toMatchObject({ APP_MODE: "aws", AWS_REGION: "us-east-1" });
  });

  it("requires every Cognito session and provider value in Cognito mode", () => {
    expect(() => parseEnvironment({ AUTH_MODE: "cognito" })).toThrow();
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
    expect(parseEnvironment({
      MCP_ENABLED: "true",
      APP_BASE_URL: "https://example.com",
      AUTH_SECRET: "a-secure-auth-secret-with-at-least-32-characters",
      MCP_OAUTH_PRIVATE_JWK: JSON.stringify({ kty: "RSA", n: "test", e: "AQAB", d: "private" }),
    })).toMatchObject({ MCP_ENABLED: "true", APP_BASE_URL: "https://example.com" });
  });
});
