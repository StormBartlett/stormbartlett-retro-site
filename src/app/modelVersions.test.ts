import { describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { modelVersions } from "./modelVersions";
import { versionedModelUrl } from "./modelUrl";

describe("model versioning", () => {
  it("gives a model a new version when its bytes change, and only then", () => {
    const directory = mkdtempSync(join(tmpdir(), "models-"));
    try {
      writeFileSync(join(directory, "a.glb"), "glTF one");
      writeFileSync(join(directory, "b.glb"), "glTF two");
      writeFileSync(join(directory, "notes.json"), "{}");
      const first = modelVersions(directory);
      expect(Object.keys(first)).toEqual(["/models/a.glb", "/models/b.glb"]);
      expect(first["/models/a.glb"]).toMatch(/^[0-9a-f]{10}$/);
      expect(modelVersions(directory)).toEqual(first);
      writeFileSync(join(directory, "a.glb"), "glTF onf");
      const second = modelVersions(directory);
      expect(second["/models/a.glb"]).not.toBe(first["/models/a.glb"]);
      expect(second["/models/b.glb"]).toBe(first["/models/b.glb"]);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("versions every shipped model and puts the hash on its URL", () => {
    const versions = modelVersions(resolve(process.cwd(), "public/models"));
    const shipped = readdirSync(resolve(process.cwd(), "public/models")).filter(name => name.endsWith(".glb"));
    expect(Object.keys(versions).sort()).toEqual(shipped.map(name => `/models/${name}`).sort());
    for (const [path, version] of Object.entries(versions)) expect(versionedModelUrl(path, versions)).toBe(`${path}?v=${version}`);
  });

  it("leaves unknown models and a missing folder unversioned", () => {
    expect(versionedModelUrl("/models/other.glb", { "/models/studio-mac.glb": "abc" })).toBe("/models/other.glb");
    expect(modelVersions(join(tmpdir(), "no-such-models-folder"))).toEqual({});
  });
});
