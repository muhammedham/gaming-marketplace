import { UserRole } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";

import * as service from "./inventory-analysis.service.js";

const IdParams = Type.Object({ id: Type.String({ format: "uuid" }) });
const ListingParams = Type.Object({ listingId: Type.String({ format: "uuid" }) });
const UploadBody = Type.Object({
  listingId: Type.String({ format: "uuid" }),
  fileName: Type.String({ minLength: 1, maxLength: 255 }),
  contentType: Type.Union([Type.Literal("video/mp4"), Type.Literal("video/webm")]),
  sizeBytes: Type.Integer({ minimum: 1, maximum: 157_286_400 }),
});

declare module "fastify" {
  interface FastifyInstance {
    inventoryAnalysisJobsWake: () => void;
  }
}

export async function inventoryAnalysisRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.authorize([UserRole.SELLER]));

  app.get<{ Params: Static<typeof ListingParams> }>(
    "/listings/:listingId",
    { schema: { params: ListingParams } },
    async (request) => ({
      data: await service.getListingAnalysisOverview(request.params.listingId, request.user.sub),
    }),
  );
  app.post<{ Body: Static<typeof UploadBody> }>(
    "/upload-url",
    { schema: { body: UploadBody } },
    async (request, reply) => reply.code(201).send({
      data: await service.requestUpload(request.user.sub, request.body),
    }),
  );
  app.post<{ Params: Static<typeof IdParams> }>(
    "/:id/complete-upload",
    { schema: { params: IdParams } },
    async (request) => {
      const analysis = await service.completeUpload(request.params.id, request.user.sub);
      app.inventoryAnalysisJobsWake();
      return { data: analysis };
    },
  );
  app.get<{ Params: Static<typeof IdParams> }>(
    "/:id",
    { schema: { params: IdParams } },
    async (request) => ({ data: await service.getAnalysis(request.params.id, request.user.sub) }),
  );
}
