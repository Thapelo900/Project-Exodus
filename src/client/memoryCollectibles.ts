import { Entity, GltfContainer, Material, MeshRenderer, Transform, engine } from '@dcl/sdk/ecs'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { clientState, notify } from './state'
import { saveCampaignProgress } from './progressPersistence'
import { setStoryMusic, setArchiveLoadingSound } from './audio'
import { MatchState } from '../shared/schemas'
import { LOCATIONS } from '../shared/config'
import { GENERATED_MISSIONS } from '../shared/generatedMissions'
function currentMatch(){for(const [,m] of engine.getEntitiesWith(MatchState))return m;return undefined}

type Pickup={entity:Entity,aura:Entity,kind:'memory'|'ram',position:Vector3,collected:boolean,startedAt:number,phase:number}
const pickups:Pickup[]=[]
let spawnedMission=0

const MEMORY_MODEL='assets/Models/FINAL_Memory_Pack.glb'
const RAM_MODEL='assets/Models/FINAL_Data_RAM.glb'

function spawn(kind:'memory'|'ram',position:Vector3){
 const e=engine.addEntity()
 const base=kind==='memory'?.48:.68
 Transform.create(e,{position,scale:Vector3.create(base,base,base),rotation:Quaternion.Identity()})
 GltfContainer.create(e,{src:kind==='memory'?MEMORY_MODEL:RAM_MODEL,visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})

 // Soft emissive pickup aura. The supplied GLB remains the visible collectible.
 const aura=engine.addEntity()
 Transform.create(aura,{parent:e,position:Vector3.create(0,0.55,0),scale:Vector3.create(1.35,1.35,1.35)})
 MeshRenderer.setSphere(aura)
 const color=kind==='memory'?Color4.fromHexString('#ff285cff'):Color4.fromHexString('#19cfffff')
 Material.setPbrMaterial(aura,{albedoColor:Color4.create(color.r,color.g,color.b,.10),emissiveColor:color,emissiveIntensity:4.5,metallic:.1,roughness:.25,transparencyMode:2})
 pickups.push({entity:e,aura,kind,position,collected:false,startedAt:0,phase:Math.random()*Math.PI*2})
}

function resetForMission(mission:number){
 for(const p of pickups){engine.removeEntity(p.aura);engine.removeEntity(p.entity)}
 pickups.length=0;clientState.memoryPickupActive=false;clientState.memoryPickupProgress=0;clientState.memoryPickupKind='';clientState.missionMemoryFound=0;clientState.missionDataRamFound=0
 const generated=GENERATED_MISSIONS[Math.max(0,Math.min(99,clientState.missionAcceptedIndex>=0?clientState.missionAcceptedIndex:mission-1))]
 const loc=LOCATIONS[generated?.place??'outpost']
 // Pack/RAM 01 are fixed Outpost discoveries on the first story mission. If missed, later eligible missions recover them.
 const first=generated?.id===1
 const completedCount=clientState.completedGeneratedMissions.size
 const nextMemory=Array.from({length:10},(_,i)=>i+1).find(id=>completedCount>=id*5&&!clientState.collectedMemoryIds.has(id))
 const needMemory=nextMemory!==undefined
 const nextRam=Array.from({length:14},(_,i)=>i+1).find(id=>!clientState.collectedDataRamIds.has(id))
 const needRam=nextRam!==undefined
 if(needMemory)spawn('memory',Vector3.create(loc.x-3,1.25,loc.z+2))
 if(needRam)spawn('ram',first&&nextRam===1?Vector3.create(100,1.25,110):Vector3.create(loc.x+3,1.25,loc.z-2))
 if(needMemory||needRam)notify(needMemory?`ARCHIVE OBJECTIVE — Memory Pack ${String(nextMemory).padStart(2,'0')} available${needRam?' + Data RAM discovery':''}`:(first?'OUTPOST STORY OBJECTIVE — recover Data RAM 01':'RECOVERY OBJECTIVE — Data RAM discovery available in this mission'),5)
}

