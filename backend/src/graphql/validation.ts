import { isValidStepId } from "../domain/steps.js";
import { badInput, notFound } from "./errors.js";

export const NAME_MAX = 200;
export const INFO_MAX = 5000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateName(name: unknown): string {
  if (typeof name !== "string" || name.trim().length === 0) throw badInput("Name cannot be empty", "name");
  const trimmed = name.trim();
  if (trimmed.length > NAME_MAX) throw badInput(`Name must be at most ${NAME_MAX} characters`, "name");
  return trimmed;
}

export function validateDate(date: unknown): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw badInput("Date is required", "date");
  return date;
}

export function validateInfo(info: unknown): string | null {
  if (info === null || info === undefined) return null;
  if (typeof info !== "string") throw badInput("Additional info must be text", "additionalInfo");
  if (info.length > INFO_MAX) throw badInput(`Additional info must be at most ${INFO_MAX} characters`, "additionalInfo");
  return info.trim() === "" ? null : info;
}

/** A malformed ID can never exist, so report it as NOT_FOUND without hitting the DB. */
export function validateId(id: string): string {
  if (!UUID_RE.test(id)) throw notFound(id);
  return id;
}

export function validateStepId(stepId: string): string {
  if (!isValidStepId(stepId)) throw badInput(`Unknown step "${stepId}"`, "stepId");
  return stepId;
}

export const PAGE_MAX = 100;
export function validatePage(limit: number | null | undefined, offset: number | null | undefined) {
  const l = limit ?? 50;
  const o = offset ?? 0;
  if (!Number.isInteger(l) || l < 1 || l > PAGE_MAX) throw badInput(`limit must be between 1 and ${PAGE_MAX}`, "limit");
  if (!Number.isInteger(o) || o < 0) throw badInput("offset must be 0 or more", "offset");
  return { take: l, skip: o };
}
