import { engine } from '@dcl/sdk/ecs'
import { room } from '../shared/messages'
import { clientState } from './state'

let lastPayload=''
let elapsed=0
let installed=false

export function campaignProgressPayload(){
  return JSON.stringify({
    completedGeneratedMissions:[...clientState.completedGeneratedMissions].sort((a,b)=>a-b),
    collectedMemoryIds:[...clientState.collectedMemoryIds].sort((a,b)=>a-b),
    collectedDataRamIds:[...clientState.collectedDataRamIds].sort((a,b)=>a-b),
    missionAcceptedIndex:clientState.missionAcceptedIndex,
    missionMemoryFound:clientState.missionMemoryFound,
    missionDataRamFound:clientState.missionDataRamFound
  })
}

export function saveCampaignProgress(force=false){
  if(clientState.localSolo || !clientState.joined)return
  const payload=campaignProgressPayload()
  if(!force&&payload===lastPayload)return
  lastPayload=payload
  void room.send('saveProgress',{payload})
}

export function setupCampaignPersistence(){
  if(installed)return
  installed=true
  room.onMessage('progressLoaded',(data)=>{
    try{
      const p=JSON.parse(data.payload||'{}')
      clientState.completedGeneratedMissions=new Set(Array.isArray(p.completedGeneratedMissions)?p.completedGeneratedMissions.map(Number):[])
      clientState.collectedMemoryIds=new Set(Array.isArray(p.collectedMemoryIds)?p.collectedMemoryIds.map(Number):[])
      clientState.collectedDataRamIds=new Set(Array.isArray(p.collectedDataRamIds)?p.collectedDataRamIds.map(Number):[])
      clientState.memoryPacksCollected=clientState.collectedMemoryIds.size
      clientState.dataRamsCollected=clientState.collectedDataRamIds.size
      clientState.missionAcceptedIndex=Math.max(-1,Math.min(99,Number(p.missionAcceptedIndex??-1)))
      clientState.missionMemoryFound=Math.max(0,Number(p.missionMemoryFound??0))
      clientState.missionDataRamFound=Math.max(0,Number(p.missionDataRamFound??0))
      lastPayload=campaignProgressPayload()
    }catch(e){console.error('[CLIENT] Could not restore campaign progress',e)}
  })
  engine.addSystem((dt)=>{
    elapsed+=dt
    if(elapsed<8)return
    elapsed=0
    saveCampaignProgress(false)
  })
}
