import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { getReleaseStatus } from "../domain/status.js";
import { RELEASE_STEPS, TOTAL_STEPS, normaliseCompletedSteps } from "../domain/steps.js";
import { DateTime } from "./scalars.js";
import { notFound } from "./errors.js";
import { validateDate, validateId, validateInfo, validateName, validateStepId } from "./validation.js";

interface ReleaseRow {
  id: string;
  name: string;
  date: Date;
  additionalInfo: string | null;
  completedSteps: unknown;
  createdAt: Date;
  updatedAt: Date;
}

/** Prisma throws P2025 when update/delete targets a missing row. */
function isNotFound(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025";
}

async function orNotFound<T>(id: string, op: Promise<T>): Promise<T> {
  try {
    return await op;
  } catch (e) {
    if (isNotFound(e)) throw notFound(id);
    throw e;
  }
}

export const resolvers = {
  DateTime,

  Query: {
    releases: () => prisma.release.findMany({ orderBy: { date: "desc" } }),

    release: (_: unknown, { id }: { id: string }) =>
      prisma.release.findUnique({ where: { id: validateId(id) } }),

    steps: () => RELEASE_STEPS,
  },

  Mutation: {
    createRelease: (
      _: unknown,
      { input }: { input: { name: string; date: Date; additionalInfo?: string | null } },
    ) =>
      prisma.release.create({
        data: {
          name: validateName(input.name),
          date: validateDate(input.date),
          additionalInfo: validateInfo(input.additionalInfo),
        },
      }),

    updateRelease: (
      _: unknown,
      { id, input }: { id: string; input: { name?: string | null; date?: Date | null; additionalInfo?: string | null } },
    ) => {
      const data: Prisma.ReleaseUpdateInput = {};
      if (input.name !== undefined) data.name = validateName(input.name);
      if (input.date !== undefined) data.date = validateDate(input.date);
      if (input.additionalInfo !== undefined) data.additionalInfo = validateInfo(input.additionalInfo);
      return orNotFound(id, prisma.release.update({ where: { id: validateId(id) }, data }));
    },

    updateAdditionalInfo: (_: unknown, { id, additionalInfo }: { id: string; additionalInfo?: string | null }) =>
      orNotFound(
        id,
        prisma.release.update({
          where: { id: validateId(id) },
          data: { additionalInfo: validateInfo(additionalInfo) },
        }),
      ),

    toggleStep: async (
      _: unknown,
      { releaseId, stepId, completed }: { releaseId: string; stepId: string; completed?: boolean | null },
    ) => {
      validateId(releaseId);
      validateStepId(stepId);
      // Single atomic statement: read-modify-write happens inside Postgres,
      // so two concurrent toggles on the same release can't overwrite each other.
      // mode: 'add' | 'remove' | 'flip'
      const mode = completed === true ? "add" : completed === false ? "remove" : "flip";
      const rows = await prisma.$queryRaw<ReleaseRow[]>`
        UPDATE "Release"
        SET "completedSteps" = CASE
              WHEN ${mode} = 'add'    AND NOT ("completedSteps" ? ${stepId}) THEN "completedSteps" || to_jsonb(${stepId}::text)
              WHEN ${mode} = 'remove' THEN "completedSteps" - ${stepId}
              WHEN ${mode} = 'flip'   AND ("completedSteps" ? ${stepId}) THEN "completedSteps" - ${stepId}
              WHEN ${mode} = 'flip'   THEN "completedSteps" || to_jsonb(${stepId}::text)
              ELSE "completedSteps"
            END,
            "updatedAt" = now()
        WHERE "id" = ${releaseId}::uuid
        RETURNING *`;
      if (rows.length === 0) throw notFound(releaseId);
      return rows[0];
    },

    deleteRelease: async (_: unknown, { id }: { id: string }) => {
      await orNotFound(id, prisma.release.delete({ where: { id: validateId(id) }, select: { id: true } }));
      return id;
    },
  },

  Release: {
    completedSteps: (r: ReleaseRow) => normaliseCompletedSteps(r.completedSteps),
    completedCount: (r: ReleaseRow) => normaliseCompletedSteps(r.completedSteps).length,
    totalSteps: () => TOTAL_STEPS,
    status: (r: ReleaseRow) => getReleaseStatus(r.completedSteps),
    steps: (r: ReleaseRow) => {
      const done = new Set(normaliseCompletedSteps(r.completedSteps));
      return RELEASE_STEPS.map((s) => ({ ...s, completed: done.has(s.id) }));
    },
  },
};
