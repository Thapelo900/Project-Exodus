import { AudioSource, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import type { WeaponId } from '../shared/config'

const A='assets/Audio/User/'
let ambientEntity:Entity|undefined, musicEntity:Entity|undefined, outpostMusicEntity:Entity|undefined, storyMusicEntity:Entity|undefined, mutantAlertEntity:Entity|undefined
const fxPool:Entity[]=[]
let fxCursor=0
function make(ref:Entity|undefined,clip:string,parent=true){if(ref)return ref;const e=engine.addEntity();Transform.create(e,{position:Vector3.Zero(),...(parent?{parent:engine.PlayerEntity}:{})});AudioSource.create(e,{audioClipUrl:clip,playing:false,loop:false,volume:1});return e}
function fx(){while(fxPool.length<16)fxPool.push(make(undefined,A+'rifle-shot.mp3'));const e=fxPool[fxCursor++%fxPool.length];return AudioSource.getMutable(e)}
// Pooled one-shot sources let rapid clicks/automatic fire overlap instead of cutting off the previous gunshot.
function play(url:string,volume=1){const a=fx();a.audioClipUrl=url;a.volume=volume;a.loop=false;a.currentTime=0;a.playing=true}
function loop(ref:'ambient'|'music'|'outpost',url:string,playing:boolean,volume:number){let e:Entity;if(ref==='ambient'){ambientEntity=make(ambientEntity,url);e=ambientEntity}else if(ref==='outpost'){outpostMusicEntity=make(outpostMusicEntity,url);e=outpostMusicEntity}else{musicEntity=make(musicEntity,url);e=musicEntity}const a=AudioSource.getMutable(e);if(a.audioClipUrl!==url)a.audioClipUrl=url;a.loop=true;a.volume=volume;if(a.playing!==playing){a.currentTime=0;a.playing=playing}}
export function playShotSound(w:WeaponId){play(A+(w==='scattergun'?'shotgun-shot.mp3':w==='rail-pistol'?'pistol-shot.mp3':'rifle-shot.mp3'),.9)}
export function playReloadSound(w:WeaponId){play(A+(w==='scattergun'?'shotgun-reload.mp3':w==='rail-pistol'?'pistol-reload.mp3':'rifle-reload.mp3'),.88)}
export function playBombExplosionSound(){play(A+'bomb-explosion.mp3',1)}
export function playEnemyBigExplosionSound(){play(A+'enemy-big-explosion.mp3',.5)}
export function playMutantAcidAttackSound(){play(A+'mutant-acid-attack.mp3',.45)}
export function playEnemyMissileFireSound(){play(A+'enemy-missile-fire.mp3',.45)}
export function playMutantAlertSound(){
  // One global Mutant/King aggro voice. Never layer multiple copies.
  mutantAlertEntity=make(mutantAlertEntity,A+'mutant-alert.mp3')
  const a=AudioSource.getMutable(mutantAlertEntity)
  if(a.playing)return
  a.audioClipUrl=A+'mutant-alert.mp3';a.volume=.45;a.loop=false;a.currentTime=0;a.playing=true
}
export function setDroneFlightSound(on:boolean){loop('ambient',A+'drone-flight.mp3',on,.24)}
// Battle soundtrack is deliberately very quiet, per design request.
export function setBattleMusic(on:boolean){loop('music',A+'battle-music.mp3',on,.075)}

export function playWaterSplashSound(){play(A+'water-splash.mp3',.78)}
export function playUiHoverSound(){play(A+'ui-hover.wav',.28)}
export function playUiSelectSound(){play(A+'ui-select.wav',.5)}

export function setOutpostMusic(on:boolean){loop('outpost',A+'outpost-music.mp3',on,.16)}
export function setStoryMusic(on:boolean){
  storyMusicEntity=make(storyMusicEntity,A+'battle-music.mp3')
  const a=AudioSource.getMutable(storyMusicEntity)
  a.audioClipUrl=A+'battle-music.mp3';a.loop=true;a.volume=.075
  if(a.playing!==on){a.currentTime=0;a.playing=on}
}


// v144 user-supplied contextual audio
let runningEntity:Entity|undefined, afterRunningEntity:Entity|undefined, archiveLoadingEntity:Entity|undefined
export function setRunningBreathing(on:boolean){
  // Movement breathing is listener-attached so it is always audible to the local player.
  if(!runningEntity){runningEntity=engine.addEntity();Transform.create(runningEntity,{position:Vector3.Zero(),parent:engine.CameraEntity});AudioSource.create(runningEntity,{audioClipUrl:A+'player-running-breathing.mp3',playing:false,loop:true,volume:.34})}
  const a=AudioSource.getMutable(runningEntity);a.audioClipUrl=A+'player-running-breathing.mp3';a.loop=true;a.volume=.34
  if(a.playing!==on){a.currentTime=0;a.playing=on}
}
export function playAfterRunningSound(){
  if(!afterRunningEntity){afterRunningEntity=engine.addEntity();Transform.create(afterRunningEntity,{position:Vector3.Zero(),parent:engine.CameraEntity});AudioSource.create(afterRunningEntity,{audioClipUrl:A+'player-after-running.mp3',playing:false,loop:false,volume:.30})}
  const a=AudioSource.getMutable(afterRunningEntity);a.audioClipUrl=A+'player-after-running.mp3';a.volume=.30;a.loop=false;a.currentTime=0;a.playing=true
}
export function playMissionTerminalOpenSound(){play(A+'mission-terminal-open.mp3',1)}
export function setArchiveLoadingSound(kind:'memory'|'ram'|'',on:boolean){
  if(!kind){if(archiveLoadingEntity){AudioSource.getMutable(archiveLoadingEntity).playing=false}return}
  const clip=kind==='memory'?'memory-pack-loading.mp3':'data-ram-loading.mp3'
  archiveLoadingEntity=make(archiveLoadingEntity,A+clip)
  const a=AudioSource.getMutable(archiveLoadingEntity);a.audioClipUrl=A+clip;a.loop=false;a.volume=.62
  if(on){a.currentTime=0;a.playing=true}else if(a.playing)a.playing=false
}
export function playMutantAttackHitSound(){play(A+'mutant-attack-hit.mp3',.76)}
export function playPlayerHurtSound(){play(A+'player-hurt.mp3',.82)}
