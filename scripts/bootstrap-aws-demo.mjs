import { readFile } from "node:fs/promises";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const required = ["AWS_REGION", "DYNAMODB_TABLE_NAME"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const region = process.env.AWS_REGION;
const tableName = process.env.DYNAMODB_TABLE_NAME;
const fixture = JSON.parse(await readFile(new URL("../fixtures/demo-company.json", import.meta.url), "utf8"));
const company = fixture.company;
const memberships = fixture.memberships;

if (!company || typeof company.id !== "string" || !Array.isArray(memberships)) {
  throw new Error("The demo company fixture is invalid.");
}

const companyId = process.env.DEMO_COMPANY_ID || company.id;
if (companyId !== company.id) {
  throw new Error(`DEMO_COMPANY_ID must match the fixture company id (${company.id}).`);
}

const baseClient = new DynamoDBClient({ region, maxAttempts: 3 });
const dynamo = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: { removeUndefinedValues: true },
});

function conditionalFailure(error) {
  return error instanceof Error && error.name === "ConditionalCheckFailedException";
}

async function putIfMissing(item, expectedEntity, label) {
  try {
    await dynamo.send(new PutCommand({
      TableName: tableName,
      Item: item,
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    return "created";
  } catch (error) {
    if (!conditionalFailure(error)) throw error;
    const existing = await dynamo.send(new GetCommand({
      TableName: tableName,
      Key: { PK: item.PK, SK: item.SK },
      ConsistentRead: true,
    }));
    if (existing.Item?.entity !== expectedEntity) {
      throw new Error(`${label} already exists with an unexpected entity type.`);
    }
    return "existing";
  }
}

const companyResult = await putIfMissing({
  PK: `COMPANY#${companyId}`,
  SK: "PROFILE",
  entity: "COMPANY",
  ...company,
}, "COMPANY", "Demo company profile");

let membershipsCreated = 0;
let membershipsExisting = 0;
for (const membership of memberships) {
  if (
    membership.companyId !== companyId
    || typeof membership.userId !== "string"
    || typeof membership.identityProvider !== "string"
    || typeof membership.identitySubject !== "string"
  ) {
    throw new Error("The demo membership fixture is invalid.");
  }
  const result = await putIfMissing({
    PK: `COMPANY#${companyId}`,
    SK: `MEMBER#${membership.userId}`,
    GSI1PK: `IDENTITY#${membership.identityProvider}#${membership.identitySubject}`,
    GSI1SK: `COMPANY#${companyId}`,
    entity: "MEMBERSHIP",
    ...membership,
  }, "MEMBERSHIP", `Demo membership ${membership.userId}`);
  if (result === "created") membershipsCreated += 1;
  else membershipsExisting += 1;
}

console.log(`Demo company profile: ${companyResult}.`);
console.log(`Demo memberships: ${membershipsCreated} created, ${membershipsExisting} already present.`);
console.log("AWS demo bootstrap complete. Existing approved knowledge was not changed.");
