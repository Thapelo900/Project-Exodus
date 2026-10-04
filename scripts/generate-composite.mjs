import { readFile, writeFile } from 'node:fs/promises'

const compositePath = new URL('../assets/scene/main.composite', import.meta.url)
const scenePath = new URL('../scene.json', import.meta.url)
const composite = JSON.parse(await readFile(compositePath, 'utf8'))
const scene = JSON.parse(await readFile(scenePath, 'utf8'))
const entities = []
let nextId = 512
const C = {
  ocean:{r:.025,g:.18,b:.24,a:1},sand:{r:.63,g:.53,b:.34,a:1},grass:{r:.16,g:.27,b:.18,a:1},grass2:{r:.1,g:.2,b:.13,a:1},road:{r:.12,g:.13,b:.14,a:1},concrete:{r:.34,g:.36,b:.36,a:1},charcoal:{r:.055,g:.065,b:.075,a:1},steel:{r:.13,g:.16,b:.18,a:1},rust:{r:.37,g:.16,b:.08,a:1},orange:{r:.92,g:.2,b:.04,a:1},red:{r:.75,g:.035,b:.025,a:1},cyan:{r:.02,g:.62,b:.9,a:1},blue:{r:.03,g:.22,b:.38,a:1},white:{r:.86,g:.9,b:.9,a:1},wood:{r:.28,g:.17,b:.09,a:1},leaf:{r:.12,g:.32,b:.16,a:1},leaf2:{r:.22,g:.4,b:.18,a:1},black:{r:.012,g:.016,b:.02,a:1}
}
function q(xd=0,yd=0,zd=0){const x=xd*Math.PI/360,y=yd*Math.PI/360,z=zd*Math.PI/360,cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);return{x:sx*cy*cz-cx*sy*sz,y:cx*sy*cz+sx*cy*sz,z:cx*cy*sz-sx*sy*cz,w:cx*cy*cz+sx*sy*sz}}
function add(name,x,y,z,sx,sy,sz,color,o={}){const e={id:nextId++,name,position:{x,y,z},scale:{x:sx,y:sy,z:sz},rotation:q(o.pitch,o.yaw,o.roll),color,mesh:o.mesh||'box',gltf:o.gltf,collider:!!o.collider,emissive:!!o.emissive,text:o.text,cameraArea:o.cameraArea,absolute:!!o.absolute};entities.push(e);return e.id}
const box=(n,x,y,z,sx,sy,sz,c,o={})=>add(n,x,y,z,sx,sy,sz,c,o)
const cyl=(n,x,y,z,sx,sy,sz,c,o={})=>add(n,x,y,z,sx,sy,sz,c,{...o,mesh:'cylinder'})
const sphere=(n,x,y,z,s,c,o={})=>add(n,x,y,z,s,s,s,c,{...o,mesh:'sphere'})
const text=(n,value,x,y,z,size=2,yaw=0,color=C.white)=>add(n,x,y,z,1,1,1,color,{text:{value,size},yaw})
const model=(n,src,x,y,z,s=1,o={})=>add(n,x,y,z,s,s,s,C.white,{...o,gltf:src})
const modelScaled=(n,src,x,y,z,sx,sy,sz,o={})=>add(n,x,y,z,sx,sy,sz,C.white,{...o,gltf:src})
function bridgeBetween(name,ax,az,bx,bz){const rawDx=bx-ax,rawDz=bz-az,rawLength=Math.hypot(rawDx,rawDz),pad=10,ux=rawDx/rawLength,uz=rawDz/rawLength;ax-=ux*pad;az-=uz*pad;bx+=ux*pad;bz+=uz*pad;const dx=bx-ax,dz=bz-az,length=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz)*180/Math.PI,x=(ax+bx)/2,z=(az+bz)/2,offsetX=dz/length*4.15,offsetZ=-dx/length*4.15;box(`${name} Deck`,x,1.75,z,8,.7,length,C.steel,{collider:true,yaw,absolute:true});box(`${name} Road`,x,2.12,z,6.8,.12,length,C.road,{collider:true,yaw,absolute:true});box(`${name} Rail Left`,x+offsetX,2.65,z+offsetZ,.22,1.45,length,C.orange,{collider:true,yaw,absolute:true});box(`${name} Rail Right`,x-offsetX,2.65,z-offsetZ,.22,1.45,length,C.orange,{collider:true,yaw,absolute:true});const supports=Math.max(1,Math.floor(length/18));for(let i=1;i<=supports;i++){const t=i/(supports+1);cyl(`${name} Support ${i}L`,ax+dx*t+offsetX*.72,.15,az+dz*t+offsetZ*.72,.7,3.2,.7,C.concrete,{collider:true,absolute:true});cyl(`${name} Support ${i}R`,ax+dx*t-offsetX*.72,.15,az+dz*t-offsetZ*.72,.7,3.2,.7,C.concrete,{collider:true,absolute:true})}}
function openBuilding(name,x,z,w,h,d,accent=C.orange){const front=z-d/2,back=z+d/2,door=Math.min(3.4,w*.34),side=(w-door)/2,wall=.35;box(`${name} Floor`,x,.2,z,w,.35,d,C.concrete,{collider:true});box(`${name} Roof`,x,h,z,w,.35,d,C.charcoal,{collider:true});box(`${name} Back Wall`,x,h/2,back,w,h,wall,C.charcoal,{collider:true});box(`${name} Left Wall`,x-w/2,h/2,z,wall,h,d,C.steel,{collider:true});box(`${name} Right Wall`,x+w/2,h/2,z,wall,h,d,C.steel,{collider:true});box(`${name} Door Left`,x-door/2-side/2,h/2,front,side,h,wall,C.charcoal,{collider:true});box(`${name} Door Right`,x+door/2+side/2,h/2,front,side,h,wall,C.charcoal,{collider:true});box(`${name} Door Lintel`,x,h-1,front,door,2,wall,C.charcoal,{collider:true});box(`${name} Accent`,x,h+.1,front,w+.2,.22,.25,accent,{emissive:true})}
function crate(n,x,z,c=C.rust){box(n,x,.65,z,1.25,1.25,1.25,c,{collider:true});box(`${n} Band`,x,.68,z,1.31,.16,1.31,C.steel)}
function container(n,x,z,c=C.rust,yaw=0){box(n,x,1.35,z,6,2.7,2.45,c,{collider:true,yaw});box(`${n} Doors`,x,1.35,z-1.24,5.4,2.25,.08,C.steel,{yaw})}
function lamp(n,x,z){cyl(`${n} Pole`,x,2.2,z,.16,4.4,.16,C.charcoal,{collider:true});box(`${n} Light`,x,4.35,z,.7,.18,.7,C.cyan,{emissive:true})}
function tree(n,x,z,s=1){cyl(`${n} Trunk`,x,1.1*s,z,.42*s,2.2*s,.42*s,C.wood,{collider:true});sphere(`${n} Crown`,x,2.8*s,z,1.75*s,C.leaf,{collider:true});sphere(`${n} Crown B`,x+.7*s,2.45*s,z+.2*s,1.1*s,C.leaf2)}
function palm(n,x,z,s=1){cyl(`${n} Trunk`,x,2*s,z,.38*s,4*s,.38*s,C.wood,{collider:true,pitch:-4});for(let i=0;i<5;i++)box(`${n} Leaf ${i}`,x+Math.sin(i*1.257)*1.1*s,4.1*s,z+Math.cos(i*1.257)*1.1*s,.55*s,.12*s,2.5*s,C.leaf2,{yaw:i*72})}
function rock(n,x,z,s=1){sphere(n,x,.55*s,z,1.4*s,C.concrete,{collider:true});box(`${n} Face`,x+.2*s,.85*s,z-.25*s,1.4*s,1.3*s,1.1*s,C.steel,{pitch:15,yaw:25,collider:true})}
function tent(n,x,z,yaw=0){box(`${n} Base`,x,.12,z,4,.22,4,C.sand,{collider:true,yaw});box(`${n} Canvas`,x,1.35,z,3.8,.12,4,C.grass2,{pitch:32,yaw,collider:true});box(`${n} Canvas B`,x,1.35,z,3.8,.12,4,C.grass2,{pitch:-32,yaw,collider:true})}

