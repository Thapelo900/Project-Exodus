PROJECT EXODUS — WELCOME AUTO-INITIALIZATION PATCH

Copy the two src files and the PNG into the matching Creator Hub folders.
Do not delete or replace unrelated game files.

Startup: 10 seconds on Welcome artwork, automatically transitions to the Modes screen.
The existing Modes ENTER EXODUS interaction still controls entering the game.
No extra waiting/loading screen is introduced by this patch.

Note: This patch does not refactor the underlying game asset-loading pipeline;
asset streaming/performance depends on the existing SDK scene and resource loading.
Test PC and landscape mobile in Creator Hub before publishing.
GitHub has not been modified.
