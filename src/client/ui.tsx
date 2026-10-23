import ReactEcs, { Button, Label, ReactEcsRenderer, UiEntity } from '@dcl/sdk/react-ecs'
import { Color4 } from '@dcl/sdk/math'
import { PlayerIdentityData, Transform, engine } from '@dcl/sdk/ecs'
import { BotState } from '../shared/schemas'
import { LOCATIONS, MISSIONS, WEAPONS, type Difficulty, type GameMode, type MissionId, type WeaponId } from '../shared/config'
import { GENERATED_MISSIONS } from '../shared/generatedMissions'
import { clientState, isServerAlive } from './state'
import { playUiHoverSound, playUiSelectSound, setStoryMusic } from './audio'
import { finishIntroCinematic } from './cinematic'
import { saveCampaignProgress } from './progressPersistence'
import { buySupply, deployBuild, fireWeapon, getLocalPlayerState, getMatchState, reloadWeapon, requestJoin, requestMission, requestRespawn, selectBuild, selectWeapon, throwBomb, toggleInventory, toggleMap, toggleScope, useInventoryItem } from './setup'

const c={panel:Color4.fromHexString('#080b0ee8'),soft:Color4.fromHexString('#171c21e6'),line:Color4.fromHexString('#dce4eaff'),white:Color4.fromHexString('#f3f6f7ff'),muted:Color4.fromHexString('#a7b0b6ff'),red:Color4.fromHexString('#e63232ff'),cyan:Color4.fromHexString('#24bce8ff'),blue:Color4.fromHexString('#2998d6ff'),amber:Color4.fromHexString('#f1ad35ff'),green:Color4.fromHexString('#46b86bff'),water:Color4.fromHexString('#55bdeaff')}
const panel={color:c.panel}
const border={borderColor:c.line,borderWidth:1}
const iconPath=(name:string)=>`Images/ui/${name}.png`
function icon(name:string,size=24){return <UiEntity uiTransform={{width:size,height:size,pointerFilter:'none'}} uiBackground={{texture:{src:iconPath(name)},textureMode:'stretch'}}/>}
function assetIcon(src:string,size=24){return <UiEntity uiTransform={{width:size,height:size,pointerFilter:'none'}} uiBackground={{texture:{src},textureMode:'stretch'}}/>}
function time(ends:number){if(!ends)return'15:00';const s=Math.max(0,Math.ceil((ends-Date.now())/1000));return`${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`}
function bar(iconName:string,label:string,value:number,color:Color4){const p=Math.max(0,Math.min(100,value));return <UiEntity uiTransform={{width:clientState.isMobile?184:230,height:clientState.isMobile?22:27,flexDirection:'row',alignItems:'center'}}>{icon(iconName,clientState.isMobile?16:21)}<Label value={label} fontSize={13} color={c.white} uiTransform={{width:clientState.isMobile?49:67,height:24,margin:'0 0 0 5px'}}/><UiEntity uiTransform={{width:clientState.isMobile?70:102,height:12}} uiBackground={{color:Color4.fromHexString('#30353aff')}}><UiEntity uiTransform={{width:`${p}%`,height:12}} uiBackground={{color}}/></UiEntity><Label value={`${Math.round(value)}`} fontSize={13} color={c.white} uiTransform={{width:clientState.isMobile?23:32,height:24,margin:'0 0 0 5px'}}/></UiEntity>}
function cardinal(deg:number){return['N','NE','E','SE','S','SW','W','NW'][Math.round(deg/45)%8]}
// v167: Big Map + Mini Map keep the v166 facing calibration, but reverse the turn direction.
// DCL heading increases opposite to the pre-rendered arrow frame order: at the verified Outpost-facing
// bridge heading this still resolves to the same correct frame, while avatar-left now becomes map-left.
function playerMapArrow(){return ((-Math.round(clientState.heading/45)+4)%8+8)%8}

function compass(){const h=Math.round(clientState.heading);const ticks=[-60,-30,0,30,60].map(o=>(h+o+360)%360);return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:16},margin:'0 0 0 -280px',width:560,height:52,flexDirection:'column',alignItems:'center',...border}} uiBackground={panel}><UiEntity uiTransform={{width:540,height:28,flexDirection:'row',justifyContent:'space-between'}}>{ticks.map((v,i)=><Label value={i===2?`${cardinal(v)}  ${v}`:`${cardinal(v)} ${v}`} fontSize={i===2?17:13} color={i===2?c.red:c.muted} uiTransform={{width:100,height:28}}/>)}</UiEntity><UiEntity uiTransform={{width:8,height:8}} uiBackground={{color:c.red}}/></UiEntity>}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value))}
function mapBadge(id:string,name:string,x:number,z:number,color:Color4,mapWidth=825,mapHeight=686){const width=name.length>11?170:136,left=x/480*mapWidth-width/2,top=(480-z)/480*mapHeight-10;return <UiEntity uiTransform={{positionType:'absolute',position:{left,top},width,height:30,padding:3,flexDirection:'row',alignItems:'center',borderColor:color,borderWidth:2,zIndex:3}} uiBackground={panel}>{icon(id,22)}<Label value={name} fontSize={11} color={c.white} uiTransform={{width:width-30,height:24,margin:'0 0 0 3px'}}/></UiEntity>}
function enemyDotColor(bot:any){return bot.variant==='king-mutant'?c.red:bot.family==='mutant'?c.green:Color4.fromHexString('#080808ff')}
function worldEnemyDots(mapWidth:number,mapHeight:number,mini=false,self?:any,zoom=1){const out:any[]=[];for(const[,b,t]of engine.getEntitiesWith(BotState,Transform)){if(!b.active||b.hp<=0)continue;let left:number,top:number;if(mini&&self){left=mapWidth/2+(t.position.x-self.position.x)/480*(mapWidth*zoom)-4;top=mapHeight/2+(t.position.z-self.position.z)/480*(mapHeight*zoom)-4}else{left=t.position.x/480*mapWidth-4;top=t.position.z/480*mapHeight-4}if(left<-8||top<-8||left>mapWidth||top>mapHeight)continue;out.push(<UiEntity uiTransform={{positionType:'absolute',position:{left,top},width:9,height:9,borderColor:Color4.fromHexString('#ffffffff'),borderWidth:1,zIndex:5,pointerFilter:'none'}} uiBackground={{color:enemyDotColor(b)}}/>)}return out}
function worldPlayerDots(mapWidth:number,mapHeight:number,mini=false,self?:any,zoom=1){if(clientState.selectedMode==='pvp'||clientState.localSolo||!clientState.joined)return null;const out:any[]=[];for(const[,identity,t]of engine.getEntitiesWith(PlayerIdentityData,Transform)){if(!identity.address)continue;let left:number,top:number;if(mini&&self){left=mapWidth/2+(t.position.x-self.position.x)/480*(mapWidth*zoom)-5;top=mapHeight/2+(t.position.z-self.position.z)/480*(mapHeight*zoom)-5}else{left=t.position.x/480*mapWidth-5;top=t.position.z/480*mapHeight-5}if(left<-10||top<-10||left>mapWidth||top>mapHeight)continue;out.push(<UiEntity uiTransform={{positionType:'absolute',position:{left,top},width:11,height:11,borderColor:c.cyan,borderWidth:2,zIndex:6,pointerFilter:'none'}} uiBackground={{color:Color4.fromHexString('#ffffffff')}}/>)}return out}

