import {
  AvatarMask,
  CameraMode,
  CameraType,
  InputAction,
  PointerEventType,
  PointerLock,
  PrimaryPointerInfo,
  TouchScreenControls,
  Transform,
  engine,
  inputSystem
} from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { isMobile } from '@dcl/sdk/platform'
import { getPlayer } from '@dcl/sdk/src/players'
import { isStateSyncronized } from '@dcl/sdk/network'
import { room } from '../shared/messages'
import { movePlayerTo, triggerSceneEmote } from '~system/RestrictedActions'
import { BotState, MatchState, PlayerState } from '../shared/schemas'
import { GAME, LOCATIONS, MISSIONS, WEAPONS, type BuildKind, type Difficulty, type GameMode, type MissionId, type WeaponId } from '../shared/config'
import { clientState, isServerAlive, notify, observeHeartbeat } from './state'
import { setupUi } from './ui'
import { kickViewModel, reloadViewModel, setViewModelAim, setupFirstPersonViewModel, switchViewModel, throwViewModel } from './viewmodel'
import { setupWorldInteractions } from './interactions'
import { isFirstPersonCamera, setupFirstPersonEnforcement } from './camera'
import { setupAvatarWeapons, triggerAvatarWeaponFire } from './avatarWeapons'
import { setupLootVisuals } from './lootVisuals'
import { setupBombVisuals } from './bombVisuals'
import { setupMemoryCollectibles } from './memoryCollectibles'
import { setupCampaignPersistence, saveCampaignProgress } from './progressPersistence'
import { setupDroneVisuals } from './droneVisuals'
import { playReloadSound, playShotSound, playMutantAlertSound, setBattleMusic, setDroneFlightSound, setOutpostMusic, setRunningBreathing, playAfterRunningSound, playMutantAttackHitSound, playPlayerHurtSound } from './audio'
import { setupTerrainFixes } from './terrainFixes'
import { setupWaterEffects } from './waterEffects'
import { setupBadgeTerminal } from './badgeTerminal'
import { isCinematicActive, setupIntroCinematic, startIntroCinematic } from './cinematic'
import {
  deployLocalBuild,
  fireLocalWeapon,
  getLocalSoloMatch,
  getLocalSoloPlayer,
  reloadLocalWeapon,
  acceptLocalMission,
  buyLocalSupply,
  respawnLocalPlayer,
  selectLocalWeapon,
  startLocalSolo,
  throwLocalBomb,
  useLocalItem
} from './localSolo'

let inputCooldown = 0
let primaryFireHeld=false
const hostileAudioState=new Map<string,string>()
let lastMutantAlertAt=0

export function getLocalPlayerState() {
  if (clientState.localSolo) return getLocalSoloPlayer()
  const address = getPlayer()?.userId.toLowerCase()
  if (!address) return undefined
  for (const [, state] of engine.getEntitiesWith(PlayerState)) {
    if (state.playerId.toLowerCase() === address) return state
  }
  return undefined
}

export function getMatchState() {
  if (clientState.localSolo) return getLocalSoloMatch()
  for (const [, state] of engine.getEntitiesWith(MatchState)) return state
  return undefined
}

export function requestJoin(mode: GameMode) {
  if (isCinematicActive()) return
  startIntroCinematic(mode, beginJoinAfterCinematic)
}

function beginJoinAfterCinematic(mode: GameMode) {
  if (clientState.localSolo && mode === 'solo-bots') {
    respawnLocalPlayer('rejoin')
    clientState.joined = true
    clientState.joining = false
    return notify('New solo deployment started', 3)
  }
  clientState.selectedMode = mode
  clientState.pendingMode = mode
  clientState.joining = true
  clientState.joinSentAt = 0
  clientState.joinStartedAt = Date.now()
  clientState.joinAttempts = 0
  clientState.inventoryOpen = false
  clientState.mapOpen = false
  clientState.shopOpen = false
  if (!clientState.insideOutpost) PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: true })
  notify('Deployment selected. Synchronizing loadout...', 12)
}

export function selectDifficulty(difficulty: Difficulty) {
  clientState.difficulty = difficulty
  notify(`${difficulty.toUpperCase()} solo threat profile selected`, 2)
}

