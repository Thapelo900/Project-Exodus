import struct,json,math,os,zipfile,shutil
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=os.path.dirname(os.path.dirname(__file__))
V193='/mnt/data/v193_ref'

def load_glb(path):
 b=open(path,'rb').read(); jl=struct.unpack_from('<I',b,12)[0]; js=json.loads(b[20:20+jl].decode().rstrip('\0 ')); p=20+jl; p+=(4-p%4)%4; bl=struct.unpack_from('<I',b,p)[0]; return js,bytearray(b[p+8:p+8+bl])
def save_glb(path,js,binb):
 js['buffers'][0]['byteLength']=len(binb); jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' '*((4-len(jb)%4)%4); bb=bytes(binb); bb+=b'\0'*((4-len(bb)%4)%4); js['buffers'][0]['byteLength']=len(bb); jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' '*((4-len(jb)%4)%4); out=bytearray(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(bb))); out+=struct.pack('<I4s',len(jb),b'JSON')+jb; out+=struct.pack('<I4s',len(bb),b'BIN\0')+bb; struct.pack_into('<I',out,8,len(out)); open(path,'wb').write(out)
def qrot(q): return R.from_quat(q if q is not None else [0,0,0,1])
def qarr(rot):
 q=rot.as_quat(); return (q/np.linalg.norm(q)).astype(np.float32)
