import { program } from "@commander-js/extra-typings";
import commander from "@commander-js/extra-typings";

const collect = new commander.Command("collect");

import { readFileSync, writeFile } from "fs";
import Papa from "papaparse";
import { RepoCsvItem } from "./types";
import { validate } from "./validate";

collect
  .option("-o, --output <file>", "output file")
  .option("-l, --limit <limit>", "the number of records to process")
  .action(async (options) => {
    const file = readFileSync("repos.csv", "utf8").toString();

    const { data } = Papa.parse<RepoCsvItem>(file, {
      header: true,
      dynamicTyping: true,
    });

    await validate(data);
  });

program.name("data").addCommand(collect).parse();