function minimap(){
  if(clientState.isMobile&&(clientState.missionTerminalOpen||clientState.inventoryOpen||clientState.shopOpen||clientState.badgesOpen||clientState.mapOpen))return null
  const mapWidth=260,mapHeight=216,t=Transform.getOrNull(engine.PlayerEntity)
  if(clientState.insideOutpost){
    const left=t?clamp((t.position.x-52)/88*mapWidth-13,1,mapWidth-27):117
    const top=t?clamp((156-t.position.z)/88*mapHeight-13,1,mapHeight-27):95
    const arrow=playerMapArrow()
    const rooms=[['outpost','ATRIUM',96,112],['city','MISSION',104,101.75],['badge','BADGES',91.5,102.5],['camp','TRADER',105.5,118.25],['rifle','STORAGE',88,119.75],['arena','EXIT',96,126]] as const
    const nearest=t?rooms.reduce((best,current)=>Math.hypot(t.position.x-current[2],t.position.z-current[3])<Math.hypot(t.position.x-best[2],t.position.z-best[3])?current:best):rooms[0]
    return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:18,top:62}:{right:18,bottom:18},width:clientState.isMobile?215:260,height:clientState.isMobile?177:216,overflow:'hidden',borderColor:c.cyan,borderWidth:2,zIndex:8}} uiBackground={{texture:{src:'Images/outpost-interior-map.png'},textureMode:'stretch'}} onMouseDown={toggleMap}>
      <UiEntity uiTransform={{positionType:'absolute',position:{left,top},width:27,height:27,zIndex:7}} uiBackground={{texture:{src:iconPath(`player-arrow-${arrow}`)},textureMode:'stretch'}}/>
      <Label value={`OUTPOST L1  ${nearest[1]}  |  CLICK MAP`} fontSize={10} color={c.cyan} uiTransform={{positionType:'absolute',position:{left:0,bottom:0},width:clientState.isMobile?215:260,height:26,padding:5,zIndex:9}} uiBackground={panel}/>
    </UiEntity>
  }
  // The minimap is literally the same full-map image and coordinate transform, only clipped around the player.
  // This avoids a second UV coordinate system drifting away from the verified large map.
  const zoom=3.7,fullW=mapWidth*zoom,fullH=mapHeight*zoom,u=t?clamp(t.position.x/480,0,1):.5,v=t?clamp(t.position.z/480,0,1):.5
  const imageLeft=mapWidth/2-u*fullW,imageTop=mapHeight/2-v*fullH
  const places=Object.entries(LOCATIONS),nearest=t?places.reduce((best,current)=>Math.hypot(t.position.x-current[1].x,t.position.z-current[1].z)<Math.hypot(t.position.x-best[1].x,t.position.z-best[1].z)?current:best):places[0]
  const venue=t&&Math.hypot(t.position.x-nearest[1].x,t.position.z-nearest[1].z)<78?nearest[1].name.toUpperCase():'WILDERNESS'
  return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:18,top:62}:{right:24,bottom:110},width:clientState.isMobile?215:248,height:clientState.isMobile?177:204,overflow:'hidden',borderColor:c.line,borderWidth:2,zIndex:8}} onMouseDown={toggleMap}>
      <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:mapWidth,height:mapHeight,zIndex:1,pointerFilter:'none'}}><UiEntity uiTransform={{positionType:'absolute',position:{left:imageLeft,top:imageTop},width:fullW,height:fullH}} uiBackground={{texture:{src:'Images/project-exodus-minimap-source.jpg'},textureMode:'stretch'}}/></UiEntity>
      {worldEnemyDots(mapWidth,mapHeight,true,t,zoom)}{worldPlayerDots(mapWidth,mapHeight,true,t,zoom)}
      <UiEntity uiTransform={{positionType:'absolute',position:{left:mapWidth/2-14,top:mapHeight/2-14},width:28,height:28,zIndex:7}} uiBackground={{texture:{src:iconPath(`player-arrow-${playerMapArrow()}`)},textureMode:'stretch'}}/>
      <Label value={`${venue}  |  CLICK FOR FULL MAP`} fontSize={10} color={c.cyan} uiTransform={{positionType:'absolute',position:{left:0,bottom:0},width:clientState.isMobile?215:260,height:28,padding:6,zIndex:9}} uiBackground={panel}/>
  </UiEntity>
}
function fullMap(){
  if(!clientState.mapOpen)return null
  const mapWidth=clientState.isMobile?560:825,mapHeight=clientState.isMobile?405:686,t=Transform.getOrNull(engine.PlayerEntity),left=t?clamp(t.position.x/480*mapWidth-14,1,mapWidth-29):398,top=t?clamp(t.position.z/480*mapHeight-14,1,mapHeight-29):329,arrow=playerMapArrow()
  if(clientState.insideOutpost){
    const roomLeft=t?clamp((t.position.x-52)/88*mapWidth-15,1,mapWidth-31):398,roomTop=t?clamp((156-t.position.z)/88*mapHeight-15,1,mapHeight-31):329
    const rooms=[['outpost','COMMAND ATRIUM',96,112],['city','MISSION OPERATIONS',104,101.75],['badge','BADGE COLLECTION',91.5,102.5],['camp','TRADER AND SUPPLIES',105.5,118.25],['rifle','GEAR STORAGE',88,119.75],['arena','NORTH EXIT',96,126]] as const
    return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:'50%'},margin:clientState.isMobile?'-247px 0 0 -316px':'-390px 0 0 -452px',width:clientState.isMobile?632:904,height:clientState.isMobile?494:780,padding:clientState.isMobile?8:16,flexDirection:'column',alignItems:'center',borderWidth:0,zIndex:40}} uiBackground={{color:Color4.fromHexString('#07090cf2')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:clientState.isMobile?632:904,height:clientState.isMobile?494:780,zIndex:45,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/exodus-expanded/big-map-frame.png'},textureMode:'stretch'}}/>
      <UiEntity uiTransform={{width:clientState.isMobile?606:872,height:45,flexDirection:'row',justifyContent:'space-between'}}><Label value="PROJECT EXODUS  OUTPOST INTERIOR L1" fontSize={clientState.isMobile?18:24} color={c.white} uiTransform={{width:clientState.isMobile?450:650,height:40}}/><Button value="CLOSE" fontSize={13} color={c.white} uiTransform={{width:clientState.isMobile?92:110,height:36,...border}} uiBackground={{color:c.red}} onMouseDown={toggleMap}/></UiEntity>
      <UiEntity uiTransform={{width:mapWidth,height:mapHeight,positionType:'relative',overflow:'hidden',borderColor:c.red,borderWidth:3,borderRadius:12}} uiBackground={{texture:{src:'Images/outpost-interior-map.png'},textureMode:'stretch'}}>
        <Label value="N\nW  +  E\nS" fontSize={13} color={c.white} uiTransform={{positionType:'absolute',position:{left:10,top:10},width:72,height:66,padding:5,zIndex:4}} uiBackground={panel}/>
        <UiEntity uiTransform={{positionType:'absolute',position:{left:roomLeft,top:roomTop},width:31,height:31,zIndex:6}} uiBackground={{texture:{src:iconPath(`player-arrow-${arrow}`)},textureMode:'stretch'}}/>
      </UiEntity>
    </UiEntity>
  }
  // Full map always shows the complete Project Exodus world. Only the mini-map follows/zooms the player.
  const worldLeft=t?clamp(t.position.x/480*mapWidth-16,1,mapWidth-33):mapWidth/2-16
  const worldTop=t?clamp(t.position.z/480*mapHeight-16,1,mapHeight-33):mapHeight/2-16
  return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:'50%'},margin:clientState.isMobile?'-247px 0 0 -316px':'-390px 0 0 -452px',width:clientState.isMobile?632:904,height:clientState.isMobile?494:780,padding:clientState.isMobile?8:16,flexDirection:'column',alignItems:'center',borderWidth:0,zIndex:40}} uiBackground={{color:Color4.fromHexString('#07090cf2')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:clientState.isMobile?632:904,height:clientState.isMobile?494:780,zIndex:45,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/exodus-expanded/big-map-frame.png'},textureMode:'stretch'}}/>
    <UiEntity uiTransform={{width:clientState.isMobile?606:872,height:45,flexDirection:'row',justifyContent:'space-between'}}><Label value="PROJECT EXODUS · ISLAND MAP" fontSize={clientState.isMobile?18:24} color={c.white} uiTransform={{width:clientState.isMobile?450:650,height:40}}/><Button value="CLOSE" fontSize={13} color={c.white} uiTransform={{width:clientState.isMobile?92:110,height:36,...border}} uiBackground={{color:c.red}} onMouseDown={toggleMap}/></UiEntity>
    <UiEntity uiTransform={{width:mapWidth,height:mapHeight,positionType:'relative',overflow:'hidden',borderColor:c.red,borderWidth:3,borderRadius:12}} uiBackground={{texture:{src:'Images/project-exodus-minimap-source.jpg'},textureMode:'stretch'}}>
      {worldEnemyDots(mapWidth,mapHeight)}{worldPlayerDots(mapWidth,mapHeight)}
      <UiEntity uiTransform={{positionType:'absolute',position:{left:worldLeft,top:worldTop},width:32,height:32,zIndex:6}} uiBackground={{texture:{src:iconPath(`player-arrow-${arrow}`)},textureMode:'stretch'}}/>
      <Label value="N" fontSize={18} color={c.white} uiTransform={{positionType:'absolute',position:{left:mapWidth/2-12,top:8},width:24,height:24,zIndex:7}}/>
    </UiEntity>
  </UiEntity>
}

function enemyCounts(){let mutants=0,drones=0,kings=0;for(const [,bot] of engine.getEntitiesWith(BotState)){if(!bot.active||bot.hp<=0)continue;if(bot.variant==='king-mutant')kings++;else if(bot.family==='mutant')mutants++;else if(bot.family==='drone')drones++;}return {mutants,drones,kings}}
function mission(){const match=getMatchState(),counts=enemyCounts(),i=Math.max(0,Math.min(GENERATED_MISSIONS.length-1,clientState.missionAcceptedIndex>=0?clientState.missionAcceptedIndex:0)),gm=GENERATED_MISSIONS[i],loc=(LOCATIONS as any)[gm.place],complete=(match?.announcement??'').includes('COMPLETE');return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:18,top:130}:{left:16,top:258},width:clientState.isMobile?293:318,height:clientState.isMobile?188:198,padding:clientState.isMobile?7:10,flexDirection:'column',borderColor:c.red,borderWidth:{left:2,top:1,right:1,bottom:1}}} uiBackground={panel}><Label value={`MISSION ${String(gm.id).padStart(3,'0')} — ${gm.name}`} fontSize={clientState.isMobile?12:16} color={c.white} uiTransform={{width:clientState.isMobile?269:308,height:clientState.isMobile?27:30}}/><Label value={complete?'MISSION COMPLETE':clientState.isMobile?`${gm.objective}  •  ${gm.difficulty}\n${loc.name}`:`${gm.objective} • ${gm.difficulty} • ${loc.name}`} fontSize={complete?20:clientState.isMobile?11:13} color={complete?c.green:c.cyan} uiTransform={{width:clientState.isMobile?269:308,height:clientState.isMobile?39:28}}/><Label value={gm.brief} fontSize={clientState.isMobile?10:11} color={c.white} uiTransform={{width:clientState.isMobile?269:308,height:clientState.isMobile?54:70}}/><Label value={`HOSTILES  M ${counts.mutants}  D ${counts.drones}  K ${counts.kings}`} fontSize={clientState.isMobile?11:14} color={c.red} uiTransform={{width:clientState.isMobile?269:308,height:clientState.isMobile?24:28}}/><Label value={`Memory ${clientState.missionMemoryFound}/${gm.memory} • Data RAM ${clientState.missionDataRamFound}/${gm.ram}`} fontSize={clientState.isMobile?10:11} color={c.muted} uiTransform={{width:clientState.isMobile?269:308,height:clientState.isMobile?22:24}}/></UiEntity>}

function missionCompleteBanner(){const m=getMatchState(),num=Math.max(1,m?.threatLevel??1);if(!(m?.announcement??'').includes(`MISSION ${num} COMPLETE`))return null;return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:'42%'},margin:'0 0 0 -430px',width:860,height:150,padding:'28px 22px 18px 22px',alignItems:'center',justifyContent:'center',borderWidth:0,zIndex:80}} uiBackground={{color:Color4.fromHexString('#08090bf5')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:860,height:150,zIndex:81,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/exodus-expanded/mission-complete-frame.png'},textureMode:'stretch'}}/><Label value={`MISSION ${num} COMPLETE`} fontSize={48} color={c.red} uiTransform={{width:820,height:90}}/></UiEntity>}


function stat(iconName:string,text:string,width:number,color=c.white){return <UiEntity uiTransform={{width,height:32,flexDirection:'row',alignItems:'center'}}>{icon(iconName,25)}<Label value={text} fontSize={14} color={color} uiTransform={{width:width-29,height:30,margin:'0 0 0 4px'}}/></UiEntity>}
function matchInfo(){const m=getMatchState(),p=getLocalPlayerState();return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:18,top:18}:{right:24,top:20},width:clientState.isMobile?355:418,height:clientState.isMobile?37:42,padding:6,flexDirection:'row',justifyContent:'space-between',borderWidth:0,borderRadius:12}} uiBackground={panel}>{stat('players',`${m?.alivePlayers??0}`,74)}{stat('skull',`${p?.kills??0}`,68)}<Label value={`THREAT ${m?.threatLevel??0}`} fontSize={14} color={(m?.threatLevel??0)>0?c.red:c.white} uiTransform={{width:110,height:30}}/>{stat('clock',time(m?.endsAt??0),112)}</UiEntity>}
function survival(){const p=getLocalPlayerState();return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:245,top:62}:{right:18,top:78},width:clientState.isMobile?192:252,height:clientState.isMobile?43:92,padding:clientState.isMobile?'3px 4px 1px 4px':'14px 12px 8px 12px',flexDirection:'column',...border}} uiBackground={panel}>{bar('health','HEALTH',p?.hp??100,c.red)}{bar('stamina','STAMINA',p?.stamina??100,c.blue)}</UiEntity>}
function ammo(){const p=getLocalPlayerState();const w=WEAPONS[(p?.equippedWeapon as WeaponId)||'pulse-rifle'],mag=p?.[w.magazineField]??0,reserve=p?.[w.ammoField]??0,status=mag>0?w.fireMode:reserve>0?'RELOAD':'FIND\nAMMO',weaponIcon=w.id==='rail-pistol'?'pistol':w.id==='scattergun'?'shotgun':'rifle';return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:245,top:116}:{right:18,top:166},width:clientState.isMobile?192:252,height:clientState.isMobile?72:122,padding:'8px 10px',flexDirection:'column',borderWidth:0,borderRadius:12}} uiBackground={panel}><UiEntity uiTransform={{width:clientState.isMobile?172:232,height:48,flexDirection:'row',alignItems:'center'}}><UiEntity uiTransform={{width:clientState.isMobile?62:92,height:48,positionType:'relative'}}><UiEntity uiTransform={{positionType:'absolute',position:{left:9,top:11},width:clientState.isMobile?59:74,height:42,pointerFilter:'none'}} uiBackground={{texture:{src:`Images/ui/weapon-${weaponIcon}.png`},textureMode:'stretch'}}/></UiEntity><Label value={`${mag} | ${reserve}`} fontSize={clientState.isMobile?17:20} textAlign="middle-center" color={mag>0?c.white:c.red} uiTransform={{width:clientState.isMobile?62:82,height:40,margin:'0 0 0 1px'}}/><Label value={w.name.toUpperCase()} fontSize={clientState.isMobile?9:10} textAlign="middle-center" color={c.muted} uiTransform={{width:clientState.isMobile?43:59,height:32}}/></UiEntity><UiEntity uiTransform={{width:clientState.isMobile?172:232,height:40,margin:'5px 0 0 0',flexDirection:'row',alignItems:'center'}}><Label value={status} fontSize={12} color={mag>0?c.muted:c.amber} textAlign="middle-center" uiTransform={{width:clientState.isMobile?62:92,height:40}}/><Button value="E  RELOAD" fontSize={12} color={c.white} uiTransform={{width:clientState.isMobile?94:128,height:30,margin:'3px 0 0 8px',borderWidth:0}} uiBackground={{color:c.red}} onMouseDown={reloadWeapon}/></UiEntity></UiEntity>}

