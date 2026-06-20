import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseReleaseArgs, usage } from "./parse-args";
import {
  HF_DATASET_REPO,
  hfStagingPaths,
  releaseAssetPaths,
  releaseAssetsDir,
  repoRoot,
} from "./paths";

interface DownloadSpec {
  localPath: string;
  remotePath: string;
}

function buildDownloadSpecs(tag: string): DownloadSpec[] {
  const staging = hfStagingPaths(tag);
  const assets = releaseAssetPaths();
  return [
    { remotePath: staging.sft, localPath: assets.sft },
    { remotePath: staging.patches, localPath: assets.patches },
  ];
}

function buildDownloadCommand(spec: DownloadSpec, tempDir: string): string[] {
  return [
    "huggingface-cli",
    "download",
    HF_DATASET_REPO,
    spec.remotePath,
    "--repo-type",
    "dataset",
    "--local-dir",
    tempDir,
  ];
}

function ensureHuggingfaceCli(): void {
  const check = Bun.spawnSync(["huggingface-cli", "--help"], {
    stdout: "ignore",
    stderr: "ignore",
  });

  if (check.exitCode === 0) {
    return;
  }

  const install = Bun.spawnSync(
    ["python3", "-m", "pip", "install", "--quiet", "huggingface_hub"],
    {
      stdout: "inherit",
      stderr: "inherit",
    }
  );

  if (install.exitCode !== 0) {
    throw new Error("failed to install huggingface_hub (huggingface-cli)");
  }
}

async function downloadFile(
  spec: DownloadSpec,
  tempDir: string
): Promise<void> {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) {
    throw new Error("HF_TOKEN is required to fetch staged release assets");
  }

  const proc = Bun.spawn(buildDownloadCommand(spec, tempDir), {
    cwd: repoRoot(),
    stdout: "inherit",
    stderr: "inherit",
    env: {
      ...process.env,
      HF_TOKEN: token,
    },
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`huggingface-cli download failed for ${spec.remotePath}`);
  }

  const downloadedPath = join(tempDir, spec.remotePath);
  if (!existsSync(downloadedPath)) {
    throw new Error(`expected downloaded asset at ${downloadedPath}`);
  }

  mkdirSync(dirname(spec.localPath), { recursive: true });
  cpSync(downloadedPath, spec.localPath);
}

async function main(): Promise<void> {
  let options: ReturnType<typeof parseReleaseArgs>;
  try {
    options = parseReleaseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${usage("scripts/release/fetch-release-staging.ts")}`);
    process.exit(1);
  }

  mkdirSync(releaseAssetsDir(), { recursive: true });
  const specs = buildDownloadSpecs(options.tag);
  const tempDir = join(repoRoot(), ".release-staging-fetch");

  if (options.dryRun) {
    console.log("[release:fetch-staging] dry run — would run:");
    for (const spec of specs) {
      console.log(
        `  HF_TOKEN=*** huggingface-cli download ${HF_DATASET_REPO} ${spec.remotePath} --repo-type dataset --local-dir ${tempDir}`
      );
      console.log(`  cp ${join(tempDir, spec.remotePath)} ${spec.localPath}`);
    }
    return;
  }

  await ensureHuggingfaceCli();

  mkdirSync(tempDir, { recursive: true });
  try {
    for (const spec of specs) {
      await downloadFile(spec, tempDir);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }

  console.log(
    `[release:fetch-staging] fetched staged release assets for ${options.tag}`
  );
  for (const spec of specs) {
    console.log(`  ${spec.localPath}`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
