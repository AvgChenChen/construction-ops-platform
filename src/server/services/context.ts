import type { Prisma, Role } from "@prisma/client";

/** Who is acting, and in which organization. Every service function takes one. */
export type Ctx = {
  userId: string;
  orgId: string;
  role: Role;
};

export type Tx = Prisma.TransactionClient;
