import struct,json,math,os
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=os.path.dirname(os.path.dirname(__file__))

def load_glb(path):
 b=open(path,'rb').read(); jl=struct.unpack_from('<I',b,12)[0]; js=json.loads(b[20:20+jl].decode().rstrip('\0 ')); p=20+jl; p+=(4-p%4)%4; bl=struct.unpack_from('<I',b,p)[0]; return js,bytearray(b[p+8:p+8+bl])
def save_glb(path,js,binb):
 js['buffers'][0]['byteLength']=len(binb); jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' '*((4-len(jb)%4)%4); bb=bytes(binb); bb+=b'\0'*((4-len(bb)%4)%4); js['buffers'][0]['byteLength']=len(bb); jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' '*((4-len(jb)%4)%4); out=bytearray(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(bb))); out+=struct.pack('<I4s',len(jb),b'JSON')+jb; out+=struct.pack('<I4s',len(bb),b'BIN\0')+bb; struct.pack_into('<I',out,8,len(out)); open(path,'wb').write(out)
def qrot(q): return R.from_quat(q if q is not None else [0,0,0,1])
def qarr(rot):
 q=rot.as_quat(); return (q/np.linalg.norm(q)).astype(np.float32)
def align_world(rest_world,target):
 v=rest_world.apply([0,1,0]); t=np.array(target,float); t/=np.linalg.norm(t); axis=np.cross(v,t); n=np.linalg.norm(axis); d=np.clip(np.dot(v,t),-1,1)
 if n<1e-8: delta=R.identity() if d>0 else R.from_rotvec([math.pi,0,0])
 else: delta=R.from_rotvec(axis/n*math.acos(d))
 return delta*rest_world

def accessor_array(js,binb,ai):
 a=js['accessors'][ai]; bv=js['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); n=a['count']; comps={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]; return np.frombuffer(binb,dtype='<f4',count=n*comps,offset=off).reshape(n,comps)
def replace_accessor(js,binb,ai,data):
 a=js['accessors'][ai]; bv=js['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); raw=np.asarray(data,dtype='<f4').tobytes(); oldlen=a['count']*({'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']])*4
 if len(raw)!=oldlen: raise RuntimeError('size mismatch')
 binb[off:off+oldlen]=raw

def fix(path):
 js,binb=load_glb(path); names={n.get('name'):i for i,n in enumerate(js['nodes']) if n.get('name')}; parent={}
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
 # v194: keep wrists/hands/fingers and weapon attachment exactly as v193.
 # Trigger-side chain: ~90 degree elbow, upper arm tucked down/back and forearm forward/up.
 # Support-side chain: elbow bent and forearm extended farther to the long-gun front handguard.
 targets={
  'Avatar_RightArm':[-0.10,-0.76,0.64],
  'Avatar_RightForeArm':[-0.03,0.64,0.77],
  'Avatar_LeftArm':[-0.42,-0.55,0.72],
  'Avatar_LeftForeArm':[-0.52,0.32,0.79],
 }
 pose={}
 for upper,fore in [('Avatar_RightArm','Avatar_RightForeArm'),('Avatar_LeftArm','Avatar_LeftForeArm')]:
  ui,fi=names[upper],names[fore]; pworld=world_rest(parent[ui]); uw=align_world(world_rest(ui),targets[upper]); pose[upper]=qarr(pworld.inv()*uw); fw=align_world(world_rest(fi),targets[fore]); pose[fore]=qarr(uw.inv()*fw)
 anim=js['animations'][0]; changed=[]
 for ch in anim['channels']:
  node=ch['target']['node']; name=js['nodes'][node].get('name');
  if ch['target']['path']=='rotation' and name in pose:
   samp=anim['samplers'][ch['sampler']]; arr=accessor_array(js,binb,samp['output']); arr[:]=pose[name]; replace_accessor(js,binb,samp['output'],arr); changed.append(name)
 if set(changed)!=set(pose): raise RuntimeError('missing arm channels '+repr(changed))
 js.setdefault('asset',{})['generator']='Project Exodus v194 elbow + second-grip fix (v193 preserved wrists/weapon)'
 save_glb(path,js,binb); print(os.path.basename(path),changed)

for title in ('Rifle','Shotgun'):
 fix(os.path.join(ROOT,'assets/Models',f'Project_Exodus_{title}_Shoot_emote.glb'))
