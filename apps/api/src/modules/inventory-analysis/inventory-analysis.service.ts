import { InventoryAnalysisStatus, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { env } from "../../config/env.js";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { createReadUrl, createUploadUrl, deleteObject, isR2Configured, verifyUploadedObject } from "../../lib/r2.js";
import { decryptSecret } from "../../lib/secret-crypto.js";

const VIDEO_TYPES = new Map([
  ["video/mp4", "mp4"],
  ["video/webm", "webm"],
]);
const INFERENCE_PATH = "/api/v1/external/inference";
const INFERENCE_POLL_INTERVAL_MS = 3_000;

type AnalysisRecord = Prisma.InventoryAnalysisGetPayload<Record<string, never>>;

function analysisOutput(analysis: AnalysisRecord) {
  return {
    id: analysis.id,
    listingId: analysis.listingId,
    gameId: analysis.gameId,
    status: analysis.status,
    fileName: analysis.originalFileName,
    mimeType: analysis.mimeType,
    sizeBytes: analysis.sizeBytes,
    providerJobId: analysis.providerJobId,
    output: analysis.output,
    rawResponse: analysis.rawResponse,
    errorMessage: analysis.errorMessage,
    uploadExpiresAt: analysis.uploadExpiresAt.toISOString(),
    deleteAfter: analysis.deleteAfter.toISOString(),
    deletedAt: analysis.deletedAt?.toISOString() ?? null,
    startedAt: analysis.startedAt?.toISOString() ?? null,
    completedAt: analysis.completedAt?.toISOString() ?? null,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
  };
}

async function ownedContext(listingId: string, sellerId: string) {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    include: {
      category: { select: { slug: true, name: true } },
      game: { include: { inferenceIntegration: true } },
    },
  });
  if (!listing) throw new AppError(404, "LISTING_NOT_FOUND", "Listing not found.");
  if (listing.sellerId !== sellerId) {
    throw new AppError(403, "FORBIDDEN", "You can analyze only your own listings.");
  }
  return listing;
}

function isEligible(listing: Awaited<ReturnType<typeof ownedContext>>) {
  return listing.category.slug === "accounts" && listing.game?.slug === "valorant";
}

