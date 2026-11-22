import { afterEach, describe, expect, it, vi } from "vitest";
import { MODEL_BOOT_TEST, opensInModel } from "./bootView";

const cases = [
  { mobile: false, storage: {}, search: "", expected: true },
  { mobile: false, storage: { "nx-fullscreen": "1" }, search: "", expected: false },
  { mobile: true, storage: {}, search: "", expected: false },
  { mobile: true, storage: { "nx-mobile-view-mode": "model" }, search: "", expected: true },
  { mobile: true, storage: { "nx-mobile-view-mode": "desktop" }, search: "", expected: false },
  { mobile: true, storage: {}, search: "?view=model", expected: true },
];

describe("boot view", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(cases)("inline script and module agree (%o)", ({ mobile, storage, search, expected }) => {
    const store = storage as Record<string, string>;
    const matchMedia = () => ({ matches: mobile });
    const localStorage = { getItem: (key: string) => store[key] ?? null };
    const location = { search };
    vi.stubGlobal("window", { matchMedia, localStorage, location });
    expect(opensInModel()).toBe(expected);
    const inline = new Function("matchMedia", "localStorage", "location", `return ${MODEL_BOOT_TEST};`);
    expect(inline(matchMedia, localStorage, location)).toBe(expected);
  });
});
