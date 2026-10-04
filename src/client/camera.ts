import { CameraMode, CameraType, PointerLock, Transform, engine } from '@dcl/sdk/ecs'
import { isInsideOutpost } from '../shared/config'
import { clientState } from './state'

// Desktop keeps Decentraland's normal camera behavior. Mobile gets an explicit
// Project Exodus 1st/3rd-person toggle; the selected mode is continuously enforced
// so native zoom gestures do not fight the mobile UI selection.
export function setupFirstPersonEnforcement() {
  let previousInside = true
  engine.addSystem(() => {
    const player = Transform.getOrNull(engine.PlayerEntity)
    if (!player) return
    const inside = isInsideOutpost(player.position)
    clientState.insideOutpost = inside
    if (inside !== previousInside) {
      previousInside = inside
      clientState.scopeToggled = false
      PointerLock.createOrReplace(engine.CameraEntity, { isPointerLocked: !inside })
    }
    if (clientState.isMobile) {
      const wanted = clientState.mobileThirdPerson ? CameraType.CT_THIRD_PERSON : CameraType.CT_FIRST_PERSON
      if (CameraMode.getOrNull(engine.CameraEntity)?.mode !== wanted) CameraMode.createOrReplace(engine.CameraEntity, { mode: wanted })
    }
  })
}

export function setMobileThirdPerson(enabled: boolean) {
  clientState.mobileThirdPerson = enabled
  CameraMode.createOrReplace(engine.CameraEntity, { mode: enabled ? CameraType.CT_THIRD_PERSON : CameraType.CT_FIRST_PERSON })
}

export function isFirstPersonCamera() {
  return CameraMode.getOrNull(engine.CameraEntity)?.mode !== CameraType.CT_THIRD_PERSON
}
