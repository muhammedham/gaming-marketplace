import type { FastifyInstance } from "fastify";

import { WalletAmountSchema, type WalletAmount } from "./wallet.schemas.js";
import { deposit, getWallet, withdraw } from "./wallet.service.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.authenticate }, async (request) => ({
    data: await getWallet(request.user.sub),
  }));

  app.post<{ Body: WalletAmount }>(
    "/deposit",
    { preHandler: app.authenticate, schema: { body: WalletAmountSchema } },
    async (request) => ({ data: await deposit(request.user.sub, request.body) }),
  );

  app.post<{ Body: WalletAmount }>(
    "/withdraw",
    { preHandler: app.authenticate, schema: { body: WalletAmountSchema } },
    async (request) => ({ data: await withdraw(request.user.sub, request.body) }),
  );
}