import { Prisma, type UserRole } from "@prisma/client";
import { Type, type Static } from "@sinclair/typebox";
import { AppError } from "../../lib/app-error.js";
import { prisma } from "../../lib/prisma.js";

export type Actor = { id: string; role: UserRole };
export const publicUser = { id: true, name: true, role: true } as const;
export const IdParams = Type.Object({ id: Type.String({ format: "uuid" }) });
export const PageQuery = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50, default: 20 })),
});
export type Page = Static<typeof PageQuery>;
export const TextBody = Type.Object({
  body: Type.String({ minLength: 1, maxLength: 2000 }),
});
export function textValue(value: string, field = "body") {
  const text = value.trim();
  if (!text)
    throw new AppError(400, "VALIDATION_ERROR", "Text cannot be empty.", {
      [field]: ["Enter some text."],
    });
  return text;
}
export async function actorFor(id: string): Promise<Actor> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user)
    throw new AppError(
      401,
      "SESSION_USER_NOT_FOUND",
      "The session is no longer valid.",
    );
  return user;
}
export function requireAccess(allowed: boolean) {
  if (!allowed)
    throw new AppError(
      403,
      "FORBIDDEN",
      "You do not have access to this resource.",
    );
}
export function pageArgs(query: Page) {
  const page = query.page ?? 1,
    limit = query.limit ?? 20;
  return { page, limit, skip: (page - 1) * limit, take: limit };
}
export function paged<T>(items: T[], total: number, query: Page) {
  const { page, limit } = pageArgs(query);
  return {
    items,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
export async function notify(
  tx: Prisma.TransactionClient,
  userIds: string[],
  type: string,
  title: string,
  message: string,
  href: string,
) {
  await tx.notification.createMany({
    data: [...new Set(userIds)].map((userId) => ({
      userId,
      type,
      title,
      message,
      href,
    })),
  });
}
