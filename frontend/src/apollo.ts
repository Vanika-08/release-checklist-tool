import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export const GRAPHQL_URL = import.meta.env.VITE_GRAPHQL_URL ?? "http://localhost:4000/graphql";

export const client = new ApolloClient({
  link: new HttpLink({ uri: GRAPHQL_URL }),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          // One cached list for all pages; each page is written at its offset.
          releases: {
            keyArgs: false,
            merge(existing: readonly unknown[] = [], incoming: readonly unknown[], { args }) {
              const offset = args?.offset ?? 0;
              const merged = offset === 0 ? [] : existing.slice(0, offset);
              return [...merged, ...incoming];
            },
          },
        },
      },
      Step: { keyFields: ["id"] },
      // ReleaseStep IDs repeat across releases, so don't normalise them.
      ReleaseStep: { keyFields: false },
    },
  }),
});
