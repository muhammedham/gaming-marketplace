import type { FastifyInstance } from "fastify";
import { Type, type Static } from "@sinclair/typebox";
import {
  actorFor,
  IdParams,
  PageQuery,
  TextBody,
  type Page,
} from "../orders/orders.shared.js";
import * as service from "./communication.service.js";

const TicketBody = Type.Object({
  orderId: Type.Optional(Type.String({ format: "uuid" })),
  subject: Type.String({ minLength: 1, maxLength: 160 }),
  body: Type.String({ minLength: 1, maxLength: 2000 }),
});
const ResolveBody = Type.Object({
  action: Type.Union([
    Type.Literal("Resume"),
    Type.Literal("Complete"),
    Type.Literal("Cancel"),
  ]),
  body: Type.String({ minLength: 1, maxLength: 1900 }),
});
const StatusBody = Type.Object({
  status: Type.Union([
    Type.Literal("Open"),
    Type.Literal("InProgress"),
    Type.Literal("Answered"),
    Type.Literal("Closed"),
  ]),
});
const ReviewBody = Type.Object({
  rating: Type.Integer({ minimum: 1, maximum: 5 }),
  comment: Type.Optional(Type.String({ maxLength: 1000 })),
});

export async function communicationRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: Page }>(
    "/sellers/:id",
    { schema: { params: IdParams, querystring: PageQuery } },
    async (r) => ({ data: await service.sellerProfile(r.params.id, r.query) }),
  );
  app.register(async (api) => {
    api.addHook("preHandler", app.authenticate);
    api.post<{ Body: { listingId: string } }>(
      "/conversations",
      {
        schema: {
          body: Type.Object({ listingId: Type.String({ format: "uuid" }) }),
        },
      },
      async (r, reply) =>
        reply
          .code(201)
          .send({
            data: await service.startConversation(
              await actorFor(r.user.sub),
              r.body.listingId,
            ),
          }),
    );
    api.get<{ Querystring: Page }>(
      "/conversations",
      { schema: { querystring: PageQuery } },
      async (r) => ({
        data: await service.listConversations(
          await actorFor(r.user.sub),
          r.query,
        ),
      }),
    );
    api.get<{ Params: { id: string } }>(
      "/conversations/:id",
      { schema: { params: IdParams } },
      async (r) => ({
        data: await service.getConversation(
          await actorFor(r.user.sub),
          r.params.id,
        ),
      }),
    );
    for (const [path, ticket] of [
      ["conversations", false],
      ["support/tickets", true],
    ] as const) {
      api.get<{ Params: { id: string }; Querystring: Page }>(
        `/${path}/:id/messages`,
        { schema: { params: IdParams, querystring: PageQuery } },
        async (r) => ({
          data: await service.listMessages(
            await actorFor(r.user.sub),
            r.params.id,
            r.query,
            ticket,
          ),
        }),
      );
      api.post<{ Params: { id: string }; Body: { body: string } }>(
        `/${path}/:id/messages`,
        { schema: { params: IdParams, body: TextBody } },
        async (r, reply) =>
          reply
            .code(201)
            .send({
              data: await (ticket ? service.replyTicket : service.sendMessage)(
                await actorFor(r.user.sub),
                r.params.id,
                r.body.body,
              ),
            }),
      );
    }
    api.post<{ Body: Static<typeof TicketBody> }>(
      "/support/tickets",
      { schema: { body: TicketBody } },
      async (r, reply) =>
        reply
          .code(201)
          .send({
            data: await service.createTicket(
              await actorFor(r.user.sub),
              r.body,
            ),
          }),
    );
    api.get<{ Querystring: Page }>(
      "/support/tickets",
      { schema: { querystring: PageQuery } },
      async (r) => ({
        data: await service.listTickets(await actorFor(r.user.sub), r.query),
      }),
    );
    api.get<{ Params: { id: string } }>(
      "/support/tickets/:id",
      { schema: { params: IdParams } },
      async (r) => ({
        data: await service.getTicket(await actorFor(r.user.sub), r.params.id),
      }),
    );
    api.patch<{ Params: { id: string }; Body: Static<typeof StatusBody> }>(
      "/support/tickets/:id",
      { schema: { params: IdParams, body: StatusBody } },
      async (r) => ({
        data: await service.updateTicketStatus(
          await actorFor(r.user.sub),
          r.params.id,
          r.body.status,
        ),
      }),
    );
    api.post<{ Params: { id: string }; Body: Static<typeof ResolveBody> }>(
      "/support/tickets/:id/resolve",
      { schema: { params: IdParams, body: ResolveBody } },
      async (r) => {
        const data = await service.resolveTicket(
          await actorFor(r.user.sub),
          r.params.id,
          r.body,
        );
        app.orderJobsWake?.();
        return { data };
      },
    );
    api.post<{ Params: { id: string }; Body: Static<typeof ReviewBody> }>(
      "/orders/:id/review",
      { schema: { params: IdParams, body: ReviewBody } },
      async (r, reply) =>
        reply
          .code(201)
          .send({
            data: await service.createReview(
              await actorFor(r.user.sub),
              r.params.id,
              r.body,
            ),
          }),
    );
    api.get<{ Querystring: Page }>(
      "/notifications",
      { schema: { querystring: PageQuery } },
      async (r) => ({
        data: await service.listNotifications(
          await actorFor(r.user.sub),
          r.query,
        ),
      }),
    );
    api.post("/notifications/read-all", async (r) => ({
      data: await service.markNotification(await actorFor(r.user.sub)),
    }));
    api.post<{ Params: { id: string } }>(
      "/notifications/:id/read",
      { schema: { params: IdParams } },
      async (r) => ({
        data: await service.markNotification(
          await actorFor(r.user.sub),
          r.params.id,
        ),
      }),
    );
  });
}
