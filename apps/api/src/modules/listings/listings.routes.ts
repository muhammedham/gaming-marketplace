import { UserRole } from "@prisma/client";
import type { FastifyInstance, FastifyRequest } from "fastify";

import {
  ListingBodySchema,
  ListingParamsSchema,
  ListingQuerySchema,
  type ListingBody,
  type ListingParams,
  type ListingQuery,
} from "./listings.schemas.js";
import {
  prepareCreateListingUpload,
  prepareListingMediaUpload,
  removeStoredMediaFiles,
} from "./listings.media.js";
import {
  addListingMedia,
  activateListing,
  assertListingOwner,
  createListingWithMedia,
  deactivateListing,
  getListing,
  listListings,
  listSellerListings,
  updateListing,
} from "./listings.service.js";

const sellerOnly = (app: FastifyInstance) => [app.authenticate, app.authorize([UserRole.SELLER])];

async function removeMediaBestEffort(
  request: FastifyRequest,
  storageKeys: string[],
) {
  try {
    await removeStoredMediaFiles(storageKeys);
  } catch (error) {
    request.log.warn({ err: error, storageKeys }, "Failed to remove listing media files.");
  }
}

export async function listingsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: ListingQuery }>(
    "/",
    { schema: { querystring: ListingQuerySchema } },
    async (request) => ({ data: await listListings(request.query) }),
  );

  app.get(
    "/mine",
    { preHandler: sellerOnly(app) },
    async (request) => ({ data: { items: await listSellerListings(request.user.sub) } }),
  );

  app.post(
    "/",
    { preHandler: sellerOnly(app) },
    async (request, reply) => {
      const prepared = await prepareCreateListingUpload(request);
      try {
        const listing = await createListingWithMedia(
          request.user.sub,
          prepared.listingId,
          prepared.input,
          prepared.media,
        );
        return reply.code(201).send({ data: listing });
      } catch (error) {
        await removeMediaBestEffort(request, prepared.media.map((media) => media.storageKey));
        throw error;
      }
    },
  );

  app.get<{ Params: ListingParams }>(
    "/:listingId",
    { schema: { params: ListingParamsSchema } },
    async (request) => {
      let viewerId: string | undefined;
      try {
        await request.jwtVerify();
        viewerId = request.user.sub;
      } catch {
        viewerId = undefined;
      }
      return { data: await getListing(request.params.listingId, viewerId) };
    },
  );

  app.patch<{ Params: ListingParams; Body: ListingBody }>(
    "/:listingId",
    {
      preHandler: sellerOnly(app),
      schema: { params: ListingParamsSchema, body: ListingBodySchema },
    },
    async (request) => ({
      data: await updateListing(request.params.listingId, request.user.sub, request.body),
    }),
  );

  app.post<{ Params: ListingParams }>(
    "/:listingId/deactivate",
    { preHandler: sellerOnly(app), schema: { params: ListingParamsSchema } },
    async (request) => ({
      data: await deactivateListing(request.params.listingId, request.user.sub),
    }),
  );

  app.post<{ Params: ListingParams }>(
    "/:listingId/activate",
    { preHandler: sellerOnly(app), schema: { params: ListingParamsSchema } },
    async (request) => ({
      data: await activateListing(request.params.listingId, request.user.sub),
    }),
  );

  app.post<{ Params: ListingParams }>(
    "/:listingId/media",
    { preHandler: sellerOnly(app), schema: { params: ListingParamsSchema } },
    async (request, reply) => {
      const listing = await assertListingOwner(request.params.listingId, request.user.sub);
      const prepared = await prepareListingMediaUpload(
        request,
        request.params.listingId,
        listing.title,
      );
      try {
        const result = await addListingMedia(request.params.listingId, request.user.sub, prepared);
        await removeMediaBestEffort(request, result.replacedStorageKeys);
        return reply.code(201).send({ data: result.media });
      } catch (error) {
        await removeMediaBestEffort(request, [prepared.storageKey]);
        throw error;
      }
    },
  );
}
