"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type FullscreenContextType = {
  isFullscreen: boolean;
  setFullscreen: (value: boolean) => void;
  toggleFullscreen: () => void;
};

const FullscreenContext = createContext<FullscreenContextType | undefined>(undefined);

export function FullscreenProvider({ children }: { children: React.ReactNode }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nx-fullscreen");
      if (saved === "1") {
        setIsFullscreen(true);
      }
    }
  }, []);

  const setFullscreen = (value: boolean) => {
    setIsFullscreen(() => {
      if (typeof window !== "undefined") {
        localStorage.setItem("nx-fullscreen", value ? "1" : "0");
      }
      return value;
    });
  };

  const toggleFullscreen = () => setFullscreen(!isFullscreen);

  return (
    <FullscreenContext.Provider value={{ isFullscreen, setFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  const context = useContext(FullscreenContext);
  if (context === undefined) {
    // Return default values if used outside provider (for backwards compatibility)
    return { isFullscreen: false, setFullscreen: () => {}, toggleFullscreen: () => {} };
  }
  return context;
}
