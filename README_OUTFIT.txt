PROJECT EXODUS - FOUR PIECE CUSTOM SOLDIER OUTFIT - PROTOTYPE PATCH

Copy src/client/* and assets/Models/ExodusSoldier/* into your existing project, preserving other files.

Includes: Upper, Lower, EX07 Helmet, Tactical Boots.
Soldier Guide: scene-attached four-piece outfit; existing AvatarShape, emotes and briefing interactions remain intact.
Local player: scene-attached four-piece outfit follows player position/rotation. This does not replace the Decentraland account avatar wearables.

IMPORTANT LIMITATIONS:
- Source GLBs are skinned but not yet retargeted to the Decentraland avatar skeleton. Meshes will not deform with walking/running/gestures.
- The existing avatar remains visible under the new outfit and may clip; this is NOT a finished production wearable solution.
- The scene model is not automatically replicated for other players.
- Models use estimated 100x scale and Z-up conversion; verify orientation/fit in Creator Hub.
- SDK build and Creator Hub rendering have not been tested here.

For production-ready animated equipment, export wearable meshes with compatible avatar rig/bones, publish Decentraland wearables (for actual avatar wardrobe) or implement a synchronized custom rigged avatar with animations.
