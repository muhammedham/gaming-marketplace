import { UserRole } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { getUserSession, toSessionPayload } from "../auth/auth.service.js";

export async function adminRoutes(app: FastifyInstance) {
  app.get(
    "/session",
    { preHandler: [app.authenticate, app.authorize([UserRole.ADMIN])] },
    async (request) => {
      const user = await getUserSession(request.user.sub);
      return { data: toSessionPayload(user) };
    },
  );
}
