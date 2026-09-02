import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

function values() {
  const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new AppError(
      503,
      "R2_NOT_CONFIGURED",
      "Cloudflare R2 storage credentials are not configured on the API server.",
    );
  }
  return {
    bucket: R2_BUCKET_NAME,
    endpoint: env.R2_ENDPOINT ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  };
}

function client() {
  const config = values();
  return {
    bucket: config.bucket,
    client: new S3Client({
      region: env.R2_REGION,
      endpoint: config.endpoint,
      credentials: config.credentials,
    }),
  };
}

export function isR2Configured() {
  return Boolean(
    env.R2_ACCOUNT_ID &&
    env.R2_BUCKET_NAME &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY,
  );
}

export async function createUploadUrl(storageKey: string, contentType: string) {
  const r2 = client();
  const command = new PutObjectCommand({
    Bucket: r2.bucket,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(r2.client, command, { expiresIn: env.R2_UPLOAD_URL_TTL_SECONDS });
}

export async function createReadUrl(storageKey: string) {
  const r2 = client();
  return getSignedUrl(
    r2.client,
    new GetObjectCommand({ Bucket: r2.bucket, Key: storageKey }),
    { expiresIn: env.R2_READ_URL_TTL_SECONDS },
  );
}

export async function verifyUploadedObject(storageKey: string, expectedSize: number, expectedType: string) {
  const r2 = client();
  try {
    const result = await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: storageKey }));
    if (result.ContentLength !== expectedSize) {
      throw new AppError(409, "UPLOAD_SIZE_MISMATCH", "The uploaded video size does not match the upload request.");
    }
    if (result.ContentType && result.ContentType.toLowerCase() !== expectedType.toLowerCase()) {
      throw new AppError(409, "UPLOAD_TYPE_MISMATCH", "The uploaded video type does not match the upload request.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(409, "UPLOAD_NOT_FOUND", "The uploaded video could not be verified in R2.");
  }
}

export async function deleteObject(storageKey: string) {
  const r2 = client();
  await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: storageKey }));
}
