import { PrismaClient } from "@prisma/client";
import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";

import { buildApp } from "../src/app.js";

loadDotenv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });

const prisma = new PrismaClient();
const app = buildApp({ logger: false });

function cookieFrom(response: { headers: Record<string, unknown> }) {
  const value = response.headers["set-cookie"];
  const header = Array.isArray(value) ? value[0] : value;
  return typeof header === "string" ? header.split(";", 1)[0] : "";
}

async function login(email: string, password: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  if (response.statusCode !== 200) throw new Error(`Login failed for ${email}: ${response.body}`);
  return cookieFrom(response);
}

async function request(
  method: "GET" | "POST" | "PATCH",
  path: string,
  cookie: string,
  payload?: object,
) {
  const response = await app.inject({
    method,
    url: `/api/v1${path}`,
    headers: { cookie },
    ...(payload ? { payload } : {}),
  });
  if (response.statusCode >= 400) throw new Error(`${method} ${path} failed: ${response.body}`);
  return response.statusCode === 204 ? undefined : response.json().data;
}

async function ensureAdminTaxonomy(admin: string) {
  let category = await prisma.category.findUnique({ where: { slug: "final-demo-collectibles" } });
  if (!category) {
    category = await request("POST", "/admin/categories", admin, {
      name: "Final Demo Collectibles",
      description: "Created by Admin during the repeatable final acceptance preparation.",
    });
  }
  let game = await prisma.game.findUnique({ where: { slug: "final-demo-arena" } });
  if (!game) game = await request("POST", "/admin/games", admin, { name: "Final Demo Arena" });
  return { category, game };
}

async function ensureOrder(
  buyer: string,
  listingId: string,
  expectedPrice: string,
  idempotencyKey: string,
) {
  return request("POST", "/orders", buyer, { listingId, expectedPrice, idempotencyKey });
}

async function main() {
  await app.ready();
  const admin = await login(process.env.DEMO_ADMIN_EMAIL ?? "admin@gaming.local", process.env.DEMO_ADMIN_PASSWORD ?? "Admin123!");
  const buyer = await login(process.env.DEMO_BUYER_EMAIL ?? "buyer@gaming.local", process.env.DEMO_BUYER_PASSWORD ?? "Buyer123!");
  const seller = await login(process.env.DEMO_SELLER_EMAIL ?? "seller@gaming.local", process.env.DEMO_SELLER_PASSWORD ?? "Seller123!");
  const taxonomy = await ensureAdminTaxonomy(admin);
  const listing = await prisma.listing.findUnique({ where: { id: "50000000-0000-4000-8000-000000000001" } });
  if (!listing) throw new Error("Final seed listing is missing. Run npm run db:seed first.");

  let normal = await ensureOrder(buyer, listing.id, listing.price.toFixed(2), "final-demo-normal-v1");
  if (normal.status === "WaitingDelivery") {
    normal = await request("POST", `/orders/${normal.id}/deliver`, seller, {
      deliveryNote: "Final demo digital delivery completed.",
    });
  }
  if (normal.status === "WaitingConfirmation") normal = await request("POST", `/orders/${normal.id}/confirm`, buyer);
  if (normal.status === "Completed" && !normal.review) {
    await request("POST", `/orders/${normal.id}/review`, buyer, {
      rating: 5,
      comment: "Repeatable final demo completion.",
    });
  }

  let paused = await ensureOrder(buyer, listing.id, listing.price.toFixed(2), "final-demo-support-v1");
  if (paused.status === "WaitingDelivery" || paused.status === "WaitingConfirmation") {
    await request("POST", "/support/tickets", buyer, {
      orderId: paused.id,
      subject: "Final demo SupportPaused verification",
      body: "Keep this second order paused so Admin can inspect the support branch.",
    });
    paused = await request("GET", `/orders/${paused.id}`, buyer);
  }

  const buyerUser = await prisma.user.findUniqueOrThrow({
    where: { email: (process.env.DEMO_BUYER_EMAIL ?? "buyer@gaming.local").toLowerCase() },
    include: { wallet: true },
  });
  if (!buyerUser.wallet) throw new Error("Demo Buyer wallet is missing.");
  if (!(await prisma.withdrawal.findUnique({ where: { idempotencyKey: "final-demo-withdrawal-v1" } }))) {
    await request("POST", "/wallet/withdrawals/simulate", buyer, {
      amountCoin: "5.00",
      iban: "TR000000000000000000000000",
      accountHolderName: "Demo Buyer",
      idempotencyKey: "final-demo-withdrawal-v1",
    });
  }

  const dashboard = await request("GET", "/admin/dashboard", admin);
  const withdrawals = await request("GET", "/admin/withdrawals?q=Demo%20Buyer", admin);
  const support = await request("GET", "/admin/support?status=Open", admin);

  console.log(JSON.stringify({
    accounts: {
      admin: process.env.DEMO_ADMIN_EMAIL ?? "admin@gaming.local",
      buyer: process.env.DEMO_BUYER_EMAIL ?? "buyer@gaming.local",
      seller: process.env.DEMO_SELLER_EMAIL ?? "seller@gaming.local",
    },
    taxonomy: { category: taxonomy.category.name, game: taxonomy.game.name },
    listing: { id: listing.id, title: listing.title, price: listing.price.toFixed(2) },
    normalOrder: { id: normal.id, status: normal.status },
    supportOrder: { id: paused.id, status: paused.status },
    adminEvidence: {
      orders: dashboard.counts.orders,
      heldCoin: dashboard.balances.heldCoin,
      simulatedWithdrawals: withdrawals.pagination.total,
      openSupport: support.pagination.total,
    },
    simulation: "Deposit and Withdrawal are demonstration records only; no real payment or transfer occurs.",
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await app.close();
    await prisma.$disconnect();
  });
