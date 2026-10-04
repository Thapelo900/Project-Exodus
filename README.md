## v12 update
- Heading-up rotating minimap and full map: map rotates 360° while cursor stays fixed facing forward.
- Removed loose ammo and bomb spawns inside Outpost.
- Restored F/secondary building-material deployment input.
- Scope/AIM button retained with EXIT SCOPE state and full-screen live-view overlay.
- Ruins recolored with industrial materials and shifted 18m right onto island.

# Project Exodus

### v42 — Supplied Hands Grip Alignment
- Corrected the supplied two-hand GLB transform in 3D: forward-facing Y rotation, grip pitch/roll, position and scale.
- Both hands now extend toward the rifle instead of leaving the forearm ends facing the camera.
- Recoil/reload retain the corrected transform.


Project Exodus is a Decentraland SDK 7 low-poly post-apocalyptic survival island. It preserves the authoritative 20-player match architecture while adding a connected explorable world, usable Outpost, survival, missions, trading, inventory, two-handed first-person weapons, bots, PvP, building and persistent loadouts.

### v33 — Reference Combat Grip
- Repositioned the supplied left/right hand GLBs around the weapon so both hands visibly carry the gun like the approved reference: left hand supports the fore-end and right hand sits at the firing grip.
- Increased the authored hands slightly for the stronger human first-person silhouette while preserving avatar skin tint, black tactical gloves and left wrist watch.
- Locomotion still spreads the hands; aiming, firing and reloading pull them into the supported weapon grip.

## World

The 30x30 World scene (480x480 metres) contains 123 named top-level Creator Hub entities and eight optimized, colorized GLBs (518 internal low-poly meshes) across eight connected regions:

- **The Outpost** - the supplied `assets/Models/OutPost.glb` is the spawn headquarters at `(96, 112)`, with command atrium, trader, mission, gear and interior-map interaction points.
- **Exodus City** - the supplied city landmark provides shops, varied buildings, market-scale streets and lights.
- **The Arena** - the supplied mountain arena provides a fortified combat bowl, entrance, stands, barriers and scoreboard forms.
- **Scavenger Camp** - the supplied survivor camp provides tents, watchtowers, salvage, storage and firepit forms.
- **The Ruins** - the supplied abandoned compound provides broken concrete, exposed structures, rubble and overgrowth.
- **The Plant** - the supplied industrial landmark provides warehouses, tanks, pipes, machinery and chimneys.
- **The Docks** - the supplied harbour provides piers, containers, cranes, warehouses and ships.
- **The Beach** - shelter, palms, campfire, seating and ocean-facing social space.

The supplied island terrain provides the coastline, mountains, forests and roads. Seven explicit collider bridges connect every major region to Exodus City or the southern route. The supplied labelled island image is used by both the compact map and full map, with live player position and heading. All imported white/default materials were replaced by a shared Project Exodus palette: forest green, rock/concrete, charcoal metal, rust, orange warnings and cyan technology lighting. Regional GLBs are optimized without Draco so both the Decentraland client and authoritative Bevy server can load them.

## Gameplay and HUD

