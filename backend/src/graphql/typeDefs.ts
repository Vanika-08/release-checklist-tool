export const typeDefs = /* GraphQL */ `
  "ISO-8601 date-time string, e.g. 2026-10-01T14:00:00.000Z"
  scalar DateTime

  enum ReleaseStatus {
    planned
    ongoing
    done
  }

  "A predefined checklist step. Same for every release."
  type Step {
    id: ID!
    order: Int!
    name: String!
    description: String!
  }

  "A checklist step in the context of one release."
  type ReleaseStep {
    id: ID!
    order: Int!
    name: String!
    description: String!
    completed: Boolean!
  }

  type Release {
    id: ID!
    name: String!
    date: DateTime!
    "Derived from completedSteps on the server. Never stored."
    status: ReleaseStatus!
    additionalInfo: String
    completedSteps: [ID!]!
    completedCount: Int!
    totalSteps: Int!
    steps: [ReleaseStep!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type Query {
    """
    Releases, newest due date first. Paginated: limit defaults to 50 (max 100).
    Use releaseCount for the total and offset to load more.
    """
    releases(limit: Int = 50, offset: Int = 0): [Release!]!
    "Total number of releases (for pagination)."
    releaseCount: Int!
    release(id: ID!): Release
    "The predefined checklist."
    steps: [Step!]!
  }

  input CreateReleaseInput {
    name: String!
    date: DateTime!
    additionalInfo: String
  }

  "Only provided fields are changed. Pass additionalInfo: null to clear it."
  input UpdateReleaseInput {
    name: String
    date: DateTime
    additionalInfo: String
  }

  type Mutation {
    createRelease(input: CreateReleaseInput!): Release!
    updateRelease(id: ID!, input: UpdateReleaseInput!): Release!
    """
    Marks a step completed or not. If completed is omitted the step is flipped.
    Runs as a single atomic UPDATE, so concurrent toggles never lose writes.
    """
    toggleStep(releaseId: ID!, stepId: ID!, completed: Boolean): Release!
    updateAdditionalInfo(id: ID!, additionalInfo: String): Release!
    "Returns the ID of the deleted release."
    deleteRelease(id: ID!): ID!
  }
`;
