import { UserRole } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import type { FastifyInstance } from "fastify";

import { getUserSession, toSessionPayload } from "../auth/auth.service.js";
import { actorFor, IdParams, PageQuery } from "../orders/orders.shared.js";
import * as service from "./admin.service.js";
import * as integrations from "./game-integrations.service.js";

const SearchQuery = Type.Intersect([
  PageQuery,
  Type.Object({ q: Type.Optional(Type.String({ maxLength: 100 })) }),
]);
const UserQuery = Type.Intersect([
  SearchQuery,
  Type.Object({
    role: Type.Optional(Type.Union([Type.Literal("BUYER"), Type.Literal("SELLER"), Type.Literal("ADMIN")])),
    status: Type.Optional(Type.Union([Type.Literal("ACTIVE"), Type.Literal("SUSPENDED")])),
  }),
]);
const UserBody = Type.Object(
  {
    role: Type.Optional(Type.Union([Type.Literal("BUYER"), Type.Literal("SELLER"), Type.Literal("ADMIN")])),
    status: Type.Optional(Type.Union([Type.Literal("ACTIVE"), Type.Literal("SUSPENDED")])),
  },
  { minProperties: 1 },
);
const CatalogQuery = Type.Intersect([
  SearchQuery,
  Type.Object({ status: Type.Optional(Type.Union([Type.Literal("ACTIVE"), Type.Literal("INACTIVE")])) }),
]);
const CategoryCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  slug: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  description: Type.String({ minLength: 1, maxLength: 2000 }),
});
const CategoryUpdate = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    slug: Type.String({ minLength: 1, maxLength: 100 }),
    description: Type.String({ minLength: 1, maxLength: 2000 }),
    status: Type.Union([Type.Literal("ACTIVE"), Type.Literal("INACTIVE")]),
  }),
  { minProperties: 1 },
);
const GameCreate = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 100 }),
  slug: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});
const GameUpdate = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    slug: Type.String({ minLength: 1, maxLength: 100 }),
    status: Type.Union([Type.Literal("ACTIVE"), Type.Literal("INACTIVE")]),
  }),
  { minProperties: 1 },
);
const ListingQuery = Type.Intersect([
  SearchQuery,
  Type.Object({ status: Type.Optional(Type.Union([Type.Literal("ACTIVE"), Type.Literal("INACTIVE")])) }),
]);
const ListingBody = Type.Object({ status: Type.Union([Type.Literal("ACTIVE"), Type.Literal("INACTIVE")]) });
const OrderQuery = Type.Intersect([
  SearchQuery,
  Type.Object({
    status: Type.Optional(
      Type.Union([
        Type.Literal("Created"),
        Type.Literal("Paid"),
        Type.Literal("WaitingDelivery"),
        Type.Literal("Delivered"),
        Type.Literal("WaitingConfirmation"),
        Type.Literal("Completed"),
        Type.Literal("SupportPaused"),
        Type.Literal("Cancelled"),
      ]),
    ),
  }),
]);
const OrderAction = Type.Object({
  action: Type.Union([Type.Literal("Complete"), Type.Literal("Cancel")]),
  note: Type.String({ minLength: 3, maxLength: 500 }),
});
const SupportQuery = Type.Intersect([
  SearchQuery,
  Type.Object({
    status: Type.Optional(Type.Union([Type.Literal("Open"), Type.Literal("InProgress"), Type.Literal("Answered"), Type.Literal("Closed")])),
  }),
]);
const SettingsBody = Type.Object({
  coinTryRate: Type.String({ pattern: "^(?:0|[1-9]\\d*)(?:\\.\\d{1,6})?$" }),
  withdrawalFeeRate: Type.String({ pattern: "^(?:0(?:\\.\\d{1,6})?|1(?:\\.0{1,6})?)$" }),
  autoConfirmationHours: Type.String({ pattern: "^(?:0|[1-9]\\d*)(?:\\.\\d{1,4})?$" }),
});
const GameIntegrationBody = Type.Object({
  baseUrl: Type.Optional(Type.String({ minLength: 3, maxLength: 500 })),
  apiKey: Type.Optional(Type.String({ minLength: 8, maxLength: 1000 })),
  enabled: Type.Boolean(),
});

