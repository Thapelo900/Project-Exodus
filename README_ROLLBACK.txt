Project Exodus v39 NPC Emergency Rollback

Restore src/client/setup.ts and src/client/ui.tsx at the project root.
The UI is restored from the v38 patch. setup.ts is v39 with ONLY the guide import and setup call removed, retaining other prior changes.
Delete src/client/soldierGuide.ts if present (optional when no code imports it).
Back up project first; do not change other files.
This patch has not been compiled or run in Creator Hub. GitHub not modified.
