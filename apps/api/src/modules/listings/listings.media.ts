import { ListingMediaRole } from "@prisma/client";
import type { FastifyRequest } from "fastify";
import { createWriteStream } from "node:fs";
import { mkdir, open, rename, rmdir, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { pipeline } from "node:stream/promises";

import { uploadDirectory } from "../../config/uploads.js";
import { AppError } from "../../lib/app-error.js";
import type { ListingBody } from "./listings.schemas.js";
import type { StoredMediaInput } from "./listings.service.js";

const MB = 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;

const rules = {
  [ListingMediaRole.COVER]: {
    maxBytes: 5 * MB,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  [ListingMediaRole.GALLERY]: {
    maxBytes: 5 * MB,
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
  },
  [ListingMediaRole.VIDEO]: {
    maxBytes: 25 * MB,
    mimeTypes: ["video/mp4", "video/webm"],
  },
} as const;

const extensionsByMimeType: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
};

const canonicalExtensionByMimeType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
};

interface TemporaryUpload {
  fieldName: string;
  originalName: string;
  mimeType: string;
  path: string;
  sizeBytes: number;
}

interface ReceivedParts {
  fields: Map<string, string>;
  files: TemporaryUpload[];
}

function requestFileTooLarge(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "FST_REQ_FILE_TOO_LARGE",
  );
}

async function receiveParts(
  request: FastifyRequest,
  allowedFields: Set<string>,
  allowedFileFields: Set<string>,
  limits: { files: number; fields: number; parts: number },
): Promise<ReceivedParts> {
  if (!request.isMultipart()) {
    throw new AppError(415, "MULTIPART_REQUIRED", "Use multipart/form-data for this request.");
  }

  const temporaryDirectory = path.join(uploadDirectory, ".tmp");
  await mkdir(temporaryDirectory, { recursive: true });
  const fields = new Map<string, string>();
  const files: TemporaryUpload[] = [];

  try {
    for await (const part of request.parts({
      limits: { ...limits, fileSize: 25 * MB },
    })) {
      if (part.type === "field") {
        if (!allowedFields.has(part.fieldname)) {
          throw new AppError(400, "UNEXPECTED_FIELD", `Field ${part.fieldname} is not allowed.`);
        }
        if (fields.has(part.fieldname)) {
          throw new AppError(400, "DUPLICATE_FIELD", `Field ${part.fieldname} may only be sent once.`);
        }
        fields.set(part.fieldname, String(part.value));
        continue;
      }

      if (!allowedFileFields.has(part.fieldname)) {
        part.file.resume();
        throw new AppError(400, "UNEXPECTED_FILE", `File field ${part.fieldname} is not allowed.`);
      }

      const temporaryPath = path.join(temporaryDirectory, `${randomUUID()}.upload`);
      try {
        await pipeline(part.file, createWriteStream(temporaryPath, { flags: "wx" }));
      } catch (error) {
        await unlink(temporaryPath).catch(() => undefined);
        throw error;
      }
      const metadata = await stat(temporaryPath);
      files.push({
        fieldName: part.fieldname,
        originalName: part.filename,
        mimeType: part.mimetype.toLowerCase(),
        path: temporaryPath,
        sizeBytes: metadata.size,
      });

      if (part.file.truncated) {
        throw new AppError(413, "MEDIA_TOO_LARGE", "The uploaded media exceeds the allowed size.");
      }
    }

    return { fields, files };
  } catch (error) {
    await removeTemporaryFiles(files);
    if (requestFileTooLarge(error)) {
      throw new AppError(413, "MEDIA_TOO_LARGE", "The uploaded media exceeds the allowed size.");
    }
    throw error;
  }
}

async function removeTemporaryFiles(files: TemporaryUpload[]) {
  await Promise.all(files.map((file) => unlink(file.path).catch(() => undefined)));
}

async function fileHeader(filePath: string) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(16);
    const result = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, result.bytesRead);
  } finally {
    await handle.close();
  }
}

function headerMatchesMimeType(header: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP";
  }
  if (mimeType === "video/mp4") {
    return header.subarray(4, 8).toString("ascii") === "ftyp";
  }
  if (mimeType === "video/webm") {
    return header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  }
  return false;
}

async function validateTemporaryUpload(file: TemporaryUpload, role: ListingMediaRole) {
  const rule = rules[role];
  const extension = path.extname(file.originalName).toLowerCase();

  if (!(rule.mimeTypes as readonly string[]).includes(file.mimeType)) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", `The ${role.toLowerCase()} MIME type is not allowed.`);
  }
  if (!extensionsByMimeType[file.mimeType]?.includes(extension)) {
    throw new AppError(415, "INVALID_MEDIA_EXTENSION", "The file extension does not match its MIME type.");
  }
  if (file.sizeBytes <= 0 || file.sizeBytes > rule.maxBytes) {
    throw new AppError(413, "MEDIA_TOO_LARGE", `The ${role.toLowerCase()} file exceeds its size limit.`);
  }
  if (!headerMatchesMimeType(await fileHeader(file.path), file.mimeType)) {
    throw new AppError(415, "INVALID_MEDIA_CONTENT", "The file content does not match its declared MIME type.");
  }
}

