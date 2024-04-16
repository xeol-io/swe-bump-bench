import fs from "fs";
import { Prediction, PredictionsSchema, Task, TasksSchema } from "./types";
import { injectGitService } from "./services/git";
import { SimpleGit } from "simple-git";
import { run as ncuRun } from "npm-check-updates";
import { version } from "os";
import { nvmUseCmd } from "./services/nvm";
import { execCmd } from "./services/exec";
import { findPackageManager } from "./services/packagejson";
import { injectTscService } from "./services/tsc";
import os from "os";
import path from "path";

export const taskIdMap = (tasksFile: string) => {
  const map = new Map<string, Task>();

  if (fs.existsSync(tasksFile)) {
    const contents = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
    const tasks = TasksSchema.parse(contents);
    tasks.map((task) => {
      map.set(task.id, task);
    });
  }

  return map;
};

export const predictionIdMap = (predictionsFile: string) => {
  const map = new Map<string, Prediction>();

  if (fs.existsSync(predictionsFile)) {
    const contents = JSON.parse(fs.readFileSync(predictionsFile, "utf8"));
    const predictions = PredictionsSchema.parse(contents);
    predictions.map((prediction) => {
      map.set(prediction.id, prediction);
    });
  }

  return map;
};

export const runEvaluation = async ({
  tmpDir,
  prediction,
  task,
}: {
  tmpDir: string;
  prediction: Prediction;
  task: Task;
}) => {
  const git = injectGitService(tmpDir);
  const tsc = injectTscService();

  const { owner, name, pkgManager, id, package: pkgName, nodeVersion } = task;
  const repoUrl = `https://github.com/${owner}/${name}`;
  const workingDir = `${tmpDir}/${id}`;

  await execCmd(`rm -rf ${workingDir}`);
  await execCmd(`mkdir -p ${workingDir}`);

  await git.clone(repoUrl, workingDir);
  await git.cwd(workingDir);
  process.chdir(workingDir);
  await git.checkout(task.baseCommit);

  const nvmCmd = await nvmUseCmd(nodeVersion);

  await execCmd(`${nvmCmd} && ${pkgManager} install`);
  const errsBefore = await tsc.run();

  await applyPatch(git, prediction.patch);
  await execCmd(`${nvmCmd} && ${pkgManager} install`);

  const errsAfter = await tsc.run();
  if (errsAfter.length > errsBefore.length) {
    console.log("FAILED TASK");
  } else {
    console.log("SUCCESSFUL TASK");
  }
};

const applyPatch = async (git: SimpleGit, patch: string) => {
  const tempDir = os.tmpdir();
  const patchFilePath = path.join(tempDir, `patch-${Date.now()}.diff`);
  const contentToWrite = patch.endsWith("\n") ? patch : `${patch}\n`;

  fs.writeFileSync(patchFilePath, contentToWrite);

  await git.applyPatch(patchFilePath);
};