export async function getListingAnalysisOverview(listingId: string, sellerId: string) {
  const listing = await ownedContext(listingId, sellerId);
  const latest = await prisma.inventoryAnalysis.findFirst({
    where: { listingId, sellerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const integration = listing.game?.inferenceIntegration;
  return {
    listing: {
      id: listing.id,
      title: listing.title,
      category: listing.category,
      game: listing.game ? { id: listing.game.id, name: listing.game.name, slug: listing.game.slug } : null,
    },
    eligible: isEligible(listing),
    integrationConfigured: Boolean(
      integration?.enabled && integration.baseUrl,
    ),
    storageConfigured: isR2Configured(),
    maxSizeBytes: env.INVENTORY_ANALYSIS_MAX_BYTES,
    retentionMinutes: env.INVENTORY_VIDEO_RETENTION_MINUTES,
    acceptedTypes: [...VIDEO_TYPES.keys()],
    latest: latest ? analysisOutput(latest) : null,
  };
}

function safeOriginalName(value: string) {
  const normalized = [...value.trim()]
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join("");
  return normalized.slice(0, 255) || "inventory-video";
}

export async function requestUpload(
  sellerId: string,
  input: { listingId: string; fileName: string; contentType: string; sizeBytes: number },
) {
  const listing = await ownedContext(input.listingId, sellerId);
  if (!isEligible(listing)) {
    throw new AppError(
      400,
      "INVENTORY_ANALYSIS_NOT_ELIGIBLE",
      "Inventory analysis is available only for Valorant listings in the Accounts category.",
    );
  }
  const integration = listing.game!.inferenceIntegration;
  if (!integration?.enabled || !integration.baseUrl) {
    throw new AppError(409, "INVENTORY_ANALYSIS_DISABLED", "The Valorant analyzer is not configured by an Admin.");
  }
  if (!isR2Configured()) {
    throw new AppError(503, "R2_NOT_CONFIGURED", "Cloudflare R2 storage is not configured on the API server.");
  }
  const contentType = input.contentType.toLowerCase();
  const extension = VIDEO_TYPES.get(contentType);
  if (!extension) {
    throw new AppError(400, "INVALID_VIDEO_TYPE", "Choose an MP4 or WebM video.");
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > env.INVENTORY_ANALYSIS_MAX_BYTES) {
    throw new AppError(400, "VIDEO_TOO_LARGE", "The inventory video must be 150 MB or smaller.");
  }

  const id = randomUUID();
  const now = Date.now();
  const uploadExpiresAt = new Date(now + env.R2_UPLOAD_URL_TTL_SECONDS * 1000);
  const deleteAfter = new Date(now + env.INVENTORY_VIDEO_RETENTION_MINUTES * 60_000);
  const storageKey = `inventory-analyses/${sellerId}/${id}/inventory.${extension}`;
  const analysis = await prisma.inventoryAnalysis.create({
    data: {
      id,
      listingId: listing.id,
      sellerId,
      gameId: listing.game!.id,
      storageKey,
      originalFileName: safeOriginalName(input.fileName),
      mimeType: contentType,
      sizeBytes: input.sizeBytes,
      uploadExpiresAt,
      deleteAfter,
    },
  });

  try {
    return {
      analysis: analysisOutput(analysis),
      uploadUrl: await createUploadUrl(storageKey, contentType),
      uploadHeaders: { "Content-Type": contentType },
    };
  } catch (error) {
    await prisma.inventoryAnalysis.delete({ where: { id } });
    throw error;
  }
}

export async function completeUpload(analysisId: string, sellerId: string) {
  const analysis = await prisma.inventoryAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND", "Inventory analysis not found.");
  if (analysis.sellerId !== sellerId) throw new AppError(403, "FORBIDDEN", "This analysis belongs to another Seller.");
  if (analysis.status !== InventoryAnalysisStatus.AWAITING_UPLOAD) {
    return analysisOutput(analysis);
  }
  if (analysis.uploadExpiresAt.getTime() < Date.now()) {
    throw new AppError(410, "UPLOAD_URL_EXPIRED", "The upload link expired. Choose the video again.");
  }
  await verifyUploadedObject(analysis.storageKey, analysis.sizeBytes, analysis.mimeType);
  const queued = await prisma.inventoryAnalysis.update({
    where: { id: analysis.id },
    data: { status: InventoryAnalysisStatus.QUEUED, errorMessage: null },
  });
  return analysisOutput(queued);
}

export async function getAnalysis(analysisId: string, sellerId: string) {
  const analysis = await prisma.inventoryAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis) throw new AppError(404, "ANALYSIS_NOT_FOUND", "Inventory analysis not found.");
  if (analysis.sellerId !== sellerId) throw new AppError(403, "FORBIDDEN", "This analysis belongs to another Seller.");
  return analysisOutput(analysis);
}

function json(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null || value === undefined
    ? Prisma.JsonNull
    : value as Prisma.InputJsonValue;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message.slice(0, 1000);
  return "The inventory provider request failed.";
}

export function externalInferenceRequestBody(game: string, media: string) {
  return { game, media, mediaType: "video" as const };
}

function printableProviderValue(value: unknown) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function externalInferenceFailureMessage(result: Record<string, unknown>) {
  const detail =
    printableProviderValue(result.error) ||
    printableProviderValue(result.detail) ||
    printableProviderValue(result.message) ||
    printableProviderValue(result.result);
  return (detail || `Inference service returned status ${String(result.status ?? "unknown")}.`).slice(0, 1000);
}

export function externalInferenceUrl(baseUrl: string, inferenceId?: string) {
  const root = baseUrl.replace(/\/+$/, "");
  if (!inferenceId) return `${root}${INFERENCE_PATH}`;
  return `${root}${INFERENCE_PATH}/${encodeURIComponent(inferenceId)}`;
}

function providerHeaders(apiKeyEncrypted: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKeyEncrypted) headers.Authorization = `Bearer ${decryptSecret(apiKeyEncrypted)}`;
  return headers;
}

async function providerJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  const bodyText = await response.text();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(bodyText) as Record<string, unknown>;
  } catch {
    throw new Error(`Inference service returned a non-JSON response (${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(
      `${externalInferenceFailureMessage(result)} (HTTP ${response.status})`.slice(0, 1000),
    );
  }
  return result;
}

function providerStatus(result: Record<string, unknown>) {
  return typeof result.status === "string" ? result.status.toLowerCase() : "";
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

export async function processAnalysis(analysisId: string) {
  const analysis = await prisma.inventoryAnalysis.findUnique({
    where: { id: analysisId },
    include: { game: { include: { inferenceIntegration: true } } },
  });
  if (
    !analysis ||
    (analysis.status !== InventoryAnalysisStatus.QUEUED &&
      analysis.status !== InventoryAnalysisStatus.PROCESSING)
  ) return;
  if (analysis.deletedAt) {
    await prisma.inventoryAnalysis.update({
      where: { id: analysis.id },
      data: { status: InventoryAnalysisStatus.FAILED, errorMessage: "The temporary video has already been deleted." },
    });
    return;
  }
  const integration = analysis.game.inferenceIntegration;
  if (!integration?.enabled || !integration.baseUrl) {
    await prisma.inventoryAnalysis.update({
      where: { id: analysis.id },
      data: { status: InventoryAnalysisStatus.FAILED, errorMessage: "The Valorant provider integration is disabled or incomplete." },
    });
    return;
  }

  await prisma.inventoryAnalysis.update({
    where: { id: analysis.id },
    data: { status: InventoryAnalysisStatus.PROCESSING, startedAt: analysis.startedAt ?? new Date(), errorMessage: null },
  });

  try {
    const headers = providerHeaders(integration.apiKeyEncrypted);
    let providerJobId = analysis.providerJobId;
    let result: Record<string, unknown> | undefined;

    if (!providerJobId) {
      const media = await createReadUrl(analysis.storageKey);
      result = await providerJson(externalInferenceUrl(integration.baseUrl), {
        method: "POST",
        headers,
        body: JSON.stringify(externalInferenceRequestBody(analysis.game.slug, media)),
      });
      providerJobId = typeof result.id === "string" ? result.id : null;
      if (!providerJobId) throw new Error("Inference service did not return an inference id.");
      await prisma.inventoryAnalysis.update({
        where: { id: analysis.id },
        data: {
          providerJobId,
          rawResponse: json(result),
        },
      });
    }

    while (true) {
      result ??= await providerJson(externalInferenceUrl(integration.baseUrl, providerJobId), {
        method: "GET",
        headers,
      });
      const status = providerStatus(result);

      if (status === "completed") {
        await prisma.inventoryAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: InventoryAnalysisStatus.COMPLETED,
            providerJobId,
            rawResponse: json(result),
            output: json(result.result),
            completedAt: new Date(),
            errorMessage: null,
          },
        });
        return;
      }
      if (status === "failed" || status === "cancelled") {
        await prisma.inventoryAnalysis.update({
          where: { id: analysis.id },
          data: {
            status: InventoryAnalysisStatus.FAILED,
            providerJobId,
            rawResponse: json(result),
            errorMessage: externalInferenceFailureMessage(result),
            completedAt: new Date(),
          },
        });
        return;
      }
      if (status !== "queued" && status !== "running") {
        throw new Error(`Inference service returned unsupported status ${String(result.status ?? "missing")}.`);
      }
      await wait(INFERENCE_POLL_INTERVAL_MS);
      result = undefined;
    }
  } catch (error) {
    await prisma.inventoryAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: InventoryAnalysisStatus.FAILED,
        errorMessage: errorMessage(error),
        completedAt: new Date(),
      },
    });
  }
}

export async function deleteAnalysisVideo(analysisId: string) {
  const analysis = await prisma.inventoryAnalysis.findUnique({ where: { id: analysisId } });
  if (!analysis || analysis.deletedAt) return;
  await deleteObject(analysis.storageKey);
  await prisma.inventoryAnalysis.update({
    where: { id: analysis.id },
    data: {
      deletedAt: new Date(),
      ...(analysis.status === InventoryAnalysisStatus.AWAITING_UPLOAD
        ? { status: InventoryAnalysisStatus.EXPIRED, errorMessage: "The upload session expired." }
        : {}),
    },
  });
}
