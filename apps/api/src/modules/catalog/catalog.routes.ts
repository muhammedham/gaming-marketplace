import type { FastifyInstance } from "fastify";

import { prisma } from "../../lib/prisma.js";

export async function catalogRoutes(app: FastifyInstance) {
  app.get("/categories", async () => {
    const items = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, description: true },
    });

    return { data: { items } };
  });

  app.get("/games", async () => {
    const items = await prisma.game.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    });

    return { data: { items } };
  });
}
