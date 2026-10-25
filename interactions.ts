import { InputAction, engine, pointerEventsSystem } from '@dcl/sdk/ecs'
import { terminalInteractionTargets } from './terrainFixes'
import { clientState, notify } from './state'
import { toggleInventory } from './setup'
import { interactViewModel } from './viewmodel'
import { playMissionTerminalOpenSound } from './audio'

// v35: bind directly to the rendered pickup objects, not the hidden legacy entities.
// The old entities lose their MeshRenderer in terrainFixes.ts and cannot be clicked.
const registered = new Map<string,number>()
let lastOpenAt = 0
function guardOpen(action:()=>void){const now=Date.now();if(now-lastOpenAt<350)return;lastOpenAt=now;action()}

function installInteractions() {
 const definitions = [
  { key:'shop', entity:terminalInteractionTargets.shop, label:'Open Trader Shop', open:()=>{
    interactViewModel(); clientState.shopOpen=true; clientState.missionTerminalOpen=false;
    clientState.badgesOpen=false; clientState.inventoryOpen=false; notify('Outpost trader online',2)
  }},
  { key:'mission', entity:terminalInteractionTargets.mission, label:'Open Mission Terminal', open:()=>{
    interactViewModel(); playMissionTerminalOpenSound(); clientState.missionTerminalOpen=true;
    clientState.shopOpen=false; clientState.badgesOpen=false; clientState.inventoryOpen=false;
    notify('Mission Terminal online',2)
  }},
  { key:'gear', entity:terminalInteractionTargets.gear, label:'Open Gear Storage', open:()=>{
    interactViewModel(); clientState.shopOpen=false; clientState.missionTerminalOpen=false;
    clientState.badgesOpen=false; toggleInventory()
  }}
 ] as const
 for (const item of definitions) {
   if (item.entity===undefined || registered.get(item.key)===item.entity) continue
   // Match the working Badge Terminal: IA_PRIMARY triggers the standard E interaction.
   pointerEventsSystem.onPointerDown({entity:item.entity,opts:{button:InputAction.IA_PRIMARY,hoverText:item.label,maxDistance:9}},()=>guardOpen(item.open))
   // Mouse pointer/touch interaction is also supported in unlocked pointer mode.
   pointerEventsSystem.onPointerDown({entity:item.entity,opts:{button:InputAction.IA_POINTER,hoverText:item.label,maxDistance:9}},()=>guardOpen(item.open))
   registered.set(item.key,item.entity)
 }
 // Keep watching for targets recreated by scene reloads; register each entity only once.
}

export function setupWorldInteractions(){engine.addSystem(installInteractions)}
