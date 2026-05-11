# Retro Mac UI Refresh

Score: 84/100

Commits:
- `94b2256` - styled retro Mac scrollbars with striped tracks, boxed arrow buttons, and bevelled thumbs.
- `a709531` - refreshed the window chrome with pinstriped title bars, bevels, title plaques, and stronger light/dark mode contrast.
- `9e5e553` - switched text-file editors to readable retro typography with clear uppercase and lowercase letterforms.

What was done:
The portfolio desktop got a more classic-Mac-inspired feel without copying the original UI exactly. The scrollbars now look tactile, windows have a stronger physical frame, and text documents use a typewriter-style font that still reads cleanly.

Short script:
"I wanted this portfolio to feel less like a modern web app wearing a costume and more like a tiny alternate-history desktop. So I rebuilt the scrollbars with old-school arrow buttons, gave every window bevelled depth and pinstriped title bars, then tuned the text editor font so it feels retro but you can still tell uppercase from lowercase while typing."

What is interesting:
The change is mostly CSS, but it meaningfully changes the whole personality of the app. It shows how small interface details, like scrollbars, titlebar patterns, bevels, and editor typography, can make a web portfolio feel like a coherent miniature operating system.

How it was done:
I kept the implementation in the shared global styling layer. Theme variables drive the light and dark palettes, CSS scrollbar pseudo-elements create the classic controls, the existing window component gets richer chrome from shared selectors, and editor typography is handled with a separate font stack from the rest of the UI.