function moveToOutpost() {
  void movePlayerTo({
    newRelativePosition: Vector3.create(97.75, 1.2, 102.1),
    cameraTarget: Vector3.create(105.0, 2.6, 102.1)
  })
}

export function requestRespawn(choice: 'continue' | 'rejoin' | 'outpost') {
  if (clientState.localSolo) {
    respawnLocalPlayer(choice)
    clientState.joined = choice === 'continue' || choice === 'rejoin'
    moveToOutpost()
    return notify(choice === 'continue' ? 'Mission progress preserved — continue from the Outpost' : choice === 'rejoin' ? 'Mission restarted from the beginning' : 'Returned to the Outpost', 3)
  }
  moveToOutpost()
  void room.send('respawnPlayer', { choice })
}

function sendPendingJoin() {
  if (!clientState.joining || !clientState.pendingMode || !isStateSyncronized() || !isServerAlive()) return
  if (Date.now() - clientState.joinSentAt < 2000) return
  const profile = getPlayer()
  const mode = clientState.pendingMode
  clientState.joinSentAt = Date.now()
  clientState.joinAttempts += 1
  void room.send('joinMatch', { mode, displayName: profile?.name || 'Exodus Runner', difficulty: clientState.difficulty })
}

function aimDirection() {
  const pointer = PrimaryPointerInfo.getOrNull(engine.RootEntity)
  if (pointer?.worldRayDirection) return Vector3.normalize(pointer.worldRayDirection)
  const camera = Transform.getOrNull(engine.CameraEntity)
  return camera ? Vector3.rotate(Vector3.Forward(), camera.rotation) : Vector3.Forward()
}

function updateThreatHud() {
  const camera = Transform.getOrNull(engine.CameraEntity), player = getLocalPlayerState(), now = Date.now()
  if (!camera) return
  const forward = Vector3.normalize(Vector3.rotate(Vector3.Forward(), camera.rotation))
  let best: { name:string; hp:number; maxHp:number; score:number } | undefined
  let nearest: Vector3 | undefined, nearestDistance = Number.POSITIVE_INFINITY
  for (const [, bot, transform] of engine.getEntitiesWith(BotState, Transform)) {
    if (!bot.active || bot.hp <= 0) continue
    const relative=Vector3.subtract(transform.position,camera.position),distance=Vector3.length(relative),alignment=Vector3.dot(Vector3.normalize(relative),forward)
    if(distance<nearestDistance){nearestDistance=distance;nearest=transform.position}
    if(distance<140&&alignment>.982){const score=alignment-distance*.0005;if(!best||score>best.score)best={name:bot.displayName.toUpperCase(),hp:bot.hp,maxHp:bot.maxHp,score}}
  }
  clientState.enemyTargetName=best?.name??'';clientState.enemyTargetHp=best?.hp??0;clientState.enemyTargetMaxHp=best?.maxHp??0
  if(player&&player.hp<clientState.lastObservedHp&&nearest){playPlayerHurtSound();const toEnemy=Vector3.normalize(Vector3.subtract(nearest,camera.position)),right=Vector3.normalize(Vector3.create(forward.z,0,-forward.x)),side=Vector3.dot(toEnemy,right),front=Vector3.dot(toEnemy,forward);clientState.damageDirection=Math.abs(side)>.55?(side>0?'RIGHT':'LEFT'):(front>0?'FRONT':'BACK');clientState.damageUntil=now+750;for(const[,b,t]of engine.getEntitiesWith(BotState,Transform)){if(b.active&&b.hp>0&&b.family==='mutant'&&Vector3.distance(t.position,camera.position)<5){playMutantAttackHitSound();break}}}
  if(player)clientState.lastObservedHp=player.hp
  if(clientState.damageUntil<now)clientState.damageDirection=''
  if(clientState.droneAlertUntil<now)clientState.droneAlert=''
}


let lowReadyWeapon: WeaponId | '' = ''
let lowReadyElapsed = 0