function slot(number:string,iconName:string,label:string,sub:string,selected:boolean,onClick:()=>void){return <UiEntity uiTransform={{width:130,height:68,margin:'0 3px',positionType:'relative',flexDirection:'row',alignItems:'center',padding:5,borderColor:selected?c.white:c.muted,borderWidth:selected?3:1}} uiBackground={{color:selected?Color4.fromHexString('#30363ddd'):c.panel}} onMouseDown={onClick}><Label value={number} fontSize={13} color={c.white} uiTransform={{positionType:'absolute',position:{left:4,top:3},width:18,height:18}}/>{icon(iconName,42)}<Label value={`${label}\n${sub}`} fontSize={11} color={c.white} uiTransform={{width:72,height:52,margin:'0 0 0 5px'}}/></UiEntity>}
// Mobile quickbar: each complete slot is the touch target, not only its icon.
function weaponSlot(number:string,kind:'rifle'|'pistol'|'shotgun',label:string,sub:string,selected:boolean,onClick:()=>void){
 const mobile=clientState.isMobile
 const accent=kind==='pistol'?Color4.fromHexString('#39e66fff'):kind==='rifle'?Color4.fromHexString('#b72cffff'):Color4.fromHexString('#ffd226ff')
 return <UiEntity uiTransform={{width:mobile?106:130,height:mobile?64:68,margin:mobile?'0 2px':'0 3px',positionType:'relative',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:mobile?2:3,borderWidth:mobile?(selected?2:1):0,borderColor:selected?accent:Color4.fromHexString('#57616bff'),pointerFilter:'block'}} uiBackground={{color:selected?Color4.fromHexString('#30363dee'):c.panel}} onMouseDown={onClick}>
  <Label value={number} fontSize={mobile?11:12} color={c.white} uiTransform={{positionType:'absolute',position:{left:4,top:3},width:18,height:18,pointerFilter:'none'}}/>
  {assetIcon(`Images/ui/weapon-${kind}.png`,mobile?38:53)}
  <Label value={`${label}  ${sub}`} fontSize={mobile?8:9} color={c.white} uiTransform={{width:mobile?100:120,height:mobile?14:15,pointerFilter:'none'}}/>
 </UiEntity>
}
function lootSlot(number:string,src:string,label:string,sub:string,color:Color4,onClick:()=>void){
 const mobile=clientState.isMobile
 return <UiEntity uiTransform={{width:mobile?106:130,height:mobile?64:68,margin:mobile?'0 2px':'0 3px',positionType:'relative',flexDirection:mobile?'column':'row',alignItems:'center',justifyContent:'center',padding:mobile?2:5,borderWidth:mobile?1:0,borderColor:mobile?color:c.muted,pointerFilter:'block'}} uiBackground={panel} onMouseDown={onClick}>
  <Label value={number} fontSize={mobile?11:12} color={c.white} uiTransform={{positionType:'absolute',position:{left:4,top:3},width:18,height:18,pointerFilter:'none'}}/>
  {assetIcon(src,mobile?36:46)}
  <Label value={mobile?`${label} ${sub}`:`${label}\\n${sub}`} fontSize={mobile?9:10} color={c.white} uiTransform={{width:mobile?100:68,height:mobile?15:46,margin:mobile?'0':'0 0 0 4px',pointerFilter:'none'}}/>
 </UiEntity>
}
function quickbar(){
 const p=getLocalPlayerState(),mobile=clientState.isMobile
 return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',bottom:mobile?8:24},margin:mobile?'0 0 0 -330px':'0 0 0 -405px',width:mobile?660:810,height:mobile?68:70,padding:mobile?1:5,flexDirection:'row',borderWidth:0,pointerFilter:'block',zIndex:100}} uiBackground={panel}>
  {weaponSlot('1','rifle','RIFLE',`${p?.magazineRifle??0}/${p?.ammoRifle??0}`,p?.equippedWeapon==='pulse-rifle',()=>selectWeapon('pulse-rifle'))}
  {weaponSlot('2','pistol','PISTOL',`${p?.magazinePistol??0}/${p?.ammoPistol??0}`,p?.equippedWeapon==='rail-pistol',()=>selectWeapon('rail-pistol'))}
  {weaponSlot('3','shotgun','SHOTGUN',`${p?.magazineShotgun??0}/${p?.ammoShotgun??0}`,p?.equippedWeapon==='scattergun',()=>selectWeapon('scattergun'))}
  {lootSlot('4','Images/loot-bomb.png','BOMB',`${p?.bombs??0}`,Color4.fromHexString('#b72cffff'),()=>throwBomb())}
  {lootSlot('5','Images/loot-medkit.png','MEDKIT',`${p?.medkits??0}`,c.red,()=>useInventoryItem('medkit'))}
  {lootSlot('6','Images/loot-water.png','WATER',`${p?.water??0}`,c.blue,()=>useInventoryItem('water'))}
 </UiEntity>
}
function crosshair(){return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:'50%'},width:34,height:34,margin:'-17px 0 0 -17px',zIndex:30,pointerFilter:'none'}}><UiEntity uiTransform={{positionType:'absolute',position:{left:15,top:0},width:3,height:10}} uiBackground={{color:c.white}}/><UiEntity uiTransform={{positionType:'absolute',position:{left:15,bottom:0},width:3,height:10}} uiBackground={{color:c.white}}/><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:15},width:10,height:3}} uiBackground={{color:c.white}}/><UiEntity uiTransform={{positionType:'absolute',position:{right:0,top:15},width:10,height:3}} uiBackground={{color:c.white}}/></UiEntity>}
function inventory(){
 if(!clientState.inventoryOpen)return null
 const p=getLocalPlayerState()
 const btn=(id:string,label:string,left:number,top:number,width:number,height:number,color:Color4,onClick:()=>void,fontSize=13)=>{const hover=clientState.hoveredMenuButton===id;return <Button value={label} fontSize={fontSize} color={c.white} uiTransform={{positionType:'absolute',position:{left,top},width,height,borderWidth:0,zIndex:104}} uiBackground={{color:hover?Color4.fromHexString('#000000b8'):Color4.fromHexString('#00000001')}} onMouseEnter={()=>{clientState.hoveredMenuButton=id;playUiHoverSound()}} onMouseLeave={()=>{if(clientState.hoveredMenuButton===id)clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();onClick()}}/>}
 // v223: Gear & Storage live UI fitted to the measured openings of the supplied frame.
 // The frame remains decorative only; all original inventory actions/state are preserved.
 return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-290px 0 0 -338px',width:676,height:581,zIndex:100,pointerFilter:'block'}} uiBackground={{color:Color4.fromHexString('#00000000')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:18,top:18},width:640,height:545,zIndex:100,pointerFilter:'none'}} uiBackground={{color:Color4.fromHexString('#24282eff')}}/><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:676,height:581,zIndex:101,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/gear-storage-frame.png'},textureMode:'stretch'}}/>
   {/* Header */}
   <Label value="GEAR AND STORAGE" fontSize={22} color={c.white} uiTransform={{positionType:'absolute',position:{left:64,top:48},width:350,height:29,zIndex:103}}/>
   {btn('gear-close','CLOSE',clientState.isMobile?516:528,42,102,42,c.red,toggleInventory,13)}

   {/* Loadout / ammunition: all copy stays inside the large upper opening. */}
   <Label value="LOADOUT / AMMUNITION" fontSize={15} color={c.white} uiTransform={{positionType:'absolute',position:{left:218,top:110},width:262,height:22,zIndex:103}}/>
   <Label value="BUILD MATERIALS  ∞" fontSize={13} color={Color4.fromHexString('#ffbd21ff')} uiTransform={{positionType:'absolute',position:{left:72,top:150},width:220,height:22,zIndex:103}}/>
   <Label value={`PULSE RIFLE   ${p?.magazineRifle??0} / ${p?.ammoRifle??0}`} fontSize={13} color={Color4.fromHexString('#cf36ffff')} uiTransform={{positionType:'absolute',position:{left:72,top:181},width:235,height:22,zIndex:103}}/>
   <Label value={`RAIL PISTOL   ${p?.magazinePistol??0} / ${p?.ammoPistol??0}`} fontSize={13} color={Color4.fromHexString('#3dff7bff')} uiTransform={{positionType:'absolute',position:{left:350,top:150},width:220,height:22,zIndex:103}}/>
   <Label value={`SCATTERGUN   ${p?.magazineShotgun??0} / ${p?.ammoShotgun??0}`} fontSize={13} color={Color4.fromHexString('#ffd226ff')} uiTransform={{positionType:'absolute',position:{left:350,top:181},width:220,height:22,zIndex:103}}/>

   {/* Bomb row */}
   <UiEntity uiTransform={{positionType:'absolute',position:{left:61,top:268},width:39,height:39,zIndex:103}} uiBackground={{texture:{src:'Images/loot-bomb.png'},textureMode:'stretch'}}/>
   <Label value={`BOMBS  ${p?.bombs??0}   •   Timed blast · 8 m radius`} fontSize={12} color={c.white} uiTransform={{positionType:'absolute',position:{left:112,top:275},width:286,height:27,zIndex:103}}/>
   {btn('gear-bomb','THROW BOMB',431,264,190,45,Color4.fromHexString('#7126aaff'),throwBomb,13)}

   {/* Consumables: quantity and action are centered as one visual unit in each colored block. */}
   <Label value={`MEDKITS  ${p?.medkits??0}`} fontSize={11} color={c.white} uiTransform={{positionType:'absolute',position:{left:58,top:337},width:162,height:20,zIndex:103}}/>
   <Label value={`SHIELD CELLS  ${p?.shieldCells??0}`} fontSize={11} color={c.white} uiTransform={{positionType:'absolute',position:{left:257,top:337},width:160,height:20,zIndex:103}}/>
   <Label value={`WATER  ${p?.water??0}`} fontSize={11} color={c.white} uiTransform={{positionType:'absolute',position:{left:454,top:337},width:162,height:20,zIndex:103}}/>
   {btn('gear-medkit','USE MEDKIT',53,379,172,47,c.red,()=>useInventoryItem('medkit'),12)}
   {btn('gear-shield','USE SHIELD CELL',254,379,166,47,Color4.fromHexString('#248dcfff'),()=>useInventoryItem('shield-cell'),12)}
   {btn('gear-water','DRINK WATER',447,379,174,47,Color4.fromHexString('#37b66bff'),()=>useInventoryItem('water'),12)}

   {/* Archive / life-credit row */}
   <Label value={`MEMORY PACKS  ${clientState.memoryPacksCollected}     DATA RAM  ${clientState.dataRamsCollected}`} fontSize={12} color={c.cyan} uiTransform={{positionType:'absolute',position:{left:61,top:487},width:314,height:24,zIndex:103}}/>
   <Label value={`LIFE CREDITS  ${p?.lifeCredits??0}`} fontSize={11} color={Color4.fromHexString('#df9bffff')} uiTransform={{positionType:'absolute',position:{left:413,top:488},width:102,height:22,zIndex:103}}/>
   {btn('gear-life','RESTORE HEALTH',518,480,100,38,Color4.fromHexString('#7130a0ff'),()=>useInventoryItem('life-credit'),9)}
 </UiEntity>
}
function terminalMissionId(place:string):MissionId{return place==='arena'?'reach-arena':place==='docks'?'reach-docks':'reach-city'}
function mobileTerminalPx(n:number){return clientState.isMobile?Math.round(n*0.60):n}
let mobileSelectedBuild:'wall'|'ramp'|'platform'='wall'
function missionPx(n:number){return clientState.isMobile?Math.round(n*0.63125):n}
function missionTerminal(){
 if(!clientState.missionTerminalOpen)return null
 const pageSize=8,totalPages=Math.ceil(GENERATED_MISSIONS.length/pageSize),page=Math.max(0,Math.min(totalPages-1,clientState.missionTerminalPage)),start=page*pageSize
 const visible=GENERATED_MISSIONS.slice(start,start+pageSize)
 const i=Math.max(0,Math.min(GENERATED_MISSIONS.length-1,clientState.missionTerminalSelected)),m=GENERATED_MISSIONS[i],loc=(LOCATIONS as any)[m.place],counts=enemyCounts(),accepted=clientState.missionAcceptedIndex===i
 const completedCount=clientState.completedGeneratedMissions.size
 const eligibleMemory=Array.from({length:10},(_,n)=>n+1).find(id=>completedCount>=id*5&&!clientState.collectedMemoryIds.has(id))
 const missedRam=!clientState.collectedDataRamIds.has(1)
 const availableMemory=eligibleMemory?1:0,availableRam=m.ram+(m.id>1&&missedRam?1:0)
 const foundMemory=clientState.missionMemoryFound,foundRam=clientState.missionDataRamFound
 const px=loc.x/480*620-13,py=(480-loc.z)/480*516-13,enemiesDone=counts.mutants+counts.drones+counts.kings===0
 const completed=clientState.completedGeneratedMissions.has(m.id)
 return <UiEntity uiTransform={clientState.isMobile?{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-295px 0 0 -505px',width:1010,height:590,zIndex:95}:{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-450px 0 0 -800px',width:missionPx(1600),height:missionPx(900),zIndex:95}} uiBackground={{color:Color4.fromHexString('#00000000')}}>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:missionPx(24),top:missionPx(24)},width:missionPx(1552),height:missionPx(852),zIndex:95,pointerFilter:'none'}} uiBackground={{color:Color4.fromHexString('#24282eff')}}/>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:missionPx(1600),height:missionPx(900),zIndex:96,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/mission-terminal-frame.png'},textureMode:'stretch'}}/>
   <Label value="MISSION TERMINAL — 100 GENERATED OPERATIONS" fontSize={clientState.isMobile?17:24} color={c.white} uiTransform={{positionType:'absolute',position:{left:missionPx(92),top:missionPx(32)},width:missionPx(920),height:missionPx(54),zIndex:97}}/>
   <Label value="STORY-SAFE ARCHIVE RECOVERY" fontSize={clientState.isMobile?10:13} color={c.cyan} uiTransform={{positionType:'absolute',position:{left:missionPx(1120),top:missionPx(39)},width:missionPx(250),height:missionPx(42),zIndex:97}}/>
   <Button value="CLOSE" fontSize={14} color={c.white} uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:missionPx(42),top:missionPx(24)}:{left:missionPx(1400),top:missionPx(27)},width:missionPx(155),height:missionPx(67),borderWidth:0,zIndex:98}} uiBackground={{color:clientState.isMobile?c.red:Color4.fromHexString('#00000001')}} onMouseEnter={()=>playUiHoverSound()} onMouseDown={()=>{playUiSelectSound();clientState.missionTerminalOpen=false}}/>

   <UiEntity uiTransform={{positionType:'absolute',position:{left:missionPx(54),top:missionPx(133)},width:missionPx(490),height:missionPx(680),padding:12,flexDirection:'column',zIndex:97}}>
    <Label value={`AVAILABLE MISSIONS  ${start+1}-${Math.min(start+pageSize,100)} / 100`} fontSize={18} color={c.white} uiTransform={{width:missionPx(466),height:missionPx(32)}}/>
    {visible.map((x,n)=>{const idx=start+n;const done=clientState.completedGeneratedMissions.has(x.id);const mem=eligibleMemory?1:0,ram=x.ram+(x.id>1&&missedRam?1:0);return <Button value={`${done?'✓ ':''}${String(x.id).padStart(3,'0')}  ${x.name}\n${(LOCATIONS as any)[x.place].name.toUpperCase()}   ${x.objective}   ${x.difficulty}   ${mem} MP / ${ram} RAM`} fontSize={10} color={c.white} uiTransform={{width:missionPx(466),height:missionPx(67),margin:'0 0 5px 0',borderColor:idx===i?c.red:c.muted,borderWidth:idx===i?2:1}} uiBackground={{color:idx===i?Color4.fromHexString('#501018dd'):Color4.fromHexString('#090c12d9')}} onMouseEnter={()=>playUiHoverSound()} onMouseDown={()=>{playUiSelectSound();clientState.missionTerminalSelected=idx}}/>})}
    <UiEntity uiTransform={{width:missionPx(466),height:missionPx(48),flexDirection:'row',justifyContent:'space-between'}}><Button value="◀ PREV" fontSize={11} color={c.white} uiTransform={{width:missionPx(135),height:missionPx(38),...border}} uiBackground={{color:c.soft}} onMouseDown={()=>{playUiSelectSound();clientState.missionTerminalPage=Math.max(0,page-1)}}/><Label value={`PAGE ${page+1}/${totalPages}`} fontSize={11} color={c.cyan} uiTransform={{width:missionPx(150),height:missionPx(38)}}/><Button value="NEXT ▶" fontSize={11} color={c.white} uiTransform={{width:missionPx(135),height:missionPx(38),...border}} uiBackground={{color:c.soft}} onMouseDown={()=>{playUiSelectSound();clientState.missionTerminalPage=Math.min(totalPages-1,page+1)}}/></UiEntity>
   </UiEntity>

   <UiEntity uiTransform={{positionType:'absolute',position:{left:missionPx(608),top:missionPx(137)},width:missionPx(405),height:missionPx(405),padding:14,flexDirection:'column',zIndex:97}}>
    <Label value={`${String(m.id).padStart(3,'0')} — ${m.name}`} fontSize={clientState.isMobile?13:19} color={c.cyan} uiTransform={{width:missionPx(377),height:missionPx(48)}}/>
    <Label value={`${m.objective}  •  ${m.difficulty}  •  ${m.enemySet}`} fontSize={clientState.isMobile?9:11} color={m.difficulty==='HARD'||m.difficulty==='SPECIAL'?c.red:m.difficulty==='MEDIUM'?c.amber:c.green} uiTransform={{width:missionPx(377),height:missionPx(40)}}/>
    <Label value={m.brief} fontSize={clientState.isMobile?10:12} color={c.white} uiTransform={{width:missionPx(377),height:missionPx(108)}}/>
    <Label value="OBJECTIVES" fontSize={14} color={c.red} uiTransform={{width:missionPx(377),height:missionPx(26)}}/>
    <Label value={`${accepted?'☑':'□'} Reach ${loc.name}\n${enemiesDone?'☑':'□'} ${m.objective}: clear required hostiles\n${availableMemory?`${foundMemory>=availableMemory?'☑':'□'} Memory Packs ${foundMemory}/${availableMemory}`:'— Memory Packs 0 available'}\n${availableRam?`${foundRam>=availableRam?'☑':'□'} Data RAMs ${foundRam}/${availableRam}`:'— Data RAMs 0 available'}\n${completed?'☑':'□'} Complete / extract`} fontSize={clientState.isMobile?10:12} color={c.white} uiTransform={{width:missionPx(377),height:missionPx(135)}}/>
   </UiEntity>

   <UiEntity uiTransform={{positionType:'absolute',position:{left:missionPx(608),top:missionPx(607)},width:missionPx(405),height:missionPx(201),padding:14,flexDirection:'column',zIndex:97}}>
    <Label value={`OFFERED REWARDS\nBuild Materials ×${m.materials}   Bombs ×${m.bombs}\nShield Cells ×${m.shieldCells}${m.lifeCredits?`   Life Credits ×${m.lifeCredits}`:''}\n${completed?'REPLAY: repeatable resources only':'Unique collectibles/badges never duplicate'}`} fontSize={11} color={c.amber} uiTransform={{width:missionPx(377),height:missionPx(108)}}/>
    <Button value={accepted?'MISSION ACTIVE':completed?'▶  REPLAY MISSION':'▶  ACCEPT MISSION'} fontSize={15} color={c.white} uiTransform={{width:missionPx(377),height:missionPx(48),borderColor:accepted?c.green:c.red,borderWidth:2}} uiBackground={{color:accepted?Color4.fromHexString('#13552dee'):c.red}} onMouseEnter={()=>playUiHoverSound()} onMouseDown={()=>{if(!accepted){playUiSelectSound();clientState.missionAcceptedIndex=i;clientState.missionMemoryFound=0;clientState.missionDataRamFound=0;clientState.missionTerminalOpen=false;saveCampaignProgress(true);requestMission(terminalMissionId(m.place))}}}/>
   </UiEntity>

   <UiEntity uiTransform={{positionType:'absolute',position:{left:missionPx(1100),top:missionPx(137)},width:missionPx(450),height:missionPx(670),padding:12,flexDirection:'column',zIndex:97}}>
    <Label value={`MISSION MAP — ${loc.name.toUpperCase()}`} fontSize={17} color={c.white} uiTransform={{width:missionPx(426),height:missionPx(32)}}/>
    <UiEntity uiTransform={{width:missionPx(426),height:missionPx(355),positionType:'relative',overflow:'hidden',borderColor:c.cyan,borderWidth:2}} uiBackground={{texture:{src:'Images/project-exodus-minimap-source.jpg'},textureMode:'stretch'}}><UiEntity uiTransform={{positionType:'absolute',position:{left:Math.max(0,Math.min(398,loc.x/480*426-13)),top:Math.max(0,Math.min(327,(480-loc.z)/480*355-13))},width:missionPx(28),height:missionPx(28),borderColor:c.red,borderWidth:4,zIndex:4}} uiBackground={{color:Color4.fromHexString('#ff203080')}}/><Label value="MISSION" fontSize={9} color={c.white} uiTransform={{positionType:'absolute',position:{left:Math.max(0,Math.min(366,loc.x/480*426-33)),top:Math.max(0,Math.min(329,(480-loc.z)/480*355+17))},width:missionPx(80),height:missionPx(20),zIndex:5}}/></UiEntity>
    <Label value={`CHECKPOINT: ${loc.name}   X:${loc.x} Z:${loc.z}\nVALID PATH: ${m.reachable?'YES':'NO'} • generation checked.`} fontSize={11} color={c.cyan} uiTransform={{width:missionPx(426),height:missionPx(54),margin:'7px 0 0 0'}}/>
    <Label value="ARCHIVE RULES\nMemory Packs unlock in authored order every 5 successful missions. Earliest missed eligible pack is prioritized. Data RAM discoveries are unique; missed Data RAM 01 remains recoverable. Mission, archive and badge progress are tracked independently." fontSize={clientState.isMobile?9:11} color={c.white} uiTransform={{width:missionPx(426),height:missionPx(115)}}/>
   </UiEntity>
 </UiEntity>
}
function shop(){
 if(!clientState.shopOpen)return null
 const p:any=getLocalPlayerState(),earned=BADGES.filter(b=>badgeProgress(p,b)>=b[3]).length,tradeScale=clientState.isMobile?.89:1
 const tabs=[['browse','BROWSE BADGES'],['mine','MY BADGES'],['list','LIST A TRADE'],['listings','MY LISTINGS'],['requests','TRADE REQUESTS']] as const
 const status=clientState.traderTab==='browse'?'ALL 30 PROJECT EXODUS BADGES — select a badge to inspect trading status':clientState.traderTab==='mine'?`YOUR COLLECTION — ${earned}/30 badges unlocked`:clientState.traderTab==='list'?'CREATE TRADE — choose one unlocked badge to offer and the badge you want in return':clientState.traderTab==='listings'?'MY ACTIVE LISTINGS — local client listing interface ready for network persistence':'TRADE REQUESTS — accept/decline interface ready for multiplayer persistence'
 return <UiEntity uiTransform={clientState.isMobile?{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-387px 0 0 -630px',width:1260,height:774,zIndex:90}:{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-430px 0 0 -700px',width:1400,height:860,zIndex:90}} uiBackground={{color:Color4.fromHexString('#00000000')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:clientState.isMobile?18:20,top:clientState.isMobile?18:20},width:clientState.isMobile?1224:1360,height:clientState.isMobile?738:820,zIndex:90,pointerFilter:'none'}} uiBackground={{color:Color4.fromHexString('#24282eff')}}/><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:91,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/trader-shop-frame.png'},textureMode:'stretch'}}/>
  <Label value={`TRADER SHOP — BADGE TRADING HUB   SEASON 1   ${earned}/30`} fontSize={clientState.isMobile?17:23} color={c.white} uiTransform={{positionType:'absolute',position:{left:78,top:29},width:clientState.isMobile?1010:1080,height:45,zIndex:92}}/>
  <Button value="CLOSE" fontSize={13} color={c.white} uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:34,top:24}:{left:1221,top:28},width:132,height:48,borderWidth:0,zIndex:94}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>playUiHoverSound()} onMouseDown={()=>clientState.shopOpen=false}/>
  <UiEntity uiTransform={{positionType:'absolute',position:{left:48,top:102},width:clientState.isMobile?1164:1304,height:55,flexDirection:'row',justifyContent:'space-between',zIndex:93}}>{tabs.map(([id,label])=>{const hover=clientState.hoveredMenuButton===`trade-tab-${id}`;return <Button value={label} fontSize={11} color={c.white} uiTransform={{width:clientState.isMobile?226:252,height:52,borderWidth:0}} uiBackground={{color:hover?Color4.fromHexString('#000000c8'):clientState.traderTab===id?Color4.fromHexString('#7b1018aa'):Color4.fromHexString('#00000001')}} onMouseEnter={()=>{clientState.hoveredMenuButton=`trade-tab-${id}`;playUiHoverSound()}} onMouseLeave={()=>{if(clientState.hoveredMenuButton===`trade-tab-${id}`)clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();clientState.traderTab=id}}/>})}</UiEntity>
  <Label value={status} fontSize={clientState.isMobile?11:14} color={c.cyan} uiTransform={{positionType:'absolute',position:{left:70,top:158},width:clientState.isMobile?1120:1260,height:22,zIndex:92}}/>
  <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:1400,height:860,zIndex:92}}>{BADGES.map((b,i)=>{const ok=badgeProgress(p,b)>=b[3],src=`Images/badges/badge-${String(i+1).padStart(2,'0')}${ok?'':'-locked'}.png`;const col=i%8,row=Math.floor(i/8);const cellCentersX=[141,301,461,621,781,941,1101,1261].map(v=>v*tradeScale),cellCentersY=[260,414,568,716].map(v=>v*tradeScale);const cardW=126*tradeScale,cardH=122*tradeScale;const cellLeft=cellCentersX[col]-cardW/2,cellTop=cellCentersY[row]-cardH/2;return <UiEntity uiTransform={{positionType:'absolute',position:{left:cellLeft,top:cellTop},width:cardW,height:cardH,flexDirection:'column',alignItems:'center',justifyContent:'flex-start',borderWidth:0,zIndex:93}} uiBackground={{color:clientState.hoveredMenuButton===`trade-badge-${i}`?Color4.fromHexString('#000000b8'):Color4.fromHexString('#00000001')}} onMouseEnter={()=>{const id=`trade-badge-${i}`;if(clientState.hoveredMenuButton!==id){clientState.hoveredMenuButton=id;playUiHoverSound()}}} onMouseLeave={()=>{if(clientState.hoveredMenuButton===`trade-badge-${i}`)clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();clientState.traderSelectedBadge=i}}><UiEntity uiTransform={{width:84*tradeScale,height:84*tradeScale,margin:'0 0 0 0'}} uiBackground={{texture:{src},textureMode:'stretch'}}/><Label value={`${String(i+1).padStart(2,'0')} ${b[0]} ${ok?'OWNED':'LOCKED'}`} fontSize={clientState.isMobile?7:5} color={ok?c.white:c.muted} uiTransform={{width:118*tradeScale,height:28*tradeScale,margin:'4px 0 0 0'}}/></UiEntity>})}</UiEntity>
  <Label value="Cross-player trade settlement requires the shared multiplayer persistence/backend; this UI never fabricates remote trades." fontSize={10} color={c.amber} uiTransform={{positionType:'absolute',position:{left:92,top:clientState.isMobile?744:793},width:clientState.isMobile?1080:1215,height:22,zIndex:92}}/>
 </UiEntity>
}
function build(){const p=getLocalPlayerState();const b=(name:string,k:'wall'|'ramp'|'platform')=><Button value={name} fontSize={11} color={c.white} uiTransform={{width:72,height:24,margin:'0 4px',borderWidth:0,borderRadius:6}} uiBackground={{color:c.soft}} onMouseDown={()=>selectBuild(k)}/>;return <UiEntity uiTransform={{positionType:'absolute',position:{right:24,bottom:24},width:248,height:64,padding:4,flexDirection:'column',alignItems:'center',borderWidth:0}} uiBackground={{color:Color4.fromHexString('#00000000')}}><Label value="BUILD MATERIALS  ∞" fontSize={12} color={c.white} uiTransform={{width:240,height:22}}/><UiEntity uiTransform={{width:240,height:30,flexDirection:'row',alignItems:'center',justifyContent:'center'}}>{b('WALL','wall')}{b('RAMP','ramp')}{b('FLOOR','platform')}</UiEntity></UiEntity>}
function controls(){const p=getLocalPlayerState(),pistol=p?.equippedWeapon==='rail-pistol';return <UiEntity uiTransform={{positionType:'absolute',position:{right:20,top:337},width:220,height:112,padding:'2px 8px',flexDirection:'column',borderWidth:0,borderRadius:12}} uiBackground={{color:Color4.fromHexString('#00000000')}}><Button value="GAME CONTROLS" fontSize={13} color={c.white} uiTransform={{width:204,height:40,margin:'4px 0 0 0',borderWidth:0,borderRadius:8}} uiBackground={{color:Color4.fromHexString('#00000000')}} onMouseDown={()=>clientState.controlsOpen=!clientState.controlsOpen}/><Button value={clientState.scopeToggled?'EXIT SCOPE':'OPEN SCOPE'} fontSize={13} color={c.white} uiTransform={{width:204,height:40,margin:'14px 0 0 0',borderWidth:0,borderRadius:8}} uiBackground={{color:Color4.fromHexString('#00000000')}} onMouseDown={()=>{if(pistol){clientState.notification='SCOPE NOT AVAILABLE FOR PISTOL — CHANGE GUN AND SELECT SCOPE AGAIN';clientState.notificationUntil=Date.now()+3500}else toggleScope()}}/></UiEntity>}
function controlsOverlay(){if(!clientState.controlsOpen)return null;return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-290px 0 0 -330px',width:660,height:580,padding:22,flexDirection:'column',alignItems:'center',...border,zIndex:70}} uiBackground={{color:Color4.fromHexString('#080b0ef5')}}><UiEntity uiTransform={{width:616,height:48,flexDirection:'row',justifyContent:'space-between'}}><Label value="PROJECT EXODUS — GAME CONTROLS" fontSize={23} color={c.white} uiTransform={{width:470,height:42}}/><Button value="CLOSE" fontSize={13} color={c.white} uiTransform={{width:110,height:38,...border}} uiBackground={{color:c.red}} onMouseDown={()=>clientState.controlsOpen=false}/></UiEntity><Label value="COMBAT" fontSize={16} color={c.red} uiTransform={{width:616,height:30}}/><Label value="LEFT CLICK   FIRE\nE   RELOAD\n1   RIFLE\n2   PISTOL\n3   SHOTGUN\n4   THROW BOMB" fontSize={15} color={c.white} uiTransform={{width:616,height:150}}/><Label value="MOVEMENT / WORLD" fontSize={16} color={c.cyan} uiTransform={{width:616,height:30}}/><Label value="W A S D   MOVE\nSPACE   JUMP\nE   RELOAD / INTERACT / PICK UP\nF   PLACE SELECTED BUILD MATERIAL\nENTER   CHAT\nCLICK MINIMAP   FULL MAP" fontSize={15} color={c.white} uiTransform={{width:616,height:150}}/><Label value="SCOPE: Use OPEN SCOPE below Game Controls with Rifle or Shotgun. Pistol does not support scope." fontSize={13} color={c.muted} uiTransform={{width:616,height:34}}/></UiEntity>}

function welcomeScreen(){
 if(!clientState.welcomeOpen)return null
 const hover=clientState.hoveredMenuButton==='welcome-enter'
 const mobileMenu=clientState.isMobile;return <UiEntity uiTransform={mobileMenu?{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:190,pointerFilter:'block'}:{positionType:'absolute',position:{left:0,top:0},width:1920,height:1080,zIndex:190,pointerFilter:'block'}} uiBackground={{texture:{src:'Images/project-exodus-welcome.png'},textureMode:'stretch'}}>
   {hover&&<UiEntity uiTransform={{positionType:'absolute',position:mobileMenu?{left:'30.73%',top:'72.78%'}:{left:590,top:786},width:mobileMenu?'37.71%':724,height:mobileMenu?'14.26%':154,zIndex:191,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/welcome-enter-hover.png'},textureMode:'stretch'}}/>}
   <Button value="" uiTransform={{positionType:'absolute',position:mobileMenu?{left:'30.73%',top:'72.78%'}:{left:590,top:786},width:mobileMenu?'37.71%':724,height:mobileMenu?'14.26%':154,zIndex:192,borderWidth:0}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>{if(clientState.hoveredMenuButton!=='welcome-enter'){clientState.hoveredMenuButton='welcome-enter';playUiHoverSound()}}} onMouseLeave={()=>{if(clientState.hoveredMenuButton==='welcome-enter')clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();clientState.hoveredMenuButton='';clientState.welcomeLoadingUntil=0;clientState.joining=false;clientState.welcomeOpen=false;modeMenuLaunched=false}}/>
   

 </UiEntity>
}

// v295.3.5: the PC and mobile artwork use different, fully aligned click regions.
let modeActionHover: 'controls' | 'howto' | 'enter' | '' = ''
let modeGuideTab: 'controls' | 'howto' | '' = ''
let menuSelectedMode: GameMode = 'solo-bots'
let modeMenuLaunched = false // Latch: only Back/Welcome can re-open the mode selector
function modeRegion(x:number,y:number,w:number,h:number){
 return <Button value="" fontSize={1} color={Color4.fromHexString('#ffffff00')} uiTransform={{positionType:'absolute',position:{left:x,top:y},width:w,height:h,zIndex:25,pointerFilter:'block',borderWidth:0}} uiBackground={{color:Color4.fromHexString('#00000001')}}/>
}
function modeSelectCard(mode:GameMode,x:number,y:number,w:number,h:number){
 const id='mode-'+mode
 return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:`${x/19.2}%`,top:`${y/10.8}%`}:{left:x,top:y},width:clientState.isMobile?`${w/19.2}%`:w,height:clientState.isMobile?`${h/10.8}%`:h,zIndex:30,pointerFilter:'block'}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>{if(clientState.hoveredMenuButton!==id){clientState.hoveredMenuButton=id;playUiHoverSound()}}} onMouseDown={()=>{playUiSelectSound();menuSelectedMode=mode;clientState.selectedMode=mode}}>
 </UiEntity>
}
function modeMenuButton(x:number,y:number,w:number,h:number,fn:()=>void,action: 'controls' | 'howto' | 'enter' | '' = ''){
 return <UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:`${x/19.2}%`,top:`${y/10.8}%`}:{left:x,top:y},width:clientState.isMobile?`${w/19.2}%`:w,height:clientState.isMobile?`${h/10.8}%`:h,zIndex:31,pointerFilter:'none'}}>
  {action!==''&&modeActionHover===action&&<UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',pointerFilter:'none'}} uiBackground={{texture:{src:clientState.isMobile?(action==='enter'?'Images/ui/exodus-button-neon-mobile-enter-fit.png':action==='howto'?'Images/ui/exodus-button-neon-mobile-howto-fit.png':'Images/ui/exodus-button-neon-mobile-guide-fit.png'):(action==='controls'?'Images/ui/exodus-button-neon-controls-fit.png':action==='howto'?'Images/ui/exodus-button-neon-howto-fit.png':'Images/ui/exodus-button-neon-enter-fit.png')},textureMode:'stretch'}}/>}
  <Button value="" fontSize={1} color={Color4.fromHexString('#ffffff00')} uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:32,pointerFilter:'block',borderWidth:0}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>{if(action!==''){modeActionHover=action;playUiHoverSound()}}} onMouseLeave={()=>{if(modeActionHover===action)modeActionHover=''}} onMouseDown={()=>{playUiSelectSound();modeActionHover='';fn()}}/>
 </UiEntity>
}
function modeGuidePopup(){
 if(!modeGuideTab)return null
 const controls=modeGuideTab==='controls',isMobile=clientState.isMobile
 const pc=controls?'W A S D   MOVE\nSHIFT   SPRINT\nSPACE   JUMP\nLEFT CLICK   SHOOT\n1 / 2 / 3   SELECT GUN\n4   THROW BOMB\n5   USE MEDKIT\n6   DRINK WATER\nE   INTERACT / RELOAD\nF   PLACE BUILD MATERIAL':'1. SELECT A GAME MODE\n2. PRESS ENTER EXODUS\n3. VISIT GEAR AND MISSION TERMINALS\n4. COLLECT AMMO, MEDKITS AND WATER\n5. FIGHT MUTANTS AND DRONES\n6. COMPLETE MISSIONS\n7. RECOVER MEMORY PACKS AND DATA RAMS'
 const touch=controls?'LEFT JOYSTICK   MOVE\nSWIPE SCREEN   LOOK AROUND\nFIRE BUTTON   SHOOT\nTAP WEAPON SLOT   SWITCH GUN\nTAP BOMB SLOT   THROW BOMB\nTAP MEDKIT / WATER   USE ITEM\nJUMP BUTTON   JUMP\nINTERACT BUTTON   PICK UP / USE\nMINIMAP   OPEN MAP':'SOLO: PLAY ALONE AGAINST HOSTILES\nCO-OP: TEAM UP AGAINST HOSTILES\nPVP: COMPETE AGAINST OTHER PLAYERS\nPVPVE: FIGHT PLAYERS AND HOSTILES\n\nSAME ISLAND. NEW MISSION.'
 const title=controls?'CONTROLS — PC & MOBILE':'HOW TO PLAY — PROJECT EXODUS'
 if(isMobile){
  // v295.3.21: stacked, vertically separated guide sections for landscape phones.
  // The overlay remains within the same safe-area and keeps its close button above the text.
  return <UiEntity uiTransform={{positionType:'absolute',position:{left:'8%',top:'5%'},width:'84%',height:'90%',zIndex:150,pointerFilter:'block'}} uiBackground={{texture:{src:'Images/ui/exodus-guide-mobile.png'},textureMode:'stretch'}}>
   <Label value={title} color={c.white} fontSize={18} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:'13%',top:'2%'},width:'74%',height:'8%',pointerFilter:'none'}}/>
   <Button value="✕ CLOSE" fontSize={12} color={c.white} uiTransform={{positionType:'absolute',position:{right:'6%',top:'10%'},width:'27%',height:30,pointerFilter:'block',borderWidth:2,borderColor:c.red}} uiBackground={{color:Color4.fromHexString('#690d18ff')}} onMouseDown={()=>{playUiSelectSound();modeGuideTab=''}}/>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:'10%',top:'20%'},width:'80%',height:'30%',flexDirection:'column',alignItems:'center',pointerFilter:'none'}}>
    <Label value={controls?'PC / KEYBOARD + MOUSE':'MISSION OBJECTIVES'} color={c.cyan} fontSize={14} textAlign="middle-center" uiTransform={{width:'100%',height:'21%',pointerFilter:'none'}}/>
    <Label value={pc} color={c.white} fontSize={controls?10:11} textAlign="middle-center" uiTransform={{width:'100%',height:'79%',pointerFilter:'none'}}/>
   </UiEntity>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:'10%',top:'54%'},width:'80%',height:'34%',flexDirection:'column',alignItems:'center',pointerFilter:'none'}}>
    <Label value={controls?'MOBILE / TOUCH CONTROLS':'GAME MODES'} color={c.red} fontSize={14} textAlign="middle-center" uiTransform={{width:'100%',height:'20%',pointerFilter:'none'}}/>
    <Label value={touch} color={c.white} fontSize={controls?10:11} textAlign="middle-center" uiTransform={{width:'100%',height:'80%',pointerFilter:'none'}}/>
   </UiEntity>
  </UiEntity>
 }
 return <UiEntity uiTransform={{positionType:'absolute',position:{left:isMobile?'8%':410,top:isMobile?'5%':140},width:isMobile?'84%':1100,height:isMobile?'90%':780,zIndex:150,pointerFilter:'block'}} uiBackground={{texture:{src:isMobile?'Images/ui/exodus-guide-mobile.png':'Images/ui/exodus-guide-desktop.png'},textureMode:'stretch'}}>
  <Label value={title} color={c.white} fontSize={isMobile?21:27} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:'12%',top:isMobile?'3%':'4%'},width:'76%',height:isMobile?'7%':'8%',pointerFilter:'none'}}/>
  <Button value="✕ CLOSE" fontSize={isMobile?14:16} color={c.white} uiTransform={{positionType:'absolute',position:{right:isMobile?'6%':'5%',top:isMobile?'10%':'11%'},width:isMobile?'27%':150,height:isMobile?38:43,pointerFilter:'block',borderWidth:2,borderColor:c.red}} uiBackground={{color:Color4.fromHexString('#690d18ff')}} onMouseDown={()=>{playUiSelectSound();modeGuideTab=''}}/>
  <UiEntity uiTransform={{positionType:'absolute',position:{left:isMobile?'7%':'7%',top:isMobile?'21%':'21%'},width:isMobile?'41%':'41%',height:isMobile?'64%':'64%',flexDirection:'column',justifyContent:'flex-start',alignItems:'center',padding:isMobile?8:14,pointerFilter:'none'}}>
   <Label value={controls?'PC / KEYBOARD + MOUSE':'MISSION OBJECTIVES'} color={c.cyan} fontSize={isMobile?16:21} textAlign="middle-center" uiTransform={{width:'100%',height:isMobile?36:50,pointerFilter:'none'}}/>
   <Label value={pc} color={c.white} fontSize={isMobile?13:17} textAlign="middle-center" uiTransform={{width:'100%',height:isMobile?'80%':'84%',pointerFilter:'none'}}/>
  </UiEntity>
  <UiEntity uiTransform={{positionType:'absolute',position:{left:isMobile?'52%':'52%',top:isMobile?'21%':'21%'},width:isMobile?'41%':'41%',height:isMobile?'64%':'64%',flexDirection:'column',justifyContent:'flex-start',alignItems:'center',padding:isMobile?8:14,pointerFilter:'none'}}>
   <Label value={controls?'MOBILE / TOUCH CONTROLS':'GAME MODES'} color={c.red} fontSize={isMobile?16:21} textAlign="middle-center" uiTransform={{width:'100%',height:isMobile?36:50,pointerFilter:'none'}}/>
   <Label value={touch} color={c.white} fontSize={isMobile?13:17} textAlign="middle-center" uiTransform={{width:'100%',height:isMobile?'80%':'84%',pointerFilter:'none'}}/>
  </UiEntity>
 </UiEntity>
}
function lobby(){
 if(clientState.welcomeOpen||clientState.joining||clientState.joined||clientState.cinematicActive||modeMenuLaunched)return null
 const mobile=clientState.isMobile
 return <UiEntity uiTransform={mobile?{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:120,pointerFilter:'block'}:{positionType:'absolute',position:{left:0,top:0},width:1920,height:1080,zIndex:120,pointerFilter:'block'}} uiBackground={{texture:{src:mobile?'Images/project-exodus-mode-mobile.png':'Images/project-exodus-opening-menu.png'},textureMode:'stretch'}}>
  <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:mobile?'100%':1920,height:mobile?'100%':1080,zIndex:29,pointerFilter:'none'}} uiBackground={{texture:{src:clientState.isMobile?('Images/ui/mode-glow-mobile-'+(menuSelectedMode==='solo-bots'?'solo':menuSelectedMode==='coop-bots'?'coop':menuSelectedMode==='pvp'?'pvp':'pvpve')+'.png'):('Images/ui/mode-glow-pc-'+(menuSelectedMode==='solo-bots'?'solo':menuSelectedMode==='coop-bots'?'coop':menuSelectedMode==='pvp'?'pvp':'pvpve')+'.png')},textureMode:'stretch'}}/>
  {mobile?<UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>
   {modeSelectCard('solo-bots',410,355,1100,125)}
   {modeSelectCard('coop-bots',410,485,1100,125)}
   {modeSelectCard('pvp',410,615,1100,125)}
   {modeSelectCard('pvp-bots',410,745,1100,125)}
   {modeMenuButton(410,888,490,62,()=>modeGuideTab='controls','controls')}
   {modeMenuButton(920,888,590,62,()=>modeGuideTab='howto','howto')}
   {modeMenuButton(610,964,700,78,()=>{modeGuideTab='';modeMenuLaunched=true;requestJoin(menuSelectedMode)},'enter')}
   {modeMenuButton(45,972,235,67,()=>{modeGuideTab='';modeActionHover='';modeMenuLaunched=false;clientState.welcomeOpen=true})}
  </UiEntity>:<UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>
   {modeSelectCard('solo-bots',46,491,458,335)}
   {modeSelectCard('coop-bots',539,491,422,335)}
   {modeSelectCard('pvp',996,491,422,335)}
   {modeSelectCard('pvp-bots',1450,491,430,335)}
   {modeMenuButton(192,873,468,92,()=>modeGuideTab='controls','controls')}
   {modeMenuButton(680,873,471,92,()=>modeGuideTab='howto','howto')}
   {modeMenuButton(1169,870,626,90,()=>{modeGuideTab='';modeMenuLaunched=true;requestJoin(menuSelectedMode)},'enter')}
   {modeMenuButton(48,965,236,80,()=>{modeGuideTab='';modeActionHover='';modeMenuLaunched=false;clientState.welcomeOpen=true})}
  </UiEntity>}
  {modeGuidePopup()}
 </UiEntity>
}
function enemyTarget(){if(!clientState.enemyTargetName)return null;const pct=Math.max(0,Math.min(100,clientState.enemyTargetHp/Math.max(1,clientState.enemyTargetMaxHp)*100));return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',top:clientState.isMobile?'72%':'58%'},margin:clientState.isMobile?'20px 0 0 -110px':'0 0 0 -145px',width:clientState.isMobile?240:330,height:clientState.isMobile?44:70,padding:clientState.isMobile?'5px 18px 3px 18px':'15px 18px 10px 18px',flexDirection:'column',borderWidth:0}} uiBackground={{color:Color4.fromHexString('#08090bf2')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:clientState.isMobile?240:330,height:clientState.isMobile?44:70,zIndex:1,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/exodus-expanded/enemy-health-frame.png'},textureMode:'stretch'}}/><Label value={clientState.enemyTargetName} fontSize={clientState.isMobile?13:12} textAlign="middle-center" color={c.white} uiTransform={{width:clientState.isMobile?204:294,height:clientState.isMobile?21:18,zIndex:3}}/><UiEntity uiTransform={{width:clientState.isMobile?204:294,height:clientState.isMobile?7:10,zIndex:3}} uiBackground={{color:Color4.fromHexString('#34393eff')}}><UiEntity uiTransform={{width:`${pct}%`,height:10}} uiBackground={{color:c.red}}/></UiEntity></UiEntity>}
function droneAlert(){if(!clientState.droneAlert)return null;return <Label value={clientState.droneAlert} fontSize={18} color={c.red} uiTransform={{positionType:'absolute',position:{left:'50%',top:130},margin:'0 0 0 -250px',width:500,height:46,padding:10,borderColor:c.red,borderWidth:2}} uiBackground={panel}/>}
function damageIndicator(){const d=clientState.damageDirection;if(!d)return null;if(d==='LEFT')return <Label value="▲ LEFT" fontSize={24} color={c.red} uiTransform={{positionType:'absolute',position:{left:35,top:480},width:110,height:42,pointerFilter:'none'}}/>;if(d==='RIGHT')return <Label value="RIGHT ▲" fontSize={24} color={c.red} uiTransform={{positionType:'absolute',position:{right:35,top:480},width:110,height:42,pointerFilter:'none'}}/>;return <Label value={`▲ ${d}`} fontSize={24} color={c.red} uiTransform={{positionType:'absolute',position:d==='FRONT'?{left:'50%',top:115}:{left:'50%',bottom:120},margin:'0 0 0 -55px',width:110,height:42,pointerFilter:'none'}}/>}
function note(){const m=getMatchState(),counts=enemyCounts(),i=Math.max(0,Math.min(GENERATED_MISSIONS.length-1,clientState.missionAcceptedIndex>=0?clientState.missionAcceptedIndex:0)),gm=GENERATED_MISSIONS[i],missionSummary=`${gm.name} — M ${counts.mutants} • D ${counts.drones} • K ${counts.kings} • RAM ${clientState.missionDataRamFound}/${gm.ram} • MP ${clientState.missionMemoryFound}/${gm.memory}`,text=clientState.notification||(clientState.joining?'Deployment selected - preparing loadout':missionSummary);if(!text)return null;return <Label value={text} fontSize={14} color={c.white} uiTransform={{positionType:'absolute',position:{left:'50%',top:78},margin:'0 0 0 -250px',width:500,height:38,padding:8,...border}} uiBackground={panel}/>}
function mobile(){
 if(!clientState.isMobile || clientState.insideOutpost || clientState.missionTerminalOpen || clientState.badgesOpen || clientState.dataStoryOpen || clientState.memoryStoryOpen)return null
 const item=(label:string,kind:'wall'|'ramp'|'platform')=>{const active=mobileSelectedBuild===kind;return <Button value={label} fontSize={11} color={c.white} uiTransform={{width:66,height:30,margin:'0 2px',borderWidth:active?3:1,borderColor:active?c.amber:c.red,borderRadius:4}} uiBackground={{color:active?Color4.fromHexString('#922021ff'):Color4.fromHexString('#15171deb')}} onMouseDown={()=>{mobileSelectedBuild=kind;selectBuild(kind)}}/>}
 return <UiEntity uiTransform={{positionType:'absolute',position:{right:18,top:247},width:215,height:38,flexDirection:'row',alignItems:'center',justifyContent:'center',zIndex:70,pointerFilter:'none'}}>{item('WALL','wall')}{item('RAMP','ramp')}{item('FLOOR','platform')}</UiEntity>
}

function elimination(){
  const p=getLocalPlayerState()
  if(!p||p.alive||clientState.eliminationDismissed)return null
  const solo=getMatchState()?.mode==='solo-bots'
  const hotspot=(id:string,left:number,top:number,width:number,height:number,onMouseDown:()=>void)=>{const hover=clientState.hoveredMenuButton===id;return <Button value="" fontSize={1} color={Color4.fromHexString('#ffffff00')} uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:`${left/19.2}%`,top:`${top/10.8}%`}:{left,top},width:clientState.isMobile?`${width/19.2}%`:width,height:clientState.isMobile?`${height/10.8}%`:height,borderColor:hover?c.red:Color4.fromHexString('#ffffff00'),borderWidth:hover?4:0,zIndex:52}} uiBackground={{color:hover?Color4.fromHexString('#ff1f3038'):Color4.fromHexString('#00000001')}} onMouseEnter={()=>{if(clientState.hoveredMenuButton!==id){clientState.hoveredMenuButton=id;playUiHoverSound()}}} onMouseLeave={()=>{if(clientState.hoveredMenuButton===id)clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();onMouseDown()}}/>}
  return <UiEntity uiTransform={clientState.isMobile?{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:50,pointerFilter:'block'}:{positionType:'absolute',position:{left:0,top:0},width:1920,height:1080,zIndex:50,pointerFilter:'block'}} uiBackground={{texture:{src:'Images/project-exodus-eliminated-menu.png'},textureMode:'stretch'}}>
    {hotspot('elim-continue',675,421,568,81,()=>requestRespawn('continue'))}
    {hotspot('elim-restart',675,517,568,77,()=>requestRespawn('rejoin'))}
    {hotspot('elim-outpost',675,609,568,77,()=>requestRespawn('outpost'))}
    {hotspot('elim-spectate',675,703,568,77,()=>clientState.eliminationDismissed=true)}
    {!solo&&<Label value="RESTART MISSION" fontSize={1} color={Color4.fromHexString('#ffffff00')} uiTransform={{positionType:'absolute',position:{left:675,top:517},width:568,height:77,zIndex:51,pointerFilter:'none'}}/>}
  </UiEntity>
}

