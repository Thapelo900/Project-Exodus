import { LOCATIONS, type LocationId } from './config'

export type GeneratedDifficulty='EASY'|'MEDIUM'|'HARD'|'SPECIAL'
export type GeneratedObjective='DEFEND'|'ELIMINATE'|'RECOVER'|'RECON'|'ESCORT'|'SABOTAGE'|'EXTRACT'|'HOLD'
export type GeneratedMission={id:number;name:string;place:LocationId;objective:GeneratedObjective;difficulty:GeneratedDifficulty;enemySet:string;brief:string;memory:number;ram:number;materials:number;bombs:number;shieldCells:number;lifeCredits:number;reachable:boolean}
const PLACES:LocationId[]=['outpost','city','arena','docks','plant','ruins','camp','beach']
const OBJECTIVES:GeneratedObjective[]=['DEFEND','ELIMINATE','RECOVER','RECON','ESCORT','SABOTAGE','EXTRACT','HOLD']
const ENEMIES=['Mutants','Drones','Mutants + Drones','King Mutant escort','Mixed hostiles']
const NAMES=['OUTPOST RECOVERY','BROKEN SIGNAL','HOSTILE TRACE','SUPPLY LINE','BLACKOUT ECHO','ISLAND SWEEP','SYSTEM RESTORE','EXODUS TRACE','NIGHT WATCH','LAST ROUTE']
const authoredMemoryCount=1,authoredRamCount=1
function hash(n:number,salt:number){let x=(n*1103515245+12345+salt*2654435761)>>>0;x^=x>>>16;return x>>>0}
function difficulty(n:number):GeneratedDifficulty{return n%20===0?'SPECIAL':n%5===0?'HARD':n%3===0?'MEDIUM':'EASY'}
function rewards(d:GeneratedDifficulty,o:GeneratedObjective){const k=d==='SPECIAL'?4:d==='HARD'?3:d==='MEDIUM'?2:1;return{materials:4+k*3+(o==='RECOVER'?3:0),bombs:o==='ELIMINATE'||o==='SABOTAGE'?Math.max(1,k-1):Math.max(0,k-2),shieldCells:o==='DEFEND'||o==='HOLD'?k:Math.max(1,k-1),lifeCredits:d==='SPECIAL'?1:(d==='HARD'&&o==='EXTRACT'?1:0)}}
function makeMission(id:number):GeneratedMission{
 if(id===1)return{id:1,name:'FIRST OUTPOST DISCOVERY',place:'outpost',objective:'RECOVER',difficulty:'EASY',enemySet:'Outpost perimeter hostiles',brief:'Search The Outpost and recover Memory Pack 01 and Data RAM 01. Both discoveries remain recoverable if either is missed.',memory:1,ram:1,materials:7,bombs:1,shieldCells:1,lifeCredits:0,reachable:true}
 const place=PLACES[hash(id,3)%PLACES.length],objective=OBJECTIVES[hash(id,7)%OBJECTIVES.length],d=difficulty(id),enemySet=ENEMIES[hash(id,11)%ENEMIES.length],r=rewards(d,objective)
 // Story/intel text is never generated. Only authored entries can be scheduled.
 const memory=authoredMemoryCount>1&&id%9===0?1:0,ram=authoredRamCount>1&&id%7===0?1:0
 const loc=LOCATIONS[place]
 const brief=`${objective} operation at ${loc.name}. Secure the marked route, deal with ${enemySet.toLowerCase()}, complete the objective, and extract. ${memory+ram>0?'Authored archive discovery available.':'No new authored archive discovery is assigned to this operation.'}`
 return{id,name:`${NAMES[(id-1)%NAMES.length]} ${String(id).padStart(3,'0')}`,place,objective,difficulty:d,enemySet,brief,memory,ram,...r,reachable:Number.isFinite(loc.x)&&Number.isFinite(loc.z)}
}
export const GENERATED_MISSIONS:GeneratedMission[]=Array.from({length:100},(_,i)=>makeMission(i+1))
export const GENERATED_MISSION_VALIDATION={count:GENERATED_MISSIONS.length,allReachable:GENERATED_MISSIONS.every(m=>m.reachable&&m.brief.length>0&&m.enemySet.length>0),invalid:GENERATED_MISSIONS.filter(m=>!m.reachable).map(m=>m.id)}