box('Ocean',240,-.3,240,480,.5,480,C.ocean,{absolute:true});box('Island Sand Shelf',240,.02,240,468,.22,462,C.sand,{collider:true,absolute:true});box('Island Interior',238,.17,244,444,.24,438,C.grass,{collider:true,absolute:true})
// Visible sea cuts and river channels match the generated minimap. Roads remain slightly above the water and bridges cross the three main channels.
for(const[n,x,z,sx,sz,yaw]of[
  ['West River',172.5,243.75,22,150,0],['North River',240,307.5,150,22,0],['East River',315,225,22,130,0],
  ['Dock Harbour',444,217.5,66,132,0],['Beach Bay',410,34,126,48,0],['Southwest Cove',86,20,140,38,0],
  ['Northwest Coast Cut',22,448,125,80,28],['Northeast Coast Cut',458,451,126,84,-26],
  ['Southwest Coast Cut',24,25,116,70,-26],['Southeast Coast Cut',461,23,120,76,28]
])box(n,x,.33,z,sx,.12,sz,C.ocean,{yaw,absolute:true})
for(const [n,x,z,s] of [['NW',6,116,2.2],['N',38,122,2.8],['NE',82,120,3.2],['W',5,52,2.5],['SW',8,9,2.2],['SE',119,10,2.6]])rock(`Coast Rock ${n}`,x,z,s)
const roads=[['West Road',20,65,32,5,0],['City Spine',64,65,56,6,90],['North Road',64,88,46,5,0],['Camp Road',87,94,43,4,90],['South Road',64,44,43,5,0],['Ruins Road',42,38,42,4,55],['Dock Road',92,60,34,5,90],['Beach Road',88,25,48,4,55]]
for(const[n,x,z,len,w,yaw]of roads)box(n,x,.36,z,w,.16,len,C.road,{collider:true,yaw})
for(const[i,x,z,yaw]of[[1,46,65,90],[2,64,82,0],[3,84,60,90]]){box(`Bridge ${i}`,x,.7,z,7,.45,10,C.steel,{collider:true,yaw});for(const side of[-1,1])box(`Bridge ${i} Rail ${side}`,x+side*3.2,1.3,z,.16,1.2,10,C.orange,{yaw})}

