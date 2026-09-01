import type { FastifyInstance } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import { actorFor, IdParams, PageQuery, type Page } from "./orders.shared.js";
import {
  cancelOrder,
  confirm,
  deliver,
  getOrder,
  listOrders,
  purchase,
} from "./orders.service.js";

const PurchaseBody = Type.Object({
  listingId: Type.String({ format: "uuid" }),
  expectedPrice: Type.String({
    pattern: "^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,2})?$",
    maxLength: 19,
  }),
  idempotencyKey: Type.String({
    minLength: 8,
    maxLength: 100,
    pattern: "^[A-Za-z0-9._-]+$",
  }),
});

export async function ordersRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.post<{ Body: Static<typeof PurchaseBody> }>(
    "/",
    { schema: { body: PurchaseBody } },
    async (request, reply) => {
      return reply
        .code(201)
        .send({
          data: await purchase(await actorFor(request.user.sub), request.body),
        });
    },
  );
  app.get<{ Querystring: Page }>(
    "/",
    { schema: { querystring: PageQuery } },
    async (request) => ({
      data: await listOrders(await actorFor(request.user.sub), request.query),
    }),
  );
  app.get<{ Params: { id: string } }>(
    "/:id",
    { schema: { params: IdParams } },
    async (request) => ({
      data: await getOrder(await actorFor(request.user.sub), request.params.id),
    }),
  );
  app.post<{ Params: { id: string }; Body: { deliveryNote: string } }>(
    "/:id/deliver",
    {
      schema: {
        params: IdParams,
        body: Type.Object({
          deliveryNote: Type.String({ minLength: 1, maxLength: 2000 }),
        }),
      },
    },
    async (request) => {
      const data = await deliver(
        await actorFor(request.user.sub),
        request.params.id,
        request.body.deliveryNote,
      );
      // A wake-up speeds scheduling; the periodic DB reconciliation also covers crash-before-enqueue.
      app.orderJobsWake?.();
      return { data };
    },
  );
  for (const [path, action] of [
    ["confirm", confirm],
    ["cancel", cancelOrder],
  ] as const) {
    app.post<{ Params: { id: string } }>(
      `/:id/${path}`,
      { schema: { params: IdParams } },
      async (request) => ({
        data: await action(await actorFor(request.user.sub), request.params.id),
      }),
    );
  }
}

declare module "fastify" {
  interface FastifyInstance {
    orderJobsWake?: () => void;
  }
}