function lowReadyEmoteFor(weapon: WeaponId) {
  return weapon === 'rail-pistol'
    ? 'assets/Models/Project_Exodus_Pistol_LowReady_emote.glb'
    : weapon === 'scattergun'
      ? 'assets/Models/Project_Exodus_Shotgun_LowReady_emote.glb'
      : 'assets/Models/Project_Exodus_Rifle_LowReady_emote.glb'
}

function playProjectExodusLowReadyEmote(weapon: WeaponId) {
  lowReadyWeapon = weapon
  void triggerSceneEmote({ src: lowReadyEmoteFor(weapon), loop: true, mask: AvatarMask.AM_UPPER_BODY })
}

// v196: Rifle shooting pose is now shared by Rifle, Pistol and Shotgun for the same third-person aiming body language. Shooting uses the complete emote (no upper-body mask) so the authored wide shooting stance, knees/feet and scope-ready head posture can play instead of the locomotion/default lower body overriding them.
function playProjectExodusShootEmote() {
  // v198: every accepted mouse shot retriggers the third-person shooting pose immediately.
  // No animation debounce: semi-auto clicks and individual automatic-fire shots stay visually synchronized.
  lowReadyWeapon = ''
  const player = getLocalPlayerState()
  const emoteSrc = player?.equippedWeapon === 'rail-pistol'
    ? 'assets/Models/Project_Exodus_Pistol_Shoot_emote.glb'
    : player?.equippedWeapon === 'scattergun'
      ? 'assets/Models/Project_Exodus_Shotgun_Shoot_emote.glb'
      : 'assets/Models/Project_Exodus_Rifle_Shoot_emote.glb'
  // v201: Shooting is ALWAYS upper-body only. Decentraland owns hips/legs/feet in every
  // state (idle, walk and sprint), so the custom firing pose can never alter the stance.
  // Re-trigger on every physical fire click; no locomotion branch and no animation debounce.
  void triggerSceneEmote({ src: emoteSrc, loop: false, mask: AvatarMask.AM_UPPER_BODY })
}

export function fireWeapon(shootEmoteAlreadyTriggered = false) {
  const match = getMatchState()
  if (match?.phase !== 'active') return notify('Enter an active round before firing')
  const player=getLocalPlayerState()
  const weapon=WEAPONS[(player?.equippedWeapon as WeaponId)||'pulse-rifle']
  if(!player||player[weapon.magazineField]<=0)return notify(player&&player[weapon.ammoField]>0?'Magazine empty — reload':'Out of ammunition — find an ammo crate or down a Drone',3)
  const direction = aimDirection()
  // v197: in third person, make the avatar body follow the actual shot direction.
  // Re-targeting the camera at the same world-space firing line makes the avatar turn into
  // the shot instead of visually firing through its back when the camera has swung around.
  const playerTransform = Transform.getOrNull(engine.PlayerEntity)
  // v199: v197/v198 called movePlayerTo on every shot. During sprinting that competes with
  // Decentraland's locomotion/network interpolation and causes the local avatar and nearby
  // replicated avatars to jitter/glitch. Keep aim-facing only for a stationary third-person
  // shot; locomotion is never repositioned or camera-retargeted while running.
  const movingNow = inputSystem.isPressed(InputAction.IA_FORWARD) || inputSystem.isPressed(InputAction.IA_WALK)
  if (!movingNow && playerTransform && CameraMode.getOrNull(engine.CameraEntity)?.mode === CameraType.CT_THIRD_PERSON) {
    const flat = Vector3.create(direction.x, 0, direction.z)
    if (Vector3.length(flat) > 0.001) {
      const facing = Vector3.normalize(flat)
      void movePlayerTo({
        newRelativePosition: Vector3.clone(playerTransform.position),
        cameraTarget: Vector3.add(Vector3.create(playerTransform.position.x, playerTransform.position.y + 1.45, playerTransform.position.z), Vector3.scale(facing, 18))
      })
    }
  }
  if (clientState.localSolo) {
    const result=fireLocalWeapon(direction)
    if(!result.startsWith('Magazine empty')&&!result.startsWith('Solo training')){kickViewModel();playShotSound(weapon.id);if(!shootEmoteAlreadyTriggered)playProjectExodusShootEmote();const id=getPlayer()?.userId.toLowerCase();if(id)triggerAvatarWeaponFire(id)}
    return notify(result,1)
  }
  // v200: local firing presentation starts on the physical mouse-down path, before the
  // multiplayer round-trip. The server remains authoritative for damage/ammo; only the
  // viewmodel/audio/avatar firing pose is predicted locally for zero perceived emote delay.
  kickViewModel()
  playShotSound(weapon.id)
  if(!shootEmoteAlreadyTriggered) playProjectExodusShootEmote()
  const localId=getPlayer()?.userId.toLowerCase()
  if(localId)triggerAvatarWeaponFire(localId)
  void room.send('fireWeapon', { directionX: direction.x, directionY: direction.y, directionZ: direction.z })
}

