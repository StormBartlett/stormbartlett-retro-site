"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

type FullscreenContextType = {
  isFullscreen: boolean;
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

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => {
      const newValue = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("nx-fullscreen", newValue ? "1" : "0");
      }
      return newValue;
    });
  };

  return (
    <FullscreenContext.Provider value={{ isFullscreen, toggleFullscreen }}>
      {children}
    </FullscreenContext.Provider>
  );
}

export function useFullscreen() {
  const context = useContext(FullscreenContext);
  if (context === undefined) {
    // Return default values if used outside provider (for backwards compatibility)
    return { isFullscreen: false, toggleFullscreen: () => {} };
  }
  return context;
}