- 20-player, 15-minute authoritative rounds with four deployment modes: Solo Survival, cooperative team survival, survivor-versus-survivor PvP, and PvPvE
- Cooperative survival disables friendly fire and scales the initial hostile force to the number of joined survivors
- Every completed mission raises the shared Threat Level and adds a capped mixed Mutant/Drone wave; active hostiles never exceed 36
- Easy, Normal and Hard threat profiles change enemy count, speed, damage, detection and reinforcement timing
- Four regional Decentraland-avatar Mutants: Standard, Berserker, flanking Stalker and toxic-projectile Infected
- Variant-specific contaminated skin, red eyes and survivor outfits with AI-triggered attack, hit and knockout emotes
- Three flying Drones: fast Scout, strafing Attack Drone and reinforcement-focused Support Drone
- Stateful patrol, alert, chase, attack, search and return behavior; gunfire/running noise can reveal the player
- Rival Mutant and Drone factions can target each other; Scout/Support backup calls are delayed, interruptible and capped
- Contextual enemy health, Drone alert warnings, directional damage feedback and enemy resource drops
- Automatic local Solo fallback when the Multiplayer Server is unavailable
- Reference-directed low-poly Pulse Rifle, Scattergun and Rail Pistol with distinct playable geometry, matching HUD portraits, finite magazine/reserve ammunition, and discharge effects that stop when empty
- Finite collectible bombs with authoritative ballistic throwing, 1.8-second fuse, eight-metre falloff blast damage, throw animation, synchronized explosion effects and persistent inventory count
- Thirty-seven finite loot points are distributed through landmark interiors and travel corridors; ammunition is no longer sold by the Outpost trader
- Destroyed Attack, Scout and Support Drones drop rifle, pistol and shotgun ammunition respectively
- Server-validated shooting, damage, fire rate, building distance and limits
- Health, shield, stamina, hunger and thirst
- Regional ammunition, materials, medkit, shield-cell, water and bomb loot with emissive rings, floating icon cards, spinning/bobbing motion, randomized light-glitch pulses and lift-away pickup animation
- Collectible supplies inside and around every major regional landmark
- Three rare Pandora Boxes per round, hidden among seven possible buildings; each awards one persistent Life Credit that restores health to 100
- Mission-board destinations with server-verified rewards
- Trader purchases paid from actual build materials
- Persistent loadout, consumables, ammunition and lifetime kills
- Two higher-detail Decentraland-style fingerless gloves with layered palms, guards, knuckle armour, articulated finger joints, avatar-coloured fingertips/forearms, wrist cuffs and a glowing wrist screen; the right hand stays on the pistol grip while the left hand moves beneath the fore-end during firing
- A rebuilt low-poly survival rifle with layered receiver, tan handguard panels, stock struts, butt pad, pistol grip, trigger guard, magazine well, rail teeth, iron sights, red optic, side vents and ejection port
- Smoothed speed-blended idle, walk, sprint and jump motion plus recoil, reload, switch and interaction movement; hands spread while running, then form a supported two-hand rifle grip without crossing the muzzle
- Animated weapon discharge with emissive muzzle flash, sparks, expanding smoke, recoil and pooled brass-casing ejection
- Cosmetic hand-attached gun representation for remote multiplayer avatars; the local gameplay weapon remains camera-parented for stable aiming
- Elimination menu with Play Again, Return to Outpost and Stay/Spectate choices
- Runtime first-person enforcement across the full World and build-height volume, including after scene reloads
- Synchronized maps: a GLB-derived Outpost level-one floorplan while inside and the supplied labelled Project Exodus island map outside; both retain north-up orientation, live heading and a rotating player arrow
- Safe-zone presentation: spawn in third-person with the avatar visible and deployment chooser open; weapons and combat HUD remain holstered until leaving the complete Outpost boundary
- Server and offline-Solo safe-zone enforcement: enemies cannot enter or target the Outpost, hostile projectiles are removed at its boundary, and player fire, explosives, building, storm and hostile damage are blocked inside
- The Outpost GLB uses 12 shared charcoal, steel, concrete, orange, cyan, glass, supply, foliage, wood and fabric materials instead of 442 white default materials
- Military-style glowing green field watch on the left wrist and a clickable/mobile scope control
- Correctly oriented cylindrical barrels, muzzle bore and combat scope geometry for the weapon viewmodel
- Original local texture icons for survival status, match information, weapons, supplies and every island venue
- Native Decentraland chat remains active

## Open in Creator Hub

Open the `project-exodus` folder. On Windows with this WSL workspace it is usually:

```text
\\wsl.localhost\Ubuntu\home\openclaw\.openclaw\workspace\project-exodus
```

Close Creator Hub before running `npm run generate:arena`, since it rewrites the editable composite. Then reopen the project.

```bash
npm install
npm run generate:arena
npm run validate
npm run build
npm run start
```

## Controls

- Move/look/jump: standard Decentraland controls
- Fire: pointer click or mobile FIRE
- Build selected structure: F/right-click secondary action or mobile BUILD
- Scope/aim: SCOPE / AIM HUD button (SDK 7 exposes F and right-click as the same secondary action and has no distinct raw G binding)
- Slots 1-3: weapons; slot 4: throw bomb; slot 5: medkit; slot 6: water
- Interact: the prompt shown on Outpost terminals
- Inventory, consumables, reload and build types: HUD controls
- Chat: native Decentraland Enter/chat control

## Test checklist

1. Spawn inside the Outpost and walk through its wide entrance.
2. Use the mission board, trader and gear-storage terminals.
3. Confirm the deployment chooser appears while the third-person avatar is inside the Outpost; select a mode and confirm it disappears immediately.
4. Fire, reload and switch weapons; magazine/reserve values must change.
5. Confirm both segmented hands match the reference silhouette, show avatar-coloured forearms/fingertips, separate clearly while running, and grip the pistol grip/fore-end together when firing.
6. Fire every weapon and confirm recoil, muzzle flash, sparks, smoke and casing ejection play once per accepted shot; empty the magazine and confirm all discharge effects stop.
7. Confirm the compact map fills its bottom-right frame above Build Materials, shows only nearby venue icons, and opens the full labelled island map when clicked; then close it and confirm FPS pointer lock returns.
8. In Solo, verify Mutants patrol the Ruins/Plant while flying Drones patrol technology zones.
9. Collect the animated ammo, medkit, water and bomb pickups; confirm their icon, glow/glitch loop and lift-away pickup animation, then destroy each Drone variant and collect its weapon-specific ammo crate.
10. Throw a bomb with slot/key 4, confirm the hand throw animation, ballistic arc, fuse, expanding blast and distance-based enemy damage; use the last bomb and confirm another cannot be thrown until a purple pickup is collected.
11. Trigger a Scout/Support alert, destroy the caller before its timer, then separately confirm capped reinforcements arrive.
12. Lead Mutants into a Drone patrol and confirm the rival factions engage.
13. Confirm toxic and Drone projectiles are visible and avoidable; aim at an enemy to show its contextual health bar.
14. Enter several landmark buildings, collect their interior supplies, find one rare purple Pandora Box, then spend its Life Credit after taking damage and confirm health returns to 100.
15. Complete a mission and confirm Threat Level increases and a mixed Mutant/Drone wave enters the island.
16. Confirm movement stamina and timed hunger/thirst changes.
17. Place walls, ramps and floors.
18. Test a second client in Co-op and confirm teammates cannot damage each other, then test PvP and confirm player damage is enabled.
19. Get eliminated and verify all three elimination choices.
20. Confirm Mutants, Drones, hostile projectiles, explosions and storm damage cannot enter or hurt players within the Outpost boundary.
21. Reload the scene and stand on a player-built platform outside the Outpost; the Decentraland avatar must remain hidden in first person.

