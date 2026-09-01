import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export default function setup() {
  const cwd = fileURLToPath(new URL("../", import.meta.url));
  const require = createRequire(import.meta.url);
  execFileSync(
    process.execPath,
    [
      require.resolve("prisma/build/index.js"),
      "migrate",
      "deploy",
    ],
    { cwd, env: process.env, stdio: "pipe" },
  );
  execFileSync(process.execPath, ["--import", "tsx", "prisma/seed.ts"], {
    cwd,
    env: process.env,
    stdio: "pipe",
  });
}
