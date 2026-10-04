import {
  CameraMode,
  CameraType,
  InputAction,
  Material,
  MeshRenderer,
  PointerEventType,
  PointerLock,
  Transform,
  VideoPlayer,
  engine,
  inputSystem,
  videoEventsSystem
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import type { GameMode } from '../shared/config'
import { clientState } from './state'
import { setOutpostMusic } from './audio'

const VIDEO_SRC = 'videos/project-exodus-intro.mp4'
let screen = 0 as any
let backdrop = 0 as any
let active = false
let pendingMode: GameMode | '' = ''
let onFinished: ((mode: GameMode) => void) | undefined
let startedAt = 0
let previousCameraMode: CameraType | undefined

function ensureScreen() {
  if (screen) return
  backdrop = engine.addEntity()
  Transform.create(backdrop, {
    parent: engine.CameraEntity,
    position: Vector3.create(0, 0, 0.42),
    rotation: Quaternion.fromEulerDegrees(0, 180, 0),
    scale: Vector3.Zero()
  })
  MeshRenderer.setPlane(backdrop)
  Material.setBasicMaterial(backdrop, { diffuseColor: { r: 0, g: 0, b: 0, a: 1 } })

  screen = engine.addEntity()
  Transform.create(screen, {
    parent: engine.CameraEntity,
    position: Vector3.create(0, 0, 0.40),
    rotation: Quaternion.fromEulerDegrees(0, 180, 180),
    scale: Vector3.Zero()
  })
  // Use a very thin box instead of a one-sided plane. Camera-attached planes can be
  // back-face culled by the Explorer (audio plays but the picture is invisible).
  // A thin box guarantees the video surface renders from the camera-facing side.
  MeshRenderer.setBox(screen)
  VideoPlayer.create(screen, { src: VIDEO_SRC, playing: false, loop: false, volume: 1, position: 0 })
  Material.setBasicMaterial(screen, { texture: Material.Texture.Video({ videoPlayerEntity: screen }) })
}

function showScreen(show: boolean) {
  ensureScreen()
  // Keep the cinematic extremely close to the camera so no world mesh, terminal,
  // pickup or avatar geometry can render in front of it. The movie surface remains
  // exact 16:9 and is sized to CONTAIN the whole frame without cropping. The larger
  // black backing provides clean letterboxing and blocks the 3D game view.
  // Fit the COMPLETE 16:9 movie frame inside the camera viewport instead of overscaling it.
  // The previous 1.40 x 0.7875 surface was larger than the visible camera frustum at
  // this distance, which cropped/zoomed the movie. 0.78 x 0.43875 preserves 16:9,
  // keeps the full frame visible, and lets the black backdrop handle letterboxing.
  const s = show ? Vector3.create(0.78, 0.43875, 0.006) : Vector3.Zero()
  const screenTransform=Transform.getMutable(screen)
  screenTransform.scale = s
  // Explorer mobile presents this camera-attached video surface inverted relative to desktop.
  // Correct only mobile; desktop keeps the proven orientation.
  screenTransform.rotation = clientState.isMobile ? Quaternion.fromEulerDegrees(0,180,0) : Quaternion.fromEulerDegrees(0,180,180)
  Transform.getMutable(backdrop).scale = show ? Vector3.create(3.4, 2.2, 1) : Vector3.Zero()
}

export function isCinematicActive() { return active }

export function startIntroCinematic(mode: GameMode, finish: (mode: GameMode) => void) {
  ensureScreen()
  pendingMode = mode
  onFinished = finish
  active = true
  startedAt = Date.now()
  clientState.cinematicActive = true
  clientState.cinematicMode = mode
  clientState.inventoryOpen = false
  clientState.mapOpen = false
  clientState.shopOpen = false
  clientState.controlsOpen = false
  clientState.badgesOpen = false
  clientState.missionTerminalOpen = false
  clientState.scopeToggled = false
  clientState.aiming = false
  // Cinematic owns the audio mix: never let Outpost music overlap the movie.
  setOutpostMusic(false)
  // Force first-person while the intro is active. This prevents the local avatar,
  // wearables and third-person body from appearing between the camera and movie.
  previousCameraMode = CameraMode.getOrNull(engine.CameraEntity)?.mode
  CameraMode.createOrReplace(engine.CameraEntity, { mode: CameraType.CT_FIRST_PERSON })
  showScreen(true)
  const video = VideoPlayer.getMutable(screen)
  video.position = 0
  video.playing = true
  PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: true })
}

export function finishIntroCinematic() {
  if (!active || !pendingMode) return
  const mode = pendingMode
  active = false
  pendingMode = ''
  clientState.cinematicActive = false
  clientState.cinematicMode = ''
  const video = VideoPlayer.getMutableOrNull(screen)
  if (video) { video.playing = false; video.position = 0 }
  showScreen(false)
  if (previousCameraMode !== undefined) {
    CameraMode.createOrReplace(engine.CameraEntity, { mode: previousCameraMode })
    previousCameraMode = undefined
  }
  const finish = onFinished
  onFinished = undefined
  if (finish) finish(mode)
}

export function setupIntroCinematic() {
  ensureScreen()
  engine.addSystem(() => {
    if (!active) return
    // F / Secondary skips the cinematic. A short guard avoids the mode-select click leaking into skip.
    if (Date.now() - startedAt > 350 && inputSystem.isTriggered(InputAction.IA_SECONDARY, PointerEventType.PET_DOWN)) {
      finishIntroCinematic()
      return
    }
    const state = videoEventsSystem.getVideoState(screen)
    if (state && state.videoLength > 0 && state.currentOffset >= state.videoLength - 0.12) finishIntroCinematic()
  })
}
