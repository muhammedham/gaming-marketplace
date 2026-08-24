import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config as loadDotenv } from "dotenv";
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
  { name: "Arena Protocol", slug: "arena-protocol" },
  { name: "Elder Realms", slug: "elder-realms" },
  { name: "Strike Division", slug: "strike-division" },
  { name: "Rift Legends", slug: "rift-legends" },
];

const coinTryRate = "1.000000";

async function main() {
  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where: { email: account.email.toLowerCase() },
      update: {
        name: account.name,
        passwordHash,
        role: account.role,
        wallet: { upsert: { create: {}, update: {} } },
      },
      create: {
        name: account.name,
        email: account.email.toLowerCase(),
        passwordHash,
        role: account.role,
        wallet: { create: {} },
      },
    });
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
    update: { coinTryRate },
    create: { id: 1, coinTryRate },
  });

  console.log(
    `Seeded ${accounts.length} demo accounts, ${categories.length} categories, ${games.length} games and coin/TRY rate ${coinTryRate}.`,
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
