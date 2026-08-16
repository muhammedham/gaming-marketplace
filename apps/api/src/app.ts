import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify, { type FastifyError } from "fastify";

import { env } from "./config/env.js";
import { AppError } from "./lib/app-error.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
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

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  app.register(cookie);
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
