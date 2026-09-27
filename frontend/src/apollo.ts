import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:4000/graphql";

export const client = new ApolloClient({
  link: new HttpLink({ uri: GRAPHQL_URL }),
  cache: new InMemoryCache({
    typePolicies: {
      Step: { keyFields: ["id"] },
      // ReleaseStep IDs repeat across releases, so don't normalise them.
      ReleaseStep: { keyFields: false },
    },
  }),
});