export function throwBomb() {
  const match=getMatchState(),player=getLocalPlayerState()
  if(match?.phase!=='active'||!player?.alive)return notify('Bombs are available during an active round',2)
  if(player.bombs<=0)return notify('No bombs - find a purple bomb pickup',3)
  const direction=aimDirection()
  if(clientState.localSolo){const result=throwLocalBomb(direction);if(result.startsWith('Bomb thrown'))throwViewModel();return notify(result,3)}
  void room.send('throwBomb',{directionX:direction.x,directionY:direction.y,directionZ:direction.z})
}

export function deployBuild(kind: BuildKind = clientState.selectedBuild) {
  const player = Transform.getOrNull(engine.PlayerEntity)
  if (!player || getMatchState()?.phase !== 'active') return notify('Building is available during active rounds')
  const direction = aimDirection()
  const horizontal = Vector3.normalize(Vector3.create(direction.x, 0, direction.z))
  const position = Vector3.add(player.position, Vector3.scale(horizontal, 5))
  const yaw = (Math.atan2(horizontal.x, horizontal.z) * 180) / Math.PI
  if (clientState.localSolo) return notify(deployLocalBuild(kind, position, yaw), 2)
  void room.send('buildStructure', { kind, x: position.x, y: 1.5, z: position.z, yaw })
}

export function selectBuild(kind: BuildKind) {
  clientState.selectedBuild = kind
  notify(`${kind[0].toUpperCase()}${kind.slice(1)} selected`)
}

export function selectWeapon(weapon: WeaponId) {
  switchViewModel()
  if (clientState.localSolo) return notify(selectLocalWeapon(weapon), 2)
  void room.send('selectWeapon', { weapon })
}

export function useInventoryItem(item: 'medkit' | 'shield-cell' | 'water' | 'life-credit') {
  if (clientState.localSolo) return notify(useLocalItem(item), 2)
  void room.send('useItem', { item })
}

export function reloadWeapon() {
  const player = getLocalPlayerState()
  if (!player) return notify('Loadout is not ready')
  const weapon=WEAPONS[(player.equippedWeapon as WeaponId)||'pulse-rifle']
  if(player[weapon.magazineField]>=weapon.magazine)return notify('Magazine already full',2)
  if(player[weapon.ammoField]<=0)return notify('No reserve ammunition — search buildings or destroy Drones',3)
  if (clientState.localSolo) {const result=reloadLocalWeapon();if(result.endsWith('reloaded')){reloadViewModel();playReloadSound(weapon.id)}return notify(result,2)}
  void room.send('reloadWeapon', { weapon: player.equippedWeapon })
}

export function requestMission(missionId: MissionId = 'reach-city') {
  clientState.missionCompletionSent = ''
  if (clientState.localSolo) return notify(acceptLocalMission(), 3)
  void room.send('requestMission', { missionId })
}

export function buySupply(item: 'medkit' | 'water') {
  if (clientState.localSolo) return notify(buyLocalSupply(item), 3)
  void room.send('buySupply', { item })
}

export function toggleInventory() {
  clientState.inventoryOpen = !clientState.inventoryOpen
}

export function toggleMap() {
  clientState.mapOpen = !clientState.mapOpen
  // Release the cursor while the island map is open, then return to FPS aiming.
  PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: !clientState.mapOpen })
}

export function toggleScope() {
  if (clientState.insideOutpost || clientState.mapOpen) return notify('Scope is available after leaving the Outpost')
  clientState.scopeToggled = !clientState.scopeToggled
  clientState.aiming = clientState.scopeToggled
  setViewModelAim(clientState.aiming)
  notify(clientState.scopeToggled ? 'Scope engaged' : 'Scope lowered', 1)
}

