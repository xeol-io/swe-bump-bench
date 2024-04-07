export const SearchPullRequestsQuery = `query SearchPullRequests($q: String!, $cursor: String, $first: Int) {
  search(
    type: ISSUE
    query: $q
    first: $first
    after: $cursor
  ) {
    pageInfo {
      endCursor
      startCursor
      hasNextPage
      hasPreviousPage
    }
    nodes {
      ... on PullRequest {
        createdAt
        repository {
          owner {
            login
          }
          name
        }
        baseRefOid
        author {
         login
        }
        files(first: 25) {
          nodes {
            changeType
            additions
            deletions
            path
          }
        }
        id
        title
        reviewDecision
        url
        commits(first: 10) {
          nodes {
            commit {
              author {
                user {
                  id
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export const RepositoryBlobQuery = `query RepoFiles($owner: String!, $name: String!, $expression:String!) {
  repository(owner: $owner, name: $name) {
    object(expression: $expression) {
      ... on Tree {
        entries {
          name
          object {
            ... on Blob {
              byteSize
              text
            }
          }
        }
      }
    }
  }
}`;
