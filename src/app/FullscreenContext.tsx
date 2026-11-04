"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/** The single definition of "mobile" for the page and the 3D scene. Never derived from devicePixelRatio. */
export const MOBILE_MEDIA_QUERY = "(max-width: 900px), (pointer: coarse)";

const FULLSCREEN_STORAGE_KEY = "nx-fullscreen";

/** localStorage access throws when storage is blocked; the session must keep working in memory. */
export function readStoredSetting(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStoredSetting(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the choice simply lasts for this session.
  }
}

/** Matches `false` on the server and during hydration, then tracks the live query. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}

type FullscreenContextType = {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  toggleFullscreen: () => void;
};

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

const NO_PROVIDER_VALUE: FullscreenContextType = {
  isFullscreen: false,
  setFullscreen: () => {},
  toggleFullscreen: () => {},
};

export function FullscreenProvider({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const latestRef = useRef(false);

  useEffect(() => {
    if (readStoredSetting(FULLSCREEN_STORAGE_KEY) === "1") {
      latestRef.current = true;
      setIsFullscreen(true);
    }
  }, []);

  const setFullscreen = useCallback((value: boolean) => {
    latestRef.current = value;
    setIsFullscreen(value);
    writeStoredSetting(FULLSCREEN_STORAGE_KEY, value ? "1" : "0");
  }, []);

  const toggleFullscreen = useCallback(() => setFullscreen(!latestRef.current), [setFullscreen]);

  const value = useMemo(
    () => ({ isFullscreen, setFullscreen, toggleFullscreen }),
    [isFullscreen, setFullscreen, toggleFullscreen]
  );

  return <FullscreenContext.Provider value={value}>{children}</FullscreenContext.Provider>;
}

export function useFullscreen() {
  // Default values cover use outside the provider (backwards compatibility).
  return useContext(FullscreenContext) ?? NO_PROVIDER_VALUE;
}
