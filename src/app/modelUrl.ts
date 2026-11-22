/**
 * Model URLs carry their content hash (`?v=…`, computed in next.config.ts), so they can be cached
 * as immutable and an updated model is fetched on the next page load. Every place that loads or
 * preloads a model must go through modelUrl: a preload URL that differs from the fetched one
 * downloads the model twice.
 */
export type ModelVersions = Record<string, string>;

function builtVersions(): ModelVersions {
  try {
    const parsed: unknown = JSON.parse(process.env.NEXT_PUBLIC_MODEL_VERSIONS || "{}");
    return parsed && typeof parsed === "object" ? parsed as ModelVersions : {};
  } catch {
    return {};
  }
}
const VERSIONS = builtVersions();

/** `path?v=<hash>` when the build knows the file, otherwise the path unchanged (tests, unknown files). */
export function versionedModelUrl(path: string, versions: ModelVersions): string {
  const version = versions[path];
  return version ? `${path}${path.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}` : path;
}

export function modelUrl(path: string): string {
  return versionedModelUrl(path, VERSIONS);
}
