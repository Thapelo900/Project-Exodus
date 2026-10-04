import { Schemas } from '@dcl/sdk/ecs'
import { registerMessages } from '@dcl/sdk/network'

export const ExodusMessages = {
  joinMatch: Schemas.Map({ mode: Schemas.String, displayName: Schemas.String, difficulty: Schemas.String }),
  leaveMatch: Schemas.Map({ reason: Schemas.String }),
  fireWeapon: Schemas.Map({ directionX: Schemas.Float, directionY: Schemas.Float, directionZ: Schemas.Float }),
  weaponFired: Schemas.Map({ playerId: Schemas.String, weapon: Schemas.String }),
  throwBomb: Schemas.Map({ directionX: Schemas.Float, directionY: Schemas.Float, directionZ: Schemas.Float }),
  buildStructure: Schemas.Map({ kind: Schemas.String, x: Schemas.Float, y: Schemas.Float, z: Schemas.Float, yaw: Schemas.Float }),
  selectWeapon: Schemas.Map({ weapon: Schemas.String }),
  reloadWeapon: Schemas.Map({ weapon: Schemas.String }),
  collectLoot: Schemas.Map({ lootId: Schemas.String }),
  useItem: Schemas.Map({ item: Schemas.String }),
  requestMission: Schemas.Map({ missionId: Schemas.String }),
  completeMission: Schemas.Map({ missionId: Schemas.String }),
  buySupply: Schemas.Map({ item: Schemas.String }),
  respawnPlayer: Schemas.Map({ choice: Schemas.String }),
  saveProgress: Schemas.Map({ payload: Schemas.String }),
  progressLoaded: Schemas.Map({ payload: Schemas.String }),
  serverEvent: Schemas.Map({ kind: Schemas.String, text: Schemas.String }),
  actionResult: Schemas.Map({ action: Schemas.String, ok: Schemas.Boolean, detail: Schemas.String })
}

export const room = registerMessages(ExodusMessages)
