import { GraphQLError, GraphQLScalarType, Kind } from "graphql";

function toDate(value: unknown): Date {
  if (typeof value !== "string") throw new GraphQLError("DateTime must be an ISO-8601 string");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new GraphQLError(`Invalid DateTime "${value}"`);
  return d;
}

export const DateTime = new GraphQLScalarType({
  name: "DateTime",
  serialize: (v) => (v instanceof Date ? v : new Date(v as string)).toISOString(),
  parseValue: toDate,
  parseLiteral: (ast) => {
    if (ast.kind !== Kind.STRING) throw new GraphQLError("DateTime must be a string");
    return toDate(ast.value);
  },
});
