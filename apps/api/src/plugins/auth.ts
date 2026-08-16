import type { UserRole } from "@prisma/client";
import type { FastifyRequest, preHandlerHookHandler } from "fastify";
import fp from "fastify-plugin";

import { AppError } from "../lib/app-error.js";
import { prisma } from "../lib/prisma.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { role: UserRole };
    user: { sub: string; role: UserRole };
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    authorize: (roles: UserRole[]) => preHandlerHookHandler;
  }
}

export const authPlugin = fp(async (app) => {
  app.decorate("authenticate", async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError(401, "UNAUTHENTICATED", "Authentication is required.");
    }
  });

  app.decorate("authorize", (roles: UserRole[]): preHandlerHookHandler => {
    return async (request) => {
      const user = await prisma.user.findUnique({
        where: { id: request.user.sub },
        select: { role: true },
      });

      if (!user) {
        throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session is no longer valid.");
      }

      if (!roles.includes(user.role)) {
        throw new AppError(403, "FORBIDDEN", "You do not have permission for this action.");
      }
    };
  });
});
