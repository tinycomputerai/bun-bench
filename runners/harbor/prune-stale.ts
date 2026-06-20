import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

export function pruneStaleHarborExports(
  outRoot: string,
  activeSlugs: Set<string>
): string[] {
  if (!existsSync(outRoot)) {
    return [];
  }

  const removed: string[] = [];
  for (const entry of readdirSync(outRoot)) {
    const full = join(outRoot, entry);
    if (!statSync(full).isDirectory() || activeSlugs.has(entry)) {
      continue;
    }

    rmSync(full, { recursive: true, force: true });
    removed.push(entry);
  }

  return removed;
}
