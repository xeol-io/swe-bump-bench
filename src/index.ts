import { program } from "@commander-js/extra-typings";
import commander from "@commander-js/extra-typings";
import * as fs from "fs";
import { predictionIdMap, runEvaluation, taskIdMap } from "./evaluate";
import { Task } from "./types";

const collect = new commander.Command("collect");
const evaluate = new commander.Command("evaluate");

import { readFileSync, writeFile } from "fs";
import Papa from "papaparse";
import { validate } from "./validate";
import path from "path";

collect
  .requiredOption("-i, --input <file>", "input file")
  .requiredOption("-o, --output <file>", "output file")
  .action(async (options) => {
    const file = readFileSync(options.input, "utf8").toString();

    const { data } = Papa.parse<Task>(file, {
      header: true,
      dynamicTyping: true,
    });

    await validate(data, options.output);
  });

evaluate
  .requiredOption("-p, --predictions-file <file>", "predictions file")
  .requiredOption("-t, --tasks-file <file>", "tasks file")
  .requiredOption("-tb, --testbed-path <file>", "testbed dir")
  .action(async (options) => {
    const { predictionsFile, tasksFile, testbedPath } = options;

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

    predictions.map(async (prediction) => {
      const task = tasksMap.get(prediction.id);
      if (!task) {
        throw new Error(`Task ${prediction.id} not found`);
      }

      const taskTestBedDir = path.join(testbedPath, prediction.modelName);
      fs.mkdirSync(taskTestBedDir, { recursive: true });

      // run evaluation
      await runEvaluation({
        tmpDir: taskTestBedDir,
        prediction,
        task,
      });
    });
  });

program.name("data").addCommand(collect).addCommand(evaluate).parse();