def accessor_array(js,binb,ai):
 a=js['accessors'][ai]; bv=js['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); n=a['count']; comps={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]; return np.frombuffer(binb,dtype='<f4',count=n*comps,offset=off).reshape(n,comps)
def replace_accessor(js,binb,ai,data):
 a=js['accessors'][ai]; bv=js['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); raw=np.asarray(data,dtype='<f4').tobytes(); binb[off:off+len(raw)]=raw
def anim_rotations(js,binb):
 out={}
 anim=js['animations'][0]
 for ch in anim['channels']:
  if ch['target']['path']!='rotation': continue
  name=js['nodes'][ch['target']['node']].get('name'); samp=anim['samplers'][ch['sampler']]
  if name: out[name]=accessor_array(js,binb,samp['output']).copy()
 return out
def parents(js):
 p={}
 for i,n in enumerate(js['nodes']):
  for c in n.get('children',[]): p[c]=i
 return p
def world_rotation(js, rots, name, frame=0):
 names={n.get('name'):i for i,n in enumerate(js['nodes']) if n.get('name')}; p=parents(js); i=names[name]; chain=[]
 while True:
  chain.append(i)
  if i not in p: break
  i=p[i]
 w=R.identity()
 for i in reversed(chain):
  nm=js['nodes'][i].get('name'); q=rots[nm][min(frame,len(rots[nm])-1)] if nm in rots else js['nodes'][i].get('rotation',[0,0,0,1]); w=w*qrot(q)
 return w

def set_const(js,binb,name,rot):
 anim=js['animations'][0]
 for ch in anim['channels']:
  if ch['target']['path']=='rotation' and js['nodes'][ch['target']['node']].get('name')==name:
   samp=anim['samplers'][ch['sampler']]; arr=accessor_array(js,binb,samp['output']); arr[:]=qarr(rot); replace_accessor(js,binb,samp['output'],arr); return
 # Bone was static in the source clip: add a constant rotation channel using the clip's existing time input.
 names={n.get('name'):i for i,n in enumerate(js['nodes']) if n.get('name')}; node=names[name]
 input_ai=anim['samplers'][0]['input']; times=accessor_array(js,binb,input_ai).copy(); count=len(times)
 while len(binb)%4: binb.append(0)
 off=len(binb); data=np.tile(qarr(rot),(count,1)).astype('<f4').tobytes(); binb.extend(data)
 bvi=len(js['bufferViews']); js['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(data)})
 ai=len(js['accessors']); js['accessors'].append({'bufferView':bvi,'componentType':5126,'count':count,'type':'VEC4'})
 si=len(anim['samplers']); anim['samplers'].append({'input':input_ai,'output':ai,'interpolation':'LINEAR'})
 anim['channels'].append({'sampler':si,'target':{'node':node,'path':'rotation'}})


def align_axis(current_world,target):
 v=current_world.apply([0,1,0]); t=np.array(target,float); t/=np.linalg.norm(t); axis=np.cross(v,t); n=np.linalg.norm(axis); d=np.clip(np.dot(v,t),-1,1)
 delta=R.identity() if n<1e-8 and d>0 else (R.from_rotvec([math.pi,0,0]) if n<1e-8 else R.from_rotvec(axis/n*math.acos(d)))
 return delta*current_world

def fix(title):
 path=os.path.join(ROOT,'assets/Models',f'Project_Exodus_{title}_Shoot_emote.glb')
 ref=os.path.join(V193,'assets/Models',f'Project_Exodus_{title}_Shoot_emote.glb')
 js,bb=load_glb(path); rjs,rbb=load_glb(ref); rots=anim_rotations(js,bb); rrots=anim_rotations(rjs,rbb)
 names={n.get('name'):i for i,n in enumerate(js['nodes']) if n.get('name')}; p=parents(js)
 # Preserve the useful v194 elbow bend, but make the support forearm reach farther down the handguard.
 # This moves the LEFT palm to the marked second/front grip without moving the weapon GLB.
 target=[-.38,.18,.91] if title=='Rifle' else [-.40,.16,.90]
 fw0=world_rotation(js,rots,'Avatar_LeftForeArm'); desired_fw=align_axis(fw0,target)
 armw=world_rotation(js,rots,'Avatar_LeftArm'); set_const(js,bb,'Avatar_LeftForeArm',armw.inv()*desired_fw)
 # Re-read pose after support edit, then compensate LEFT hand locally so its WORLD palm facing remains exactly v194.
 rots2=anim_rotations(js,bb); desired_left_hand_world=world_rotation(js,rots,'Avatar_LeftHand')
 forew=world_rotation(js,rots2,'Avatar_LeftForeArm'); set_const(js,bb,'Avatar_LeftHand',forew.inv()*desired_left_hand_world)
 # Straight weapon: retain the bent trigger elbow, but compensate the trigger hand/wrist so the hand's WORLD
 # orientation matches v193 (where the long gun sat level). This changes no weapon model transform/attachment.
 rots3=anim_rotations(js,bb); desired_right_hand_world=world_rotation(rjs,rrots,'Avatar_RightHand')
 right_forew=world_rotation(js,rots3,'Avatar_RightForeArm'); set_const(js,bb,'Avatar_RightHand',right_forew.inv()*desired_right_hand_world)
 # Scope posture: small forward head/neck lean only; no torso/weapon offsets.
 rots4=anim_rotations(js,bb); neck_local=qrot(rots4['Avatar_Neck'][0] if 'Avatar_Neck' in rots4 else js['nodes'][names['Avatar_Neck']].get('rotation',[0,0,0,1])); head_local=qrot(rots4['Avatar_Head'][0] if 'Avatar_Head' in rots4 else js['nodes'][names['Avatar_Head']].get('rotation',[0,0,0,1]))
 set_const(js,bb,'Avatar_Neck',neck_local*R.from_euler('x',-8,degrees=True))
 set_const(js,bb,'Avatar_Head',head_local*R.from_euler('x',-6,degrees=True))
 # Stable shooting stance matching the supplied wide-foot reference: thighs spread, knees softly bent, feet flattened.
 rots5=anim_rotations(js,bb)
 adjustments={
  'Avatar_LeftUpLeg':R.from_euler('z',-15,degrees=True)*R.from_euler('x',5,degrees=True),
  'Avatar_RightUpLeg':R.from_euler('z',15,degrees=True)*R.from_euler('x',5,degrees=True),
  'Avatar_LeftLeg':R.from_euler('x',-10,degrees=True),
  'Avatar_RightLeg':R.from_euler('x',-10,degrees=True),
  'Avatar_LeftFoot':R.from_euler('x',8,degrees=True)*R.from_euler('z',-5,degrees=True),
  'Avatar_RightFoot':R.from_euler('x',8,degrees=True)*R.from_euler('z',5,degrees=True),
 }
 for nm,adj in adjustments.items():
  base=qrot(rots5[nm][0] if nm in rots5 else js['nodes'][names[nm]].get('rotation',[0,0,0,1])); set_const(js,bb,nm,base*adj)
 js.setdefault('asset',{})['generator']='Project Exodus v195 straight long-gun + second grip + scope head + shooting stance'
 save_glb(path,js,bb)
 print('updated',title)

for t in ('Rifle','Shotgun'): fix(t)
