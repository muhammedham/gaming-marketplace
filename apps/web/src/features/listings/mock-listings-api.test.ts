import { describe, expect, it } from "vitest";

import { mockCreateListing, mockDeactivateListing, mockListListings } from "./mock-listings-api";

const demoActor = { id: "seller-test", name: "Test Seller", email: "test@example.com" };

describe("mock listings API", () => {
  it("combines category, game and price filters", async () => {
    const result = await mockListListings({
      category: "game-currency",
      game: "elder-realms",
      minPrice: "500",
      maxPrice: "600",
    });

    expect(result.items.map((listing) => listing.id)).toEqual(["listing-gold-coins"]);
  });

  it("publishes Seller listings as ACTIVE and enforces ownership", async () => {
    const listing = await mockCreateListing({
      actor: demoActor,
      input: {
        categoryId: "cat-items",
        gameId: "game-elder",
        title: "Test inventory item",
        description: "An item created by the listing workflow test.",
        price: "75",
      },
      media: { cover: null, gallery: [], video: null },
    });

    expect(listing.status).toBe("ACTIVE");
    await expect(
      mockDeactivateListing(listing.id, { id: "other-seller", name: "Other", email: "other@example.com" }),
    ).rejects.toThrow(/belong to your Seller account/);
    await expect(mockDeactivateListing(listing.id, demoActor)).resolves.toMatchObject({ status: "INACTIVE" });
  });
});
