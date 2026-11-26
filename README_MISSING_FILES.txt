PROJECT EXODUS — MISSING FILES RESTORATION
Compared user-uploaded Data RAMS.zip, Memory Packs.zip, Images.zip,
and Extras(1).zip against GitHub project paths.

These files were missing at their expected locations in the uploaded archives:
- Images/story/ : Data RAM and Memory Pack artwork, reorganized to match
  the existing code's expected Images/story/... paths.
- Images/ui/ : approved v20 modes images and v7 welcome image, recovered
  from prior approved patch archives.
- src/shared/badgeTracking.ts : present in GitHub but absent from uploaded Extras.

This is a FILE-PRESENCE restoration, NOT a fix for terminal interactions
or runtime loading. No existing game logic is replaced. Some UI assets may
already exist in your Creator Hub project even if missing from these four ZIPs.
Back up your game and extract into project root. Do not replace newer assets
unless they are genuinely absent.
GitHub has NOT been modified.
