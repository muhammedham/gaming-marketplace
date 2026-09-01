import { Prisma, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";
import type { LoginBody, RegisterBody } from "./auth.schemas.js";

type UserWithWallet = Prisma.UserGetPayload<{ include: { wallet: true } }>;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function registerUser(input: RegisterBody) {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();

  if (name.length < 2) {
    throw new AppError(400, "VALIDATION_ERROR", "The request is invalid.", {
      name: ["Name must contain at least 2 characters."],
    });
  }

  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hashPassword(input.password),
        role: input.role,
        wallet: { create: {} },
      },
      include: { wallet: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "An account with this email already exists.");
    }

    throw error;
  }
}

export async function authenticateUser(input: LoginBody) {
  const user = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    include: { wallet: true },
  });

  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  }

  return user;
}

export async function getUserSession(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });

  if (!user) {
    throw new AppError(401, "SESSION_USER_NOT_FOUND", "The session is no longer valid.");
  }

  if (user.status === "SUSPENDED") {
    throw new AppError(403, "ACCOUNT_SUSPENDED", "This account is suspended.");
  }

  return user;
}

export function toSessionPayload(user: UserWithWallet) {
  if (!user.wallet) {
    throw new AppError(500, "WALLET_NOT_FOUND", "The account wallet is missing.");
  }

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as UserRole,
      status: user.status,
    },
    wallet: {
      availableBalance: user.wallet.availableBalance.toFixed(2),
      heldBalance: user.wallet.heldBalance.toFixed(2),
      currency: "COIN" as const,
    },
  };
}