// Fortified Outpost with open entrance and fully walkable interior.
const ox=20,oz=75;box('Outpost Foundation',ox,.45,oz,30,.9,27,C.concrete,{collider:true});box('Outpost Lobby Floor',ox,.98,oz,25,.18,22,C.steel,{collider:true})
box('Outpost West Wall',7.7,4.5,oz,.6,7,22,C.charcoal,{collider:true});box('Outpost North Wall',ox,4.5,85.7,25,7,.6,C.charcoal,{collider:true});box('Outpost South Wall',ox,4.5,64.3,25,7,.6,C.charcoal,{collider:true});box('Outpost East Wall North',32.3,4.5,81.2,.6,7,9,C.charcoal,{collider:true});box('Outpost East Wall South',32.3,4.5,68.8,.6,7,9,C.charcoal,{collider:true});box('Outpost Entrance Lintel',32.3,7.1,75,.6,1.8,4,C.charcoal,{collider:true})
box('Outpost Roof North',ox,8.1,82.2,25,.4,7,C.charcoal,{collider:true});box('Outpost Roof South',ox,8.1,67.8,25,.4,7,C.charcoal,{collider:true});box('Outpost Roof West',13,8.1,75,11,.4,8,C.charcoal,{collider:true})
for(let i=0;i<4;i++)box(`Outpost Stair ${i+1}`,36.5-i*1.2,.2+i*.2,75,1.7,.25+i*.12,7,C.concrete,{collider:true});box('Outpost Entrance Glow',32.62,4.5,75,.08,4.8,3.6,C.cyan,{emissive:true});text('Outpost Brand','PROJECT EXODUS',32.65,7.2,75,2.4,90,C.white);text('Outpost Tagline','SURVIVE  EXPLORE  TRADE  REBUILD',32.68,6.4,75,1.1,90,C.cyan)
cyl('Outpost Hologram Base',22,1.3,75,4,.55,4,C.charcoal,{collider:true});cyl('Outpost Hologram Ring',22,1.65,75,3.4,.12,3.4,C.cyan,{emissive:true});sphere('Outpost Holographic Globe',22,3.5,75,2.5,C.cyan,{emissive:true});box('Outpost Globe Axis',22,3.5,75,.12,4.3,.12,C.white,{pitch:22,emissive:true});text('Lobby Motto','SURVIVE\nEXPLORE\nTRADE\nREBUILD',9,4,75,1.25,90,C.white)
box('Trader Counter',28,2,82,6,2,1.2,C.charcoal,{collider:true});box('Trader Counter Glow',28,2.75,81.38,6,.12,.08,C.orange,{emissive:true});box('Outpost Shop Terminal',29.5,3,81.3,1.2,1.3,.28,C.blue,{collider:true,emissive:true});cyl('Trader NPC Body',26.5,3.35,83.1,1.1,2.4,1.1,C.rust,{collider:true});sphere('Trader NPC Head',26.5,4.8,83.1,1,C.concrete);box('Trader NPC Visor',26.5,4.85,82.62,.72,.23,.08,C.cyan,{emissive:true});for(let i=0;i<3;i++){box(`Trader Shelf ${i}`,25.6+i*1.8,3.6,85.1,1.4,3,.35,C.steel,{collider:true});crate(`Trader Supply ${i}`,25.6+i*1.8,84.5,i===1?C.orange:C.rust)}text('Trader Sign','TRADER  SHOP',28,5.5,85.35,1.3,180,C.orange)
box('Mission Board Frame',28,3.6,64.75,7,4,.35,C.charcoal,{collider:true});box('Outpost Mission Board',28,3.6,64.52,6.2,3.2,.18,C.blue,{collider:true,emissive:true});text('Mission Board Label','MISSION BOARD\nREACH EXODUS CITY',28,3.8,64.38,1.15,0,C.white);box('Mission Desk',28,1.6,67,5,1.2,1.4,C.steel,{collider:true})
for(let i=0;i<4;i++){box(`Gear Locker ${i}`,9.1,2.8,80+i*1.45,.8,3.6,1.1,C.steel,{collider:true});box(`Gear Locker Glow ${i}`,9.55,3.1,80+i*1.45,.04,1.6,.5,C.cyan,{emissive:true})}box('Outpost Inventory Terminal',11,2.5,84.5,1.4,1.5,.4,C.blue,{collider:true,emissive:true});box('Weapon Rack',13,3,85.2,4,3,.35,C.charcoal,{collider:true});for(let i=0;i<3;i++)box(`Rack Weapon ${i}`,12+i,3,84.95,.16,.18,2,C.orange,{pitch:90});text('Gear Room Sign','GEAR  STORAGE',12,5.4,85.35,1.2,180,C.cyan)
for(const[i,x,z,yaw]of[[0,11,68,0],[1,15,66.5,90]]){box(`Lounge Couch ${i} Seat`,x,1.55,z,4,.7,1.6,C.rust,{collider:true,yaw});box(`Lounge Couch ${i} Back`,x,2.2,z+.7,4,1.5,.35,C.rust,{collider:true,yaw})}box('Lounge Table',15,1.35,70.5,3,.35,2,C.wood,{collider:true});cyl('Lounge Plant',9,1.5,65.5,1,1,1,C.rust,{collider:true});sphere('Lounge Plant Leaves',9,2.8,65.5,1.4,C.leaf2);text('Lounge Philosophy','GOOD PEOPLE\nBUILD BETTER WORLDS',8.1,4.2,70,1.3,90,C.white)
for(const[i,x,z]of[[1,8.5,65.2],[2,8.5,84.8],[3,31.5,65.2],[4,31.5,84.8]]){box(`Outpost Tower ${i}`,x,6,z,3.2,10,3.2,C.charcoal,{collider:true});box(`Outpost Tower Light ${i}`,x,10.4,z,3.4,.2,3.4,i%2?C.orange:C.cyan,{emissive:true})}box('Outpost Control Room',20,10,75,9,4,7,C.charcoal,{collider:true});box('Control Room Window',24.52,10,75,.08,2.5,4.8,C.blue,{emissive:true});cyl('Outpost Antenna',19,14.5,75,.15,5,.15,C.orange);for(let i=0;i<3;i++)box(`Antenna Arm ${i}`,19,13+i*.8,75,2,.08,.08,C.white,{yaw:i*60});cyl('Satellite Mast',25,13,78,.2,4,.2,C.steel);sphere('Satellite Dish',25.8,15,78,1.7,C.concrete,{pitch:38});for(const[i,x,z]of[[0,35,70],[1,36,81],[2,31,61]])crate(`Outpost Exterior Crate ${i}`,x,z);for(const[i,x,z]of[[0,37,65],[1,37,75],[2,37,85]])lamp(`Outpost Lamp ${i}`,x,z)

