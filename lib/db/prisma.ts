import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function buildPrismaDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
      return "postgresql://demo:demo@localhost:5432/mercadolibs_demo";
    }

    return undefined;
  }

  const url = new URL(databaseUrl);

  // Next dev and route handlers can create enough concurrent work to exhaust
  // Prisma's default local pool. Use a smaller pool and a slightly longer wait.
  if (!url.searchParams.has("connection_limit")) {
    url.searchParams.set("connection_limit", "5");
  }

  if (!url.searchParams.has("pool_timeout")) {
    url.searchParams.set("pool_timeout", "20");
  }

  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: buildPrismaDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
