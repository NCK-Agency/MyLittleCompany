import { z } from "zod";

const environmentSchema = z.object({
  APP_MODE: z.enum(["local", "aws"]).default("local"),
  AUTH_MODE: z.enum(["demo", "production"]).default("demo"),
  DEMO_COMPANY_ID: z.string().min(1).default("demo-salon"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("My Little Company"),
  NEXT_PUBLIC_DEMO_MODE: z.enum(["true", "false"]).default("true"),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

export function parseEnvironment(
  input: Record<string, string | undefined>,
): AppEnvironment {
  return environmentSchema.parse(input);
}

export const env = parseEnvironment(process.env);
