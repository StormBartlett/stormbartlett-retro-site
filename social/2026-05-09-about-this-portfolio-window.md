# About This Portfolio Window

Score: 86/100

Commits:
- `bc9b9c0` - Add generated about portfolio icons
- `ff6f2e0` - Add about this portfolio window

What was done:
Added a new retro "About This Portfolio" window to the portfolio desktop UI. The Help menu now opens a classic Mac-inspired profile panel with generated pixel icons for the portfolio identity, full-stack engineering, AI, data storytelling, and product thinking.

Why it is interesting:
It turns a standard portfolio "about" interaction into a tiny operating-system moment. The hook is that the window feels like a lost classic Mac dialog, but the icons were generated with the image API and then sliced into production assets.

How it was done:
Generated a horizontal retro icon sheet with the image API, removed the chroma-key background, cropped it into individual transparent PNG icons, and added those files under `public/about-portfolio-icons`. Then the React desktop menu was wired to a dedicated `about-portfolio` window that reuses the existing window chrome and font system while styling the body like a compact vintage About box.

Short script:
"I wanted the portfolio's About menu to feel like a real retro OS detail, not just another text page. So I used the image API to generate a set of black-and-white Mac-style pixel icons, split them into transparent assets, and wired them into a new About This Portfolio dialog. Same desktop window system, same UI font, but now the Help menu opens a tiny classic-Mac profile card for Storm Bartlett."
