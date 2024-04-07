WITH PullRequestDetails AS (
  SELECT
    JSON_EXTRACT_SCALAR(payload, '$.pull_request.head.repo.name') AS name,
    JSON_EXTRACT_SCALAR(payload, '$.pull_request.head.repo.owner.login') AS owner,
    JSON_EXTRACT_SCALAR(payload, '$.pull_request.html_url') AS pr_url,
    JSON_EXTRACT_SCALAR(payload, '$.pull_request.title') AS pr_title,
    JSON_EXTRACT_SCALAR(payload, '$.pull_request.head.ref') AS branch_name,
    JSON_EXTRACT_SCALAR(payload, '$.action') AS event,
    CAST(JSON_EXTRACT_SCALAR(payload, '$.pull_request.merged') AS BOOL) AS merged,
    CAST(JSON_EXTRACT_SCALAR(payload, '$.pull_request.commits') AS INT) AS commits,
    CAST(JSON_EXTRACT_SCALAR(payload, '$.pull_request.changed_files') AS INT) AS changed_files
  FROM `githubarchive.year.2023`
  WHERE type = 'PullRequestEvent'
)

SELECT *
FROM PullRequestDetails
WHERE merged = true AND commits > 1
AND STARTS_WITH(branch_name, "dependabot/npm")
AND changed_files > 2
AND (
    REGEXP_CONTAINS(pr_title, r'from 0\.\d+\.?\d* to 1\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 1\.\d+\.?\d* to 2\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 2\.\d+\.?\d* to 3\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 3\.\d+\.?\d* to 4\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 4\.\d+\.?\d* to 5\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 5\.\d+\.?\d* to 6\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 6\.\d+\.?\d* to 7\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 7\.\d+\.?\d* to 8\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 8\.\d+\.?\d* to 9\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 9\.\d+\.?\d* to 10\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 10\.\d+\.?\d* to 11\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 11\.\d+\.?\d* to 12\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 12\.\d+\.?\d* to 13\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 13\.\d+\.?\d* to 14\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 14\.\d+\.?\d* to 15\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 15\.\d+\.?\d* to 16\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 16\.\d+\.?\d* to 17\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 17\.\d+\.?\d* to 18\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 18\.\d+\.?\d* to 19\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 19\.\d+\.?\d* to 20\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 20\.\d+\.?\d* to 21\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 21\.\d+\.?\d* to 22\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 22\.\d+\.?\d* to 23\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 23\.\d+\.?\d* to 24\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 24\.\d+\.?\d* to 25\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 25\.\d+\.?\d* to 26\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 26\.\d+\.?\d* to 27\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 27\.\d+\.?\d* to 28\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 28\.\d+\.?\d* to 29\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 29\.\d+\.?\d* to 30\.\d+\.?\d*') OR
    REGEXP_CONTAINS(pr_title, r'from 30\.\d+\.?\d* to 31\.\d+\.?\d*') OR

)
LIMIT 50000;