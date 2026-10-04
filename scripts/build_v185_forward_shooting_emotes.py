import struct,json,math,os,copy
import numpy as np
BASE='assets/Models/Project_Exodus_Rifle_Shoot_emote.glb'
ROOT=os.path.dirname(os.path.dirname(__file__))

def quat_euler(x=0,y=0,z=0):
    # XYZ Euler degrees -> quaternion
    x,y,z=map(math.radians,(x,y,z)); cx,sx=math.cos(x/2),math.sin(x/2); cy,sy=math.cos(y/2),math.sin(y/2); cz,sz=math.cos(z/2),math.sin(z/2)
    q=np.array([sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz, cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz],dtype=np.float32)
    return q/np.linalg.norm(q)

def load_glb(path):
    b=open(path,'rb').read(); jl=struct.unpack_from('<I',b,12)[0]; js=json.loads(b[20:20+jl].decode().rstrip('\0 ')); p=20+jl; p+=(4-p%4)%4; bl=struct.unpack_from('<I',b,p)[0]; return js,bytearray(b[p+8:p+8+bl])

def save_glb(path,js,binb):
    jb=json.dumps(js,separators=(',',':')).encode(); jb+=b' ' * ((4-len(jb)%4)%4); bb=bytes(binb); bb+=b'\0'*((4-len(bb)%4)%4)
    out=bytearray(struct.pack('<4sII',b'glTF',2,12+8+len(jb)+8+len(bb))); out+=struct.pack('<I4s',len(jb),b'JSON')+jb; out+=struct.pack('<I4s',len(bb),b'BIN\0')+bb; struct.pack_into('<I',out,8,len(out)); open(path,'wb').write(out)

def set_channel(js,binb,node_name,values):
    anim=js['animations'][0]; node_idx=next(i for i,n in enumerate(js['nodes']) if n.get('name')==node_name)
    ch=next(c for c in anim['channels'] if c['target']['node']==node_idx)
    acc=js['accessors'][anim['samplers'][ch['sampler']]['output']]; bv=js['bufferViews'][acc['bufferView']]; start=bv.get('byteOffset',0)+acc.get('byteOffset',0)
    arr=np.asarray(values,dtype='<f4').reshape(acc['count'],-1); raw=arr.tobytes(); binb[start:start+len(raw)]=raw

def make(name,kind,shoot):
    js,binb=load_glb(os.path.join(ROOT,BASE)); js['animations'][0]['name']=name
    # v185: runtime v184 screenshots show the negative-Y right-arm pose points vertically upward.
    # Reverse the shoulder yaw for the shooting clips only: right arm positive Y, left arm negative Y.
    # This drives both upper arms horizontally forward; left forearm stays bent as weapon support.
    if shoot:
        # Aim forward at shoulder/chest height. Right arm: -X -> +Z (+Y rotation). Left: +X -> +Z (-Y rotation).
        if kind=='pistol':
            r=[quat_euler(-4,82,-3), quat_euler(-7,78,-3), quat_euler(-4,82,-3), quat_euler(-4,82,-3)]
            rf=[quat_euler(0,2,-3), quat_euler(-5,2,-4), quat_euler(0,2,-3), quat_euler(0,2,-3)]
            l=[quat_euler(3,-72,5), quat_euler(2,-68,5), quat_euler(3,-72,5), quat_euler(3,-72,5)]
            lf=[quat_euler(-2,18,28), quat_euler(-4,22,32), quat_euler(-2,18,28), quat_euler(-2,18,28)]
        else:
            r=[quat_euler(-4,80,-4), quat_euler(-8,75,-4), quat_euler(-4,80,-4), quat_euler(-4,80,-4)]
            rf=[quat_euler(-3,4,-8), quat_euler(-8,5,-10), quat_euler(-3,4,-8), quat_euler(-3,4,-8)]
            l=[quat_euler(4,-68,6), quat_euler(3,-64,6), quat_euler(4,-68,6), quat_euler(4,-68,6)]
            lf=[quat_euler(-3,32,38), quat_euler(-6,36,42), quat_euler(-3,32,38), quat_euler(-3,32,38)]
        spine=[quat_euler(-3,0,0),quat_euler(-6,0,0),quat_euler(-3,0,0),quat_euler(-3,0,0)]
    else:
        # Low-ready: both long guns diagonally across torso and down; pistol lowered in right hand.
        if kind=='pistol':
            r=[quat_euler(10,-42,-8)]*4; rf=[quat_euler(8,-4,-22)]*4
            l=[quat_euler(4,8,8)]*4; lf=[quat_euler(0,4,6)]*4
        else:
            r=[quat_euler(12,-48,-10)]*4; rf=[quat_euler(12,-8,-24)]*4
            l=[quat_euler(10,46,12)]*4; lf=[quat_euler(6,8,38)]*4
        spine=[quat_euler(-1,0,0)]*4
    set_channel(js,binb,'Avatar_Spine2',spine)
    set_channel(js,binb,'Avatar_RightShoulder',[quat_euler(0,4,-4)]*4)
    set_channel(js,binb,'Avatar_RightArm',r); set_channel(js,binb,'Avatar_RightForeArm',rf); set_channel(js,binb,'Avatar_RightHand',[quat_euler(0,0,0)]*4)
    set_channel(js,binb,'Avatar_LeftArm',l); set_channel(js,binb,'Avatar_LeftForeArm',lf)
    out=os.path.join(ROOT,'assets/Models',name+'_emote.glb'); save_glb(out,js,binb); print(out)

for kind,title in [('rifle','Rifle'),('shotgun','Shotgun'),('pistol','Pistol')]:
    make(f'Project_Exodus_{title}_Shoot',kind,True)
