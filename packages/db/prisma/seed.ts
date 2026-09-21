import prisma from "../src/index";

/**
 * Seeds the local development database.
 *
 * This script must be IDEMPOTENT: `pnpm db:seed` is run repeatedly against a
 * database that may already hold data, and `prisma migrate reset` runs it
 * automatically after replaying migrations. Every write therefore uses
 * `upsert` keyed on a stable, hand-chosen id - never `create`, and never an
 * id the database generates - so a second run updates the same rows instead
 * of inserting duplicates.
 *
 * Shape to follow once models exist:
 *
 *   await prisma.thing.upsert({
 *     where: { id: "seed-thing-1" },
 *     update: { name: "First thing" },
 *     create: { id: "seed-thing-1", name: "First thing" },
 *   });
 */
function main(): Promise<unknown> {
  // TODO: seed entities here as models are added to schema.prisma.
  // The schema currently declares no models, so there is nothing to write.
  return Promise.resolve();
}

main()
  .catch((error: unknown) => {
    process.exitCode = 1;
    throw new Error("Seeding failed", { cause: error });
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
