import { GraphQLError } from "graphql";

export const badInput = (message: string, field?: string) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT", field } });

export const notFound = (id: string) =>
  new GraphQLError(`Release ${id} not found`, { extensions: { code: "NOT_FOUND" } });

export const conflict = (message: string) =>
  new GraphQLError(message, { extensions: { code: "CONFLICT" } });
