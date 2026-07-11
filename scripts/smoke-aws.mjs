import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import {
  BedrockAgentClient,
  DeleteKnowledgeBaseDocumentsCommand,
  IngestKnowledgeBaseDocumentsCommand,
} from "@aws-sdk/client-bedrock-agent";
import { BedrockAgentRuntimeClient, RetrieveCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

const required = [
  "AWS_REGION", "BEDROCK_MODEL_ID", "BEDROCK_KNOWLEDGE_BASE_ID",
  "BEDROCK_DATA_SOURCE_ID", "DYNAMODB_TABLE_NAME", "S3_BUCKET_NAME",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`AWS smoke configuration is incomplete: ${missing.join(", ")}`);
  process.exit(1);
}
const region = process.env.AWS_REGION;
const modelId = process.env.BEDROCK_MODEL_ID;
const knowledgeBaseId = process.env.BEDROCK_KNOWLEDGE_BASE_ID;
const dataSourceId = process.env.BEDROCK_DATA_SOURCE_ID;
const tableName = process.env.DYNAMODB_TABLE_NAME;
const bucket = process.env.S3_BUCKET_NAME;
const config = { region, maxAttempts: 3 };
const bedrock = new BedrockRuntimeClient(config);
const agent = new BedrockAgentClient(config);
const agentRuntime = new BedrockAgentRuntimeClient(config);
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(config), { marshallOptions: { removeUndefinedValues: true } });
const s3 = new S3Client(config);
const runId = randomUUID();
const companyId = `smoke-${runId}`;
const memoryId = `memory-${runId}`;
const now = new Date().toISOString();
const objectKey = `memories/${companyId}/${memoryId}/v1.md`;
const s3Uri = `s3://${bucket}/${objectKey}`;
const recordKey = { PK: `COMPANY#${companyId}`, SK: `MEMORY#${memoryId}` };
const versionKey = { PK: `COMPANY#${companyId}#MEMORY#${memoryId}`, SK: "VERSION#00000001" };
const auditKey = { PK: `COMPANY#${companyId}`, SK: `AUDIT#${now}#${runId}` };
let ingested = false;
let uploaded = false;
let persisted = false;

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const jsonText = (value) => value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim() ?? value.trim();

