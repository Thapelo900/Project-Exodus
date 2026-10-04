import { InputAction, engine, pointerEventsSystem } from '@dcl/sdk/ecs'
import { clientState, notify } from './state'
import { requestMission, toggleInventory } from './setup'
import { interactViewModel } from './viewmodel'
import { playMissionTerminalOpenSound } from './audio'

let installed = false
let attempts = 0

function installInteractions() {
  if (installed || attempts++ > 120) return
  const shop = engine.getEntityOrNullByName('Outpost Shop Terminal')
  const board = engine.getEntityOrNullByName('Outpost Mission Board')
  const storage = engine.getEntityOrNullByName('Outpost Inventory Terminal')
  if (!shop || !board || !storage) return
  pointerEventsSystem.onPointerDown({ entity: shop, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open Trader Shop', maxDistance: 7 } }, () => {
    interactViewModel()
    clientState.shopOpen = true
    clientState.inventoryOpen = false
    notify('Outpost trader online', 2)
  })
  pointerEventsSystem.onPointerDown({ entity: board, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open Mission Terminal', maxDistance: 7 } }, () => { interactViewModel(); playMissionTerminalOpenSound(); clientState.missionTerminalOpen=true; clientState.shopOpen=false; clientState.inventoryOpen=false; notify('Mission Terminal online',2) })
  pointerEventsSystem.onPointerDown({ entity: storage, opts: { button: InputAction.IA_PRIMARY, hoverText: 'Open Gear Storage', maxDistance: 7 } }, () => { interactViewModel(); toggleInventory() })
  installed = true
}

export function setupWorldInteractions() {
  engine.addSystem(installInteractions)
}
