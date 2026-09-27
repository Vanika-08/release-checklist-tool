import type { ApolloError } from "@apollo/client";

const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

/** ISO string -> value for <input type="datetime-local"> in the user's timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Human message from an Apollo error: prefer the server's GraphQL message. */
export function errorMessage(err: unknown): string {
  const e = err as ApolloError | undefined;
  if (e?.graphQLErrors?.length) return e.graphQLErrors[0].message;
  if (e?.networkError) return "Can't reach the API. Check your connection and try again.";
  return (err as Error)?.message ?? "Something went wrong.";
}

export function relativeDue(iso: string): string {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  return `${-days} day${days === -1 ? "" : "s"} ago`;
}
