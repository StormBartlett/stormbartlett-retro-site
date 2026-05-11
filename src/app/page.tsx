"use client";

import { useEffect, useState } from "react";
import OldMac3D from "./OldMac3D";
import DesktopOS from "./DesktopOS";
import { FullscreenProvider, useFullscreen } from "./FullscreenContext";

type ViewMode = "model" | "desktop";

function HomeContent() {
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const [mobileViewMode, setMobileViewMode] = useState<ViewMode>("desktop");
  const { isFullscreen, setFullscreen } = useFullscreen();

  useEffect(() => {
    const saved = localStorage.getItem("nx-mobile-view-mode");
    if (saved === "model" || saved === "desktop") {
      setMobileViewMode(saved);
    }
  }, []);

  const setDesktopViewMode = (mode: ViewMode) => {
    setFullscreen(mode === "desktop");
  };

  const setMobileViewModePersisted = (mode: ViewMode) => {
    setMobileViewMode(mode);
    localStorage.setItem("nx-mobile-view-mode", mode);
  };

  useEffect(() => {
    const update = () => {
      const coarse = typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches;
      const small = typeof window !== "undefined" && window.innerWidth <= 900;
      const mobile = !!(coarse || small);
      setIsMobile(mobile);
      const isPortrait = typeof window !== "undefined" && window.innerWidth <= window.innerHeight;
      setOrientation(isPortrait ? "portrait" : "landscape");
    };
    update();
    const onResize = () => update();
    let mq: MediaQueryList | null = null;
    if (typeof window !== "undefined") {
      mq = matchMedia("(pointer: coarse)");
      mq.addEventListener?.("change", update);
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", onResize);
        window.removeEventListener("orientationchange", onResize);
      }
      mq?.removeEventListener?.("change", update);
    };
  }, []);

  if (isMobile) {
    const mobileDesktop = (
      <DesktopOS
        embedded
        modelScreen={mobileViewMode === "model"}
        mobileVariant={orientation}
        viewMode={mobileViewMode}
        onViewModeChange={setMobileViewModePersisted}
      />
    );

    if (mobileViewMode === "model") {
      return <OldMac3D>{mobileDesktop}</OldMac3D>;
    }

    // Fill entire viewport with the embedded CRT screen on portrait/landscape
    return <div style={{ width: "100svw", height: "100svh" }}>{mobileDesktop}</div>;
  }

  // Render the actual desktop as the main screen.
  if (isFullscreen) {
    return (
      <div style={{ width: "100vw", height: "100vh" }}>
        <DesktopOS embedded viewMode="desktop" onViewModeChange={setDesktopViewMode} />
      </div>
    );
  }

  return (
    <OldMac3D>
      <DesktopOS embedded modelScreen viewMode="model" onViewModeChange={setDesktopViewMode} />
    </OldMac3D>
  );
}

export default function Home() {
  return (
    <FullscreenProvider>
      <HomeContent />
    </FullscreenProvider>
  );
}
