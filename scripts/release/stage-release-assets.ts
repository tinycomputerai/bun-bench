import { cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import {
  exportDatasetPaths,
  releaseAssetPaths,
  releaseAssetsDir,
  repoRoot,
} from "./paths";

function requireExport(path: string, label: string): void {
  if (!existsSync(path)) {
    console.error(`[release:stage] missing export file: ${path}`);
    console.error(
      `run export:${label === "sft" ? "sft" : "patches"} before staging release assets`
    );
    process.exit(1);
  }

  if (statSync(path).size === 0) {
    console.error(`[release:stage] export file is empty: ${path}`);
    process.exit(1);
  }
}

function main(): void {
  const root = repoRoot();
  const exports = exportDatasetPaths(root);
  const assetsDir = releaseAssetsDir(root);
  const assets = releaseAssetPaths(root);

  requireExport(exports.sft, "sft");
  requireExport(exports.patches, "patches");

  mkdirSync(assetsDir, { recursive: true });
  cpSync(exports.sft, assets.sft);
  cpSync(exports.patches, assets.patches);

  console.log("[release:stage] complete");
  console.log(`  ${assets.sft}`);
  console.log(`  ${assets.patches}`);
}

if (import.meta.main) {
  main();
}
