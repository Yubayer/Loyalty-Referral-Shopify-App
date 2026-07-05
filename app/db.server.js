import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

/** @type {PrismaClient} */
const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
