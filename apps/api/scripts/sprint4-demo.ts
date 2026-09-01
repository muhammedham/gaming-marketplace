import { randomUUID } from "node:crypto";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/modules/auth/auth.service.js";
import { uploadDirectory } from "../src/config/uploads.js";
import { simulateDeposit } from "../src/modules/wallet/wallet.service.js";

if (process.env.NODE_ENV === "production")
  throw new Error("This fixture is for local development only.");
const password = "Sprint4Demo123!";
try {
  const accounts = [];
  for (const role of ["BUYER", "SELLER", "ADMIN"] as const) {
    const email = `sprint4-${role.toLowerCase()}@gaming.local`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `Sprint 4 Demo ${role}`,
        role,
        passwordHash: await hashPassword(password),
        wallet: { create: {} },
      },
    });
    accounts.push(user);
  }
  const [buyer, seller] = accounts;
  const category = await prisma.category.findFirstOrThrow();
  const game = await prisma.game.findUnique({ where: { slug: "valorant" } });
  let listing = await prisma.listing.findFirst({
    where: { sellerId: seller.id, title: "Sprint 4 Demo - Delivery practice" },
  });
  if (!listing) {
    const id = randomUUID(),
      storageKey = `listings/${id}/cover.png`;
    await mkdir(resolve(uploadDirectory, "listings", id), { recursive: true });
    await copyFile(
      resolve("../../demo-assets/valorant/valorant-neon-arsenal.png"),
      resolve(uploadDirectory, storageKey),
    );
    const { size } = await stat(resolve(uploadDirectory, storageKey));
    listing = await prisma.listing.create({
      data: {
        id,
        sellerId: seller.id,
        categoryId: category.id,
        gameId: game?.id,
        title: "Sprint 4 Demo - Delivery practice",
        description:
          "Simulation-only fixture for testing purchase, delivery, confirmation, chat and support. No real digital product is sold.",
        price: "40.00",
        media: {
          create: {
            role: "COVER",
            storageKey,
            mimeType: "image/png",
            sizeBytes: size,
            altText: "Sprint 4 demonstration listing",
          },
        },
      },
    });
  }
  await simulateDeposit(buyer.id, {
    amountTry: "1000.00",
    idempotencyKey: `sprint4-demo-initial-${buyer.id}`,
  });
  console.log(
    JSON.stringify(
      {
        accounts: accounts.map((u) => ({ email: u.email, role: u.role })),
        password,
        listingId: listing.id,
        note: "Existing records and balances are never reset; initial deposit is idempotent.",
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
