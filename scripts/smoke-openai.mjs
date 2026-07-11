import OpenAI from "openai";

const models = [
  ["FAST", process.env.OPENAI_MODEL_FAST ?? "gpt-5.6-luna"],
  ["BALANCED", process.env.OPENAI_MODEL_BALANCED ?? "gpt-5.6-terra"],
  ["BEST", process.env.OPENAI_MODEL_BEST ?? "gpt-5.6-sol"],
];

if (!process.env.OPENAI_API_KEY) {
  console.error("OpenAI smoke configuration is incomplete: OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 0,
  timeout: 25_000,
});

const schema = {
  type: "object",
  properties: {
    ready: { type: "boolean" },
    tier: { type: "string", enum: models.map(([tier]) => tier) },
  },
  required: ["ready", "tier"],
  additionalProperties: false,
};

for (const [tier, model] of models) {
  const response = await client.responses.create({
    model,
    store: false,
    input: `Return ready=true and tier=${tier}.`,
    max_output_tokens: 80,
    text: {
      format: {
        type: "json_schema",
        name: "model_smoke",
        strict: true,
        schema,
      },
    },
  });
  const value = JSON.parse(response.output_text);
  if (value.ready !== true || value.tier !== tier) {
    throw new Error(`OpenAI ${tier} model returned an unexpected structured response.`);
  }
  console.log(`PASS ${tier} ${model} (${response._request_id ?? "request-id-unavailable"})`);
}

console.log("OpenAI model smoke passed");
