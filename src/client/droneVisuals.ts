import { Entity, GltfContainer, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { BotState } from '../shared/schemas'
import { clientState } from './state'

type DroneVisual = { root: Entity; parts: Entity[] }
const visuals = new Map<string, DroneVisual>()

function part(parent: Entity, position: Vector3, scale: Vector3, color: string, mesh: 'box'|'cylinder'|'sphere'='box', emissive=false, rotation=Quaternion.Identity()) {
  const entity = engine.addEntity()
  Transform.create(entity, { position, scale, rotation, parent })
  if (mesh === 'sphere') MeshRenderer.setSphere(entity)
  else if (mesh === 'cylinder') MeshRenderer.setCylinder(entity, .5, .5)
  else MeshRenderer.setBox(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.fromHexString(color),
    emissiveColor: emissive ? Color4.fromHexString(color) : undefined,
    emissiveIntensity: emissive ? 2.5 : 0,
    metallic: .55,
    roughness: .48
  })
  return entity
}

function createDroneVisual(root: Entity, variant: string): DroneVisual {
  const model = engine.addEntity()
  // v52: user-supplied drone model. Keep the BotState/root entity unchanged so AI, shooting,
  // collision, health and networking continue to use the existing gameplay entity.
  Transform.create(model, { position: Vector3.create(0, -0.35, 0), scale: Vector3.create(1.15, 1.15, 1.15), rotation: Quaternion.Identity(), parent: root })
  GltfContainer.create(model, { src: 'assets/Models/Drones.glb' })
  return { root, parts: [model] }
}

function removeVisual(id: string) {
  const visual = visuals.get(id)
  if (!visual) return
  for (const entity of visual.parts) engine.removeEntity(entity)
  visuals.delete(id)
}

function droneVisualSystem() {
  // Solo preview already authors its drone geometry locally. This system is specifically
  // for synchronized/published matches, where only BotState + Transform need to cross the network.
  if (clientState.localSolo) {
    for (const id of [...visuals.keys()]) removeVisual(id)
    return
  }
  const seen = new Set<string>()
  for (const [entity, bot] of engine.getEntitiesWith(BotState, Transform)) {
    if (bot.family !== 'drone') continue
    seen.add(bot.botId)
    if (bot.active && bot.hp > 0) {
      if (!visuals.has(bot.botId)) visuals.set(bot.botId, createDroneVisual(entity, bot.variant))
    } else removeVisual(bot.botId)
  }
  for (const id of [...visuals.keys()]) if (!seen.has(id)) removeVisual(id)
}

export function setupDroneVisuals() { engine.addSystem(droneVisualSystem) }