## Publishing

`scene.json` targets `aurethegard.dcl.eth`. Confirm exact spelling and ownership before Creator Hub **Publish to World**. Publishing requires the owning wallet's interactive signature.

## Key files

```text
assets/scene/main.composite       Editable regional placement, bridges and interactions
assets/Models/                    Colorized, server-compatible low-poly world GLBs
images/project-exodus-minimap-source.png  Original minimap art
images/project-exodus-minimap-detailed.png Detailed low-poly HUD minimap artwork
scripts/generate-composite.mjs    Deterministic island generator
scripts/process-world-models.mjs  Deterministic material/orientation processor for supplied GLBs
scripts/generate-ui-icons.mjs     Local Project Exodus HUD and map icon generator
images/ui/                        HUD, inventory and venue icon textures
src/server/setup.ts               Authoritative gameplay
src/client/interactions.ts        Outpost interactions
src/client/ui.tsx                 Reference-directed HUD
src/client/viewmodel.ts           Two-handed FPS weapon
```

Run `npm run validate`, `npm run typecheck`, and `npm run build` before publishing.

## v11 update
- Bomb pickup placeholder mesh removed; only the pickup icon remains.
- Outpost Gear Storage, Trader Shop and Accept Mission terminals rebuilt as detailed 3D rotating geometry inspired by the supplied designs.
- Restored click-toggle SCOPE / AIM control; the same control becomes EXIT SCOPE while active. Right mouse hold-to-scope binding removed.
- Outdoor minimap and big map now move beneath a fixed north-facing player cursor, keeping the player centered.

## v13 fixes
- Ruins GLB rotated 90 degrees to place its authored Z-up base flat in Decentraland; oversized Compound_Pad mesh removed and industrial vertex colors baked into a cleaned GLB.
- Scope/Aim button restored as click-toggle; scope overlay uses transparent center for live world view and includes a visible EXIT SCOPE button on the overlay.
- Building Wall/Ramp/Floor placement is infinite in local Solo and server-authoritative play; HUD shows infinity and placement no longer decrements materials.

## v17 Ruins correction
The supplied Ruins GLB is now corrected internally from Z-up to Decentraland Y-up, its runtime entity rotation is reset to identity, and visible industrial base colors are embedded into all Ruins materials.

## v19 Ruins correction
- Kept the now-correct flat Ruins orientation unchanged.
- Shifted the Ruins 30m left from its authored scene position so the circular footprint sits farther onto the island.
- Rebuilt all 583 Ruins material entries with a high-contrast 18-color industrial RGB palette plus restrained emissive accents for visible color separation in Creator Hub lighting.


## v21 Ruins placement
The Ruins runtime placement was moved 8 metres back toward the island centre compared with v20, while preserving its flat baked orientation and grey-building/RGB-crate materials.

## v22 Ruins placement
- Moved the flat Ruins compound to the actual center of its island at the same world position used by the Ruins map marker (x=111, z=296).
- Preserved the corrected flat orientation and existing grey-building / RGB-crate materials.


## v23 placement update
- The Plant runtime transform is centered on the right-hand southern island at world X 270 / Z 384.
- Plant map/location coordinates were updated to match the new world position.


## v168 persistent campaign progress
The authoritative SDK server now stores per-player campaign progress with `Storage.player`, keyed by the Decentraland player address. It restores completed generated missions, collected Memory Pack/Data RAM IDs, active mission selection and per-mission collectible counters on the next join. Badge statistics/loadout were already stored server-side and remain persistent. The client sends campaign snapshots only when changed (plus immediate saves for key actions). Local offline fallback/preview without the authoritative server cannot provide cross-session server persistence.

V215: Trader Shop badge-card geometry aligned to fixed 8-column decorative cells; working v213 terminal-open path unchanged.

- v218: Replaced Trader Shop frame with supplied high-quality 30-cell master and aligned each badge/text unit by fixed absolute cell coordinates. Defringed transparent edges.

- v221: Trader badge artwork + title units re-centered to the decorative frame cells; right-side columns corrected; terminal opening unchanged.
