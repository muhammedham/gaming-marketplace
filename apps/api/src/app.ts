import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError } from "fastify";
import { mkdirSync } from "node:fs";

import { env } from "./config/env.js";
import { uploadDirectory } from "./config/uploads.js";
import { AppError } from "./lib/app-error.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { catalogRoutes } from "./modules/catalog/catalog.routes.js";
import { listingsRoutes } from "./modules/listings/listings.routes.js";
import { walletRoutes } from "./modules/wallet/wallet.routes.js";
import { authPlugin } from "./plugins/auth.js";

interface BuildAppOptions {
  logger?: boolean;
}

function validationDetails(error: FastifyError) {
  if (!error.validation) {
    return undefined;
  }

  return error.validation.reduce<Record<string, string[]>>((details, issue) => {
    const field = issue.instancePath.replace(/^\//, "") || "request";
    details[field] = [...(details[field] ?? []), issue.message ?? "Invalid value."];
    return details;
  }, {});
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? (env.NODE_ENV !== "test" ? { level: env.LOG_LEVEL } : false),
  });

  const localWebOrigins = [
    env.WEB_ORIGIN,
    env.WEB_ORIGIN.replace("127.0.0.1", "localhost"),
    env.WEB_ORIGIN.replace("localhost", "127.0.0.1"),
  ].filter((origin, index, origins) => origins.indexOf(origin) === index);

  app.register(cors, {
    origin: localWebOrigins,
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "OPTIONS"],
  });
  app.register(cookie);
  app.register(multipart);
  mkdirSync(uploadDirectory, { recursive: true });
  app.register(fastifyStatic, {
    root: uploadDirectory,
    prefix: "/uploads/",
    decorateReply: false,
    serveDotFiles: false,
  });
  app.register(jwt, {
    secret: env.JWT_SECRET,
    cookie: { cookieName: env.AUTH_COOKIE_NAME, signed: false },
  });
  app.register(authPlugin);

  app.get("/health", async () => {
    await prisma.$queryRaw`SELECT 1`;
    if (redis.status === "wait") {
      await redis.connect();
    }
    const redisStatus = await redis.ping();

    return {
      data: {
        status: "ok",
        services: { postgres: "up", redis: redisStatus === "PONG" ? "up" : "down" },
      },
    };
  });

  app.register(authRoutes, { prefix: "/api/v1/auth" });
  app.register(adminRoutes, { prefix: "/api/v1/admin" });
  app.register(catalogRoutes, { prefix: "/api/v1" });
  app.register(listingsRoutes, { prefix: "/api/v1/listings" });
  app.register(walletRoutes, { prefix: "/api/v1/wallet" });

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as FastifyError;

    if (fastifyError.validation) {
      return reply.code(400).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "The request is invalid.",
          details: validationDetails(fastifyError),
        },
      });
    }

    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }

    request.log.error(error);
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
    });
  });

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
    if (redis.status !== "end") {
      redis.disconnect();
    }
  });

  return app;
}
