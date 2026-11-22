/**
 * Whether this visit opens on the 3D view. Desktops do unless they chose the flat desktop
 * (`nx-fullscreen`); phones do only when they chose it (`nx-mobile-view-mode`) or follow a
 * `?view=model` link. page.tsx decides the same way after hydration.
 *
 * It runs twice: as an inline script before first paint (so the flat desktop is never painted
 * only to be swapped for the 3D view), and at module load to start the 3D code early. The inline
 * copy has to be a plain expression string; bootView.test.ts checks both agree.
 */
const MOBILE = "(max-width: 900px), (pointer: coarse)";

export const MODEL_BOOT_TEST = `(matchMedia(${JSON.stringify(MOBILE)}).matches?(localStorage.getItem("nx-mobile-view-mode")==="model"||new URLSearchParams(location.search).get("view")==="model"):localStorage.getItem("nx-fullscreen")!=="1")`;

export function opensInModel(): boolean {
  if (window.matchMedia(MOBILE).matches) {
    return window.localStorage.getItem("nx-mobile-view-mode") === "model" || new URLSearchParams(window.location.search).get("view") === "model";
  }
  return window.localStorage.getItem("nx-fullscreen") !== "1";
}
