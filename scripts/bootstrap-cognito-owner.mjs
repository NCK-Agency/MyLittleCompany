import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

const required = [
  "COGNITO_REGION",
  "COGNITO_USER_POOL_ID",
  "DYNAMODB_TABLE_NAME",
  "BOOTSTRAP_OWNER_EMAIL",
];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const region = process.env.COGNITO_REGION;
const poolId = process.env.COGNITO_USER_POOL_ID;
const tableName = process.env.DYNAMODB_TABLE_NAME;
const email = process.env.BOOTSTRAP_OWNER_EMAIL.trim().toLowerCase();
const displayName = process.env.BOOTSTRAP_OWNER_NAME?.trim() || "Company owner";
const companyId = process.env.DEMO_COMPANY_ID || "demo-salon";
const cognito = new CognitoIdentityProviderClient({ region, maxAttempts: 3 });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region, maxAttempts: 3 }), {
  marshallOptions: { removeUndefinedValues: true },
});

function attribute(attributes, name) {
  return attributes?.find((item) => item.Name === name)?.Value;
}

const company = await dynamo.send(new GetCommand({
  TableName: tableName,
  Key: { PK: `COMPANY#${companyId}`, SK: "PROFILE" },
  ConsistentRead: true,
}));
if (company.Item?.entity !== "COMPANY" || company.Item?.id !== companyId) {
  throw new Error("Demo company profile is missing. Run pnpm bootstrap:aws-demo before pnpm bootstrap:cognito.");
}

let cognitoUser;
try {
  cognitoUser = await cognito.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: email }));
} catch (error) {
  if (!(error instanceof UserNotFoundException)) throw error;
  const created = await cognito.send(new AdminCreateUserCommand({
    UserPoolId: poolId,
    Username: email,
    DesiredDeliveryMediums: ["EMAIL"],
    UserAttributes: [
      { Name: "email", Value: email },
      { Name: "email_verified", Value: "true" },
      { Name: "name", Value: displayName },
    ],
  }));
  cognitoUser = { UserAttributes: created.User?.Attributes };
}

const subject = attribute(cognitoUser.UserAttributes, "sub");
if (!subject) throw new Error("Cognito user has no sub attribute");
const identityKey = `IDENTITY#COGNITO#${subject}`;
const existing = await dynamo.send(new QueryCommand({
  TableName: tableName,
  IndexName: "GSI1",
  KeyConditionExpression: "GSI1PK = :identity",
  ExpressionAttributeValues: { ":identity": identityKey },
  Limit: 1,
}));

if (!existing.Items?.length) {
  const now = new Date().toISOString();
  const userId = `user-${crypto.randomUUID()}`;
  await dynamo.send(new PutCommand({
    TableName: tableName,
    Item: {
      PK: `COMPANY#${companyId}`,
      SK: `MEMBER#${userId}`,
      GSI1PK: identityKey,
      GSI1SK: `COMPANY#${companyId}`,
      entity: "MEMBERSHIP",
      companyId,
      userId,
      email,
      displayName,
      identityProvider: "COGNITO",
      identitySubject: subject,
      roles: ["OWNER"],
      grants: [],
      status: "INVITED",
      createdAt: now,
      updatedAt: now,
    },
    ConditionExpression: "attribute_not_exists(PK)",
  }));
  console.log(`Created owner membership for ${email}.`);
} else {
  console.log(`Owner membership already exists for ${email}.`);
}
