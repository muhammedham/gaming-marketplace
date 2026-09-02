import { Prisma } from "@prisma/client";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import { encryptSecret } from "../../lib/secret-crypto.js";
import type { Actor } from "../orders/orders.shared.js";

function output(item: {
  id: string;
  name: string;
  slug: string;
  status: string;
  inferenceIntegration: {
    provider: string;
    baseUrl: string | null;
    apiKeyEncrypted: string | null;
    apiKeyLastFour: string | null;
    enabled: boolean;
    updatedAt: Date;
  } | null;
}) {
  return {
    gameId: item.id,
    gameName: item.name,
    gameSlug: item.slug,
    gameStatus: item.status,
    supported: item.slug === "valorant",
    provider: item.inferenceIntegration?.provider ?? "EXTERNAL_API",
    baseUrl: item.inferenceIntegration?.baseUrl ?? "",
    apiKeyConfigured: Boolean(item.inferenceIntegration?.apiKeyEncrypted),
    apiKeyMasked: item.inferenceIntegration?.apiKeyLastFour
      ? `••••${item.inferenceIntegration.apiKeyLastFour}`
      : null,
    enabled: item.inferenceIntegration?.enabled ?? false,
    updatedAt: item.inferenceIntegration?.updatedAt.toISOString() ?? null,
  };
}

export async function listGameIntegrations() {
  const games = await prisma.game.findMany({
    orderBy: { name: "asc" },
    include: { inferenceIntegration: true },
  });
  return games.map(output);
}

export async function updateGameIntegration(
  actor: Actor,
  gameId: string,
  input: { baseUrl?: string; apiKey?: string; enabled: boolean },
) {
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { inferenceIntegration: true },
  });
  if (!game) throw new AppError(404, "GAME_NOT_FOUND", "Game not found.");
  if (game.slug !== "valorant") {
    throw new AppError(400, "GAME_INTEGRATION_UNSUPPORTED", "Inventory analysis is currently available only for Valorant.");
  }

  const requestedBaseUrl = input.baseUrl === undefined
    ? game.inferenceIntegration?.baseUrl ?? null
    : input.baseUrl.trim() || null;
  let baseUrl = requestedBaseUrl;
  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !localHttp) throw new Error("Unsupported protocol");
      parsed.search = "";
      parsed.hash = "";
      const inferencePath = "/api/v1/external/inference";
      const path = parsed.pathname.replace(/\/+$/, "");
      if (path.endsWith(inferencePath)) parsed.pathname = path.slice(0, -inferencePath.length) || "/";
      baseUrl = parsed.toString().replace(/\/+$/, "");
    } catch {
      throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", {
        baseUrl: ["Enter a valid HTTPS API base URL, for example https://example.trycloudflare.com."],
      });
    }
  }
  const apiKey = input.apiKey?.trim();
  const apiKeyEncrypted = apiKey
    ? encryptSecret(apiKey)
    : game.inferenceIntegration?.apiKeyEncrypted ?? null;
  const apiKeyLastFour = apiKey
    ? apiKey.slice(-4)
    : game.inferenceIntegration?.apiKeyLastFour ?? null;
  if (input.enabled && !baseUrl) {
    throw new AppError(400, "INTEGRATION_INCOMPLETE", "The API base URL is required before enabling the integration.");
  }

  const integration = await prisma.$transaction(async (tx) => {
    const updated = await tx.gameInferenceIntegration.upsert({
      where: { gameId },
      update: { provider: "EXTERNAL_API", baseUrl, apiKeyEncrypted, apiKeyLastFour, enabled: input.enabled },
      create: { gameId, provider: "EXTERNAL_API", baseUrl, apiKeyEncrypted, apiKeyLastFour, enabled: input.enabled },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: actor.id,
        action: "GAME_INFERENCE_INTEGRATION_UPDATED",
        entityType: "GameInferenceIntegration",
        entityId: updated.id,
        details: {
          gameId,
          provider: updated.provider,
          baseUrl: updated.baseUrl,
          enabled: updated.enabled,
          apiKeyRotated: Boolean(apiKey),
        } satisfies Prisma.InputJsonObject,
      },
    });
    return updated;
  });

  return output({ ...game, inferenceIntegration: integration });
}
