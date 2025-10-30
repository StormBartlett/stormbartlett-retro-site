"use client";

import { useEffect, useState } from "react";
import OldMac3D from "./OldMac3D";
import DesktopOS from "./DesktopOS";

export default function Home() {
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");

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
      <div className="embedded-screen" style={{ width: "100svw", height: "100svh" }}>
        <DesktopOS embedded mobileVariant={orientation} />
      </div>
    );
  }

  return (
    <OldMac3D>
      <DesktopOS embedded />
    </OldMac3D>
  );
}




