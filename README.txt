Project Exodus v25 — 180° reversal from v24

v24 faced -Z. v25 faces +Z, with the same spawn position.

Install: extract apply_spawn_v25.py into your Project Exodus project root,
then run `python apply_spawn_v25.py` and restart Creator Hub preview.

The included scene.json is for comparison only; use the script to also update
src/client/setup.ts and retain your other scene settings.

IMPORTANT: Decentraland spawn cameraTarget controls the initial viewing direction,
not an independently controllable local avatar body rotation. Rotating this target
180° may also rotate the camera view. If you need the avatar to look directly at
its own third-person camera while keeping the billboard behind it, a separate
camera/orientation implementation is required and is NOT included here.

GitHub unchanged. Not tested in Creator Hub.
