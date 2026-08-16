import { Type, type Static } from "@sinclair/typebox";

const EmailSchema = Type.String({ format: "email", maxLength: 255 });
const PasswordSchema = Type.String({ minLength: 8, maxLength: 72 });

export const RegisterBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 100 }),
    email: EmailSchema,
    password: PasswordSchema,
    role: Type.Union([Type.Literal("BUYER"), Type.Literal("SELLER")]),
  },
  { additionalProperties: false },
);

export const LoginBodySchema = Type.Object(
  {
    email: EmailSchema,
    password: PasswordSchema,
  },
  { additionalProperties: false },
);

export type RegisterBody = Static<typeof RegisterBodySchema>;
export type LoginBody = Static<typeof LoginBodySchema>;
