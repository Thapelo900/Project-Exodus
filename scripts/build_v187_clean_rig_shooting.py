import struct,json,math,os,copy
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=os.path.dirname(os.path.dirname(__file__))
CLEAN='/mnt/data/AvatarShape_B.glb'

def load_glb(path):
 b=open(path,'rb').read(); jl=struct.unpack_from('<I',b,12)[0]; js=json.loads(b[20:20+jl].decode().rstrip('\0 ')); p=20+jl; p+=(4-p%4)%4; bl=struct.unpack_from('<I',b,p)[0]; return js,bytearray(b[p+8:p+8+bl])
def save_glb(path,js,binb):
 js['buffers'][0]['byteLength']=len(binb)
 jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' ' * ((4-len(jb)%4)%4); bb=bytes(binb); bb+=b'\0'*((4-len(bb)%4)%4)
 js['buffers'][0]['byteLength']=len(bb)
 jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' ' * ((4-len(jb)%4)%4)
 out=bytearray(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(bb))); out+=struct.pack('<I4s',len(jb),b'JSON')+jb; out+=struct.pack('<I4s',len(bb),b'BIN\0')+bb; struct.pack_into('<I',out,8,len(out)); open(path,'wb').write(out)
def qrot(q): return R.from_quat(q if q is not None else [0,0,0,1])
def qarr(rot):
 q=rot.as_quat(); return (q/np.linalg.norm(q)).astype(np.float32)
def align_world(rest_world,target):
 v=rest_world.apply([0,1,0]); t=np.array(target,float); t/=np.linalg.norm(t)
 axis=np.cross(v,t); n=np.linalg.norm(axis); d=np.clip(np.dot(v,t),-1,1)
 if n<1e-8: delta=R.identity() if d>0 else R.from_rotvec([math.pi,0,0])
 else: delta=R.from_rotvec(axis/n*math.acos(d))
 return delta*rest_world

def make(kind,outname):
 js,binb=load_glb(CLEAN)
 names={n.get('name'):i for i,n in enumerate(js['nodes']) if n.get('name')}
 parent={}
 for i,n in enumerate(js['nodes']):
  for c in n.get('children',[]): parent[c]=i
 def local(i): return qrot(js['nodes'][i].get('rotation'))
 def world_rest(i):
  chain=[]; k=i
  while True:
   chain.append(k)
   if k not in parent: break
   k=parent[k]
  w=R.identity()
  for k in reversed(chain): w=w*local(k)
  return w
 # Target bone directions in clean-avatar world basis (+Z forward). These are built from the supplied clean rig,
 # not from the old synthetic emote axes.
 if kind=='pistol':
  rt=[0.08,-0.03,1.0]; rf=[0.03,0.00,1.0]; lt=[-0.10,-0.03,1.0]; lf=[-0.03,0.00,1.0]
 else:
  # shouldered long-gun: trigger arm forward with elbow tucked; support arm reaches inward/front under handguard
  rt=[0.10,-0.18,0.98]; rf=[0.03,0.06,1.0]; lt=[-0.32,-0.12,0.94]; lf=[-0.18,0.16,0.97]
 pose={}
 # keep shoulder bind rotations; solve arm world directions against clean rig
 for side,upper,fore,tup,tf in [
  ('R','Avatar_RightArm','Avatar_RightForeArm',rt,rf),
  ('L','Avatar_LeftArm','Avatar_LeftForeArm',lt,lf)]:
  ui,fi=names[upper],names[fore]
  pi=parent[ui]
  pworld=world_rest(pi)
  uw=align_world(world_rest(ui),tup)
  pose[upper]=qarr(pworld.inv()*uw)
  fw=align_world(world_rest(fi),tf)
  pose[fore]=qarr(uw.inv()*fw)
 # hands follow forearms using bind local rotation, preserving natural wrist alignment
 for h in ['Avatar_RightHand','Avatar_LeftHand']:
  pose[h]=np.array(js['nodes'][names[h]].get('rotation',[0,0,0,1]),dtype=np.float32)
 # subtle forward chest lean, otherwise bind
 pose['Avatar_Spine2']=np.array(js['nodes'][names['Avatar_Spine2']].get('rotation',[0,0,0,1]),dtype=np.float32)
 # append binary helper
 def append(data,target=34962):
  nonlocal binb
  while len(binb)%4: binb.append(0)
  off=len(binb); raw=np.asarray(data,dtype='<f4').tobytes(); binb.extend(raw)
  bv=len(js.setdefault('bufferViews',[])); js['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':len(raw)})
  return bv
 times=np.array([0.0,0.10,0.22,0.48],dtype=np.float32)
 tbv=append(times); ta=len(js.setdefault('accessors',[])); js['accessors'].append({'bufferView':tbv,'componentType':5126,'count':4,'type':'SCALAR','min':[0.0],'max':[0.48]})
 samplers=[]; channels=[]
 for bone,q in pose.items():
  # Hold the clean pose; add only a tiny recoil pulse on forearms by keeping pose stable for reliability.
  vals=np.tile(q,(4,1)).astype(np.float32)
  bv=append(vals); ac=len(js['accessors']); js['accessors'].append({'bufferView':bv,'componentType':5126,'count':4,'type':'VEC4'})
  si=len(samplers); samplers.append({'input':ta,'output':ac,'interpolation':'LINEAR'}); channels.append({'sampler':si,'target':{'node':names[bone],'path':'rotation'}})
 js['animations']=[{'name':f'Project_Exodus_{kind.title()}_Shoot_CleanRig','samplers':samplers,'channels':channels}]
 js.setdefault('asset',{})['generator']='Project Exodus v187 clean AvatarShape_B shooting pose builder'
 save_glb(outname,js,binb)
 print(kind,outname,os.path.getsize(outname),{k:[round(float(x),4) for x in v] for k,v in pose.items() if 'Arm' in k or 'ForeArm' in k})
for kind,title in [('rifle','Rifle'),('shotgun','Shotgun'),('pistol','Pistol')]:
 make(kind,os.path.join(ROOT,'assets/Models',f'Project_Exodus_{title}_Shoot_emote.glb'))
