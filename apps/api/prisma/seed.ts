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

  console.log(`Seeded ${accounts.length} demo accounts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
