import { prisma } from "../prisma.js";

export async function getAccountByEmail(email: string) {
  return prisma.userAccount.findUnique({ where: { email } });
}

export async function upsertAccountByEmail(email: string) {
  return prisma.userAccount.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}
