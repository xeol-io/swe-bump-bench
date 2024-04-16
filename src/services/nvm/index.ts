import fs from "fs";
import { readFile } from "node:fs/promises";

import { execCmd } from "../exec";

// . command works for /bin/sh and /bin/bash shells, while
// source does not.
const sourceCmd = ". ~/.nvm/nvm.sh &&";

export const nvmUseCmd = async (version?: string) => {
  if (version) {
    const nvmUseCmd = `${sourceCmd} nvm use ${version}`;
    await installPkgManagers(nvmUseCmd);
    return nvmUseCmd;
  }

  const nvmRc = fs.existsSync(".nvmrc")
    ? await readFile(".nvmrc", "utf8")
    : null;

  if (!nvmRc) {
    try {
      await execCmd(`${sourceCmd} nvm install --lts`);
    } catch (e) {
      console.debug("Error when calling `nvm install --lts`", e);
    }
    console.debug("No .nvmrc file found");
    const nvmUseCmd = `${sourceCmd} nvm use lts/\\*`;
    await installPkgManagers(nvmUseCmd);
    return nvmUseCmd;
  } else {
    try {
      await execCmd(`${sourceCmd} nvm version ${nvmRc}`);
      console.debug("Using .nvmrc file");
      const nvmUseCmd = `${sourceCmd} nvm use`;
      await installPkgManagers(nvmUseCmd);
      return nvmUseCmd;
    } catch (e) {
      console.debug("Installing .nvmrc file");
      try {
        await execCmd(`${sourceCmd} nvm install`);
      } catch (e) {
        console.debug("Error when calling `nvm install`", e);
      }
      const nvmUseCmd = `${sourceCmd} nvm use`;
      await installPkgManagers(nvmUseCmd);
      return nvmUseCmd;
    }
  }
};

const installPkgManagers = async (useCmd: string) => {
  await execCmd(`${useCmd} && npm install -g yarn`);
  await execCmd(`${useCmd} && npm install -g pnpm`);
};
