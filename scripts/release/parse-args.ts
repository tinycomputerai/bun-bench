export type ReleaseCliOptions = {
  tag: string;
  dryRun: boolean;
};

export function parseReleaseArgs(argv: string[]): ReleaseCliOptions {
  let tag = process.env.RELEASE_TAG?.trim() ?? "";
  let dryRun = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--tag") {
      tag = argv[index + 1]?.trim() ?? "";
      index += 1;
      continue;
    }
    if (arg.startsWith("--tag=")) {
      tag = arg.slice("--tag=".length).trim();
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
  }

  if (!tag) {
    throw new Error("missing required --tag (example: v0.1.0)");
  }

  if (!/^v\d+\.\d+\.\d+/.test(tag)) {
    throw new Error(`invalid release tag format: ${tag} (expected vX.Y.Z)`);
  }

  return { tag, dryRun };
}

export function releaseVersionFromTag(tag: string): string {
  return tag.startsWith("v") ? tag.slice(1) : tag;
}

export function usage(scriptName: string): string {
  return [
    `usage: bun ${scriptName} --tag <tag> [--dry-run]`,
    "",
    "environment:",
    "  RELEASE_TAG   release git tag (example: v0.1.0)",
    "  DRY_RUN       set to true/1 to print commands without publishing",
  ].join("\n");
}
