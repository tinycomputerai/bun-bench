import { existsSync } from "node:fs";
import { join } from "node:path";
import { parseReleaseArgs, usage } from "./parse-args";
import { assertReleaseAssets } from "./release-assets";
import { HF_DATASET_REPO, hfStagingPaths, repoRoot } from "./paths";

type UploadSpec = {
  localPath: string;
  remotePath: string;
};

function buildUploadSpecs(tag: string, assets: { sft: string; patches: string }): UploadSpec[] {
  const staging = hfStagingPaths(tag);
  return [
    { localPath: assets.sft, remotePath: staging.sft },
    { localPath: assets.patches, remotePath: staging.patches },
  ];
}

function buildUploadCommand(spec: UploadSpec, tag: string): string[] {
  return [
    "huggingface-cli",
    "upload",
    HF_DATASET_REPO,
    spec.localPath,
    spec.remotePath,
    "--repo-type",
    "dataset",
    "--commit-message",
    `Stage release assets for ${tag}`,
  ];
}

async function ensureHuggingfaceCli(): Promise<void> {
  const check = Bun.spawnSync(["huggingface-cli", "--help"], {
    stdout: "ignore",
    stderr: "ignore",
  });

  if (check.exitCode === 0) {
    return;
  }

  const install = Bun.spawnSync(["python3", "-m", "pip", "install", "--quiet", "huggingface_hub"], {
    stdout: "inherit",
    stderr: "inherit",
  });

  if (install.exitCode !== 0) {
    throw new Error("failed to install huggingface_hub (huggingface-cli)");
  }
}

async function uploadFile(spec: UploadSpec, tag: string): Promise<void> {
  const token = process.env.HF_TOKEN?.trim();
  if (!token) {
    throw new Error("HF_TOKEN is required to upload release staging assets");
  }

  const proc = Bun.spawn(buildUploadCommand(spec, tag), {
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
    throw new Error(`huggingface-cli upload failed for ${spec.remotePath}`);
  }
}

async function main(): Promise<void> {
  let options;
  try {
    options = parseReleaseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(`\n${usage("scripts/release/upload-release-staging.ts")}`);
    process.exit(1);
  }

  let assets;
  try {
    assets = assertReleaseAssets();
  } catch (error) {
    console.error("[release:upload-staging] failed");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const specs = buildUploadSpecs(options.tag, assets);

  if (options.dryRun) {
    console.log("[release:upload-staging] dry run — would run:");
    for (const spec of specs) {
      console.log(
        `  HF_TOKEN=*** huggingface-cli upload ${HF_DATASET_REPO} ${spec.localPath} ${spec.remotePath} --repo-type dataset --commit-message "Stage release assets for ${options.tag}"`,
      );
    }
    return;
  }

  await ensureHuggingfaceCli();

  for (const spec of specs) {
    if (!existsSync(spec.localPath)) {
      console.error(`[release:upload-staging] missing staged asset: ${spec.localPath}`);
      process.exit(1);
    }
    await uploadFile(spec, options.tag);
  }

  console.log(`[release:upload-staging] staged release assets for ${options.tag} on ${HF_DATASET_REPO}`);
  for (const spec of specs) {
    console.log(`  ${spec.remotePath}`);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
