import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Build-time only (read by next.config.ts): the first 10 hex characters of each model's SHA-256,
 * keyed by its public URL. Recomputed on every `next build` and `next dev` start, so a rebuilt
 * GLB gets a new URL with nothing to remember. A missing folder gives no versions (plain URLs).
 */
export function modelVersions(directory: string, publicPath = "/models"): Record<string, string> {
  try {
    return Object.fromEntries(readdirSync(directory).filter(name => name.endsWith(".glb")).sort().map(name => [
      `${publicPath}/${name}`,
      createHash("sha256").update(readFileSync(join(directory, name))).digest("hex").slice(0, 10),
    ]));
  } catch {
    return {};
  }
}
