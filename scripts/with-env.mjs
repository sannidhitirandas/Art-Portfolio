import { spawn } from "node:child_process";

const [, , nodeEnv, command, ...args] = process.argv;

if (!nodeEnv || !command) {
  console.error(
    "Usage: node scripts/with-env.mjs <development|production> <command> [args...]",
  );
  process.exit(1);
}

const child = spawn(command, args, {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: nodeEnv },
  // Windows needs a shell to resolve local .cmd executables such as tsx.cmd.
  shell: process.platform === "win32",
});

child.on("error", error => {
  console.error(`Could not start '${command}': ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exitCode = code ?? 1;
  }
});
