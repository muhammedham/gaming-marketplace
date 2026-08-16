import type { FastifyInstance, FastifyReply } from "fastify";

import { env } from "../../config/env.js";
import { LoginBodySchema, RegisterBodySchema, type LoginBody, type RegisterBody } from "./auth.schemas.js";
import { authenticateUser, getUserSession, registerUser, toSessionPayload } from "./auth.service.js";

const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  maxAge: env.AUTH_SESSION_TTL_SECONDS,
};

async function createSession(reply: FastifyReply, user: { id: string; role: "BUYER" | "SELLER" | "ADMIN" }) {
  const token = await reply.jwtSign(
    { role: user.role },
    { sign: { sub: user.id, expiresIn: env.AUTH_SESSION_TTL_SECONDS } },
  );

  reply.setCookie(env.AUTH_COOKIE_NAME, token, cookieOptions);
}

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterBody }>(
    "/register",
    { schema: { body: RegisterBodySchema } },
    async (request, reply) => {
      const user = await registerUser(request.body);
      await createSession(reply, user);
      return reply.code(201).send({ data: toSessionPayload(user) });
    },
  );

  app.post<{ Body: LoginBody }>(
    "/login",
    { schema: { body: LoginBodySchema } },
    async (request, reply) => {
      const user = await authenticateUser(request.body);
      await createSession(reply, user);
      return { data: toSessionPayload(user) };
    },
  );

  app.post("/logout", async (_request, reply) => {
    reply.clearCookie(env.AUTH_COOKIE_NAME, { path: "/" });
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: app.authenticate }, async (request) => {
    const user = await getUserSession(request.user.sub);
    return { data: toSessionPayload(user) };
  });
}
