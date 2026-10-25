#!/usr/bin/env python3
"""Turn v24 spawn camera target 180 degrees, -Z to +Z. Backups first."""
from pathlib import Path
import json,re,shutil
root=Path(__file__).resolve().parent
scene=root/'scene.json'; setup=root/'src/client/setup.ts'
if not scene.is_file() or not setup.is_file():
    raise SystemExit('Place this script in the Project Exodus root beside scene.json and src/client/setup.ts')
data=json.loads(scene.read_text(encoding='utf-8'))
sp=next((s for s in data.get('spawnPoints',[]) if s.get('default')),None)
if sp is None: raise SystemExit('Default spawn missing; nothing changed')
x=sum(sp['position']['x'])/2; z=sum(sp['position']['z'])/2
sp['cameraTarget']={'x':round(x,4),'y':2.6,'z':round(z+7.25,4)}
code=setup.read_text(encoding='utf-8')
pattern=r'(function\s+moveToOutpost\s*\(\s*\)\s*\{[\s\S]*?cameraTarget:\s*Vector3\.create\s*\()([^)]*)(\))'
updated,n=re.subn(pattern,lambda m:m.group(1)+f'{sp["cameraTarget"]["x"]}, 2.6, {sp["cameraTarget"]["z"]}'+m.group(3),code,count=1)
if n!=1: raise SystemExit('Return-to-Outpost target not found; no files changed')
for p in (scene,setup):
    b=p.with_name(p.name+'.pre-v25.bak')
    if not b.exists(): shutil.copy2(p,b)
scene.write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
setup.write_text(updated,encoding='utf-8')
print('v25 applied: 180-degree reversal of v24 spawn target (-Z to +Z); position unchanged.')