type Search = Static<typeof SearchQuery>;

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.authorize([UserRole.ADMIN]));

  app.get("/session", async (request) => ({
    data: toSessionPayload(await getUserSession(request.user.sub)),
  }));
  app.get("/dashboard", async () => ({ data: await service.dashboard() }));
  app.get<{ Querystring: Static<typeof UserQuery> }>(
    "/users",
    { schema: { querystring: UserQuery } },
    async (request) => ({ data: await service.listUsers(request.query) }),
  );
  app.patch<{ Params: { id: string }; Body: Static<typeof UserBody> }>(
    "/users/:id",
    { schema: { params: IdParams, body: UserBody } },
    async (request) => ({
      data: await service.updateUser(await actorFor(request.user.sub), request.params.id, request.body),
    }),
  );
  app.get<{ Querystring: Static<typeof CatalogQuery> }>(
    "/categories",
    { schema: { querystring: CatalogQuery } },
    async (request) => ({ data: await service.listCategories(request.query) }),
  );
  app.post<{ Body: Static<typeof CategoryCreate> }>(
    "/categories",
    { schema: { body: CategoryCreate } },
    async (request, reply) =>
      reply.code(201).send({ data: await service.createCategory(await actorFor(request.user.sub), request.body) }),
  );
  app.patch<{ Params: { id: string }; Body: Static<typeof CategoryUpdate> }>(
    "/categories/:id",
    { schema: { params: IdParams, body: CategoryUpdate } },
    async (request) => ({
      data: await service.updateCategory(await actorFor(request.user.sub), request.params.id, request.body),
    }),
  );
  app.get<{ Querystring: Static<typeof CatalogQuery> }>(
    "/games",
    { schema: { querystring: CatalogQuery } },
    async (request) => ({ data: await service.listGames(request.query) }),
  );
  app.post<{ Body: Static<typeof GameCreate> }>(
    "/games",
    { schema: { body: GameCreate } },
    async (request, reply) =>
      reply.code(201).send({ data: await service.createGame(await actorFor(request.user.sub), request.body) }),
  );
  app.patch<{ Params: { id: string }; Body: Static<typeof GameUpdate> }>(
    "/games/:id",
    { schema: { params: IdParams, body: GameUpdate } },
    async (request) => ({
      data: await service.updateGame(await actorFor(request.user.sub), request.params.id, request.body),
    }),
  );
  app.get<{ Querystring: Static<typeof ListingQuery> }>(
    "/listings",
    { schema: { querystring: ListingQuery } },
    async (request) => ({ data: await service.listListings(request.query) }),
  );
  app.patch<{ Params: { id: string }; Body: Static<typeof ListingBody> }>(
    "/listings/:id",
    { schema: { params: IdParams, body: ListingBody } },
    async (request) => ({
      data: await service.updateListingStatus(await actorFor(request.user.sub), request.params.id, request.body.status),
    }),
  );
  app.get<{ Querystring: Static<typeof OrderQuery> }>(
    "/orders",
    { schema: { querystring: OrderQuery } },
    async (request) => ({ data: await service.listOrders(request.query) }),
  );
  app.post<{ Params: { id: string }; Body: Static<typeof OrderAction> }>(
    "/orders/:id/action",
    { schema: { params: IdParams, body: OrderAction } },
    async (request) => ({
      data: await service.resolveOrder(await actorFor(request.user.sub), request.params.id, request.body),
    }),
  );
  app.get<{ Querystring: Search }>(
    "/withdrawals",
    { schema: { querystring: SearchQuery } },
    async (request) => ({ data: await service.listWithdrawals(request.query) }),
  );
  app.get<{ Querystring: Static<typeof SupportQuery> }>(
    "/support",
    { schema: { querystring: SupportQuery } },
    async (request) => ({ data: await service.listSupport(request.query) }),
  );
  app.get("/settings", async () => ({ data: await service.getSettings() }));
  app.patch<{ Body: Static<typeof SettingsBody> }>(
    "/settings",
    { schema: { body: SettingsBody } },
    async (request) => ({
      data: await service.updateSettings(await actorFor(request.user.sub), request.body),
    }),
  );
  app.get("/integrations/games", async () => ({ data: { items: await integrations.listGameIntegrations() } }));
  app.patch<{ Params: { id: string }; Body: Static<typeof GameIntegrationBody> }>(
    "/integrations/games/:id",
    { schema: { params: IdParams, body: GameIntegrationBody } },
    async (request) => ({
      data: await integrations.updateGameIntegration(
        await actorFor(request.user.sub),
        request.params.id,
        request.body,
      ),
    }),
  );
  app.get<{ Querystring: Search }>(
    "/audit",
    { schema: { querystring: SearchQuery } },
    async (request) => ({ data: await service.listAudits(request.query) }),
  );
}