let lastRunPosition:Vector3|undefined // camera X/Z position: used only to reject stationary/teleport cases
let wasRunning=false
let runStartedAt=0

function clientInputSystem(dt: number) {
  inputCooldown = Math.max(0, inputCooldown - dt)
  const match = getMatchState()
  if (match) observeHeartbeat(match.heartbeat)
  const camera = Transform.getOrNull(engine.CameraEntity)
  const avatar = Transform.getOrNull(engine.PlayerEntity)
  if (camera) {
    const forward = Vector3.rotate(Vector3.Forward(), camera.rotation)
    clientState.heading = (Math.atan2(forward.x, forward.z) * 180 / Math.PI + 360) % 360
  }
  const localPlayer = getLocalPlayerState()
  // v169: custom run audio follows Decentraland sprint only. In the current client Ctrl is IA_WALK,
  // so explicitly reject IA_WALK and require forward movement at sprint speed. This makes plain W silent,
  // Ctrl+W silent, and Shift+W (the default sprint) the only forward state that can arm the run/recovery audio.
  if(camera){
    const cur=Vector3.create(camera.position.x,0,camera.position.z)
    const prev=lastRunPosition
    const travelled=prev?Vector3.distance(cur,prev):0
    const speed=dt>0?travelled/dt:0
    const canUseRunAudio=!clientState.cinematicActive&&!clientState.welcomeOpen&&!clientState.insideOutpost
    const movingForward=inputSystem.isPressed(InputAction.IA_FORWARD)
    const ctrlWalk=inputSystem.isPressed(InputAction.IA_WALK)
    const sprinting=canUseRunAudio&&movingForward&&!ctrlWalk&&speed>5.5&&speed<18
    if(sprinting&&!wasRunning)runStartedAt=Date.now()
    setRunningBreathing(sprinting)
    if(!sprinting&&wasRunning&&runStartedAt>0){playAfterRunningSound();runStartedAt=0}
    wasRunning=sprinting
    lastRunPosition=cur
  }
  if (clientState.welcomeOpen) {
    primaryFireHeld=false; setOutpostMusic(true); setBattleMusic(false); setDroneFlightSound(false)
    // v235: mobile/native Interact can activate ENTER EXODUS without relying on a tiny screen hitbox.
    // Accept both the main pointer/hand action and PRIMARY while the welcome overlay owns input.
    if (clientState.welcomeLoadingUntil<=0 && (
      inputSystem.isTriggered(InputAction.IA_POINTER, PointerEventType.PET_DOWN) ||
      inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)
    )) {
      clientState.hoveredMenuButton='welcome-pressed'
      clientState.welcomeLoadingUntil=Date.now()+10000
    }
    return
  }
  if (isCinematicActive() || clientState.memoryStoryOpen || clientState.dataStoryOpen) { primaryFireHeld = false; setOutpostMusic(false); setBattleMusic(false); setDroneFlightSound(false); return }
  const combatReady = !clientState.insideOutpost
  // v76 contextual combat audio: quiet music only during an active battle outside Outpost;
  // drone loop only while a live drone is nearby; mutant alert is one-shot on detection/attack.
  // Outpost island track and battle track are mutually exclusive.
  setOutpostMusic(clientState.insideOutpost)
  setBattleMusic(match?.phase === 'active' && combatReady)
  let nearbyDrone=false, mutantAlert=false
  if(avatar&&combatReady&&match?.phase==='active')for(const[,b,t]of engine.getEntitiesWith(BotState,Transform)){
    if(!b.active||b.hp<=0)continue
    const d=Vector3.distance(t.position,avatar.position)
    if(b.family==='drone'&&d<55)nearbyDrone=true
    const prev=hostileAudioState.get(b.botId)??'patrol'
    if(b.family==='mutant'&&d<Math.max(12,b.detection)&&prev!=='attack'&&prev!=='chase'&&(b.aiState==='attack'||b.aiState==='chase'||b.aiState==='alert'))mutantAlert=true
    hostileAudioState.set(b.botId,b.aiState)
  }
  setDroneFlightSound(nearbyDrone)
  if(mutantAlert&&Date.now()-lastMutantAlertAt>1800){lastMutantAlertAt=Date.now();playMutantAlertSound()}
  if (localPlayer?.equippedWeapon === 'rail-pistol' && clientState.scopeToggled) { clientState.scopeToggled=false; clientState.aiming=false; setViewModelAim(false) }
  updateThreatHud()
  if (localPlayer?.alive) clientState.eliminationDismissed = false
  if (avatar && localPlayer?.missionId && localPlayer.missionId in MISSIONS) {
    const missionId = localPlayer.missionId as MissionId
    const target = LOCATIONS[MISSIONS[missionId].target]
    clientState.missionDistance = Vector3.distance(avatar.position, Vector3.create(target.x, avatar.position.y, target.z))

  }
  if (match && clientState.lastRound === 0) clientState.lastRound = match.round
  else if (match && match.round !== clientState.lastRound) {
    clientState.lastRound = match.round
    if (match.phase === 'lobby') {
      clientState.joined = false
      clientState.joining = false
      clientState.selectedMode = ''
      clientState.pendingMode = ''
    }
  }
  sendPendingJoin()
  if (clientState.joining && clientState.joinStartedAt > 0) {
    const waitingMs = Date.now() - clientState.joinStartedAt
    if (clientState.selectedMode === 'solo-bots' && waitingMs >= 10000) {
      startLocalSolo(clientState.difficulty)
      clientState.localSolo = true
      clientState.joined = true
      clientState.joining = false
      clientState.pendingMode = ''
      notify('Solo training started locally. Multiplayer Server is offline.', 6)
    } else if (clientState.selectedMode !== 'solo-bots' && waitingMs >= 20000) {
      clientState.joining = false
      clientState.selectedMode = ''
      clientState.pendingMode = ''
      notify('Multiplayer Server unavailable. Choose Solo to play locally.', 8)
    }
  }
  if (clientState.notificationUntil > 0 && Date.now() >= clientState.notificationUntil) {
    clientState.notification = ''
    clientState.notificationUntil = 0
  }
  // Scope is controlled by the on-screen SCOPE / AIM toggle. Right mouse is no longer bound to scope.
  const pointerLocked = PointerLock.getOrNull(engine.CameraEntity)?.isPointerLocked ?? false
  // v169: fire only from a fresh physical left-mouse DOWN edge. Do not latch a held-fire boolean:
  // a missed PET_UP/pointer-lock transition could leave that latch true and cause ghost automatic shooting.
  primaryFireHeld=false
  const primaryFirePressed=(clientState.isMobile||pointerLocked)&&inputSystem.isTriggered(InputAction.IA_POINTER,PointerEventType.PET_DOWN)
  if(clientState.insideOutpost||match?.phase!=='active'){primaryFireHeld=false;return}
  // v143: Decentraland's primary action is the E interaction key. Outside the safe Outpost, E reloads.
  if (inputSystem.isTriggered(InputAction.IA_PRIMARY, PointerEventType.PET_DOWN)) { reloadWeapon(); inputCooldown=.18; return }
  if(inputCooldown>0)return

  // v78: a click fires immediately; holding left mouse continues at the equipped weapon's real fire rate.
  if (primaryFirePressed) {
    const p=getLocalPlayerState(),w=WEAPONS[(p?.equippedWeapon as WeaponId)||'pulse-rifle']
    // v201: start the upper-body pose on the SAME physical PET_DOWN edge as the muzzle path.
    // This intentionally happens before networking/target-facing work so visual aim responds
    // to the click immediately instead of a later gameplay/server state.
    playProjectExodusShootEmote()
    fireWeapon(true)
    inputCooldown=Math.max(.04,w.fireDelayMs/1000)
  } else if (inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
    // F places the currently selected building material. Left mouse remains dedicated to firing.
    deployBuild()
    inputCooldown=.18
  } else if (inputSystem.isTriggered(InputAction.IA_ACTION_3, PointerEventType.PET_DOWN)) {
    selectWeapon('pulse-rifle')
  } else if (inputSystem.isTriggered(InputAction.IA_ACTION_4, PointerEventType.PET_DOWN)) {
    selectWeapon('rail-pistol')
  } else if (inputSystem.isTriggered(InputAction.IA_ACTION_5, PointerEventType.PET_DOWN)) {
    selectWeapon('scattergun')
  } else if (inputSystem.isTriggered(InputAction.IA_ACTION_6, PointerEventType.PET_DOWN)) {
    throwBomb()
  }
}

