import struct,json,os
import numpy as np
from scipy.spatial.transform import Rotation as R
ROOT=os.path.dirname(os.path.dirname(__file__))

def load(path):
 b=open(path,'rb').read(); jl=struct.unpack_from('<I',b,12)[0]; j=json.loads(b[20:20+jl].decode().rstrip('\0 ')); p=20+jl; p+=(4-p%4)%4; bl=struct.unpack_from('<I',b,p)[0]; return j,bytearray(b[p+8:p+8+bl])
def save(path,j,bb):
 j['buffers'][0]['byteLength']=len(bb); jb=json.dumps(j,separators=(',',':')).encode(); jb+=b' '*((4-len(jb)%4)%4); raw=bytes(bb); raw+=b'\0'*((4-len(raw)%4)%4); j['buffers'][0]['byteLength']=len(raw); jb=json.dumps(j,separators=(',',':')).encode(); jb+=b' '*((4-len(jb)%4)%4); out=bytearray(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(raw))); out+=struct.pack('<I4s',len(jb),b'JSON')+jb+struct.pack('<I4s',len(raw),b'BIN\0')+raw; struct.pack_into('<I',out,8,len(out)); open(path,'wb').write(out)
def arr(j,bb,ai):
 a=j['accessors'][ai]; bv=j['bufferViews'][a['bufferView']]; off=bv.get('byteOffset',0)+a.get('byteOffset',0); n=a['count']; c={'SCALAR':1,'VEC4':4}[a['type']]; return np.frombuffer(bb,dtype='<f4',count=n*c,offset=off).reshape(n,c)
def patch(title):
 p=os.path.join(ROOT,'assets/Models',f'Project_Exodus_{title}_Shoot_emote.glb'); j,bb=load(p); anim=j['animations'][0]
 # Correct signs observed in-world: v197 thigh spread drove feet inward/crossed; reverse that spread.
 # Head/neck x sign also leaned away from optic; reverse and increase slightly toward weapon.
 delta={'Avatar_LeftUpLeg':('z',34),'Avatar_RightUpLeg':('z',-34),'Avatar_Neck':('x',24),'Avatar_Head':('x',22)}
 for ch in anim['channels']:
  if ch['target']['path']!='rotation': continue
  nm=j['nodes'][ch['target']['node']].get('name')
  if nm not in delta: continue
  a,deg=delta[nm]; ai=anim['samplers'][ch['sampler']]['output']; x=arr(j,bb,ai)
  d=R.from_euler(a,deg,degrees=True)
  for i,q in enumerate(x):
   nq=(R.from_quat(q)*d).as_quat(); x[i]=nq/np.linalg.norm(nq)
 # keep knees softly bent but no animated foot twisting; feet remain under DCL bind orientation.
 j.setdefault('asset',{})['generator']='Project Exodus v198 corrected outward shooting stance + forward optic head lean'
 save(p,j,bb)
for t in ('Rifle','Shotgun','Pistol'): patch(t)
