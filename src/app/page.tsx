"use client";

import { useEffect, useState } from "react";
import OldMac3D from "./OldMac3D";
import DesktopOS from "./DesktopOS";
import { FullscreenProvider, useFullscreen } from "./FullscreenContext";

function HomeContent() {
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const { isFullscreen } = useFullscreen();

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
    // Fill entire viewport with the embedded CRT screen on portrait/landscape
    return (
      <div style={{ width: "100svw", height: "100svh" }}>
        <DesktopOS embedded mobileVariant={orientation} />
      </div>
    );
  }

  // Fullscreen mode: render DesktopOS directly without 3D component
  if (isFullscreen) {
    return (
      <div style={{ width: "100vw", height: "100vh" }}>
        <DesktopOS embedded />
      </div>
    );
  }

  return (
    <OldMac3D>
      <DesktopOS embedded />
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



