/**
 * Seeds releases for demos and stress tests.
 *   npm run seed            -> 1000 releases (default)
 *   SEED_COUNT=50 npm run seed
 *   SEED_RESET=1 npm run seed   (delete existing releases first)
 */
import { prisma } from "./db.js";
import { RELEASE_STEPS } from "./domain/steps.js";

const COUNT = Number(process.env.SEED_COUNT ?? 1000);
const NOTES = [
  "Rollback plan: redeploy previous tag from the release pipeline. Feature flags for the new billing flow default to off and are enabled per workspace after smoke tests.",
  "Depends on the auth-service 3.x migration landing first. Coordinate with the platform team before starting the deploy window, and post in #releases when it begins.",
  "Includes the Postgres 16 upgrade for the reporting replica. Expect a short read-only window. Customer success has been notified and the status page draft is ready.",
];

async function main() {
  if (process.env.SEED_RESET) await prisma.release.deleteMany();
  const start = new Date("2024-01-08T09:00:00Z").getTime();
  const rows = Array.from({ length: COUNT }, (_, i) => {
    const done = i % (RELEASE_STEPS.length + 1); // spread across planned/ongoing/done
    const major = 1 + Math.floor(i / 100);
    return {
      name: `Version ${major}.${Math.floor(i / 10) % 10}.${i % 10}`,
      date: new Date(start + i * 86_400_000),
      additionalInfo: NOTES[i % NOTES.length].repeat(1 + (i % 3)),
      completedSteps: RELEASE_STEPS.slice(0, done).map((s) => s.id),
    };
  });
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const res = await prisma.release.createMany({
      data: rows.slice(i, i + 500),
      skipDuplicates: true,
    });
    inserted += res.count;
  }
  console.log(
    `Inserted ${inserted} releases (total now ${await prisma.release.count()})`,
  );
}

main().finally(() => prisma.$disconnect());
