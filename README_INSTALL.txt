PROJECT EXODUS v38 — SOURCE INSPECTION REPAIR
Based on user-uploaded New folder.zip.

1. Back up your Creator Hub project.
2. Extract into the project root, preserving src/client and Images paths.
3. Keep the current OutPost.glb and terrainFixes.ts — neither is changed.
4. Check that images are at Images/story/... and Images/ui/exodus-expanded/...
   NOT Images/Images/...

CHANGES
- Terminal interaction callbacks are protected against duplicate events.
- Terminal handlers keep checking for re-created targets rather than permanently stopping.
- Archive initialization and story overlays remain renderable if the game is still on the lobby/joining transition.
- Loading UI label explicitly says INITIALIZING, using the original 10-second timer.
- Restores archive story art and loading-frame assets at the exact paths referenced by UI.
- Stops simultaneous collection when a story panel is already open.

LIMITATIONS
- No change to terminal coordinates or OutPost.glb.
- A full game runtime test and SDK typecheck have not been performed.
- The provided full-game ZIP had no Images directory. Missing images in the archive
  do not prove they are absent from the user's installed Creator Hub project.
- If terminals still fail to open, examine Creator Hub console for runtime errors.
- GitHub was not changed.
