import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Index } from "npm-check-updates/build/src/types/IndexType";
import { run as ncuRun } from "npm-check-updates";

export const findPackageManager = (): {
  pkgManager: "npm" | "yarn" | "pnpm" | null;
  filePath: string;
} => {
  let currentDir = process.cwd();
  const rootPath = path.parse(currentDir).root;

  while (currentDir !== rootPath) {
    if (fs.existsSync(path.join(currentDir, "package-lock.json"))) {
      return {
        pkgManager: "npm",
        filePath: path.join(currentDir, "package-lock.json"),
      };
    } else if (fs.existsSync(path.join(currentDir, "yarn.lock"))) {
      return {
        pkgManager: "yarn",
        filePath: path.join(currentDir, "yarn.lock"),
      };
    } else if (fs.existsSync(path.join(currentDir, "pnpm-lock.yaml"))) {
      return {
        pkgManager: "pnpm",
        filePath: path.join(currentDir, "pnpm-lock.yaml"),
      };
    }

    // check for .git folder to stop at the root of the repo
    if (fs.existsSync(path.join(currentDir, ".git"))) {
      break;
    }

    currentDir = path.join(currentDir, "..");
  }
  return {
    pkgManager: "npm",
    filePath: "package-lock.json",
  };
};

const fileHash = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
};

// ncu doesn't actually wait until npm install has finished
// before continuing, so we have to create a manual wait
// until the package lock file changes
const waitForFileChange = async (
  filePath: string,
  initialHash: string,
  timeout = 60000
) => {
  const startTime = Date.now();
  return new Promise<void>((resolve, reject) => {
    (function waitForChange() {
      if (Date.now() - startTime >= timeout) {
        reject(new Error("Timeout waiting for file change"));
        return;
      }

      const currentHash = fileHash(filePath);
      if (currentHash !== initialHash) {
        resolve();
      } else {
        setTimeout(waitForChange, 500);
      }
    })();
  });
};

export const updatePackageJson = async (packageName?: string) => {
  const { pkgManager, filePath: pkgManagerFilePath } = findPackageManager();
  console.log("pkgManager found:", pkgManager);
  if (!pkgManager) {
    throw new Error("No package manager found");
  }
  const initialHash = fileHash(pkgManagerFilePath);

  function isIndex(value: unknown): value is Index<string> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  const upgradedPackages = await ncuRun({
    packageFile: "./package.json",
    interactive: !packageName,
    install: "always",
    jsonUpgraded: true,
    packageManager: pkgManager,
    target: "latest",
    upgrade: true,
    filter: packageName
      ? (name) => name === packageName || name === `@types/${packageName}`
      : undefined,
  });

  if (isIndex(upgradedPackages)) {
    const pkgNames = Object.keys(upgradedPackages);
    await waitForFileChange(pkgManagerFilePath, initialHash);
    return pkgNames.find(Boolean);
  } else {
    throw new Error(
      "Invalid type for upgradedPackages return, expected Index<string>. jsonUpgraded may be false."
    );
  }
};
