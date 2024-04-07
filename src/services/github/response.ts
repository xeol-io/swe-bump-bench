import base64url from "base64url";
import { z } from "zod";

export const PullRequestSchema = z
  .object({
    createdAt: z.string(),
    files: z.object({
      nodes: z.array(
        z.object({
          changeType: z.string(),
          additions: z.number(),
          deletions: z.number(),
          path: z.string(),
        })
      ),
    }),
  })
  .nullable();

export const BatchPullRequestResponseSchema = z.record(
  z.string().transform((v) => base64url.decode(v)),
  z
    .object({
      pullRequest: PullRequestSchema,
    })
    .nullable() // in the case that the repository isn't found
);

export const FileInRepoSchema = z.object({
  name: z.string(),
  object: z
    .object({
      byteSize: z.number().optional(),
      text: z.string().nullish(),
    })
    .nullable(),
});

export const BatchRepositoryBlobResponseSchema = z.record(
  z.string().transform((v) => base64url.decode(v)),
  z
    .object({
      object: z
        .object({
          entries: z.array(FileInRepoSchema),
        })
        .nullable(),
    })
    .nullable() // in the case that the repository isn't found
);

export type FileInRepo = z.infer<typeof FileInRepoSchema>;
export type PullRequest = z.infer<typeof PullRequestSchema>;

export interface PullRequestNode {
  createdAt: string;
  repository: {
    owner: {
      login: string;
    };
    name: string;
    viewerDefaultMergeMethod: string;
  };
  author: {
    login: string;
  };
  baseRefOid: string;
  files: {
    nodes: Array<{
      changeType: string;
      additions: number;
      deletions: number;
      path: string;
    }>;
  };
  id: string;
  title: string;
  reviewDecision: null | string; // Adjust the type if more specific information is available
  bodyHTML: string;
  headRefName: string;
  url: string;
  commits: {
    nodes: Array<{
      commit: {
        author: {
          login: string;
        };
        additions: number;
        statusCheckRollup: null | any; // Adjust the type if more specific information is available
      };
    }>;
  };
}

export interface SearchPullRequestsResponse {
  search: {
    pageInfo: {
      endCursor: string;
      startCursor: string;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    nodes: PullRequestNode[];
  };
}
