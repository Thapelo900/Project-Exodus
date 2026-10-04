import type { BuildKind, Difficulty, GameMode } from '../shared/config'

export const clientState = {
  pendingMode: '' as GameMode | '',
  welcomeOpen: true,
  welcomeLoadingUntil: 0,
  selectedMode: '' as GameMode | '',
  difficulty: 'normal' as Difficulty,
  joinSentAt: 0,
  joinStartedAt: 0,
  joinAttempts: 0,
  joining: false,
  cinematicActive: false,
  cinematicMode: '' as GameMode | '',
  localSolo: false,
  selectedBuild: 'wall' as BuildKind,
  notification: 'Connecting to Exodus command...',
  notificationUntil: 0,
  lastHeartbeat: 0,
  heartbeatObservedAt: 0,
  isMobile: false,
  mobileThirdPerson: false,
  joined: false,
  inventoryOpen: false,
  mapOpen: false,
  controlsOpen: false,
  badgesOpen: false,
  selectedBadge: 0,
  insideOutpost: true,
  aiming: false,
  scopeToggled: false,
  shopOpen: false,
  missionTerminalOpen: false,
  missionTerminalSelected: 0,
  missionTerminalPage: 0,
  completedGeneratedMissions: new Set<number>(),
  collectedMemoryIds: new Set<number>(),
  collectedDataRamIds: new Set<number>(),
  missionMemoryFound: 0,
  missionDataRamFound: 0,
  missionAcceptedIndex: -1,
  memoryPacksCollected: 0,
  dataRamsCollected: 0,
  heading: 0,
  missionDistance: 0,
  missionCompletionSent: '',
  eliminationDismissed: false,
  enemyTargetName: '',
  enemyTargetHp: 0,
  enemyTargetMaxHp: 0,
  droneAlert: '',
  droneAlertUntil: 0,
  damageDirection: '',
  damageUntil: 0,
  lastObservedHp: 100,
  lastRound: 0,
  hoveredMenuButton: '',
  traderTab: 'browse',
  traderSelectedBadge: 0,
  memoryPickupKind: '' as ''|'memory'|'ram',
  memoryPickupProgress: 0,
  memoryPickupActive: false,
  memoryStoryOpen: false,
  memoryStoryIndex: 0,
  memoryStoryPage: 0,
  dataStoryOpen: false,
  dataStoryIndex: 0,
  dataStoryPage: 0
}

export function notify(text: string, seconds = 3) {
  clientState.notification = text
  clientState.notificationUntil = Date.now() + seconds * 1000
}

export function observeHeartbeat(value: number) {
  if (value !== clientState.lastHeartbeat) {
    clientState.lastHeartbeat = value
    clientState.heartbeatObservedAt = Date.now()
  }
}

export function isServerAlive() {
  return clientState.heartbeatObservedAt > 0 && Date.now() - clientState.heartbeatObservedAt < 7000
}