// Regional landmarks.
const city=[[42,51,9,7,8],[52,58,9,7,8],[62,55,8,11,7],[73,57,10,8,8],[84,52,9,10,8],[43,69,8,9,9],[51,76,8,12,9],[63,71,10,9,8],[75,70,7,14,8],[86,76,10,8,9],[57,84,9,7,8],[72,84,11,10,9]];city.forEach((b,i)=>{openBuilding(`City Building ${i+1}`,b[0],b[1],b[2],b[3],b[4],i%2?C.cyan:C.orange);text(`City Sign ${i}`,i%2?'SUPPLIES':'EXODUS CITY',b[0],3,b[1]-b[4]/2-.22,1.1,0,i%2?C.cyan:C.white)});for(let i=0;i<9;i++){box(`City Market Stall ${i}`,52+i*3,1,64,2.4,1.7,2.2,i%2?C.rust:C.blue,{collider:true});box(`City Market Canopy ${i}`,52+i*3,2.2,64,2.8,.15,2.6,i%2?C.orange:C.cyan)}for(let i=0;i<12;i++)lamp(`City Street Lamp ${i}`,39+i*4.5,64);text('City Gateway','EXODUS CITY',64,5.2,45.5,2.1,0,C.white)
cyl('Arena Floor',62,.55,108,25,.7,25,C.road,{collider:true});for(let i=0;i<12;i++){const a=i*Math.PI/6,x=62+Math.sin(a)*15,z=108+Math.cos(a)*15;box(`Arena Barrier ${i}`,x,1.7,z,4,2.5,.7,i%3===0?C.red:C.charcoal,{collider:true,yaw:i*30})}for(const[i,x,z]of[[0,62,94],[1,62,122],[2,48,108],[3,76,108]])openBuilding(`Arena Spawn ${i+1}`,x,z,7,4,5,C.red);box('Arena Score Frame',62,7,119,13,6,.5,C.charcoal,{collider:true});box('Arena Score Display',62,7,118.7,11,4,.15,C.red,{emissive:true});text('Arena Score Text','THE ARENA\nSURVIVE THE COLLAPSE',62,7.2,118.5,1.25,0,C.white);for(let i=0;i<4;i++)box(`Arena Stand ${i}`,50+i*8,3,124,7,1.1,4,C.concrete,{collider:true,pitch:-12})
for(const[i,x,z,yaw]of[[0,98,93,10],[1,106,91,-12],[2,109,100,20]])tent(`Camp Tent ${i}`,x,z,yaw);for(const[i,x,z]of[[0,96,102],[1,113,94]]){box(`Camp Watchtower ${i}`,x,4,z,3,7,3,C.wood,{collider:true});box(`Camp Watch Deck ${i}`,x,7.6,z,4,.4,4,C.steel,{collider:true})}cyl('Camp Firepit',104,.45,97,2,.5,2,C.charcoal,{collider:true});sphere('Camp Fire',104,1.2,97,1,C.orange,{emissive:true});for(let i=0;i<5;i++)crate(`Camp Salvage ${i}`,96+i*3,87+(i%2)*2,i%2?C.rust:C.steel);text('Camp Sign','SCAVENGER CAMP',104,5.2,87,1.7,0,C.white)
for(const[i,x,z,w,h,d]of[[0,16,27,8,9,7],[1,26,23,10,13,8],[2,31,35,8,7,9],[3,18,39,7,11,7]]){box(`Ruins Slab ${i}`,x,.3,z,w,.5,d,C.concrete,{collider:true});box(`Ruins Wall ${i}A`,x-w/2,h/2,z,.45,h,d,C.concrete,{collider:true});box(`Ruins Wall ${i}B`,x,h/2,z+d/2,w,h,.45,C.concrete,{collider:true});box(`Ruins Beam ${i}`,x,h*.65,z,w*.8,.3,.3,C.rust,{pitch:i%2?18:-12,collider:true})}for(let i=0;i<10;i++){rock(`Ruins Rubble ${i}`,12+(i*7)%28,18+(i*11)%28,.45+(i%3)*.2);if(i<5)tree(`Ruins Overgrowth ${i}`,13+i*7,45-(i%2)*5,.7)}text('Ruins Sign','THE RUINS',25,5,14,1.8,0,C.red)
openBuilding('Plant Warehouse',52,26,15,7,13,C.orange);openBuilding('Plant Workshop',73,26,13,6,11,C.cyan);for(const[i,x,z,s]of[[0,61,23,4],[1,66,23,3.5],[2,62,33,3]]){cyl(`Plant Tank ${i}`,x,s/2+.4,z,s,s,s,C.steel,{collider:true});box(`Plant Tank Band ${i}`,x,s*.7,z,s+.2,.25,s+.2,C.orange)}for(let i=0;i<3;i++){cyl(`Plant Chimney ${i}`,48+i*7,9,36,1.5,16,1.5,C.charcoal,{collider:true});box(`Plant Chimney Stripe ${i}`,48+i*7,14,36,1.6,1,1.6,C.orange)}for(let i=0;i<5;i++)box(`Plant Pipe ${i}`,53+i*4,3.5,19,4,.45,.45,C.rust,{collider:true,yaw:90});text('Plant Sign','THE PLANT  CRAFTING',63,5.5,17,1.7,0,C.orange)
box('Dock Platform',108,.45,58,28,.7,27,C.wood,{collider:true});box('Dock Pier',121,.5,58,12,.8,6,C.steel,{collider:true});for(const[i,x,z,c]of[[0,99,50,C.rust],[1,106,50,C.blue],[2,102,54,C.orange],[3,110,67,C.rust],[4,102,67,C.blue]])container(`Dock Container ${i}`,x,z,c,i%2?90:0);box('Dock Crane Tower',113,7,53,2,13,2,C.orange,{collider:true});box('Dock Crane Arm',108,13,53,13,.7,.7,C.orange,{collider:true});cyl('Dock Crane Cable',102,9.5,53,.1,6,.1,C.black);box('Dock Boat Hull',124,1,67,7,1.8,16,C.rust,{pitch:-5,collider:true});box('Dock Boat Cabin',124,3,65,5,3,5,C.charcoal,{collider:true});openBuilding('Dock Warehouse',104,61,12,6,9,C.cyan);text('Dock Sign','THE DOCKS',108,5,45,1.8,0,C.white)
box('Beach Sand',101,.4,14,38,.4,24,C.sand,{collider:true});openBuilding('Beach Shelter',101,14,10,4,7,C.cyan);for(const[i,x,z,s]of[[0,88,8,1],[1,94,18,.8],[2,111,11,1.1],[3,116,20,.9]])palm(`Beach Palm ${i}`,x,z,s);cyl('Beach Firepit',105,.7,21,2,.45,2,C.charcoal,{collider:true});sphere('Beach Fire',105,1.4,21,.9,C.orange,{emissive:true});for(let i=0;i<3;i++)box(`Beach Bench ${i}`,91+i*7,.8,6,4,.5,1,C.wood,{collider:true});text('Beach Sign','THE BEACH',101,4.8,8.3,1.5,180,C.white)

