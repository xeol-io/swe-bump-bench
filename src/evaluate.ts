import fs from "fs";
import { Prediction, PredictionSchema, Task, TasksSchema } from "./types";
import { injectGitService } from "./services/git";
import { ResetMode, SimpleGit } from "simple-git";
import { nvmUseCmd } from "./services/nvm";
import { execCmd } from "./services/exec";
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

export const predictionIdMap = (predictionsDir: string) => {
  const map = new Map<string, Prediction>();

  if (fs.existsSync(predictionsDir)) {
    fs.readdirSync(predictionsDir).forEach((file) => {
      if (file.endsWith(".prediction.json")) {
        const filePath = path.join(predictionsDir, file);
        const contents = JSON.parse(fs.readFileSync(filePath, "utf8"));
        const prediction = PredictionSchema.parse(contents);
        map.set(prediction.id, prediction);
      }
    });
  }

  return map;
};

export const runEvaluation = async ({
  logDir,
  tmpDir,
  prediction,
  task,
}: {
  logDir: string;
  tmpDir: string;
  prediction: Prediction;
  task: Task;
}) => {
  const git = injectGitService(tmpDir);
  const tsc = injectTscService();

  const { owner, name, pkgManager, id, package: pkgName, nodeVersion } = task;

  console.log(`Running evaluation for ${id}`);

  const repoUrl = `https://github.com/${owner}/${name}`;
  const workingDir = `${tmpDir}/${id}`;

  await execCmd(`rm -rf ${workingDir}`);
  await execCmd(`mkdir -p ${workingDir}`);

  await git.clone(repoUrl, workingDir);
  await git.cwd(workingDir);
  process.chdir(workingDir);
  await git.checkout(task.commit);

  const nvmCmd = await nvmUseCmd(nodeVersion);

  await execCmd(`${nvmCmd} && ${pkgManager} install`);
  const errsBefore = await tsc.run(nvmCmd);
  if (errsBefore.length > 0) {
    console.log("INVALID TASK, errors before patching", errsBefore);
  }
  await git.reset(ResetMode.HARD);

  const patchApplied = await applyPatch(git, prediction.patch);
  if (!patchApplied) {
    console.log("INVALID TASK, could not apply patch");
    storeEvaluationResult(prediction.modelName, id, false, logDir);
    return;
  }
  await execCmd(`${nvmCmd} && ${pkgManager} install`);

  const errsAfter = await tsc.run(nvmCmd);
  if (errsAfter.length > errsBefore.length) {
    console.log("FAILED TASK");
    storeEvaluationResult(prediction.modelName, id, false, logDir);
  } else {
    console.log("SUCCESSFUL TASK");
    storeEvaluationResult(prediction.modelName, id, true, logDir);
  }
};

const storeEvaluationResult = (
  model: string,
  id: string,
  result: boolean,
  logDir: string
) => {
  const filePath = path.join(logDir, `${id}.${model}.eval.log`);
  console.log(filePath);
  fs.writeFileSync(filePath, result.toString());
};

const applyPatch = async (git: SimpleGit, patch: string) => {
  const tempDir = os.tmpdir();
  const patchFilePath = path.join(tempDir, `patch-${Date.now()}.diff`);
  const contentToWrite = patch.endsWith("\n") ? patch : `${patch}\n`;

  fs.writeFileSync(patchFilePath, contentToWrite);

  try {
    await git.applyPatch(patchFilePath, {
      "--ignore-space-change": null,
      "--ignore-whitespace": null,
      "--reject": null,
    });
    return true;
  } catch (e) {
    console.log("Error applying patch", e);
    return false;
  }
};
