import type { ApolloError } from "@apollo/client";

const dateFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const formatDate = (iso: string) => dateFmt.format(new Date(iso));

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function errorMessage(err: unknown): string {
  const e = err as ApolloError | undefined;

  const graphQLError = e?.graphQLErrors?.[0];

  if (graphQLError) {
    if (graphQLError.extensions?.code === "CONFLICT") {
      return "Release name already exists. Please choose a different name.";
    }

    return graphQLError.message;
  }

  if (e?.networkError) {
    return "Can't reach the API. Check your connection and try again.";
  }

  return (err as Error)?.message ?? "Something went wrong.";
}

export function relativeDue(iso: string): string {
  const days = Math.round(
    (new Date(iso).getTime() - Date.now()) / 86_400_000,
  );

  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;

  return `${-days} day${days === -1 ? "" : "s"} ago`;
}
