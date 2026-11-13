import { Courier_Prime, Silkscreen, VT323 } from "next/font/google";
import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Self-hosted and preloaded by Next: no render-blocking Google stylesheet, no late font swaps.
const silkscreen = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-silkscreen", display: "swap" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt323", display: "swap" });
const courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-courier-prime", display: "swap" });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${silkscreen.variable} ${vt323.variable} ${courierPrime.variable}`}>
      <head>
        {/* Desktop visitors open in the 3D view: skip painting the flat desktop first, and start
            the default model download alongside the page instead of after the 3D code arrives. */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(!matchMedia("(max-width: 900px), (pointer: coarse)").matches&&localStorage.getItem("nx-fullscreen")!=="1")document.documentElement.dataset.boot="model"}catch(e){}` }} />
        <link rel="preload" href="/models/studio-mac.glb" as="fetch" crossOrigin="anonymous" media="(min-width: 901px) and (pointer: fine)" />
        <link rel="icon" href="/favicon.ico?v=2" sizes="any" />
        <link rel="icon" href="/favicon-32x32.png?v=2" type="image/png" sizes="32x32" />
        <link rel="icon" href="/lightning-logo-black.svg?v=2" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
        <link rel="mask-icon" href="/lightning-logo-black.svg?v=2" color="#000000" />
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
                <symbol id="icon-file-about" viewBox="0 0 32 32">
                  <use href="#icon-file"/>
                  <g fill="#000">
                    {/* pixel portrait: head + shoulders */}
                    <rect x="13" y="11" width="6" height="6"/>
                    <path d="M10 25v-2h2v-2h8v2h2v2z"/>
                  </g>
                </symbol>
                <symbol id="icon-file-skills" viewBox="0 0 32 32">
                  <use href="#icon-file"/>
                  {/* lightning bolt to match the site logo */}
                  <path fill="#000" d="M18 9l-7 9h4l-2 8 8-11h-4l3-6z"/>
                </symbol>
                <symbol id="icon-calculator" viewBox="0 0 32 32">
                  <rect x="6" y="3" width="20" height="26" fill="#fff" stroke="#000" strokeWidth="1"/>
                  <rect x="9" y="6" width="14" height="5" fill="#fff" stroke="#000" strokeWidth="1"/>
                  <g fill="#000">
                    <rect x="9" y="14" width="4" height="3"/>
                    <rect x="14" y="14" width="4" height="3"/>
                    <rect x="19" y="14" width="4" height="3"/>
                    <rect x="9" y="19" width="4" height="3"/>
                    <rect x="14" y="19" width="4" height="3"/>
                    <rect x="19" y="19" width="4" height="3"/>
                    <rect x="9" y="24" width="9" height="3"/>
                    <rect x="19" y="24" width="4" height="3"/>
                  </g>
                </symbol>
                <symbol id="icon-hourglass" viewBox="0 0 32 32">
                  <path d="M10 5h12v4l-4 5v4l4 5v4H10v-4l4-5v-4l-4-5z" fill="#fff" stroke="#000" strokeWidth="1"/>
                  <g fill="#000">
                    <rect x="8" y="3" width="16" height="2"/>
                    <rect x="8" y="27" width="16" height="2"/>
                    <path d="M13 8h6l-3 4z"/>
                    <path d="M12 25h8l-4-6z"/>
                    <rect x="15.5" y="16" width="1" height="7"/>
                  </g>
                </symbol>
                <symbol id="icon-activity" viewBox="0 0 32 32">
                  <rect x="4" y="5" width="24" height="18" fill="#fff" stroke="#000" strokeWidth="1"/>
                  <rect x="7" y="8" width="18" height="12" fill="none" stroke="#000" strokeWidth="1"/>
                  <path d="M8 15h3l2-4 3 8 2-6h7" fill="none" stroke="#000" strokeWidth="1.5"/>
                  <g fill="#000">
                    <rect x="13" y="23" width="6" height="2"/>
                    <rect x="10" y="25" width="12" height="2"/>
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
