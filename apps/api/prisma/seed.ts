import { Prisma, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config as loadDotenv } from "dotenv";
import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const prisma = new PrismaClient();

const accounts = [
  {
    name: "Demo Admin",
    email: process.env.DEMO_ADMIN_EMAIL ?? "admin@gaming.local",
    password: process.env.DEMO_ADMIN_PASSWORD ?? "Admin123!",
    role: UserRole.ADMIN,
  },
  {
    name: "Demo Buyer",
    email: process.env.DEMO_BUYER_EMAIL ?? "buyer@gaming.local",
    password: process.env.DEMO_BUYER_PASSWORD ?? "Buyer123!",
    role: UserRole.BUYER,
  },
  {
    name: "Demo Seller",
    email: process.env.DEMO_SELLER_EMAIL ?? "seller@gaming.local",
    password: process.env.DEMO_SELLER_PASSWORD ?? "Seller123!",
    role: UserRole.SELLER,
  },
];

const categories = [
  {
    name: "Accounts",
    slug: "accounts",
    description: "Progressed accounts ready for a new owner.",
  },
  {
    name: "Game Currency",
    slug: "game-currency",
    description: "In-game coins and credit bundles.",
  },
  {
    name: "Items",
    slug: "items",
    description: "Rare equipment and inventory items.",
  },
  {
    name: "Skins",
    slug: "skins",
    description: "Cosmetic weapon and character collections.",
  },
  {
    name: "Gift Cards",
    slug: "gift-cards",
    description: "Digital balance and store cards.",
  },
  {
    name: "Boosting",
    slug: "boosting",
    description: "Clearly scoped progression services.",
  },
];

const games = [
  { name: "Valorant", slug: "valorant" },
  { name: "Arena Protocol", slug: "arena-protocol" },
  { name: "Elder Realms", slug: "elder-realms" },
  { name: "Strike Division", slug: "strike-division" },
  { name: "Rift Legends", slug: "rift-legends" },
];

const coinTryRate = "1.000000";
const withdrawalFeeRate = process.env.WITHDRAWAL_FEE_RATE ?? "0.000000";
const autoConfirmationHours = process.env.AUTO_CONFIRMATION_HOURS ?? "24";
const finalListingId = "50000000-0000-4000-8000-000000000001";
const finalMediaId = "50000000-0000-4000-8000-000000000101";

async function main() {
  const seededUsers = new Map<UserRole, { id: string; walletId: string }>();
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const user = await prisma.user.upsert({
      where: { email: account.email.toLowerCase() },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        status: "ACTIVE",
        wallet: { upsert: { create: {}, update: {} } },
      },
      create: {
        name: account.name,
        email: account.email.toLowerCase(),
        passwordHash,
        role: account.role,
        status: "ACTIVE",
        wallet: { create: {} },
      },
      include: { wallet: true },
    });
    if (!user.wallet) throw new Error(`Wallet missing for ${account.email}.`);
    seededUsers.set(account.role, { id: user.id, walletId: user.wallet.id });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category,
    });
  }

  for (const game of games) {
    await prisma.game.upsert({
      where: { slug: game.slug },
      update: { name: game.name },
      create: game,
    });
  }

  await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: { coinTryRate, withdrawalFeeRate, autoConfirmationHours },
    create: { id: 1, coinTryRate, withdrawalFeeRate, autoConfirmationHours },
  });

  const seller = seededUsers.get(UserRole.SELLER)!;
  const buyer = seededUsers.get(UserRole.BUYER)!;
  const category = await prisma.category.findUniqueOrThrow({ where: { slug: "skins" } });
  const game = await prisma.game.findUniqueOrThrow({ where: { slug: "valorant" } });
  await prisma.listing.upsert({
    where: { id: finalListingId },
    update: {
      sellerId: seller.id,
      categoryId: category.id,
      gameId: game.id,
      title: "Final Demo - Valorant Starter Loadout",
      description: "A repeatable simulation-only demo listing with cover media for the final Buyer, Seller and Admin acceptance flow.",
      price: "40.00",
      status: "ACTIVE",
    },
    create: {
      id: finalListingId,
      sellerId: seller.id,
      categoryId: category.id,
      gameId: game.id,
      title: "Final Demo - Valorant Starter Loadout",
      description: "A repeatable simulation-only demo listing with cover media for the final Buyer, Seller and Admin acceptance flow.",
      price: "40.00",
      status: "ACTIVE",
    },
  });
  const storageKey = `listings/${finalListingId}/final-demo-cover.png`;
  const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const uploadRoot = path.isAbsolute(process.env.UPLOAD_DIR ?? "")
    ? path.resolve(process.env.UPLOAD_DIR!)
    : path.resolve(repositoryRoot, process.env.UPLOAD_DIR ?? "uploads");
  const source = path.join(repositoryRoot, "demo-assets", "valorant", "valorant-starter-loadout.png");
  const destination = path.join(uploadRoot, ...storageKey.split("/"));
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  const mediaStats = await stat(destination);
  await prisma.listingMedia.upsert({
    where: { id: finalMediaId },
    update: { listingId: finalListingId, storageKey, mimeType: "image/png", sizeBytes: mediaStats.size, altText: "Valorant starter loadout final demo cover", sortOrder: 0, role: "COVER" },
    create: { id: finalMediaId, listingId: finalListingId, storageKey, mimeType: "image/png", sizeBytes: mediaStats.size, altText: "Valorant starter loadout final demo cover", sortOrder: 0, role: "COVER" },
  });

  await prisma.$transaction(async (tx) => {
    const idempotencyKey = "final-seed-buyer-balance-v1";
    if (await tx.walletTransaction.findUnique({ where: { idempotencyKey } })) return;
    await tx.$queryRaw`SELECT id FROM wallets WHERE id = ${buyer.walletId}::uuid FOR UPDATE`;
    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: buyer.walletId } });
    const amount = new Prisma.Decimal("1000.00");
    const availableAfter = wallet.availableBalance.add(amount);
    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEPOSIT",
        amount,
        idempotencyKey,
        description: "Final demo simulated deposit seed",
        availableBefore: wallet.availableBalance,
        availableAfter,
        heldBefore: wallet.heldBalance,
        heldAfter: wallet.heldBalance,
      },
    });
    await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalance: availableAfter } });
    await tx.deposit.create({
      data: {
        walletId: wallet.id,
        transactionId: transaction.id,
        amountTry: amount,
        coinTryRate,
        coinAmount: amount,
        idempotencyKey,
      },
    });
  });

  console.log(
    `Seeded ${accounts.length} demo accounts, ${categories.length} categories, ${games.length} games, final media listing ${finalListingId}, Buyer simulation balance, and system settings.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