export function setupClient() {
  setupIntroCinematic()
  console.log('[CLIENT] Project Exodus client booting')
  clientState.isMobile = isMobile()
  if (clientState.isMobile) {
    TouchScreenControls.setMainAction(InputAction.IA_POINTER)
    TouchScreenControls.showJoystick()
    TouchScreenControls.showCrosshair()
  }

  room.onMessage('serverEvent', (data) => {
    if(data.kind==='drone-alert'){clientState.droneAlert=data.text;clientState.droneAlertUntil=Date.now()+6500}
    notify(data.text, data.kind === 'round-end' ? GAME.resultsSeconds : 4)
  })
  room.onMessage('weaponFired', (data) => {
    triggerAvatarWeaponFire(data.playerId)
    const local=getPlayer()?.userId.toLowerCase()
    // v200: local player already predicted the presentation at mouse-down; do not replay
    // it when the authoritative network echo arrives. Remote players still receive the event.
    if(local&&data.playerId.toLowerCase()===local){ /* presentation already played locally */ }
  })
  room.onMessage('actionResult', (data) => {
    if (data.action === 'join' && clientState.localSolo) return
    if (data.action === 'join' && data.ok) {
      clientState.joined = true
      clientState.joining = false
      clientState.pendingMode = ''
      notify('Saved loadout and campaign progress restored.', 3)
      saveCampaignProgress(false)
    } else if (data.action === 'join' && !data.ok) {
      clientState.joined = false
      clientState.joining = false
      clientState.selectedMode = ''
      clientState.pendingMode = ''
    }
    if (data.action === 'respawn' && data.ok) {
      clientState.joined = data.detail === 'rejoin' || data.detail === 'continue'
      clientState.joining = false
      clientState.selectedMode = (data.detail === 'rejoin' || data.detail === 'continue') ? clientState.selectedMode : ''
      moveToOutpost()
    }
    if(data.action==='fire'&&data.ok){kickViewModel();const w=getLocalPlayerState()?.equippedWeapon as WeaponId|undefined;if(w)playShotSound(w)}
    if(data.action==='reload'&&data.ok){const p=getLocalPlayerState();const w=WEAPONS[(p?.equippedWeapon as WeaponId)||'pulse-rifle'];reloadViewModel();playReloadSound(w.id)}
    if(data.action==='bomb'&&data.ok)throwViewModel()
    notify(data.detail, data.action === 'fire' ? 1 : 3)
  })

  setupFirstPersonViewModel(
    () => {
      const weapon = getLocalPlayerState()?.equippedWeapon
      return weapon === 'scattergun' || weapon === 'rail-pistol' ? weapon : 'pulse-rifle'
    },
    // v163: the FPS hands/gun exist only while the Decentraland camera is actually in
    // first-person. Pressing C into Decentraland's default third-person camera hides
    // the viewmodel immediately; returning to first-person restores it.
    () => !clientState.insideOutpost && !clientState.scopeToggled
  )
  setupFirstPersonEnforcement()
  setupAvatarWeapons()
  // v141 idle reset: do not force a looping upper-body weapon pose while the
  // player is not shooting. This leaves Decentraland's normal/default avatar
  // idle, walk and run animations in control. Shooting remains event-driven.
  lowReadyWeapon = ''
  lowReadyElapsed = 0
  setupLootVisuals()
  setupBombVisuals()
  setupDroneVisuals()
  setupTerrainFixes()
  setupWaterEffects()
  setupBadgeTerminal()
  setupMemoryCollectibles()
  setupCampaignPersistence()
  engine.addSystem(clientInputSystem)
  setupWorldInteractions()
  setupUi()
  console.log('[CLIENT] Project Exodus client ready')
}
