import type { FastifyInstance } from "fastify";

import {
  DepositSimulationSchema,
  WalletAmountSchema,
  WalletListQuerySchema,
  WithdrawalAmountSchema,
  WithdrawalSimulationSchema,
  type DepositSimulation,
  type WalletAmount,
  type WalletListQuery,
  type WithdrawalAmount,
  type WithdrawalSimulation,
} from "./wallet.schemas.js";
import {
  deposit,
  getWallet,
  listDeposits,
  listTransactions,
  listWithdrawals,
  previewWithdrawal,
  simulateDeposit,
  simulateWithdrawal,
  withdraw,
} from "./wallet.service.js";

export async function walletRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.authenticate }, async (request) => ({
    data: await getWallet(request.user.sub),
  }));

  app.get<{ Querystring: WalletListQuery }>(
    "/transactions",
    { preHandler: app.authenticate, schema: { querystring: WalletListQuerySchema } },
    async (request) => ({ data: await listTransactions(request.user.sub, request.query) }),
  );

  app.get<{ Querystring: WalletListQuery }>(
    "/deposits",
    { preHandler: app.authenticate, schema: { querystring: WalletListQuerySchema } },
    async (request) => ({ data: await listDeposits(request.user.sub, request.query) }),
  );

  app.get<{ Querystring: WalletListQuery }>(
    "/withdrawals",
    { preHandler: app.authenticate, schema: { querystring: WalletListQuerySchema } },
    async (request) => ({ data: await listWithdrawals(request.user.sub, request.query) }),
  );

  app.post<{ Body: WalletAmount }>(
    "/deposit",
    { preHandler: app.authenticate, schema: { body: WalletAmountSchema } },
    async (request) => ({ data: await deposit(request.user.sub, request.body) }),
  );

  app.post<{ Body: DepositSimulation }>(
    "/deposits/simulate",
    { preHandler: app.authenticate, schema: { body: DepositSimulationSchema } },
    async (request, reply) => reply.code(201).send({ data: await simulateDeposit(request.user.sub, request.body) }),
  );

  app.post<{ Body: WithdrawalAmount }>(
    "/withdrawals/preview",
    { preHandler: app.authenticate, schema: { body: WithdrawalAmountSchema } },
    async (request) => ({ data: await previewWithdrawal(request.user.sub, request.body.amountCoin) }),
  );

  app.post<{ Body: WithdrawalSimulation }>(
    "/withdrawals/simulate",
    { preHandler: app.authenticate, schema: { body: WithdrawalSimulationSchema } },
    async (request, reply) => reply.code(201).send({ data: await simulateWithdrawal(request.user.sub, request.body) }),
  );

  app.post<{ Body: WalletAmount }>(
    "/withdraw",
    { preHandler: app.authenticate, schema: { body: WalletAmountSchema } },
    async (request) => ({ data: await withdraw(request.user.sub, request.body) }),
  );
}