const BADGES=[
['FIRST STEPS','Complete your first Project Exodus mission.','missionsCompleted',1],
['SCAVENGER','Loot 50 items. Every individual pickup counts.','lootCollected',50],
['SUPPLIER','Deliver supplies to the Outpost through supply objectives.','suppliesDelivered',10],
['CLEAN SWEEP','Complete a mission after eliminating every required enemy.','cleanSweeps',1],
['OUTPOST HERO','Complete the Outpost objective / defense mission.','outpostDefenses',1],
['PLANT RUNNER','Complete a generated mission assigned to The Plant.','badgePlace',1],
['DOCKS DEALER','Complete a generated mission assigned to The Docks.','badgePlace',2],
['ARENA CHAMPION','Complete a generated mission assigned to The Arena.','badgePlace',4],
['EXPLORER','Discover all 8 named Project Exodus locations.','locations',8],
['LOOT MASTER','Collect all rare loot rewards: find 5 legendary/rare loot drops.','legendaryLoot',5],
['DRONE HUNTER','Eliminate 50 Drones.','droneKills',50],
['MUTANT SLAYER','Eliminate 50 Mutants.','mutantKills',50],
['SHARPSHOOTER','Land 100 confirmed headshots on hostile targets.','headshots',100],
['SURVIVOR','Use 100 medkits.','medkitsUsed',100],
['EXPLOSIVE EXPERT','Use 50 bombs or explosives during combat.','explosivesUsed',50],
['AMMO COLLECTOR','Pick up a total of 500 ammunition rounds.','ammoRoundsCollected',500],
['GEAR MASTER','Use Rifle, Pistol, Shotgun, Medkit, Water and Bomb at least once.','badgeGearUsed',6],
['BOMBARDIER','Eliminate 10 enemies with confirmed explosive damage.','explosiveKills',10],
['LOOT CHAMPION','Collect at least one rare / legendary loot reward.','legendaryLoot',1],
['MISSION MASTER','Complete DEFEND, ELIMINATE, RECOVER, RECON, ESCORT, SABOTAGE, EXTRACT and HOLD objectives.','missionTypes',8],
['DRONE DESTROYER','Eliminate 100 drones.','droneKills',100],
['GEAR COLLECTOR','Collect 100 weapon/ammunition gear pickups.','weaponsCollected',100],
['MUTANT EXTERMINATOR','Eliminate 100 mutants.','mutantKills',100],
['LOOT LEGEND','Collect 500 individual loot pickups.','lootCollected',500],
['VETERAN SURVIVOR','Complete 25 genuine missions.','missionsCompleted',25],
['SPEED RUNNER','Complete an eligible mission in 5 minutes or less.','speedRuns',1],
['NIGHT OPS','Complete 3 missions during the in-game nighttime cycle.','nightMissions',3],
['LONE WOLF','Complete 10 solo missions.','soloMissions',10],
['TEAM PLAYER','Complete 10 co-op missions with other survivors.','coopMissions',10],
['EXODUS ELITE','Unlock all 29 previous Project Exodus badges.','all',29]
] as const
function bitCount(n:number){let c=0;for(let v=n>>>0;v;v>>>=1)c+=v&1;return c}
function badgeProgress(p:any,b:any): number{if(!p)return 0;if(b[2]==='all')return BADGES.slice(0,29).filter(x=>badgeProgress(p,x)>=x[3]).length;if(b[2]==='locations')return bitCount(Number(p.locationsDiscovered??0));if(b[2]==='missionTypes')return bitCount(Number(p.missionTypesMask??0)&255);if(b[2]==='badgePlace')return (Number(p.badgePlacesMask??0)&Number(b[3]))?1:0;if(b[2]==='badgeGearUsed')return bitCount(Number(p.badgeGearUsedMask??0)&63);if(b[2]==='gearTypes')return bitCount(Number(p.gearTypesMask??0)&255);if(b[2]==='missionType')return (Number(p.missionTypesMask??0)&(1<<(Number(b[3])-1)))?Number(b[3]):0;return Math.max(0,Number(p[b[2]]??0))}
function badgeCollection(){
 if(!clientState.badgesOpen)return null
 const p:any=getLocalPlayerState(),earned=BADGES.filter(b=>badgeProgress(p,b)>=b[3]).length,sel=BADGES[Math.max(0,Math.min(29,clientState.selectedBadge))],prog=badgeProgress(p,sel),unlocked=prog>=sel[3]
 const mobileBadgeScale=clientState.isMobile?.58:1
 const cols=6,cellW=149*mobileBadgeScale,cellH=132*mobileBadgeScale,startX=72*mobileBadgeScale,startY=164*mobileBadgeScale
 const selectedPct=Math.max(0,Math.min(100,Math.round(prog/Math.max(1,Number(sel[3]))*100)))
 return <UiEntity uiTransform={clientState.isMobile?{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-278px 0 0 -412px',width:824,height:557,zIndex:100,pointerFilter:'block'}:{positionType:'absolute',position:{left:'50%',top:'50%'},margin:'-480px 0 0 -710px',width:mobileTerminalPx(1420),height:mobileTerminalPx(960),zIndex:100,pointerFilter:'block'}} uiBackground={{color:Color4.fromHexString('#00000000')}}>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:clientState.isMobile?13:20,top:clientState.isMobile?17:20},width:clientState.isMobile?795:mobileTerminalPx(1380),height:clientState.isMobile?516:mobileTerminalPx(920),zIndex:100,pointerFilter:'none'}} uiBackground={{color:Color4.fromHexString('#24282eff')}}/>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:101,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/achievement-database-frame.png'},textureMode:'stretch'}}/>
   <Label value="PROJECT EXODUS — ACHIEVEMENT DATABASE" fontSize={clientState.isMobile?15:24} color={c.white} uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(74),top:mobileTerminalPx(61)},width:mobileTerminalPx(820),height:mobileTerminalPx(42),zIndex:103}}/>
   <Label value={`${earned}/30`} fontSize={22} color={c.white} uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1105),top:mobileTerminalPx(61)},width:mobileTerminalPx(105),height:mobileTerminalPx(42),zIndex:103}}/>
   <Button value="CLOSE" fontSize={16} color={c.white} uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:mobileTerminalPx(34),top:mobileTerminalPx(42)}:{left:mobileTerminalPx(1230),top:mobileTerminalPx(55)},width:mobileTerminalPx(135),height:mobileTerminalPx(94),zIndex:106}} uiBackground={{color:clientState.isMobile?c.red:Color4.fromHexString('#00000001')}} onMouseEnter={()=>playUiHoverSound()} onMouseDown={()=>{playUiSelectSound();clientState.badgesOpen=false}}/>
   {BADGES.map((b,i)=>{const col=i%cols,row=Math.floor(i/cols),x=startX+col*cellW,y=startY+row*cellH,v=badgeProgress(p,b),goal=Math.max(1,Number(b[3])),pct=Math.max(0,Math.min(100,Math.round(v/goal*100))),ok=v>=goal,hover=clientState.hoveredMenuButton===`badge-old-${i}`,src=`Images/badges/badge-${String(i+1).padStart(2,'0')}${ok?'':'-locked'}.png`;return <UiEntity uiTransform={{positionType:'absolute',position:{left:x,top:y},width:118*mobileBadgeScale,height:116*mobileBadgeScale,zIndex:103}}><UiEntity uiTransform={{positionType:'absolute',position:{left:14*mobileBadgeScale,top:2*mobileBadgeScale},width:90*mobileBadgeScale,height:82*mobileBadgeScale,pointerFilter:'none'}} uiBackground={{texture:{src},textureMode:'stretch'}}/><UiEntity uiTransform={{positionType:'absolute',position:{left:8*mobileBadgeScale,top:82*mobileBadgeScale},width:102*mobileBadgeScale,height:6*mobileBadgeScale,pointerFilter:'none'}} uiBackground={{color:Color4.fromHexString('#34393eff')}}><UiEntity uiTransform={{width:`${pct}%`,height:6,pointerFilter:'none'}} uiBackground={{color:ok?c.green:c.red}}/></UiEntity><Label value={`${String(i+1).padStart(2,'0')}  ${pct}%  ${Math.min(v,goal)}/${goal}`} fontSize={7} color={hover||i===clientState.selectedBadge?c.amber:c.white} uiTransform={{positionType:'absolute',position:{left:3*mobileBadgeScale,top:91*mobileBadgeScale},width:112*mobileBadgeScale,height:14*mobileBadgeScale,pointerFilter:'none'}}/><Button value="" uiTransform={{positionType:'absolute',position:{left:0,top:0},width:118*mobileBadgeScale,height:116*mobileBadgeScale,zIndex:105}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>{clientState.hoveredMenuButton=`badge-old-${i}`;playUiHoverSound()}} onMouseLeave={()=>{if(clientState.hoveredMenuButton===`badge-old-${i}`)clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();clientState.selectedBadge=i}}/></UiEntity>})}
   <Label value={unlocked?'◇ 3D HOLOGRAM — UNLOCKED ◇':'◇ 3D HOLOGRAM — LOCKED ◇'} fontSize={clientState.isMobile?10:12} color={unlocked?c.cyan:c.muted} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1044),top:mobileTerminalPx(207)},width:mobileTerminalPx(318),height:mobileTerminalPx(22),zIndex:103}}/>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1074),top:mobileTerminalPx(236)},width:mobileTerminalPx(255),height:mobileTerminalPx(255),zIndex:103,pointerFilter:'none'}} uiBackground={{texture:{src:`Images/badges/badge-${String(clientState.selectedBadge+1).padStart(2,'0')}${unlocked?'':'-locked'}.png`},textureMode:'stretch'}}/>
   <Label value={`${String(clientState.selectedBadge+1).padStart(2,'0')} — ${sel[0]}`} fontSize={clientState.isMobile?12:15} color={unlocked?c.cyan:c.white} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1046),top:mobileTerminalPx(525)},width:mobileTerminalPx(316),height:mobileTerminalPx(40),zIndex:103}}/>
   <Label value={`OBJECTIVE\n${sel[1]}`} fontSize={clientState.isMobile?11:12} color={c.white} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1048),top:mobileTerminalPx(574)},width:mobileTerminalPx(312),height:mobileTerminalPx(70),zIndex:103}}/>
   <Label value={`PROGRESS   ${Math.min(prog,Number(sel[3]))} / ${sel[3]}   (${selectedPct}%)`} fontSize={clientState.isMobile?11:12} color={c.white} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1048),top:mobileTerminalPx(661)},width:mobileTerminalPx(312),height:mobileTerminalPx(20),zIndex:103}}/>
   <UiEntity uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1048),top:mobileTerminalPx(696)},width:mobileTerminalPx(312),height:mobileTerminalPx(10),zIndex:103}} uiBackground={{color:Color4.fromHexString('#34393eff')}}><UiEntity uiTransform={{width:`${selectedPct}%`,height:mobileTerminalPx(10)}} uiBackground={{color:unlocked?c.green:c.red}}/></UiEntity>
   <Label value={unlocked?'BADGE UNLOCKED\nCampaign achievement completed.':'Complete the objective above to unlock this badge.'} fontSize={clientState.isMobile?11:9} color={c.white} textAlign="middle-center" uiTransform={{positionType:'absolute',position:{left:mobileTerminalPx(1048),top:mobileTerminalPx(733)},width:mobileTerminalPx(312),height:mobileTerminalPx(52),zIndex:103}}/>
 </UiEntity>
}
function scopeOverlay(){if(!clientState.scopeToggled)return null;const p=getLocalPlayerState();if(p?.equippedWeapon==='rail-pistol')return null;return <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:90,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/scope-overlay.png'},textureMode:'stretch'}}><Label value="5x ZOOM" fontSize={18} color={c.red} uiTransform={{positionType:'absolute',position:{right:70,top:52},width:130,height:34}}/><Button value="EXIT SCOPE" fontSize={16} color={c.white} uiTransform={{positionType:'absolute',position:{right:45,bottom:45},width:180,height:48,borderColor:c.line,borderWidth:2,pointerFilter:'block'}} uiBackground={{color:c.red}} onMouseDown={toggleScope}/></UiEntity>}


function memoryPickup(){if(!clientState.memoryPickupActive)return null;const pct=Math.round(clientState.memoryPickupProgress*100),sec=Math.min(10,Math.floor(clientState.memoryPickupProgress*10));const memory=clientState.memoryPickupKind==='memory';return <UiEntity uiTransform={{positionType:'absolute',position:{left:'50%',bottom:118},margin:'0 0 0 -210px',width:440,height:100,padding:'18px 22px 12px 22px',flexDirection:'column',borderWidth:0,zIndex:35}} uiBackground={{color:Color4.fromHexString('#08090bf2')}}><UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:440,height:100,zIndex:36,pointerFilter:'none'}} uiBackground={{texture:{src:memory?'Images/ui/exodus-expanded/memory-loading-frame.png':'Images/ui/exodus-expanded/data-loading-frame.png'},textureMode:'stretch'}}/><Label value={`${memory?'MEMORY PACK':'DATA RAM'} — COLLECTING ${sec}/10s`} fontSize={15} color={memory?c.red:c.cyan} uiTransform={{width:396,height:28}}/><UiEntity uiTransform={{width:396,height:16,borderColor:memory?c.red:c.blue,borderWidth:1}} uiBackground={{color:c.soft}}><UiEntity uiTransform={{width:`${pct}%`,height:16}} uiBackground={{color:memory?c.red:c.blue}}/></UiEntity></UiEntity>}

