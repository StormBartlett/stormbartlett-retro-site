"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import DesktopOS from "./DesktopOS";
import MatrixBackground from "./MatrixBackground";
import {
  FullscreenProvider,
  readStoredSetting,
  useFullscreen,
  useIsMobileViewport,
  useMediaQuery,
  writeStoredSetting,
} from "./FullscreenContext";

type ViewMode = "model" | "desktop";

const MOBILE_VIEW_MODE_KEY = "nx-mobile-view-mode";

const CHROME_STYLE: CSSProperties = {
  position: "fixed",
  zIndex: 10001,
  minHeight: 44,
  padding: "0 14px",
  background: "#fff",
  color: "#101010",
  border: "2px solid #101010",
  boxShadow: "3px 3px 0 rgba(0,0,0,.45)",
  font: "inherit",
};

function ModelLoading() {
  return (
    <div
      role="status"
      style={{
        ...CHROME_STYLE,
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        alignItems: "center",
      }}
    >
      Loading 3D view…
    </div>
  );
}

// Three.js is only fetched once the visitor is actually in model mode.
const OldMac3D = dynamic(() => import("./OldMac3D"), { ssr: false, loading: ModelLoading });

/** Chunk, WebGL-context and GLB failures all land here and fall back to the flat desktop. */
class ModelErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D view unavailable, using the desktop view instead.", error);
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function HomeContent() {
  const isMobile = useIsMobileViewport();
  const isPortrait = useMediaQuery("(orientation: portrait)");
  const { isFullscreen, setFullscreen } = useFullscreen();
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [mobileViewMode, setMobileViewMode] = useState<ViewMode>("desktop");

  // Runs in the same effect flush as FullscreenProvider's load, so both settings apply in one render.
  useEffect(() => {
    if (readStoredSetting(MOBILE_VIEW_MODE_KEY) === "model") setMobileViewMode("model");
    setSettingsLoaded(true);
  }, []);

  // The server and first client render are always the usable flat desktop; phones stay on it by default.
  const [modelFailed, setModelFailed] = useState(false);
  const viewMode: ViewMode = modelFailed || !settingsLoaded ? "desktop" : isMobile ? mobileViewMode : isFullscreen ? "desktop" : "model";
  // Allocate WebGL only after the first visit; retain its uploaded resources for instant returns.
  const [modelVisited, setModelVisited] = useState(false);
  useEffect(() => { if (viewMode === "model") setModelVisited(true); }, [viewMode]);

  const changeViewMode = useCallback(
    (mode: ViewMode) => {
      if (mode === "model") setModelFailed(false);
      if (isMobile) {
        setMobileViewMode(mode);
        writeStoredSetting(MOBILE_VIEW_MODE_KEY, mode);
      } else {
        setFullscreen(mode === "desktop");
      }
    },
    [isMobile, setFullscreen]
  );
  const enterDesktop = useCallback(() => changeViewMode("desktop"), [changeViewMode]);
  const modelUnavailable = useCallback(() => {setModelFailed(true);enterDesktop();}, [enterDesktop]);

  /*
   * One DesktopOS instance lives for the whole session so open windows and app
   * state survive view changes. React always sees `host` as a child of `home`;
   * model mode moves that DOM node into the 3D screen slot. `home` never
   * unmounts, so React never needs to remove `host` from a parent it no longer has.
   */
  const homeRef = useRef<HTMLDivElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewModeRef = useRef<ViewMode>(viewMode);
  const screenSlotRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    viewModeRef.current = viewMode;
    const home = homeRef.current;
    const host = hostRef.current;
    // Same commit as the 3D tree's removal, so the desktop is never missing for a paint.
    if (viewMode === "desktop" && home && host && host.parentElement !== home) {
      home.appendChild(host);
      // DesktopOS re-clamps icons on resize; the available area has just changed.
      window.dispatchEvent(new Event("resize"));
    }
    if (viewMode === "model" && host && screenSlotRef.current) {
      screenSlotRef.current.appendChild(host);
      window.dispatchEvent(new Event("resize"));
    }
  }, [viewMode]);

  const attachToScreenSlot = useCallback((slot: HTMLElement, mounted = true) => {
    const host = hostRef.current;
    if (!mounted) {
      if (screenSlotRef.current !== slot) return;
      screenSlotRef.current = null;
      if (host && homeRef.current) homeRef.current.appendChild(host);
      return;
    }
    screenSlotRef.current = slot;
    // The slot can mount late, after the visitor has already left model mode.
    if (viewModeRef.current !== "model" || !host) return;
    slot.appendChild(host);
    window.dispatchEvent(new Event("resize"));
  }, []);

  return (
    <>
      {/* Hidden while the 3D screen loads; the host is moved out of here once its slot exists. */}
      <div ref={homeRef} style={{ width: "100%", height: "100%", display: viewMode === "model" ? "none" : "block" }}>
        <div ref={hostRef} style={{ width: "100%", height: "100%" }}>
          <DesktopOS
            embedded
            modelScreen={viewMode === "model"}
            mobileVariant={isMobile ? (isPortrait ? "portrait" : "landscape") : undefined}
            viewMode={viewMode}
            onViewModeChange={changeViewMode}
          />
        </div>
      </div>

      {!modelFailed && (viewMode === "model" || modelVisited) && (
        <>
          {viewMode === "model" && <MatrixBackground />}
          <ModelErrorBoundary onError={modelUnavailable}>
            <div aria-hidden={viewMode !== "model"} inert={viewMode !== "model"} style={{ position: "fixed", inset: 0, visibility: viewMode === "model" ? "visible" : "hidden", pointerEvents: viewMode === "model" ? "auto" : "none" }}>
              <OldMac3D active={viewMode === "model"} onScreenSlot={attachToScreenSlot} onScreenTap={isMobile ? enterDesktop : undefined} />
            </div>
          </ModelErrorBoundary>
          {/* Plain DOM so it works while the model loads, and if WebGL never starts. */}
          {viewMode === "model" && <button
            type="button"
            onClick={enterDesktop}
            style={{
              ...CHROME_STYLE,
              top: "calc(env(safe-area-inset-top, 0px) + 12px)",
              right: "calc(env(safe-area-inset-right, 0px) + 12px)",
              cursor: "pointer",
            }}
          >
            Enter Desktop
          </button>}
        </>
      )}
    </>
  );
}

export default function Home() {
  return (
    <FullscreenProvider>
      <HomeContent />
    </FullscreenProvider>
  );
}
