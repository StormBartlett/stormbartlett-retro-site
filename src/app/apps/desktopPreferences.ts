export const DESKTOP_PREFERENCES_KEY = "storm-desktop-preferences-v1";
export const DESKTOP_PREFERENCES_EVENT = "storm-preferences-change";

export const WALLPAPERS = {
  "classic-dots": {
    label: "Classic",
    color: "#d6d6ce",
    image: "radial-gradient(#48483e 0.65px, transparent 0.8px)",
    size: "4px 4px",
    ink: "#161616",
  },
  grid: {
    label: "Grid",
    color: "#d7dad6",
    image: "linear-gradient(#7a827a33 1px, transparent 1px), linear-gradient(90deg, #7a827a33 1px, transparent 1px)",
    size: "12px 12px",
    ink: "#161616",
  },
  lilac: {
    label: "Lilac",
    color: "#cbbddd",
    image: "radial-gradient(#74618566 0.65px, transparent 0.8px)",
    size: "4px 4px",
    ink: "#161616",
  },
  mint: {
    label: "Mint",
    color: "#bfd3c3",
    image: "radial-gradient(#54775e66 0.65px, transparent 0.8px)",
    size: "4px 4px",
    ink: "#161616",
  },
  midnight: {
    label: "Midnight",
    color: "#282c3c",
    image: "radial-gradient(#bac3df66 0.65px, transparent 0.8px)",
    size: "6px 6px",
    ink: "#f5f3e8",
  },
} as const;

export const ACCENTS = {
  graphite: { label: "Graphite", color: "#363631" },
  amber: { label: "Amber", color: "#986022" },
  plum: { label: "Plum", color: "#76558f" },
  teal: { label: "Teal", color: "#2e7470" },
} as const;

export type DesktopPreferences = {
  wallpaper: keyof typeof WALLPAPERS;
  accent: keyof typeof ACCENTS;
  scanlines: boolean;
  reduceEffects: boolean;
  sound: boolean;
};

export const DEFAULT_DESKTOP_PREFERENCES: DesktopPreferences = {
  wallpaper: "classic-dots",
  accent: "graphite",
  scanlines: false,
  reduceEffects: false,
  sound: false,
};

let preferences: DesktopPreferences | undefined;
let watchingPreferences = false;
let storageAvailable = true;

function validatePreferences(value: unknown): DesktopPreferences {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    wallpaper: typeof candidate.wallpaper === "string" && Object.hasOwn(WALLPAPERS, candidate.wallpaper)
      ? candidate.wallpaper as DesktopPreferences["wallpaper"] : DEFAULT_DESKTOP_PREFERENCES.wallpaper,
    accent: typeof candidate.accent === "string" && Object.hasOwn(ACCENTS, candidate.accent)
      ? candidate.accent as DesktopPreferences["accent"] : DEFAULT_DESKTOP_PREFERENCES.accent,
    scanlines: typeof candidate.scanlines === "boolean" ? candidate.scanlines : false,
    reduceEffects: typeof candidate.reduceEffects === "boolean" ? candidate.reduceEffects : false,
    sound: typeof candidate.sound === "boolean" ? candidate.sound : false,
  };
}

function readStoredPreferences(): DesktopPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_DESKTOP_PREFERENCES };
  try {
    const stored = window.localStorage.getItem(DESKTOP_PREFERENCES_KEY);
    storageAvailable = true;
    if (!stored) return { ...DEFAULT_DESKTOP_PREFERENCES };
    try {
      return validatePreferences(JSON.parse(stored));
    } catch {
      return { ...DEFAULT_DESKTOP_PREFERENCES };
    }
  } catch {
    storageAvailable = false;
    return { ...DEFAULT_DESKTOP_PREFERENCES };
  }
}

export function systemPrefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function readDesktopPreferences(): DesktopPreferences {
  const stored = preferences ?? readStoredPreferences();
  return { ...stored, reduceEffects: stored.reduceEffects || systemPrefersReducedMotion() };
}

export function isDesktopPreferenceStorageAvailable(): boolean {
  return storageAvailable;
}

function applyDesktopPreferences(): DesktopPreferences {
  const settings = readDesktopPreferences();
  if (typeof document === "undefined") return settings;
  const root = document.documentElement;
  const wallpaper = WALLPAPERS[settings.wallpaper];
  const accent = ACCENTS[settings.accent].color;
  root.dataset.desktopWallpaper = settings.wallpaper;
  root.dataset.desktopAccent = settings.accent;
  root.dataset.desktopScanlines = settings.scanlines && !settings.reduceEffects ? "on" : "off";
  root.dataset.reduceEffects = String(settings.reduceEffects);
  root.dataset.desktopSound = settings.sound ? "on" : "off";
  root.style.setProperty("--desktop-wallpaper-color", wallpaper.color);
  root.style.setProperty("--desktop-wallpaper-image", wallpaper.image);
  root.style.setProperty("--desktop-wallpaper-size", wallpaper.size);
  root.style.setProperty("--desktop-wallpaper-ink", wallpaper.ink);
  root.style.setProperty("--desktop-accent", accent);
  root.style.setProperty("--accent", accent);
  window.dispatchEvent(new CustomEvent<DesktopPreferences>(DESKTOP_PREFERENCES_EVENT, { detail: settings }));
  return settings;
}

/** Call once when the desktop boots. Safe with unavailable storage and during SSR. */
export function hydrateDesktopPreferences(): DesktopPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_DESKTOP_PREFERENCES };
  preferences ??= readStoredPreferences();
  if (!watchingPreferences) {
    watchingPreferences = true;
    if (typeof window.matchMedia === "function") {
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      motionQuery.addEventListener?.("change", applyDesktopPreferences);
    }
    window.addEventListener("storage", (event) => {
      if (event.key !== DESKTOP_PREFERENCES_KEY && event.key !== null) return;
      preferences = readStoredPreferences();
      applyDesktopPreferences();
    });
  }
  return applyDesktopPreferences();
}

/** Updates are immediate; blocked storage still permits settings for this visit. */
export function updateDesktopPreferences(patch: Partial<DesktopPreferences>): DesktopPreferences {
  preferences = validatePreferences({ ...(preferences ?? readStoredPreferences()), ...patch });
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(DESKTOP_PREFERENCES_KEY, JSON.stringify(preferences));
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }
  return applyDesktopPreferences();
}