function memoryStoryPopup(){
 if(!clientState.memoryStoryOpen)return null
 const index=Math.max(1,clientState.memoryStoryIndex)
  const memoryPackPages:Record<number,string[]>={
  1:['Images/story/memory-packs/memory-pack-01-01.jpg','Images/story/memory-packs/memory-pack-01-02.jpg','Images/story/memory-packs/memory-pack-01-03.jpg','Images/story/memory-packs/memory-pack-01-04.jpg','Images/story/memory-packs/memory-pack-01-05.jpg','Images/story/memory-packs/memory-pack-01-06.jpg'],
  2:['Images/story/memory-packs/memory-pack-02-01.jpg','Images/story/memory-packs/memory-pack-02-02.jpg','Images/story/memory-packs/memory-pack-02-03.jpg','Images/story/memory-packs/memory-pack-02-04.jpg','Images/story/memory-packs/memory-pack-02-05.jpg','Images/story/memory-packs/memory-pack-02-06.jpg'],
  3:['Images/story/memory-packs/memory-pack-03-01.jpg','Images/story/memory-packs/memory-pack-03-02.jpg','Images/story/memory-packs/memory-pack-03-03.jpg','Images/story/memory-packs/memory-pack-03-04.jpg','Images/story/memory-packs/memory-pack-03-05.jpg','Images/story/memory-packs/memory-pack-03-06.jpg','Images/story/memory-packs/memory-pack-03-07.jpg'],
  4:['Images/story/memory-packs/memory-pack-04-01.jpg','Images/story/memory-packs/memory-pack-04-02.jpg','Images/story/memory-packs/memory-pack-04-03.jpg','Images/story/memory-packs/memory-pack-04-04.jpg','Images/story/memory-packs/memory-pack-04-05.jpg','Images/story/memory-packs/memory-pack-04-06.jpg'],
  5:['Images/story/memory-packs/memory-pack-05-01.jpg','Images/story/memory-packs/memory-pack-05-02.jpg','Images/story/memory-packs/memory-pack-05-03.jpg','Images/story/memory-packs/memory-pack-05-04.jpg','Images/story/memory-packs/memory-pack-05-05.jpg','Images/story/memory-packs/memory-pack-05-06.jpg'],
  6:['Images/story/memory-packs/memory-pack-06-01.jpg','Images/story/memory-packs/memory-pack-06-02.jpg','Images/story/memory-packs/memory-pack-06-03.jpg','Images/story/memory-packs/memory-pack-06-04.jpg','Images/story/memory-packs/memory-pack-06-05.jpg','Images/story/memory-packs/memory-pack-06-06.jpg'],
  7:['Images/story/memory-packs/memory-pack-07-01.jpg','Images/story/memory-packs/memory-pack-07-02.jpg','Images/story/memory-packs/memory-pack-07-03.jpg','Images/story/memory-packs/memory-pack-07-04.jpg','Images/story/memory-packs/memory-pack-07-05.jpg','Images/story/memory-packs/memory-pack-07-06.jpg'],
  8:['Images/story/memory-packs/memory-pack-08-01.jpg','Images/story/memory-packs/memory-pack-08-02.jpg','Images/story/memory-packs/memory-pack-08-03.jpg','Images/story/memory-packs/memory-pack-08-04.jpg','Images/story/memory-packs/memory-pack-08-05.jpg','Images/story/memory-packs/memory-pack-08-06.jpg'],
  9:['Images/story/memory-packs/memory-pack-09-01.jpg','Images/story/memory-packs/memory-pack-09-02.jpg','Images/story/memory-packs/memory-pack-09-03.jpg','Images/story/memory-packs/memory-pack-09-04.jpg','Images/story/memory-packs/memory-pack-09-05.jpg'],
  10:['Images/story/memory-packs/memory-pack-10-01.jpg','Images/story/memory-packs/memory-pack-10-02.jpg','Images/story/memory-packs/memory-pack-10-03.jpg','Images/story/memory-packs/memory-pack-10-04.jpg','Images/story/memory-packs/memory-pack-10-05.jpg'],
 }
 const pages=memoryPackPages[index]??[]
 const page=Math.min(clientState.memoryStoryPage,Math.max(0,pages.length-1)),hasNext=page<pages.length-1
 return <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',alignItems:'center',justifyContent:'center',zIndex:170,pointerFilter:'block'}} uiBackground={{color:Color4.fromHexString('#000000f4')}}><UiEntity uiTransform={clientState.isMobile?{width:'82%',height:'92%',positionType:'relative',borderWidth:0}:{width:1600,height:900,positionType:'relative',borderColor:c.red,borderWidth:2}}>{pages.length>0&&<UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:clientState.isMobile?'100%':1600,height:clientState.isMobile?'100%':900,zIndex:170}} uiBackground={{texture:{src:pages[page]},textureMode:'stretch'}}/>}{clientState.hoveredMenuButton==='memory-continue'&&<UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:'38.66%',bottom:'2.22%'}:{left:618,bottom:20},width:clientState.isMobile?'22.86%':365,height:clientState.isMobile?'8.41%':76,zIndex:172,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/memory-continue-hover.png'},textureMode:'stretch'}}/>}<Button value="" fontSize={1} color={Color4.fromHexString('#ffffff00')} uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:'38.66%',bottom:'2.22%'}:{left:618,bottom:20},width:clientState.isMobile?'22.86%':365,height:clientState.isMobile?'8.41%':76,borderWidth:0,zIndex:173}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>{clientState.hoveredMenuButton='memory-continue';playUiHoverSound()}} onMouseLeave={()=>{if(clientState.hoveredMenuButton==='memory-continue')clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();if(hasNext)clientState.memoryStoryPage+=1;else{clientState.memoryStoryOpen=false;clientState.memoryStoryPage=0;setStoryMusic(false)}}}/></UiEntity></UiEntity>
}

