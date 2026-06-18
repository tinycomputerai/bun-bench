import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseReleaseArgs, usage } from "./parse-args";
import { repoRoot } from "./paths";

const HARBOR_CREDENTIALS_DIR = join(homedir(), ".harbor");
const HARBOR_CREDENTIALS_PATH = join(HARBOR_CREDENTIALS_DIR, "credentials.json");

function installHarborCredentials(token: string): void {
  mkdirSync(HARBOR_CREDENTIALS_DIR, { recursive: true });
  writeFileSync(HARBOR_CREDENTIALS_PATH, token, { mode: 0o600 });
}

function buildPublishCommand(tag: string, harborRoot: string): string[] {
  return ["uvx", "harbor", "publish", harborRoot, "-t", tag, "--public"];
}

async function runHarborPublish(tag: string, harborRoot: string): Promise<number> {
  const token = process.env.HARBOR_TOKEN?.trim();
  if (!token) {
    throw new Error("HARBOR_TOKEN is required to publish Harbor packages");
  }

  installHarborCredentials(token);

  const command = buildPublishCommand(tag, harborRoot);
  const proc = Bun.spawn(command, {
    cwd: repoRoot(),
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });

  return proc.exited;
}

async function main(): Promise<void> {
  let options;
  try {
    options = parseReleaseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${usage("scripts/release/publish-harbor.ts")}`);
    process.exit(1);
  }

  const harborRoot = join(repoRoot(), "harbor");
  if (!existsSync(harborRoot)) {
    console.error(`[release:harbor] harbor export directory not found: ${harborRoot}`);
    process.exit(1);
  }

  const command = buildPublishCommand(options.tag, harborRoot).join(" ");

  if (options.dryRun) {
    console.log("[release:harbor] dry run — would run:");
    console.log(`  HARBOR_TOKEN=*** ${command}`);
    return;
  }

  const exitCode = await runHarborPublish(options.tag, harborRoot);
  if (exitCode !== 0) {
    process.exit(exitCode);
  }

  console.log(`[release:harbor] published harbor/ with tag ${options.tag}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
