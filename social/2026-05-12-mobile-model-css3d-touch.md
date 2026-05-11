# Mobile Model CSS3D Touch Fix

Score: 87/100

Commit: `Fix mobile model screen projection and input mapping`

## What Was Done

Fixed the mobile model view so the retro desktop renders as an 800x600 screen inside the 3D Mac instead of shrinking into the phone viewport, and changed pointer math to map through the transformed CSS3D plane before dragging windows, icons, and desktop items.

## Why It Is Interesting

The bug looked like a mobile layout issue, but the real problem was coordinate space. The 3D screen is projected with perspective, so `getBoundingClientRect()` scale math is only an approximation. On mobile, that approximation breaks badly because the screen is small, rotated, and perspective-distorted.

## How It Was Done

The fix treats the model screen as a stable 800x600 local surface, then converts client pointer coordinates back into that local surface using a four-corner inverse projection. Mobile-specific CSS3D offsets were removed, and model-screen CSS now overrides mobile viewport rules only inside the 3D screen.

## Short Script

This bug is a good example of why mobile web bugs can be geometry bugs, not CSS bugs.

The desktop was drawn inside a 3D Mac, but touch events were being converted with flat bounding-box scale math. That works until the screen is rotated in perspective. Then the visual point under your finger and the calculated desktop point drift apart.

The fix was to stop thinking in viewport pixels and start thinking in screen-local coordinates. The Mac screen is always 800 by 600. So every touch gets projected back onto that plane first, then the desktop handles it like normal.

Once that was in place, dragging an icon on the tiny projected screen moved it exactly where it should.
