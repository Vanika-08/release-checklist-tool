import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db.js";
import { getReleaseStatus } from "../domain/status.js";
import {
  RELEASE_STEPS,
  TOTAL_STEPS,
  normaliseCompletedSteps,
} from "../domain/steps.js";
import { DateTime } from "./scalars.js";
import { conflict, notFound } from "./errors.js";
import {
  validateDate,
  validateId,
  validateInfo,
  validateName,
  validatePage,
  validateStepId,
} from "./validation.js";
import type { GraphQLResolveInfo } from "graphql";

interface ReleaseRow {
  id: string;
  name: string;
  date: Date;
  additionalInfo: string | null;
  completedSteps: unknown;
  createdAt: Date;
  updatedAt: Date;
}

// P2025: update/delete hit a missing row. P2002: duplicate release name.
async function mapPrismaErrors<T>(op: Promise<T>, id?: string): Promise<T> {
  try {
    return await op;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025" && id) throw notFound(id);
      if (e.code === "P2002")
        throw conflict("A release with this name already exists.");
    }
    throw e;
  }
}

/** Does the client's selection on this field include `name`? (inline fields and fragments) */
function selects(info: GraphQLResolveInfo, name: string): boolean {
  const seen = new Set<string>();
  const walk = (set: readonly any[] | undefined): boolean =>
    !!set?.some((sel) => {
      if (sel.kind === "Field") return sel.name.value === name;
      if (sel.kind === "InlineFragment")
        return walk(sel.selectionSet.selections);
      if (sel.kind === "FragmentSpread" && !seen.has(sel.name.value)) {
        seen.add(sel.name.value);
        return walk(info.fragments[sel.name.value]?.selectionSet.selections);
      }
      return false;
    });
  return info.fieldNodes.some((n) => walk(n.selectionSet?.selections));
}

/** normaliseCompletedSteps is called by several field resolvers per row; compute it once per row. */
const normalisedCache = new WeakMap<object, string[]>();
function completed(r: ReleaseRow): string[] {
  let v = normalisedCache.get(r);
  if (!v) {
    v = normaliseCompletedSteps(r.completedSteps);
    normalisedCache.set(r, v);
  }
  return v;
}

export const resolvers = {
  DateTime,

  Query: {
    releases: (
      _: unknown,
      args: { limit?: number | null; offset?: number | null },
      _ctx: unknown,
      info: GraphQLResolveInfo,
    ) =>
      prisma.release.findMany({
        ...validatePage(args.limit, args.offset),
        // id as tie-breaker keeps offset pagination stable when dates are equal.
        orderBy: [{ date: "desc" }, { id: "asc" }],
        // additionalInfo can be large free text; skip it when the list doesn't ask for it.
        omit: selects(info, "additionalInfo")
          ? undefined
          : { additionalInfo: true },
      }),

    releaseCount: () => prisma.release.count(),

    release: (_: unknown, { id }: { id: string }) =>
      prisma.release.findUnique({ where: { id: validateId(id) } }),

    steps: () => RELEASE_STEPS,
  },

  Mutation: {
    createRelease: (
      _: unknown,
      {
        input,
      }: {
        input: { name: string; date: Date; additionalInfo?: string | null };
      },
    ) =>
      mapPrismaErrors(
        prisma.release.create({
          data: {
            name: validateName(input.name),
            date: validateDate(input.date),
            additionalInfo: validateInfo(input.additionalInfo),
          },
        }),
      ),

    updateRelease: (
      _: unknown,
      {
        id,
        input,
      }: {
        id: string;
        input: {
          name?: string | null;
          date?: Date | null;
          additionalInfo?: string | null;
        };
      },
    ) => {
      const data: Prisma.ReleaseUpdateInput = {};
      if (input.name !== undefined) data.name = validateName(input.name);
      if (input.date !== undefined) data.date = validateDate(input.date);
      if (input.additionalInfo !== undefined)
        data.additionalInfo = validateInfo(input.additionalInfo);
      return mapPrismaErrors(
        prisma.release.update({ where: { id: validateId(id) }, data }),
        id,
      );
    },

    updateAdditionalInfo: (
      _: unknown,
      { id, additionalInfo }: { id: string; additionalInfo?: string | null },
    ) =>
      mapPrismaErrors(
        prisma.release.update({
          where: { id: validateId(id) },
          data: { additionalInfo: validateInfo(additionalInfo) },
        }),
        id,
      ),

    toggleStep: async (
      _: unknown,
      {
        releaseId,
        stepId,
        completed,
      }: { releaseId: string; stepId: string; completed?: boolean | null },
    ) => {
      validateId(releaseId);
      validateStepId(stepId);
      // Single atomic statement: read-modify-write happens inside Postgres,
      // so two concurrent toggles on the same release can't overwrite each other.
      const mode =
        completed === true ? "add" : completed === false ? "remove" : "flip";
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
      await mapPrismaErrors(
        prisma.release.delete({
          where: { id: validateId(id) },
          select: { id: true },
        }),
        id,
      );
      return id;
    },
  },

  Release: {
    completedSteps: (r: ReleaseRow) => completed(r),
    completedCount: (r: ReleaseRow) => completed(r).length,
    totalSteps: () => TOTAL_STEPS,
    status: (r: ReleaseRow) => getReleaseStatus(completed(r)),
    steps: (r: ReleaseRow) => {
      const done = new Set(completed(r));
      return RELEASE_STEPS.map((s) => ({ ...s, completed: done.has(s.id) }));
    },
  },
};