// Secondary settlements fill the travel corridors without closing roads or doorways.
// They use the same open-front construction as the regional buildings, so every one is enterable.
const frontierBlocks=[
  [12,54,8,5,7],[20,49,7,4.5,6],[29,52,9,6,7],[35,58,7,5,6],
  [31,71,8,5,7],[37,78,7,5.5,6],[30,91,9,6,7],[39,96,8,5,6],
  [47,94,7,5,6],[55,99,9,6.5,7],[70,96,8,5,7],[79,92,7,5.5,6],
  [86,87,9,6,7],[92,81,7,5,6],[101,80,8,5.5,7],[113,83,9,6,7],
  [15,107,8,5,7],[26,112,7,5.5,6],[38,115,9,6,7],[86,114,8,5,7],
  [98,116,7,5,6],[113,109,9,6.5,7],[118,94,7,5,6],[109,73,8,5.5,7],
  [94,69,7,5,6],[88,56,9,6,7],[95,42,8,5.5,7],[108,38,7,5,6],
  [117,31,9,6,7],[83,34,8,5,7],[76,17,7,5,6],[67,13,9,6.5,7],
  [49,13,8,5,7],[41,20,7,5.5,6],[39,31,9,6,7],[30,44,8,5,6],
  [13,47,7,5,6],[10,67,9,6,7],[11,91,8,5.5,7],[51,106,7,5,6],
  [74,116,8,5,7],[119,52,7,5.5,6],[112,17,8,5,7],[89,17,7,5,6]
]
frontierBlocks.forEach((b,i)=>{
  const accent=i%3===0?C.orange:i%3===1?C.cyan:C.red
  openBuilding(`Frontier Block ${i+1}`,b[0],b[1],b[2],b[3],b[4],accent)
  if(i%2===0)crate(`Frontier Block ${i+1} Supply`,b[0]+b[2]/2+1.2,b[1]+1.1,i%4===0?C.orange:C.rust)
  if(i%4===0)lamp(`Frontier Block ${i+1} Lamp`,b[0]-b[2]/2-1,b[1]-b[4]/2-1)
  if(i%5===0)text(`Frontier Block ${i+1} Sign`,i%10===0?'SAFE SHELTER':'SALVAGE',b[0],b[3]-.7,b[1]-b[4]/2-.22,.85,0,accent)
})
for(let i=0;i<120;i++){const x=4+(i*23)%120,z=4+(i*37)%120;if((x<38&&z>58&&z<90)||(x>38&&x<90&&z>42&&z<90)||(x>90&&z>42&&z<78)||frontierBlocks.some(b=>Math.abs(x-b[0])<3&&Math.abs(z-b[1])<3))continue;tree(`Island Tree ${i}`,x,z,.65+(i%4)*.12)}for(let i=0;i<48;i++){const a=i*Math.PI/24,x=62+Math.sin(a)*(42+(i%5)*5),z=70+Math.cos(a)*(41+(i%6)*4);rock(`Foothill Rock ${i}`,x,z,.7+(i%3)*.25)}for(let i=0;i<20;i++)lamp(`Road Lamp ${i}`,24+i*5,43+(i%2)*42);for(const[i,x,z]of[[0,43,65],[1,78,65],[2,64,46],[3,64,85],[4,34,52],[5,92,78]]){box(`Road Barricade ${i}`,x,1,z,4,1.8,.45,C.charcoal,{collider:true,yaw:i%2?90:0});box(`Road Warning ${i}`,x,1.5,z,3.4,.3,.5,C.red,{emissive:true,yaw:i%2?90:0})}

