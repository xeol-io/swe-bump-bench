import fs from "fs";
import { readFile } from "node:fs/promises";

import { execCmd } from "../exec";

// . command works for /bin/sh and /bin/bash shells, while
// source does not.
const sourceCmd = ". ~/.nvm/nvm.sh &&";

export const nvmUseCmd = async (version?: string) => {
  if (version) {
    try {
      await execCmd(`${sourceCmd} nvm version ${version}`);
    } catch (e) {
      await execCmd(`${sourceCmd} nvm install ${version}`);
    }
    const nvmUseCmd = `${sourceCmd} nvm use ${version}`;
    await installPkgManagers(nvmUseCmd);
    return nvmUseCmd;
  }

  const nvmRc = fs.existsSync(".nvmrc")
    ? await readFile(".nvmrc", "utf8")
    : null;

  if (!nvmRc) {
    await execCmd(`${sourceCmd} nvm install --lts`);
    const nvmUseCmd = `${sourceCmd} nvm use --lts`;
    await installPkgManagers(nvmUseCmd);
    return nvmUseCmd;
  } else {
    try {
      await execCmd(`${sourceCmd} nvm version ${nvmRc}`);
      const nvmUseCmd = `${sourceCmd} nvm use`;
      await installPkgManagers(nvmUseCmd);
      return nvmUseCmd;
    } catch (e) {
      await execCmd(`${sourceCmd} nvm install`);
      const nvmUseCmd = `${sourceCmd} nvm use`;
      await installPkgManagers(nvmUseCmd);
      return nvmUseCmd;
    }
  }
};

const installPkgManagers = async (useCmd: string) => {
  await execCmd(`${useCmd} && npm install -g yarn`);
  await execCmd(`${useCmd} && npm install -g pnpm`);
  await execCmd(`${useCmd} && npm install -g typescript`);
};