try {
  const model = await bedrock.send(new ConverseCommand({
    modelId,
    messages: [{ role: "user", content: [{ text: "Reply with the single word READY." }] }],
    inferenceConfig: { maxTokens: 10, temperature: 0 },
  }));
  if (!model.output?.message?.content?.some((block) => block.text)) throw new Error("Nova Converse returned no text");
  console.log("PASS model Converse request");

  const onboardingPrompt = await readFile(new URL("../prompts/onboarding-extractor.md", import.meta.url), "utf8");
  const extraction = await bedrock.send(new ConverseCommand({
    modelId,
    system: [{ text: onboardingPrompt }],
    messages: [{ role: "user", content: [{ text: JSON.stringify({
      proofQuestion: "Can the team offer 25% off?",
      source: {
        id: `source-${runId}`,
        title: "AWS onboarding smoke source",
        content: "We never discount more than 15%. Prefer a complimentary add-on to protect our premium positioning.",
      },
    }) }] }],
    inferenceConfig: { maxTokens: 2_500, temperature: 0.1 },
  }));
  const extractionText = extraction.output?.message?.content?.flatMap((block) => block.text ? [block.text] : []).join("\n");
  if (!extractionText) throw new Error("Onboarding extraction returned no text");
  const extractionValue = JSON.parse(jsonText(extractionText));
  if (!Array.isArray(extractionValue.candidates) || extractionValue.candidates.length === 0 || extractionValue.candidates.length > 12) {
    throw new Error("Onboarding extraction did not return a bounded candidate list");
  }
  if (!extractionValue.candidates.some((candidate) => typeof candidate?.statement === "string" && candidate.statement.includes("15%"))) {
    throw new Error("Onboarding extraction did not preserve the source-backed discount rule");
  }
  console.log("PASS Bedrock onboarding extraction");

  await dynamo.send(new TransactWriteCommand({
    ClientRequestToken: createHash("sha256").update(runId).digest("hex").slice(0, 36),
    TransactItems: [
      { Put: { TableName: tableName, Item: {
        ...recordKey, entity: "MEMORY", id: memoryId, companyId, type: "DECISION",
        status: "APPROVED", currentVersion: 1, title: "AWS smoke memory",
        appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL", tags: ["smoke"],
        effectiveFrom: now, createdAt: now, updatedAt: now, indexStatus: "READY",
      }, ConditionExpression: "attribute_not_exists(PK)" } },
      { Put: { TableName: tableName, Item: {
        ...versionKey, entity: "MEMORY_VERSION", memoryId, companyId, version: 1,
        title: "AWS smoke memory", statement: "AWS smoke retrieval marker.", rationale: "Integration verification.",
        appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL", tags: ["smoke"], effectiveFrom: now,
        sourceRefs: [{ sourceId: `source-${runId}`, label: "AWS smoke test" }],
        approvedBy: "smoke-test", approvedAt: now, createdAt: now,
      }, ConditionExpression: "attribute_not_exists(PK)" } },
      { Put: { TableName: tableName, Item: {
        ...auditKey, entity: "AUDIT", id: runId, companyId, actorId: "smoke-test",
        action: "SMOKE_MEMORY_CREATED", targetType: "MEMORY", targetId: memoryId, createdAt: now,
      }, ConditionExpression: "attribute_not_exists(PK)" } },
    ],
  }));
  persisted = true;
  console.log("PASS DynamoDB transactional write");

  const document = `# AWS smoke memory\n\n- Company ID: ${companyId}\n- Memory ID: ${memoryId}\n- Version: 1\n- Status: APPROVED\n\nAWS smoke retrieval marker.\n`;
  const digest = createHash("sha256").update(document).digest();
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: objectKey, Body: document, ContentType: "text/markdown; charset=utf-8",
    ServerSideEncryption: "AES256", ChecksumSHA256: digest.toString("base64"),
  }));
  uploaded = true;
  console.log("PASS encrypted S3 upload");

  await agent.send(new IngestKnowledgeBaseDocumentsCommand({
    knowledgeBaseId, dataSourceId,
    clientToken: createHash("sha256").update(s3Uri).digest("hex"),
    documents: [{
      content: { dataSourceType: "S3", s3: { s3Location: { uri: s3Uri } } },
      metadata: { type: "IN_LINE_ATTRIBUTE", inlineAttributes: [
        { key: "companyId", value: { type: "STRING", stringValue: companyId } },
        { key: "memoryId", value: { type: "STRING", stringValue: memoryId } },
        { key: "version", value: { type: "NUMBER", numberValue: 1 } },
        { key: "status", value: { type: "STRING", stringValue: "APPROVED" } },
        { key: "roleScopes", value: { type: "STRING_LIST", stringListValue: ["EMPLOYEE"] } },
        { key: "sensitivity", value: { type: "STRING", stringValue: "INTERNAL" } },
      ] },
    }],
  }));
  ingested = true;

  let hit;
  for (let attempt = 0; attempt < 15 && !hit; attempt += 1) {
    const result = await agentRuntime.send(new RetrieveCommand({
      knowledgeBaseId,
      retrievalQuery: { text: "AWS smoke retrieval marker" },
      retrievalConfiguration: { vectorSearchConfiguration: {
        numberOfResults: 5,
        filter: { andAll: [
          { equals: { key: "companyId", value: companyId } },
          { equals: { key: "status", value: "APPROVED" } },
        ] },
      } },
    }));
    hit = result.retrievalResults?.find((item) => item.metadata?.memoryId === memoryId);
    if (!hit) await sleep(2_000);
  }
  if (!hit) throw new Error("Knowledge Base did not return the scoped smoke document within 30 seconds");
  console.log("PASS scoped Knowledge Base retrieval");

  const [record, version] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: tableName, Key: recordKey, ConsistentRead: true })),
    dynamo.send(new GetCommand({ TableName: tableName, Key: versionKey, ConsistentRead: true })),
  ]);
  if (record.Item?.companyId !== companyId || version.Item?.memoryId !== memoryId) throw new Error("DynamoDB hydration failed");
  console.log("PASS structured record hydration");
  console.log("AWS smoke test passed");
} finally {
  if (ingested) {
    await agent.send(new DeleteKnowledgeBaseDocumentsCommand({
      knowledgeBaseId, dataSourceId,
      documentIdentifiers: [{ dataSourceType: "S3", s3: { uri: s3Uri } }],
    })).catch(() => undefined);
  }
  if (uploaded) await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })).catch(() => undefined);
  if (persisted) {
    await Promise.all([recordKey, versionKey, auditKey].map((Key) =>
      dynamo.send(new DeleteCommand({ TableName: tableName, Key })).catch(() => undefined),
    ));
  }
}
