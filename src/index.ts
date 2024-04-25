import { program } from "@commander-js/extra-typings";
import commander from "@commander-js/extra-typings";
import * as fs from "fs";
import { predictionIdMap, runEvaluation, taskIdMap } from "./evaluate";

const collect = new commander.Command("collect");
const evaluate = new commander.Command("evaluate");

import { readFileSync, writeFile } from "fs";
import Papa from "papaparse";
import { collectTasks } from "./collect";
import path from "path";

interface Repo {
  repoUrl: string;
}

collect
  .requiredOption("-i, --input <file>", "input file")
  .requiredOption("-o, --output <file>", "output file")
  .action(async (options) => {
    const file = readFileSync(options.input, "utf8").toString();

    const { data } = Papa.parse<Repo>(file, {
      header: true,
      dynamicTyping: true,
    });

    const repos = data
      .map((repo) => {
        const [owner, name] = repo.repoUrl.split("/").slice(-2);
        if (!owner || !name) {
          return undefined;
        }

        return {
          owner: owner,
          name: name,
        };
      })
      .filter(<T>(r: T | undefined): r is T => !!r);

    await collectTasks(repos, options.output);
  });

evaluate
  .requiredOption("-p, --predictions-file <file>", "predictions file")
  .requiredOption("-l, --log-path <file>", "log dir")
  .requiredOption("-t, --tasks-file <file>", "tasks file")
  .requiredOption("-tb, --testbed-path <file>", "testbed dir")
  .action(async (options) => {
    const { predictionsFile, tasksFile, logPath, testbedPath } = options;

    if (!fs.existsSync(logPath) || !fs.statSync(logPath).isDirectory()) {
      throw new Error("--log_dir must exist and point at a directory");
    }
    if (
      !fs.existsSync(testbedPath) ||
      !fs.statSync(testbedPath).isDirectory()
    ) {
      throw new Error("--testbed must exist and point at a directory");
    }

    const tasksMap = taskIdMap(tasksFile);
    const tasks = Array.from(tasksMap.values());

    const predictionsMap = predictionIdMap(predictionsFile);
    const predictions = Array.from(predictionsMap.values());

    for (const prediction of predictions) {
      const task = tasksMap.get(prediction.id);
      if (!task) {
        throw new Error(`Task ${prediction.id} not found`);
      }

      const taskTestBedDir = path.join(testbedPath, prediction.modelName);
      fs.mkdirSync(taskTestBedDir, { recursive: true });

      // run evaluation
      await runEvaluation({
        logDir: logPath,
        tmpDir: taskTestBedDir,
        prediction,
        task,
      });
    }
  });

program.name("data").addCommand(collect).addCommand(evaluate).parse();