export function setupMemoryCollectibles(){engine.addSystem((dt)=>{
 const m=currentMatch(),mission=Math.max(1,m?.threatLevel??1)
 const collectibleMission=clientState.missionAcceptedIndex>=0?clientState.missionAcceptedIndex+1:mission
 if(collectibleMission!==spawnedMission){spawnedMission=collectibleMission;resetForMission(collectibleMission)}
 const pt=Transform.getOrNull(engine.PlayerEntity);if(!pt)return
 let active:Pickup|undefined
 const now=Date.now()
 for(const p of pickups){
  if(p.collected)continue
  const tr=Transform.getMutableOrNull(p.entity);if(!tr)continue
  const base=p.kind==='memory'?.48:.68
  const t=now/1000+p.phase
  const hover=Math.sin(t*2.2)*.16
  tr.position=Vector3.create(p.position.x,p.position.y+hover,p.position.z)
  // v124 final supplied models are authored upright. Keep them upright and spin only around Y.
  tr.rotation=Quaternion.fromEulerDegrees(0,(now/12+p.phase*40)%360,0)
  const pulse=base*(1+Math.sin(t*3.1)*.07)
  tr.scale=Vector3.create(pulse,pulse,pulse)
  const aura=Transform.getMutableOrNull(p.aura)
  if(aura){const glow=1.22+Math.sin(t*4.0)*.16;aura.scale=Vector3.create(glow,glow,glow);aura.rotation=Quaternion.fromEulerDegrees(0,(now/8)%360,0)}
  if(Vector3.distance(pt.position,p.position)<=2.7){active=p;break}
 }
 if(!active){for(const p of pickups)p.startedAt=0;setArchiveLoadingSound('',false);clientState.memoryPickupActive=false;clientState.memoryPickupProgress=0;clientState.memoryPickupKind='';return}
 if(!active.startedAt){active.startedAt=now;setArchiveLoadingSound(active.kind,true)}
 const progress=Math.min(1,(now-active.startedAt)/10000)
 clientState.memoryPickupActive=true;clientState.memoryPickupKind=active.kind;clientState.memoryPickupProgress=progress
 const tr=Transform.getMutable(active.entity)
 const base=active.kind==='memory'?.48:.68
 const collectPulse=base*(1+progress*.38+Math.sin(now/75)*.08)
 tr.scale=Vector3.create(collectPulse,collectPulse,collectPulse)
 const aura=Transform.getMutableOrNull(active.aura)
 if(aura){const collectGlow=1.3+progress*1.15+Math.sin(now/65)*.18;aura.scale=Vector3.create(collectGlow,collectGlow,collectGlow)}
 if(progress>=1){
  active.collected=true;setArchiveLoadingSound('',false);engine.removeEntity(active.aura);engine.removeEntity(active.entity)
  clientState.memoryPickupActive=false;clientState.memoryPickupProgress=0
  if(active.kind==='memory'){const completedCount=clientState.completedGeneratedMissions.size;const memoryId=Array.from({length:10},(_,i)=>i+1).find(id=>completedCount>=id*5&&!clientState.collectedMemoryIds.has(id));if(memoryId!==undefined){clientState.collectedMemoryIds.add(memoryId);clientState.memoryPacksCollected=clientState.collectedMemoryIds.size;clientState.missionMemoryFound+=1;clientState.memoryStoryIndex=memoryId;clientState.memoryStoryPage=0;clientState.memoryStoryOpen=true;setStoryMusic(true)}}else{const ramId=Array.from({length:14},(_,i)=>i+1).find(id=>!clientState.collectedDataRamIds.has(id));if(ramId!==undefined){clientState.collectedDataRamIds.add(ramId);clientState.dataRamsCollected=clientState.collectedDataRamIds.size;clientState.missionDataRamFound+=1;clientState.dataStoryIndex=ramId;clientState.dataStoryPage=0;clientState.dataStoryOpen=true;setStoryMusic(true)}}
  saveCampaignProgress(true)
  notify(active.kind==='memory'?'MEMORY PACK COLLECTED +1':'DATA RAM COLLECTED +1',4)
 }
})}
