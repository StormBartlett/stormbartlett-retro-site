"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import DesktopOS from "./DesktopOS";
import MatrixBackground from "./MatrixBackground";
import {
  FullscreenProvider,
  readStoredSetting,
  MOBILE_MEDIA_QUERY,
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

/** Same boot readout the 3D scene shows, so loading reads as one sequence over the rain. */
function ModelLoading() {
  return (
    <div className="boot-screen" role="status" aria-label="Loading 3D view">
      <div className="boot-title">STORM OS</div>
      <div className="boot-bar"><span style={{ width: "12%" }} /></div>
      <div className="boot-step">Loading 3D view<span className="boot-caret">_</span></div>
    </div>
  );
}

// Three.js is only fetched once the visitor is actually in model mode.
const loadHardware = () => import("./OldMac3D");
const OldMac3D = dynamic(loadHardware, { ssr: false, loading: ModelLoading });
// Desktop visitors land in 3D: fetch its code with the page rather than after hydration.
if (typeof window !== "undefined") {
  try { if (!window.matchMedia(MOBILE_MEDIA_QUERY).matches && window.localStorage.getItem("nx-fullscreen") !== "1") void loadHardware().catch(() => {}); } catch {}
}

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
    // `?view=model` deep-links phones straight into the 3D desk without changing their saved choice.
    const linked = new URLSearchParams(window.location.search).get("view") === "model";
    if (linked || readStoredSetting(MOBILE_VIEW_MODE_KEY) === "model") setMobileViewMode("model");
    setSettingsLoaded(true);
  }, []);

  // The server and first client render are always the usable flat desktop; phones stay on it by default.
  const [modelFailed, setModelFailed] = useState(false);
  const viewMode: ViewMode = modelFailed || !settingsLoaded ? "desktop" : isMobile ? mobileViewMode : isFullscreen ? "desktop" : "model";
  // Allocate WebGL only after the first visit; retain its uploaded resources for instant returns.
  const [modelVisited, setModelVisited] = useState(false);
  useEffect(() => { if (viewMode === "model") setModelVisited(true); }, [viewMode]);
  useEffect(() => {
    if (!settingsLoaded || isMobile) return;
    let cancelled = false;
    const prepare = () => {void loadHardware().then(module => {if (!cancelled) module.preloadHardware();}).catch(() => {});};
    const timer = window.setTimeout(prepare, 700);
    return () => {cancelled = true;window.clearTimeout(timer);};
  }, [settingsLoaded, isMobile]);

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
    // The pre-hydration boot flag only hides the flat desktop until React decides the view.
    if (settingsLoaded) delete document.documentElement.dataset.boot;
  }, [settingsLoaded, viewMode]);

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
      <div ref={homeRef} data-flat-home style={{ width: "100%", height: "100%", display: viewMode === "model" ? "none" : "block" }}>
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
