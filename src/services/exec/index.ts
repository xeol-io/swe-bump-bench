import { exec } from "child_process";

export const execCmd = async (cmd: string) => {
  return await new Promise<string>((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Failed to execute command '${cmd}'`));
      }
      if (stderr) {
        resolve(stderr);
      }
      resolve(stdout);
    });
  });
};
