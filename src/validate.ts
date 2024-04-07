import { FileInRepo, PullRequest } from "./services/github/response";
import { injectGitHubClient } from "./services/github";
import { RepoCsvItem } from "./types";
import { cluster } from "radash";
import Papa from "papaparse";
import { appendFile, writeFile } from "fs/promises";
import { exists, existsSync, fstat, readFileSync, statSync } from "fs";

const client = injectGitHubClient();

export const validate = async (items: RepoCsvItem[]) => {
  const batches = cluster(items, 25);

  for (const batch of batches) {
    const results: RepoCsvItem[] = [];
    console.log("Fetched batch");
    const prMapBatch = await client.pr.getBatch(batch);
    const blobMapBatch = await client.repository.blobBatch(batch);

    batch.forEach((item) => {
      const prKey = `${item.owner}/${item.name}/${item.number}`;
      const blobKey = `${item.owner}/${item.name}/${item.base_sha}`;
      const pr = prMapBatch[prKey]?.pullRequest;
      if (!pr) {
        return;
      }
      const code = blobMapBatch[blobKey]?.object?.entries;
      if (!code) {
        return;
      }

      const hasTsConfig = hasTsconfigFile(code);
      const hasNvmRc = hasNvmRcFile(code);
      if (!hasTsConfig || !hasNvmRc) {
        return;
      }

      const pkgManager = getPackageManager(code);
      const nvmRcContent = getNvmRcContent(code);

      item.node_version = nvmRcContent;
      item.pkg_manager = pkgManager;

      const pkgInfo = getPackageUpgraded(item.pr_title);
      if (!pkgInfo) {
        return;
      }
      const { pkg, versionFrom, versionTo } = pkgInfo;
      item.package = pkg;
      item.version_from = versionFrom;
      item.version_to = versionTo;

      const codeChanges = hasCodeChanges(pr);
      const onlyOnePackageModified = onlyOnePackageModifiedInPackageJson(pr);
      if (!codeChanges || !onlyOnePackageModified) {
        return;
      }

      results.push(item);
    });

    if (results.length) {
      if (existsSync("matches.csv")) {
        const file = readFileSync("matches.csv", "utf8").toString();
        const { data } = Papa.parse<RepoCsvItem>(file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        const combined = [...data, ...results];
        const csv = Papa.unparse(combined);
        await writeFile("matches.csv", csv);
      } else {
        const csv = Papa.unparse(results);
        await writeFile("matches.csv", csv);
      }
    }
  }
};

const hasTsconfigFile = (files: FileInRepo[]) => {
  return files.some((entry) => entry.name === "tsconfig.json");
};

const hasNvmRcFile = (files: FileInRepo[]) => {
  return files.some((entry) => entry.name === ".nvmrc");
};

const getNvmRcContent = (files: FileInRepo[]) => {
  return files.find((entry) => entry.name === ".nvmrc")?.object?.text?.trim();
};

const getPackageUpgraded = (title: string) => {
  const matches = title.match(/[Bb]ump ([^\s]+) from ([\d.]+) to ([\d.]+)/);
  if (!matches || matches.length < 4) {
    return null;
  }
  const pkg = matches?.[1];
  const versionFrom = matches?.[2];
  const versionTo = matches?.[3];
  if (!pkg || !versionFrom || !versionTo) {
    return null;
  }

  return {
    pkg,
    versionFrom,
    versionTo,
  };
};

const getPackageManager = (files: FileInRepo[]) => {
  const hasPackageLockJson = files.some(
    (entry) => entry.name === "package-lock.json"
  );

  const hasPnpmLockJson = files.some(
    (entry) => entry.name === "pnpm-lock.yaml"
  );

  const hasYarnLockJson = files.some((entry) => entry.name === "yarn.lock");

  if (hasPackageLockJson) {
    return "npm";
  } else if (hasPnpmLockJson) {
    return "pnpm";
  } else if (hasYarnLockJson) {
    return "yarn";
  }
};

export const onlyOnePackageModifiedInPackageJson = (node: PullRequest) => {
  if (!node) {
    return false;
  }

  const packageJsonPaths = node.files.nodes.filter(
    (file) => file.path === "package.json"
  );

  if (packageJsonPaths.length > 1) {
    return false;
  }
  const packageJsonPath = packageJsonPaths[0];
  if (!packageJsonPath) {
    return false;
  }

  return packageJsonPath.additions + packageJsonPath.deletions == 2;
};

export const hasCodeChanges = (node: PullRequest) => {
  if (!node) {
    return false;
  }
  const files = node.files.nodes;
  const codeFiles = files.filter(
    (file) =>
      file.path.endsWith(".ts") ||
      file.path.endsWith(".tsx") ||
      file.path.endsWith(".jsx")
  );
  return codeFiles.length > 0;
};
