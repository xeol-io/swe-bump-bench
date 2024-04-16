import { FileInRepo, PullRequest } from "./services/github/response";
import { injectGitHubClient } from "./services/github";
import { cluster } from "radash";
import Papa from "papaparse";
import { writeFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { Task } from "./types";

const gh = injectGitHubClient();

const generateTaskId = (owner: string, name: string, number: number) => {
  return `${owner}__${name}-${number}`;
};

export const validate = async (items: Task[], output: string) => {
  const batches = cluster(items, 25);

  for (const batch of batches) {
    console.log("Processing batch of size", batch.length);
    const results: Task[] = [];
    const prMapBatch = await gh.pr.getBatch(batch);
    const blobMapBatch = await gh.repository.blobBatch(batch);

    await Promise.all(
      batch.map(async (item) => {
        const prKey = `${item.owner}/${item.name}/${item.number}`;
        const blobKey = `${item.owner}/${item.name}/${item.baseCommit}`;
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
        const pkgInfo = getPackageUpgraded(item.prTitle);
        if (!pkgInfo) {
          return;
        }
        const { pkg, versionFrom, versionTo } = pkgInfo;
        if (isInInvalidPackageList(pkg)) {
          return;
        }

        const codeChanges = hasCodeChanges(pr);
        const onlyOnePackageModified = onlyOnePackageModifiedInPackageJson(pr);
        if (!codeChanges || !onlyOnePackageModified) {
          return;
        }

        const patch = await gh.pr.patch({
          prUrl: item.prUrl,
        });

        const updatedItem = {
          ...item,
          id: generateTaskId(item.owner, item.name, item.number),
          node_version: nvmRcContent,
          pkg_manager: pkgManager,
          package: pkg,
          version_from: versionFrom,
          version_to: versionTo,
          patch,
        };

        results.push(updatedItem);
      })
    );

    if (results.length) {
      console.log(`Saving ${results.length} records to ${output}`);
      if (existsSync(output)) {
        const file = readFileSync(output, "utf8").toString();
        const { data } = Papa.parse<Task>(file, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
        });
        const combined = [...data, ...results];
        const csv = Papa.unparse(combined);
        await writeFile(output, csv);
      } else {
        const csv = Papa.unparse(results);
        await writeFile(output, csv);
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

const isInInvalidPackageList = (pkg: string) => {
  return ["prettier"].includes(pkg);
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
