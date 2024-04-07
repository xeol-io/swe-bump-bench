import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const env = createEnv({
  server: {
    GITHUB_TOKEN: z.string(),
  },
  runtimeEnv: process.env,
});

export const config = {
  github: {
    token: env.GITHUB_TOKEN,
  },
};