// Replace the procedural Outpost with the supplied production GLB. The interaction proxies stay
// named so the existing mission, trader and inventory code binds without a second gameplay system.
const oldOutpost=/^(Outpost|Trader|Mission|Gear|Weapon|Rack|Lounge|Control|Antenna|Satellite)/
for(let index=entities.length-1;index>=0;index-=1)if(oldOutpost.test(entities[index].name))entities.splice(index,1)
model('Outpost GLB','assets/Models/OutPost.glb',96,.1,112,1,{absolute:true,collider:true})
box('Outpost Mission Board',104,2.15,101.75,.7,1.5,.22,C.blue,{absolute:true,collider:true,emissive:true})
box('Outpost Shop Terminal',105.5,2.15,118.25,.7,1.5,.22,C.orange,{absolute:true,collider:true,emissive:true})
box('Outpost Inventory Terminal',88,2.15,119.75,.7,1.5,.22,C.cyan,{absolute:true,collider:true,emissive:true})

// Remap the compact design coordinates into a 30x30 (480m) World while keeping buildings human-scaled.
const worldScale=3.75
const regions=[
  {old:[20,75],now:[96,112],match:/^(Outpost|Trader|Mission|Gear|Weapon|Rack|Lounge|Control|Antenna|Satellite)/},
  {old:[64,65],now:[240,216],match:/^City/},
  {old:[62,108],now:[240,80],match:/^Arena/},
  {old:[104,96],now:[384,107],match:/^Camp/},
  {old:[25,31],now:[93,296],match:/^Ruins/},
  {old:[63,27],now:[211,384],match:/^Plant/},
  {old:[108,58],now:[387,285],match:/^Dock/},
  {old:[101,15],now:[360,384],match:/^Beach/}
]
for(const e of entities){if(e.absolute)continue;const region=regions.find(r=>r.match.test(e.name));if(region){e.position.x=region.now[0]+e.position.x-region.old[0];e.position.z=region.now[1]+e.position.z-region.old[1];continue}const frontier=/^Frontier Block (\d+)/.exec(e.name);if(frontier){const center=frontierBlocks[Number(frontier[1])-1];e.position.x=center[0]*worldScale+(e.position.x-center[0]);e.position.z=center[1]*worldScale+(e.position.z-center[1]);continue}const bridge=/^Bridge (\d)/.exec(e.name);if(bridge){const centers=[[0,0],[46,65],[64,82],[84,60]],center=centers[Number(bridge[1])];e.position.x=center[0]*worldScale+(e.position.x-center[0]);e.position.z=center[1]*worldScale+(e.position.z-center[1]);e.scale.z*=worldScale;continue}e.position.x=Math.max(3,Math.min(477,e.position.x*worldScale));e.position.z=Math.max(3,Math.min(477,e.position.z*worldScale));if(/^(West Road|City Spine|North Road|Camp Road|South Road|Ruins Road|Dock Road|Beach Road)$/.test(e.name))e.scale.z*=worldScale}

