import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { config } from "../../env";
import { GraphqlResponseError } from "@octokit/graphql";

import {
  BatchPullRequestResponseSchema,
  BatchRepositoryBlobResponseSchema,
  SearchPullRequestsResponse,
} from "./response";
import { RepositoryBlobQuery, SearchPullRequestsQuery } from "./queries";
import base64url from "base64url";
import mustache from "mustache";
import { writeFile } from "fs/promises";

export const createGitHubClient = (client: Octokit) => {
  return {
    pr: {
      patch: async ({ prUrl }: { prUrl: string }) => {
        const diffUrl = `${prUrl}.diff`;
        const res = await fetch(`${diffUrl}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch ${diffUrl}`);
        }
        return await res.text();
      },
      getBatch: async (
        req: {
          owner: string;
          name: string;
          number: number;
        }[]
      ) => {
        const template = `
        query {
          {{#queries}}
          {{alias}}: repository(owner: "{{ owner }}", name: "{{ name }}") {
            pullRequest(number: {{ number }}) {
              createdAt
              commits(first: 1) {
                nodes {
                  id
                  commit {
                    id
                    checkSuites(first:10) {
                      nodes {
                        conclusion
                      }
                    }
                  }
                }
              }
              files(first: 10) {
                nodes {
                  changeType
                  additions
                  deletions
                  path
                }
              }
            }
          }
          {{/queries}}
        }`;

        // batched queries need to be named in graphql, so we generate a url safe base64
        // encoding of owner and name to use as the alias,
        // and then decode in the response to match the inputs to getBatch
        const queries = req.map((r) => {
          const alias = base64url(`${r.owner}/${r.name}/${r.number}`);
          return {
            alias,
            ...r,
          };
        });

        const query = mustache.render(template, { queries });

        try {
          const data = await client.graphql(query);
          return BatchPullRequestResponseSchema.parse(data);
        } catch (e: unknown) {
          // if we know the error is because the repository doesn't exist, we don't
          // want to throw an error. repos not found will be null in the response
          if (
            e instanceof GraphqlResponseError &&
            e.errors?.every((e) => e.type === "NOT_FOUND")
          ) {
            return BatchPullRequestResponseSchema.parse(e.data);
          } else if (
            e instanceof GraphqlResponseError &&
            e.headers["x-ratelimit-remaining"] === "0"
          ) {
            throw e;
          }

          throw e;
        }
      },
      search: async ({
        first,
        cursor,
        q,
      }: {
        first: number;
        cursor: string | null;
        q: string;
      }) => {
        return await client.graphql<SearchPullRequestsResponse>(
          SearchPullRequestsQuery,
          {
            first,
            cursor,
            q,
          }
        );
      },
    },
    repository: {
      blobBatch: async (
        req: { owner: string; name: string; baseCommit?: string }[]
      ) => {
        const template = `
        query {
          {{#queries}}
          {{alias}}: repository(owner: "{{ owner }}", name: "{{ name }}") {
            object(expression: "{{ baseCommit }}:") {
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
          {{/queries}}
        }`;

        // batched queries need to be named in graphql, so we generate a url safe base64
        // encoding of owner and name to use as the alias,
        // and then decode in the response to match the inputs to getBatch
        const queries = req.map((r) => {
          const request = {
            owner: r.owner,
            name: r.name,
            // default to HEAD if no baseCommit is defined
            baseCommit: r.baseCommit ?? "HEAD",
          };
          const alias = base64url(
            `${request.owner}/${request.name}/${request.baseCommit}`
          );
          return {
            alias,
            ...request,
          };
        });

        const query = mustache.render(template, { queries });

        try {
          const data = await client.graphql(query);
          return BatchRepositoryBlobResponseSchema.parse(data);
        } catch (e: unknown) {
          // if we know the error is because the repository doesn't exist, we don't
          // want to throw an error. repos not found will be null in the response
          if (
            e instanceof GraphqlResponseError &&
            e.errors?.every((e) => e.type === "NOT_FOUND")
          ) {
            return BatchRepositoryBlobResponseSchema.parse(e.data);
          } else if (
            e instanceof GraphqlResponseError &&
            e.headers["x-ratelimit-remaining"] === "0"
          ) {
            throw e;
          }

          throw e;
        }
      },
    },
  };
};

export const injectGitHubClient = () => {
  if (config.github.token === undefined) {
    throw new Error("Missing GitHub token");
  }

  const ThrottledOctokit = Octokit.plugin(throttling);
  const octokit = new ThrottledOctokit({
    auth: config.github.token,
    throttle: {
      onRateLimit: (
        retryAfter,
        options: { [key: string]: any },
        octokit,
        retryCount
      ) => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );

        if (retryCount < 1) {
          // only retries once
          octokit.log.info(`Retrying after ${retryAfter} seconds!`);
          return true;
        }
      },
      onSecondaryRateLimit: (
        retryAfter,
        options: { [key: string]: any },
        octokit
      ) => {
        // does not retry, only logs a warning
        octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url}`
        );
        return true;
      },
    },
  });
  return createGitHubClient(octokit);
};

export type GitHubClient = ReturnType<typeof createGitHubClient>;
