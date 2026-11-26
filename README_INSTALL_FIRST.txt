PROJECT EXODUS v76 - TARGETED RECOVERY

FILES:
assets/Models/OutPost.glb - exact copy of your newly uploaded OutPost(2).glb (no edits)
src/client/ui.tsx - based on your newly uploaded ui(2).tsx, adds back the Soldier Guide dialogue renderer and import
src/client/soldierGuide.ts - exact copy of your newly uploaded soldierGuide.ts

IMPORTANT:
1. BACK UP your whole project before replacing anything.
2. First restore ONLY assets/Models/OutPost.glb. Verify building in Preview.
3. To fix the NPC opening a dialogue with nothing visible, compare the included ui.tsx with your current one before replacing. It retains the Welcome and Modes implementations in your uploaded ui(2).tsx; it does NOT restore a different version of these screens.
4. soldierGuide.ts is provided for reference; replace only if your current file differs and you know the uploaded version is desired.
5. NPC dialogue art paths still require Images/ui/exodus-guide-speech-step-1.png through step-4.png and hologram assets to exist in your project.
6. The game has NOT been compiled or run in Creator Hub. No other code, terminals, screens or images are replaced.
