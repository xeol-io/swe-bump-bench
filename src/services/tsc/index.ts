import { exec } from "child_process";

import { TscOutputSchema } from "./schema";

/* eslint-disable no-control-regex */
function stripAnsi(str: string) {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ""
  );
}

export const parse = async (input: string) => {
  const data = stripAnsi(input);
  const trimRegex = /Found \d+ errors in/;
  const trimmedString = trimRegex.test(data)
    ? data.substring(0, data.search(trimRegex))
    : data;

  // tsc errors with lines like this
  // src/components/Component.tsx:231:33 - error TS2339: Property 'foo' does not exist on type 'Bar'
  const colonRegex =
    /^(.+?):(\d+):(\d+) - (error|warning) (TS\d+): (.*(?:\n(?!src\/).*)*)/gm;
  // tsc errors with lines like this
  // src/components/Component.tsx(231,33): error TS2339: Property 'foo' does not exist on type 'Bar'
  const bracketRegex =
    /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.*(?:\n(?!src\/).*)*)/gm;
  const items = [];

  let c;
  let b;
  while ((c = colonRegex.exec(trimmedString)) !== null) {
    if (c.length === 7) {
      items.push({
        type: "Item",
        value: {
          path: {
            type: "Path",
            value: c[1],
          },
          cursor: {
            type: "Cursor",
            value: {
              line: parseInt(c[2]!, 10),
              col: parseInt(c[3]!, 10),
            },
          },
          tsError: {
            type: "TsError",
            value: {
              type: c[4],
              errorString: c[5],
            },
          },
          message: {
            type: "Message",
            value: c[6]!.trim(),
          },
        },
      });
    }
  }
  while ((b = bracketRegex.exec(trimmedString)) !== null) {
    if (b.length === 7) {
      items.push({
        type: "Item",
        value: {
          path: {
            type: "Path",
            value: b[1],
          },
          cursor: {
            type: "Cursor",
            value: {
              line: parseInt(b[2]!, 10),
              col: parseInt(b[3]!, 10),
            },
          },
          tsError: {
            type: "TsError",
            value: {
              type: b[4],
              errorString: b[5],
            },
          },
          message: {
            type: "Message",
            value: b[6]!.trim(),
          },
        },
      });
    }
  }
  return TscOutputSchema.parse(items);
};

export const createTscService = (doExec: typeof exec) => {
  return {
    run: async (nvmCmd: string) => {
      console.log("Running tsc...");
      const data = await new Promise<string>((resolve, reject) => {
        // the --pretty flag is required here so that tsc outputs line number information
        // to stdout
        doExec(
          `${nvmCmd} && tsc --noEmit --pretty --skipLibCheck`,
          (error, stdout, stderr) => {
            if (error) {
              if (stderr.includes("command not found: tsc")) {
                throw new Error(
                  "You must have typescript installed to use this service."
                );
              }
              resolve(stdout);
            }
            if (stderr) {
              resolve(stdout);
            }
            resolve(stdout);
          }
        );
      });

      return await parse(data);
    },
  };
};

export const injectTscService = () => {
  return createTscService(exec);
};
