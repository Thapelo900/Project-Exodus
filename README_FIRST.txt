PROJECT EXODUS v75 - TARGETED RECOVERY (DO NOT BLINDLY REPLACE ALL FILES)

This is a recovery candidate assembled from uploaded backups, NOT a verified exact snapshot of the last working project.

1. Back up the ENTIRE current project. Close Creator Hub Preview.
2. PRIMARY RESTORE: copy 01_RESTORE_OUTPOST/assets/Models/OutPost.glb to assets/Models/OutPost.glb. This is the 9,364,728-byte redesigned Outpost found in New folder.zip, NOT the 3,597,560-byte older model from Extras.zip. Confirm it visually.
3. OPTIONAL UI RECOVERY: ONLY IF welcome, modes, or Soldier Guide are still broken, compare 02_OPTIONAL_UI_RECOVERY/src/client/ui.tsx against your current ui.tsx and merge changes. This is the v66 copy with Soldier Guide dialogue handlers, NOT guaranteed to match all your later UI work. DO NOT blindly overwrite it.
4. OPTIONAL STEP 4 ART: matching dialogue step-4 image from v66 is included, only if needed.
5. Keep current interactions.ts, soldierGuide.ts, badgeTerminal.ts, terrainFixes.ts, weapons, mission code, etc. No script replacements are bundled for those files.
6. Restart Preview. Test Welcome, Modes, NPC click, all 4 terminals, screens, and interior.

WARNING: v69 terminal GLBs and code may not be consistent with this 9.4MB Outpost. This patch does not guarantee terminal placement. If the NPC still does not respond, a copy of the latest current project is required to diagnose the script bindings.
