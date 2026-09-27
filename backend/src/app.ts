import { createSchema, createYoga } from "graphql-yoga";
import { typeDefs } from "./graphql/typeDefs.js";
import { resolvers } from "./graphql/resolvers.js";
import { config } from "./config.js";

export const schema = createSchema({ typeDefs, resolvers });

export function buildYoga() {
  return createYoga({
    schema,
    graphqlEndpoint: "/graphql",
    // Unexpected errors are masked in responses; GraphQLErrors we throw
    // (BAD_USER_INPUT, NOT_FOUND) pass through with their message and code.
    maskedErrors: true,
    graphiql: !config.isProduction,
    cors: {
      origin: config.corsOrigins,
      credentials: false,
      methods: ["POST", "GET", "OPTIONS"],
    },
    landingPage: false,
  });
}
