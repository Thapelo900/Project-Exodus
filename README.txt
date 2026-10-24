PROJECT EXODUS — WELCOME SCREEN v5 (Creator Hub patch)

Files:
  src/client/ui.tsx
  src/client/setup.ts
  Images/ui/exodus-welcome-initializing.png

Install: Back up your project, then merge these folders into your Creator Hub
project, replacing only the matching files. Test in preview before publishing.

Changes:
- Approved monochrome artwork with EMPTY red loading frame.
- No percentage or progress fill baked into the background PNG.
- Exactly one DCL animated red fill and one live percentage in the frame.
- Ten-second welcome timer from v2; then opens the existing Modes screen.
- No changes to gameplay assets or modes images.

IMPORTANT: ui.tsx is based on the earlier welcome patch series. If your current
Creator Hub ui.tsx has newer gameplay changes, compare/merge rather than blindly
overwriting it. This ZIP does not implement background asset streaming.
GitHub was not modified.

V6: Percentage is a single right-aligned DCL Label (digits and % share font/size).

V7: Removed the live numeric percentage label entirely. Only the animated red DCL loading fill remains inside the empty frame. The 10-second timer and Modes transition are unchanged.