// The supplied production GLBs replace the legacy procedural island and seven regional landmarks.
// The existing Beach remains because no Beach model was supplied; interaction proxies stay intact.
const keep=/^(Outpost GLB|Outpost Mission Board|Outpost Shop Terminal|Outpost Inventory Terminal|Beach)/
for(let index=entities.length-1;index>=0;index-=1)if(!keep.test(entities[index].name))entities.splice(index,1)
modelScaled('Island Terrain GLB','assets/Models/IslandTerrain.glb',240,-1.6,240,16,4,16,{absolute:true,collider:true})
// v84: continuous water surface beneath/around the authored island terrain. Terrain and bridge decks remain above this level.
box('Water Full Surface',240,.60,240,480,.06,480,{r:.018,g:.31,b:.48,a:.52},{absolute:true,collider:false})
for(const[n,x,z,sx,sz,yaw]of[['Water West',172.5,243.75,22,150,0],['Water North',240,307.5,150,22,0],['Water East',315,225,22,130,0],['Water Harbour',444,217.5,66,132,0],['Water Beach',410,34,126,48,0],['Water SW',86,20,140,38,0]])box(n,x,.62,z,sx,.08,sz,{r:.02,g:.34,b:.52,a:.62},{yaw,absolute:true,collider:false})
model('Arena GLB','assets/Models/Arena.glb',240,.92,80,1,{absolute:true,collider:true})
model('Exodus City GLB','assets/Models/ExodusCity.glb',240,.1,216,1,{absolute:true,collider:true})
model('Scavenger Camp GLB','assets/Models/ScavengerCamp.glb',384,1.9,107,1,{absolute:true,collider:true})
model('Ruins GLB','assets/Models/Ruins_v16_supplied.glb',93,1.2,296,1,{absolute:true,collider:true,yaw:180})
model('Plant GLB','assets/Models/Plant.glb',270,.35,384,1,{absolute:true,collider:true})
model('Docks GLB','assets/Models/Docks.glb',387,.25,285,1,{absolute:true,collider:true})
bridgeBetween('Outpost City Bridge',145,145,190,184)
bridgeBetween('Arena City Bridge',240,126,240,165)
bridgeBetween('Camp City Bridge',337,145,293,182)
bridgeBetween('Ruins City Bridge',142,282,187,246)
bridgeBetween('Docks City Bridge',338,270,296,243)
bridgeBetween('Plant Docks Bridge',304,355,353,314)
bridgeBetween('Plant City Bridge',238,264,262,338)
text('Arena Region Sign','THE ARENA',240,5.4,124,1.8,180,C.red)
text('City Region Sign','EXODUS CITY',240,5.4,267,1.8,180,C.white)
text('Camp Region Sign','SCAVENGER CAMP',384,5.4,148,1.6,180,C.orange)
text('Ruins Region Sign','THE RUINS',93,5.4,341,1.8,180,C.red)
text('Plant Region Sign','THE PLANT',270,5.4,423,1.8,180,C.cyan)
text('Docks Region Sign','THE DOCKS',387,5.4,327,1.8,180,C.white)

