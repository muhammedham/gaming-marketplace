import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

function encryptionKey() {
  const configured = env.INTEGRATION_ENCRYPTION_KEY;
  const value = configured ?? (env.NODE_ENV === "test" ? Buffer.alloc(32, 7).toString("base64") : undefined);
  if (!value) {
    throw new AppError(
      503,
      "INTEGRATION_ENCRYPTION_NOT_CONFIGURED",
      "Set INTEGRATION_ENCRYPTION_KEY before saving provider API keys.",
    );
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new AppError(
      503,
      "INTEGRATION_ENCRYPTION_INVALID",
      "INTEGRATION_ENCRYPTION_KEY must be a Base64-encoded 32-byte key.",
    );
  }
  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(envelope: string) {
  const [version, ivValue, tagValue, encryptedValue, extra] = envelope.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue || extra) {
    throw new AppError(500, "INTEGRATION_SECRET_INVALID", "The stored provider credential is invalid.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AppError(500, "INTEGRATION_SECRET_INVALID", "The stored provider credential could not be decrypted.");
  }
}
