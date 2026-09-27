import { gql } from "@apollo/client";

export const RELEASE_LIST_FIELDS = gql`
  fragment ReleaseListFields on Release {
    id
    name
    date
    status
    completedSteps
    completedCount
    totalSteps
  }
`;

export const RELEASE_DETAIL_FIELDS = gql`
  fragment ReleaseDetailFields on Release {
    ...ReleaseListFields
    additionalInfo
    createdAt
    updatedAt
    steps {
      id
      order
      name
      description
      completed
    }
  }
  ${RELEASE_LIST_FIELDS}
`;

export const GET_STEPS = gql`
  query Steps {
    steps {
      id
      order
      name
    }
  }
`;

// The list only asks for what a row renders: no additionalInfo, no step details.
export const GET_RELEASES = gql`
  query Releases {
    releases {
      ...ReleaseListFields
    }
  }
  ${RELEASE_LIST_FIELDS}
`;

export const GET_RELEASE = gql`
  query Release($id: ID!) {
    release(id: $id) {
      ...ReleaseDetailFields
    }
  }
  ${RELEASE_DETAIL_FIELDS}
`;

export const CREATE_RELEASE = gql`
  mutation CreateRelease($input: CreateReleaseInput!) {
    createRelease(input: $input) {
      ...ReleaseDetailFields
    }
  }
  ${RELEASE_DETAIL_FIELDS}
`;

export const UPDATE_RELEASE = gql`
  mutation UpdateRelease($id: ID!, $input: UpdateReleaseInput!) {
    updateRelease(id: $id, input: $input) {
      ...ReleaseDetailFields
    }
  }
  ${RELEASE_DETAIL_FIELDS}
`;

export const TOGGLE_STEP = gql`
  mutation ToggleStep($releaseId: ID!, $stepId: ID!, $completed: Boolean) {
    toggleStep(releaseId: $releaseId, stepId: $stepId, completed: $completed) {
      ...ReleaseDetailFields
    }
  }
  ${RELEASE_DETAIL_FIELDS}
`;

export const UPDATE_ADDITIONAL_INFO = gql`
  mutation UpdateAdditionalInfo($id: ID!, $additionalInfo: String) {
    updateAdditionalInfo(id: $id, additionalInfo: $additionalInfo) {
      id
      additionalInfo
      updatedAt
    }
  }
`;

export const DELETE_RELEASE = gql`
  mutation DeleteRelease($id: ID!) {
    deleteRelease(id: $id)
  }
`;