function listingBodyFromFields(fields: Map<string, string>): ListingBody {
  const categoryId = fields.get("categoryId") ?? "";
  const gameIdValue = fields.get("gameId")?.trim();
  const title = fields.get("title") ?? "";
  const description = fields.get("description") ?? "";
  const price = fields.get("price") ?? "";
  const details: Record<string, string[]> = {};

  if (!UUID_PATTERN.test(categoryId)) details.categoryId = ["Category id must be a UUID."];
  if (gameIdValue && !UUID_PATTERN.test(gameIdValue)) details.gameId = ["Game id must be a UUID."];
  if (title.length < 3 || title.length > 160) details.title = ["Title must contain 3 to 160 characters."];
  if (description.length < 20 || description.length > 5_000) {
    details.description = ["Description must contain 20 to 5000 characters."];
  }
  if (!PRICE_PATTERN.test(price)) details.price = ["Price must be a positive decimal with up to 2 decimal places."];

  if (Object.keys(details).length > 0) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", details);
  }

  return {
    categoryId,
    gameId: gameIdValue || null,
    title,
    description,
    price,
  };
}

function roleForCreateField(fieldName: string) {
  if (fieldName === "cover") return ListingMediaRole.COVER;
  if (fieldName === "gallery") return ListingMediaRole.GALLERY;
  return ListingMediaRole.VIDEO;
}

function safeUploadPath(storageKey: string) {
  const segments = storageKey.split("/");
  const resolved = path.resolve(uploadDirectory, ...segments);
  const relative = path.relative(uploadDirectory, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Unsafe media storage key.");
  }
  return resolved;
}

async function moveToListingStorage(
  listingId: string,
  title: string,
  files: Array<{ file: TemporaryUpload; role: ListingMediaRole; sortOrder: number }>,
) {
  const stored: StoredMediaInput[] = [];
  try {
    for (const item of files) {
      const extension = canonicalExtensionByMimeType[item.file.mimeType];
      const storageKey = `listings/${listingId}/${randomUUID()}${extension}`;
      const destination = safeUploadPath(storageKey);
      await mkdir(path.dirname(destination), { recursive: true });
      await rename(item.file.path, destination);
      stored.push({
        role: item.role,
        storageKey,
        mimeType: item.file.mimeType,
        sizeBytes: item.file.sizeBytes,
        altText:
          item.role === ListingMediaRole.COVER
            ? `${title.trim()} cover`
            : item.role === ListingMediaRole.VIDEO
              ? `${title.trim()} product video`
              : `${title.trim()} gallery image ${item.sortOrder + 1}`,
        sortOrder: item.sortOrder,
      });
    }
    return stored;
  } catch (error) {
    await removeStoredMediaFiles(stored.map((item) => item.storageKey)).catch(() => undefined);
    throw error;
  }
}

export async function prepareCreateListingUpload(request: FastifyRequest) {
  const received = await receiveParts(
    request,
    new Set(["categoryId", "gameId", "title", "description", "price"]),
    new Set(["cover", "gallery", "video"]),
    {
    files: 7,
    fields: 6,
    parts: 13,
    },
  );

  try {
    const input = listingBodyFromFields(received.fields);
    const grouped = {
      cover: received.files.filter((file) => file.fieldName === "cover"),
      gallery: received.files.filter((file) => file.fieldName === "gallery"),
      video: received.files.filter((file) => file.fieldName === "video"),
    };

    if (grouped.cover.length !== 1) {
      throw new AppError(400, "COVER_REQUIRED", "Exactly one Cover image is required.");
    }
    if (grouped.gallery.length > 5) {
      throw new AppError(400, "GALLERY_LIMIT_EXCEEDED", "A listing can contain up to 5 gallery images.");
    }
    if (grouped.video.length > 1) {
      throw new AppError(400, "VIDEO_LIMIT_EXCEEDED", "A listing can contain one Video.");
    }

    const prepared = received.files.map((file) => ({
      file,
      role: roleForCreateField(file.fieldName),
      sortOrder: file.fieldName === "gallery" ? grouped.gallery.indexOf(file) : 0,
    }));
    for (const item of prepared) await validateTemporaryUpload(item.file, item.role);

    const listingId = randomUUID();
    const media = await moveToListingStorage(listingId, input.title, prepared);
    return { input, listingId, media };
  } finally {
    await removeTemporaryFiles(received.files);
  }
}

export async function prepareListingMediaUpload(
  request: FastifyRequest,
  listingId: string,
  listingTitle: string,
) {
  const received = await receiveParts(
    request,
    new Set(["role"]),
    new Set(["file"]),
    { files: 1, fields: 1, parts: 2 },
  );

  try {
    if (received.files.length !== 1) {
      throw new AppError(400, "MEDIA_FILE_REQUIRED", "Exactly one media file is required.");
    }

    const roleValue = received.fields.get("role")?.toUpperCase();
    if (!roleValue || !Object.values(ListingMediaRole).includes(roleValue as ListingMediaRole)) {
      throw new AppError(400, "INVALID_MEDIA_ROLE", "Role must be COVER, GALLERY, or VIDEO.");
    }
    const role = roleValue as ListingMediaRole;
    await validateTemporaryUpload(received.files[0], role);
    const media = await moveToListingStorage(listingId, listingTitle, [
      { file: received.files[0], role, sortOrder: 0 },
    ]);
    return media[0];
  } finally {
    await removeTemporaryFiles(received.files);
  }
}

export async function removeStoredMediaFiles(storageKeys: string[]) {
  const filePaths = storageKeys.map(safeUploadPath);
  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await unlink(filePath);
      } catch (error) {
        if (!error || typeof error !== "object" || !("code" in error) || error.code !== "ENOENT") {
          throw error;
        }
      }
    }),
  );

  const directories = new Set(filePaths.map((filePath) => path.dirname(filePath)));
  await Promise.all(
    [...directories].map(async (directory) => {
      try {
        await rmdir(directory);
      } catch (error) {
        if (
          !error ||
          typeof error !== "object" ||
          !("code" in error) ||
          !["ENOENT", "ENOTEMPTY"].includes(String(error.code))
        ) {
          throw error;
        }
      }
    }),
  );
}
