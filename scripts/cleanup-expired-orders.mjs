import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const deleted = await prisma.order.deleteMany({
    where: {
      expiresAt: {
        lt: now,
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        schedule: "daily",
        cutoff: now.toISOString(),
        deletedOrders: deleted.count,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: "orders_cleanup_failed",
          message: error instanceof Error ? error.message : "unknown_error",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