const byName=new Map(composite.components.map(c=>[c.name,c]));function core(name){let c=byName.get(name);if(!c){c={name,data:{}};composite.components.push(c);byName.set(name,c)}c.data={};return c}const transforms=core('core::Transform'),meshes=core('core::MeshRenderer'),colliders=core('core::MeshCollider'),materials=core('core::Material'),cameraAreas=core('core::CameraModeArea'),texts=core('core::TextShape'),gltfs=core('core::GltfContainer');let names=byName.get('core-schema::Name');if(!names){names={name:'core-schema::Name',jsonSchema:{type:'object',properties:{value:{type:'string',serializationType:'utf8-string'}},serializationType:'map'},data:{}};composite.components.push(names);byName.set(names.name,names)}names.data={}
for(const e of entities){const k=String(e.id);transforms.data[k]={json:{position:e.position,scale:e.scale,rotation:e.rotation,parent:0}};names.data[k]={json:{value:e.name}};if(e.cameraArea){cameraAreas.data[k]={json:{area:e.cameraArea,mode:0}};continue}if(e.text){texts.data[k]={json:{text:e.text.value,fontSize:e.text.size,textColor:e.color,textAlign:0}};continue}if(e.gltf){gltfs.data[k]={json:{src:e.gltf,visibleMeshesCollisionMask:e.collider?3:0,invisibleMeshesCollisionMask:0}};continue}const mesh=e.mesh==='cylinder'?{$case:'cylinder',cylinder:{radiusTop:.5,radiusBottom:.5}}:e.mesh==='sphere'?{$case:'sphere',sphere:{}}:{$case:'box',box:{uvs:[]}};meshes.data[k]={json:{mesh}};if(e.collider)colliders.data[k]={json:{collisionMask:3,mesh}};const pbr={albedoColor:e.color,metallic:e.emissive?.22:.45,roughness:e.emissive?.24:.7};if(e.emissive){pbr.emissiveColor={r:e.color.r,g:e.color.g,b:e.color.b};pbr.emissiveIntensity=2.2}materials.data[k]={json:{material:{$case:'pbr',pbr}}}}
const nodes=byName.get('inspector::Nodes').data['0'].json.value;nodes.length=0;nodes.push({entity:0,open:true,children:entities.map(e=>e.id)},{entity:1,children:[]},{entity:2,children:[]});for(const e of entities)nodes.push({entity:e.id,children:[]})
const parcels=Array.from({length:900},(_,i)=>({x:Math.floor(i/30),y:i%30}));const metadata=byName.get('inspector::SceneMetadata-v5').data['0'].json;metadata.name='Project Exodus';metadata.description='A low-poly post-apocalyptic survival island for 20 players: explore, trade, rebuild and survive.';metadata.thumbnail='images/project-exodus-thumbnail-228x160.png';metadata.categories=['game','social'];metadata.tags=['survival','low-poly','multiplayer'];metadata.layout={base:{x:0,y:0},parcels};metadata.spawnPoints=[{name:'Outpost Safe Spawn — Badges / Mission',default:true,position:{x:{$case:'range',value:[97.6,97.9]},y:{$case:'range',value:[1.2,1.2]},z:{$case:'range',value:[102.0,102.2]}},cameraTarget:{x:104,y:2.6,z:101.75}}]
scene.scene.parcels=parcels.map(p=>`${p.x},${p.y}`);scene.scene.base='0,0';scene.spawnPoints=[{name:'Outpost Safe Spawn — Badges / Mission',default:true,position:{x:[97.6,97.9],y:[1.2,1.2],z:[102.0,102.2]},cameraTarget:{x:104,y:2.6,z:101.75}}]
const cube=byName.get('cube-id');if(cube)cube.data={};await writeFile(compositePath,`${JSON.stringify(composite,null,2)}\n`);await writeFile(scenePath,`${JSON.stringify(scene,null,2)}\n`);console.log(`Generated ${entities.length} Project Exodus island entities across 30x30 parcels`)
