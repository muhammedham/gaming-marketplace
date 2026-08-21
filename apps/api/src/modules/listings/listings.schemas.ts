import { Static, Type } from "@sinclair/typebox";

const DecimalStringSchema = Type.String({
  pattern: "^(?:0|[1-9]\\d{0,15})(?:\\.\\d{1,2})?$",
  maxLength: 19,
});

export const ListingParamsSchema = Type.Object({
  listingId: Type.String({ format: "uuid" }),
});

export const ListingQuerySchema = Type.Object({
  q: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  category: Type.Optional(Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 100 })),
  game: Type.Optional(Type.String({ pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 100 })),
  minPrice: Type.Optional(DecimalStringSchema),
  maxPrice: Type.Optional(DecimalStringSchema),
  sort: Type.Optional(Type.Union([
    Type.Literal("newest"),
    Type.Literal("price_asc"),
    Type.Literal("price_desc"),
  ])),
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 12 })),
});

export const ListingBodySchema = Type.Object({
  categoryId: Type.String({ format: "uuid" }),
  gameId: Type.Union([Type.String({ format: "uuid" }), Type.Null()]),
  title: Type.String({ minLength: 3, maxLength: 160 }),
  description: Type.String({ minLength: 20, maxLength: 5_000 }),
  price: DecimalStringSchema,
});

export type ListingParams = Static<typeof ListingParamsSchema>;
export type ListingQuery = Static<typeof ListingQuerySchema>;
export type ListingBody = Static<typeof ListingBodySchema>;
