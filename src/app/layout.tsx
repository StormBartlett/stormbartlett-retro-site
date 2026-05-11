import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Storm Bartlett",
  description: "Storm Bartlett's Portfolio",
  icons: {
    icon: "/lightning-logo-black.svg",
    shortcut: "/lightning-logo-black.svg",
    apple: "/lightning-logo-black.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png?v=2" type="image/png" sizes="32x32" />
        <link rel="icon" href="/lightning-logo-black.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
        <link rel="mask-icon" href="/lightning-logo-black.svg?v=2" color="#000000" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Silkscreen:wght@400;700&family=VT323&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Immediately set viewport to prevent any zoom
                function enforceViewport() {
                  const viewport = document.querySelector('meta[name="viewport"]');
                  if (viewport) {
                    viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover');
                  }
                }
                enforceViewport();
                
                // Prevent zoom gestures immediately
                if (document.addEventListener) {
                  document.addEventListener('gesturestart', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }, { passive: false, capture: true });
                  
                  document.addEventListener('gesturechange', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }, { passive: false, capture: true });
                  
                  document.addEventListener('gestureend', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                  }, { passive: false, capture: true });
                  
                  // Prevent ALL double-tap zoom
                  let lastTouchEnd = 0;
                  let touchStartTime = 0;
                  document.addEventListener('touchstart', function(e) {
                    touchStartTime = Date.now();
                    // Prevent multi-touch zoom everywhere
                    if (e.touches.length > 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      return false;
                    }
                    enforceViewport();
                  }, { passive: false, capture: true });
                  
                  document.addEventListener('touchend', function(e) {
                    const now = Date.now();
                    const timeSinceStart = now - touchStartTime;
                    const timeSinceLastEnd = now - lastTouchEnd;
                    
                    // Prevent double-tap zoom (two taps within 300ms)
                    if (timeSinceLastEnd < 300 && timeSinceStart < 500) {
                      e.preventDefault();
                      e.stopPropagation();
                      enforceViewport();
                      return false;
                    }
                    lastTouchEnd = now;
                    enforceViewport();
                  }, { passive: false, capture: true });
                  
                  // Prevent zoom on touchmove
                  document.addEventListener('touchmove', function(e) {
                    if (e.touches.length > 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      enforceViewport();
                      return false;
                    }
                  }, { passive: false, capture: true });
                }
                
                // Aggressive zoom reset function
                function resetZoom() {
                  enforceViewport();
                  // Use visualViewport API if available
                  if (window.visualViewport) {
                    if (window.visualViewport.scale !== 1) {
                      enforceViewport();
                    }
                  }
                }
                
                // Reset zoom very frequently
                if (typeof window !== 'undefined') {
                  setInterval(function() {
                    resetZoom();
                  }, 50);
                  
                  // Reset on any event that might cause zoom
                  window.addEventListener('orientationchange', function() {
                    setTimeout(resetZoom, 0);
                    setTimeout(resetZoom, 100);
                    setTimeout(resetZoom, 300);
                  });
                  
                  window.addEventListener('resize', function() {
                    resetZoom();
                  });
                  
                  // Reset on focus (when user returns to tab)
                  window.addEventListener('focus', resetZoom);
                  
                  // Reset on scroll (some browsers zoom on scroll)
                  window.addEventListener('scroll', resetZoom, { passive: true });
                  
                  // Use visualViewport API to detect zoom changes
                  if (window.visualViewport) {
                    window.visualViewport.addEventListener('resize', resetZoom);
                    window.visualViewport.addEventListener('scroll', resetZoom);
                  }
                }
                
                // Run immediately when DOM is ready
                if (document.readyState === 'loading') {
                  document.addEventListener('DOMContentLoaded', resetZoom);
                } else {
                  resetZoom();
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        <div className="crt">
          <div className="content">
            {/* Inline 1-bit icon sprite */}
            <svg width="0" height="0" style={{position:"absolute", left:-9999, visibility:"hidden"}} aria-hidden="true" focusable="false">
              <defs>
                <symbol id="icon-file" viewBox="0 0 32 32">
                  <path fill="#ffffff" stroke="#000" strokeWidth="1" d="M6 1.5h14l6 6v23H6z"/>
                  <path fill="#fff" stroke="#000" strokeWidth="1" d="M20 1.5v7h7"/>
                  <path d="M6 1.5h14v7h7v22H6z" fill="none" stroke="#000" strokeWidth="1"/>
                </symbol>
                <symbol id="icon-file-txt" viewBox="0 0 32 32">
                  <use href="#icon-file"/>
                  <g stroke="#000" strokeWidth="1" strokeLinecap="square">
                    <path d="M9 13.5h14"/>
                    <path d="M9 17.5h14"/>
                    <path d="M9 21.5h11"/>
                  </g>
                  <g fill="#000">
                    <rect x="9" y="9" width="2" height="2"/>
                    <rect x="12" y="9" width="2" height="2"/>
                    <rect x="15" y="9" width="2" height="2"/>
                  </g>
                </symbol>
                <symbol id="icon-file-html" viewBox="0 0 32 32">
                  <use href="#icon-file"/>
                  <g fill="#000">
                    <path d="M10 16 l4 -4 v3 l-3 1 3 1 v3z"/>
                    <rect x="19" y="12" width="2" height="8"/>
                    <path d="M16 12 l6 4 -6 4z"/>
                  </g>
                </symbol>
                <symbol id="icon-file-binary" viewBox="0 0 32 32">
                  <use href="#icon-file"/>
                  <g fill="#000">
                    <rect x="9" y="12" width="2" height="2"/>
                    <rect x="13" y="12" width="2" height="6"/>
                    <rect x="17" y="12" width="2" height="2"/>
                    <rect x="21" y="12" width="2" height="6"/>
                    <rect x="9" y="18" width="2" height="2"/>
                    <rect x="17" y="18" width="2" height="2"/>
                  </g>
                </symbol>
                <symbol id="icon-folder" viewBox="0 0 32 32">
                  <path d="M3 9.5h9l2 3h15v15H3z" fill="#fff" stroke="#000" strokeWidth="1"/>
                  <path d="M3 9.5h9l2 3h15" fill="none" stroke="#000" strokeWidth="1"/>
                  <rect x="3" y="12.5" width="26" height="15" fill="#fff" stroke="#000" strokeWidth="1"/>
                </symbol>

                {/* Sun for dark mode toggle (light mode active) */}
                <symbol id="icon-sun" viewBox="0 0 16 16">
                  <rect x="7" y="0" width="2" height="2" fill="currentColor"/>
                  <rect x="7" y="14" width="2" height="2" fill="currentColor"/>
                  <rect x="0" y="7" width="2" height="2" fill="currentColor"/>
                  <rect x="14" y="7" width="2" height="2" fill="currentColor"/>
                  <rect x="3" y="3" width="2" height="2" fill="currentColor" transform="rotate(45 4 4)"/>
                  <rect x="11" y="11" width="2" height="2" fill="currentColor" transform="rotate(45 12 12)"/>
                  <rect x="3" y="11" width="2" height="2" fill="currentColor" transform="rotate(-45 4 12)"/>
                  <rect x="11" y="3" width="2" height="2" fill="currentColor" transform="rotate(-45 12 4)"/>
                  <rect x="5" y="5" width="6" height="6" fill="currentColor"/>
                </symbol>

                {/* Moon for dark mode toggle (dark mode active) - pixel banana crescent */}
                <symbol id="icon-moon" viewBox="0 0 16 16">
                  <g fill="currentColor" shapeRendering="crispEdges">
                    <rect x="12" y="0" width="2" height="2"/>
                    <rect x="10" y="0" width="2" height="2"/>
                    <rect x="10" y="2" width="2" height="2"/>
                    <rect x="8" y="2" width="2" height="2"/>
                    <rect x="8" y="4" width="2" height="2"/>
                    <rect x="6" y="4" width="2" height="2"/>
                    <rect x="6" y="6" width="2" height="2"/>
                    <rect x="4" y="6" width="2" height="2"/>
                    <rect x="4" y="8" width="2" height="2"/>
                    <rect x="4" y="10" width="2" height="2"/>
                    <rect x="2" y="8" width="2" height="2"/>
                    <rect x="2" y="10" width="2" height="2"/>
                    <rect x="0" y="10" width="2" height="2"/>
                    <rect x="0" y="12" width="2" height="2"/>
                  </g>
                </symbol>

                {/* Pixel Apple logo for the Apple menu */}
                <symbol id="icon-apple" viewBox="0 0 16 16">
                  <g fill="currentColor" shapeRendering="crispEdges">
                    <rect x="8" y="0" width="2" height="2"/>
                    <rect x="7" y="2" width="2" height="2"/>
                    <rect x="6" y="3" width="4" height="1"/>
                    <rect x="5" y="4" width="6" height="1"/>
                    <rect x="4" y="5" width="8" height="1"/>
                    <rect x="3" y="6" width="10" height="3"/>
                    <rect x="4" y="9" width="8" height="2"/>
                    <rect x="5" y="11" width="6" height="1"/>
                    <rect x="6" y="12" width="4" height="1"/>
                  </g>
                </symbol>
              </defs>
            </svg>
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
