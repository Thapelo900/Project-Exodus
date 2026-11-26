PROJECT EXODUS — STEP 1 / PART A — SOLO ACHIEVEMENT COUNTERS
Source: Thapelo900/Project-Exodus, main branch, inspected 2026-10-21.

This is a SOURCE PATCH, not a full Creator Hub ZIP. It changes only src/client/localSolo.ts.
It fixes local Solo tracking for medkits used, ammunition rounds collected,
gear types collected, and locations discovered. It does not change badge names,
thresholds, or multiplayer server logic.

APPLY TO YOUR GITHUB WORKING COPY:
  git apply --check Project_Exodus_Step1_Solo_Badge_Counters.patch
  git apply Project_Exodus_Step1_Solo_Badge_Counters.patch
  npm run typecheck
  npm run build

TEST IN CREATOR HUB:
- Use an injured player to consume a medkit and check Survivor progress.
- Pick up ammunition and check Ammo Collector and Gear Master.
- Visit each named location and check Explorer / Scout Master progress.

IMPORTANT: Headshot recognition and persistent offline Solo badge storage are NOT
fixed by this patch. The multiplayer server's persistent storage is not available
when Solo falls back offline; claiming a persistence fix without implementing and
testing an appropriate storage mechanism would be misleading.

DO NOT COMMIT OR PUSH BEFORE TESTING AND USER APPROVAL.
