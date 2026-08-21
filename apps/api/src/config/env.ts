import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { z } from "zod";

loadDotenv({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default("http://127.0.0.1:5173"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  AUTH_COOKIE_NAME: z.string().min(1).default("gm_session"),
  AUTH_SESSION_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DEMO_ADMIN_EMAIL: z.email().default("admin@gaming.local"),
  DEMO_ADMIN_PASSWORD: z.string().min(8).default("Admin123!"),
  DEMO_BUYER_EMAIL: z.email().default("buyer@gaming.local"),
  DEMO_BUYER_PASSWORD: z.string().min(8).default("Buyer123!"),
  DEMO_SELLER_EMAIL: z.email().default("seller@gaming.local"),
  DEMO_SELLER_PASSWORD: z.string().min(8).default("Seller123!"),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  MEDIA_PUBLIC_URL: z.url().default("http://127.0.0.1:4000/uploads"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const messages = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  throw new Error(`Invalid environment configuration:\n${messages.join("\n")}`);
}

export const env = result.data;