function cinematicOverlay(){if(!clientState.cinematicActive)return null;return <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:200,pointerFilter:'block'}} uiBackground={{color:Color4.fromHexString('#00000001')}}><Button value="[ F ]  SKIP CINEMATIC" fontSize={20} color={c.white} uiTransform={{positionType:'absolute',position:clientState.isMobile?{right:245,bottom:34}:{right:52,bottom:48},width:300,height:60,borderColor:c.red,borderWidth:2,zIndex:203}} uiBackground={{color:Color4.fromHexString('#080b0edd')}} onMouseDown={finishIntroCinematic}/></UiEntity>}
function dataStoryPopup(){
 if(!clientState.dataStoryOpen)return null
 const index=Math.max(1,clientState.dataStoryIndex)
 const dataRamPages:Record<number,string[]>={
 1:['Images/story/data-rams/data-ram-01-01.jpg','Images/story/data-rams/data-ram-01-02.jpg'],
 2:['Images/story/data-rams/data-ram-02-01.jpg'],3:['Images/story/data-rams/data-ram-03-01.jpg'],4:['Images/story/data-rams/data-ram-04-01.jpg'],
 5:['Images/story/data-rams/data-ram-05-01.jpg'],6:['Images/story/data-rams/data-ram-06-01.jpg'],7:['Images/story/data-rams/data-ram-07-01.jpg'],
 8:['Images/story/data-rams/data-ram-08-01.jpg'],9:['Images/story/data-rams/data-ram-09-01.jpg'],
 10:['Images/story/data-rams/data-ram-10-01.jpg','Images/story/data-rams/data-ram-10-02.jpg','Images/story/data-rams/data-ram-10-03.jpg'],
 11:['Images/story/data-rams/data-ram-11-01.jpg'],12:['Images/story/data-rams/data-ram-12-01.jpg','Images/story/data-rams/data-ram-12-02.jpg'],
 13:['Images/story/data-rams/data-ram-13-01.jpg','Images/story/data-rams/data-ram-13-02.jpg','Images/story/data-rams/data-ram-13-03.jpg'],
 14:['Images/story/data-rams/data-ram-14-01.jpg','Images/story/data-rams/data-ram-14-02.jpg','Images/story/data-rams/data-ram-14-03.jpg','Images/story/data-rams/data-ram-14-04.jpg']
 }
 const pages=dataRamPages[index]??[]
 const page=Math.min(clientState.dataStoryPage,Math.max(0,pages.length-1)),hasNext=page<pages.length-1
 return <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',zIndex:170,alignItems:'center',justifyContent:'center',pointerFilter:'block'}} uiBackground={{color:Color4.fromHexString('#000000f4')}}><UiEntity uiTransform={clientState.isMobile?{width:'82%',height:'92%',positionType:'relative',borderWidth:0}:{width:1600,height:900,positionType:'relative',borderColor:c.cyan,borderWidth:2}}>{pages.length>0&&<UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:clientState.isMobile?'100%':1600,height:clientState.isMobile?'100%':900,zIndex:170}} uiBackground={{texture:{src:pages[page]},textureMode:'stretch'}}/>}{clientState.hoveredMenuButton==='data-continue'&&<UiEntity uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:'38.66%',bottom:'2.22%'}:{left:618,bottom:20},width:clientState.isMobile?'22.86%':365,height:clientState.isMobile?'8.41%':76,zIndex:172,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/memory-continue-hover.png'},textureMode:'stretch'}}/>}<Button value="" fontSize={1} color={Color4.fromHexString('#ffffff00')} uiTransform={{positionType:'absolute',position:clientState.isMobile?{left:'38.66%',bottom:'2.22%'}:{left:618,bottom:20},width:clientState.isMobile?'22.86%':365,height:clientState.isMobile?'8.41%':76,borderWidth:0,pointerFilter:'block',zIndex:173}} uiBackground={{color:Color4.fromHexString('#00000001')}} onMouseEnter={()=>{clientState.hoveredMenuButton='data-continue';playUiHoverSound()}} onMouseLeave={()=>{if(clientState.hoveredMenuButton==='data-continue')clientState.hoveredMenuButton=''}} onMouseDown={()=>{playUiSelectSound();if(hasNext)clientState.dataStoryPage+=1;else{clientState.dataStoryOpen=false;clientState.dataStoryPage=0;setStoryMusic(false)}}}/></UiEntity></UiEntity>
}

