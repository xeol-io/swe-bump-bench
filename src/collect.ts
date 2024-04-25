import path from "path";
import { execCmd } from "./services/exec";
import { injectGitService } from "./services/git";
import { injectTscService } from "./services/tsc";
import { cluster, isObject } from "radash";
import semver from "semver";
import { run as ncuRun } from "npm-check-updates";
import PackageJson from "@npmcli/package-json";

import { injectGitHubClient } from "./services/github";
import { nvmUseCmd } from "./services/nvm";
import { ResetMode } from "simple-git";
import { Task } from "./types";
import { FileInRepo } from "./services/github/response";
import { readFileSync, writeFileSync } from "fs";
const gh = injectGitHubClient();

const defaultNodeVersion = "v20.12.2";

export const collectTasks = async (
  repos: { owner: string; name: string }[],
  outputFile: string
) => {
  const batches = cluster(repos, 25);

  const tmpDir = "/tmp/workspace";

  const git = injectGitService(tmpDir);
  const tsc = injectTscService();
  console.log(`There are ${batches.length} batches to validate`);

  for (const batch of batches) {
    console.log("Processing batch of size", batch.length);
    const blobMapBatch = await gh.repository.blobBatch(batch);

    for (const repo of batch) {
      console.log("Cloning", repo.owner, repo.name);
      const blobKey = `${repo.owner}/${repo.name}/HEAD`;
      const ghFiles = blobMapBatch[blobKey]?.object?.entries;
      if (!ghFiles) {
        continue;
      }

      const hasTsConfig = hasTsconfigFile(ghFiles);
      if (!hasTsConfig) {
        continue;
      }

      const pkgManager = getPackageManager(ghFiles);
      if (!pkgManager) {
        continue;
      }

      const workingDir = path.join(tmpDir, `${repo.owner}__${repo.name}`);
      const repoUrl = `https://github.com/${repo.owner}/${repo.name}`;

      await execCmd(`rm -rf ${workingDir}`);
      await execCmd(`mkdir -p ${workingDir}`);

      await git.clone(repoUrl, workingDir);
      await git.cwd(workingDir);
      process.chdir(workingDir);

      const nvmCmd = await nvmUseCmd();
      try {
        await execCmd(`${nvmCmd} && ${pkgManager} install`);
      } catch (e) {
        console.log(
          `Error running ${pkgManager} install for repository ${repo.owner}__${repo.name}. Skipping...`
        );
        continue;
      }

      const errsBefore = await tsc.run(nvmCmd);

      const upgradeablePackages = await ncuRun({
        packageFile: "./package.json",
        interactive: false,
        jsonUpgraded: true,
        target: "latest",
        filterResults: (name, { currentVersion, upgradedVersion }) => {
          if (name.startsWith("@types")) {
            return false;
          }

          if (name.includes("prettier") || name.includes("eslint")) {
            return false;
          }

          const currentSemver = semver.coerce(currentVersion);

          if (!currentSemver) {
            console.debug(`No semver found for ${currentVersion}`);
            return false;
          }

          const upgradedSemver = semver.coerce(upgradedVersion);

          if (!upgradedSemver) {
            console.debug(`No semver found for ${upgradedVersion}`);
            return false;
          }

          return currentSemver.major !== upgradedSemver.major;
        },
      });

      if (
        !isObject(upgradeablePackages) ||
        !Object.keys(upgradeablePackages).length
      ) {
        console.log(
          `No packages to upgrade for ${repo.owner}__${repo.name}. Skipping...`
        );
        continue;
      }

      for (const [packageName, newVersion] of Object.entries(
        upgradeablePackages
      )) {
        await updatePackageJson(workingDir, packageName, newVersion);

        try {
          await execCmd(`${nvmCmd} && ${pkgManager} install`);
        } catch (e) {
          console.log("Error upgrading packages", e);
          continue;
        }

        let errsAfter = [];
        try {
          errsAfter = await tsc.run(nvmCmd);
        } catch (e) {
          console.log(e);
        }
        if (errsAfter.length > errsBefore.length) {
          const nodeVersion = getNvmRcContent(ghFiles);

          const task: Task = {
            id: `${repo.owner}__${repo.name}-${packageName.replace(
              /\//g,
              "-slash-"
            )}__${newVersion}`,
            name: repo.name,
            owner: repo.owner,
            pkgManager: pkgManager,
            package: packageName,
            versionTo: newVersion,
            nodeVersion: nodeVersion ?? defaultNodeVersion,
            commit: await git.revparse("HEAD"),
          };

          console.log("Valid task found, appending to output file");
          await appendToOutputFile(task, outputFile);
        }
        await git.reset(ResetMode.HARD);
      }
    }
  }
};

const updatePackageJson = async (
  workingDir: string,
  packageName: string,
  newVersion: string
) => {
  const packageJson = await PackageJson.load(workingDir);
  const existingDeps = packageJson.content.dependencies;
  const existingDevDeps = packageJson.content.devDependencies;

  if (existingDeps?.[packageName]) {
    existingDeps[packageName] = newVersion;
  }
  if (existingDevDeps?.[packageName]) {
    existingDevDeps[packageName] = newVersion;
  }
  await packageJson.save();
};

const appendToOutputFile = async (task: Task, outputFile: string) => {
  const existingTasks = JSON.parse(readFileSync(outputFile, "utf-8"));
  writeFileSync(
    outputFile,
    JSON.stringify(existingTasks.concat(task), null, 2)
  );
};

const getNvmRcContent = (files: FileInRepo[]) => {
  return files.find((entry) => entry.name === ".nvmrc")?.object?.text?.trim();
};

const hasTsconfigFile = (files: FileInRepo[]) => {
  return files.some((entry) => entry.name === "tsconfig.json");
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
