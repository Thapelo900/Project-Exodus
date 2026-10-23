import { GENERATED_MISSIONS, type GeneratedMission } from './generatedMissions'

/** Strictly gameplay-earned progress. Legacy counters remain untouched. */
export const BADGE_OBJECTIVES = ['DEFEND','ELIMINATE','RECOVER','RECON','ESCORT','SABOTAGE','EXTRACT','HOLD'] as const
export const BADGE_GEAR = {rifle:1,pistol:2,shotgun:4,medkit:8,water:16,bomb:32} as const
export function completedMissionMask(mission:GeneratedMission){return 1<<BADGE_OBJECTIVES.indexOf(mission.objective)}
export function completedPlaceMask(mission:GeneratedMission){return mission.place==='plant'?1:mission.place==='docks'?2:mission.place==='arena'?4:0}
export function missionForIndex(index:number):GeneratedMission|undefined{return Number.isInteger(index)&&index>=0&&index<GENERATED_MISSIONS.length?GENERATED_MISSIONS[index]:undefined}
/** In-game clock: one daylight and nighttime cycle every 30 minutes of active match time. */
export const GAME_DAY_CYCLE_MS=30*60*1000
export function isInGameNight(matchStartsAt:number,now:number){const progress=((Math.max(0,now-matchStartsAt)%GAME_DAY_CYCLE_MS)/GAME_DAY_CYCLE_MS);return progress>=0.5}
export function missionIsFast(startedAt:number,now:number){return Number.isFinite(startedAt)&&startedAt>0&&now>=startedAt&&now-startedAt<=300000}
export function countBits(n:number){let c=0;for(let bits=n>>>0;bits;bits>>>=1)c+=bits&1;return c}