function mobilePanelClose(){return null}

function mobilePanelFrames(){return null} // Mobile HUD uses its original clean panels without decorative red overlays
function mobileRightStackFrame(){return null}
function gameplayFrame(){const player=getLocalPlayerState();if(player&&!player.alive&&!clientState.eliminationDismissed)return null;if(clientState.isMobile)return null;return <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:1920,height:1080,zIndex:60,pointerFilter:'none'}} uiBackground={{texture:{src:'Images/ui/project-exodus-gameplay-frame.png'},textureMode:'stretch'}}/>}

function alphaTestLabel(){return <Label value="Alpha Test v0. 00" fontSize={16} color={c.white} uiTransform={{positionType:'absolute',position:{right:18,bottom:14},width:180,height:28,zIndex:165,pointerFilter:'none'}}/>}

function mobileWallpaper(){return <UiEntity uiTransform={{positionType:'absolute',position:{left:0,top:0},width:'100%',height:'100%',pointerFilter:'none',zIndex:1}} uiBackground={{texture:{src:'Images/ui/exodus-mobile-popup-wallpaper.jpg'},textureMode:'stretch'}}/>}
function hud(){if(clientState.welcomeOpen)return <UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>{welcomeScreen()}</UiEntity>;if(clientState.cinematicActive)return <UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>{cinematicOverlay()}</UiEntity>;if(!clientState.joined&&!clientState.joining)return <UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>{lobby()}</UiEntity>;const active=!clientState.insideOutpost;return <UiEntity uiTransform={{width:'100%',height:'100%',pointerFilter:'none'}}>{active&&compass()}{minimap()}{active&&mission()}{active&&matchInfo()}{active&&mobilePanelFrames()}{active&&mobileRightStackFrame()}{active&&survival()}{active&&ammo()}{active&&quickbar()}{active&&!clientState.isMobile&&controls()}{active&&(getLocalPlayerState()?.alive??true)&&gameplayFrame()}{active&&!clientState.aiming&&crosshair()}{controlsOverlay()}{badgeCollection()}{memoryPickup()}{memoryStoryPopup()}{dataStoryPopup()}{missionCompleteBanner()}{active&&!clientState.isMobile&&build()}{active&&mobile()}{active&&enemyTarget()}{active&&droneAlert()}{active&&damageIndicator()}{inventory()}{shop()}{missionTerminal()}{fullMap()}{note()}{!clientState.insideOutpost&&elimination()}{scopeOverlay()}{alphaTestLabel()}{mobilePanelClose()}</UiEntity>}
export function setupUi(){ReactEcsRenderer.setUiRenderer(hud,{virtualWidth:1920,virtualHeight:1080,screenInset:clientState.isMobile?'none':'device'})}