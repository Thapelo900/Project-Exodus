import { writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const size=512, pixels=Buffer.alloc(size*size*4)
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}return(crc^0xffffffff)>>>0}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum])}
function set(x,y,c){x=Math.round(x);y=Math.round(y);if(x<0||x>=size||y<0||y>=size)return;const p=(y*size+x)*4;pixels[p]=c[0];pixels[p+1]=c[1];pixels[p+2]=c[2];pixels[p+3]=c[3]??255}
function inside(x,y,points){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}return hit}
function polygon(points,color){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);for(let y=Math.max(0,Math.floor(Math.min(...ys)));y<=Math.min(size-1,Math.ceil(Math.max(...ys)));y++)for(let x=Math.max(0,Math.floor(Math.min(...xs)));x<=Math.min(size-1,Math.ceil(Math.max(...xs)));x++)if(inside(x+.5,y+.5,points))set(x,y,color)}
function world(x,z){return[x/480*size,(480-z)/480*size]}
function worldPolygon(points,color){polygon(points.map(([x,z])=>world(x,z)),color)}
function rectWorld(cx,cz,sx,sz,color){const[a,b]=world(cx-sx/2,cz+sz/2),[c,d]=world(cx+sx/2,cz-sz/2);for(let y=Math.floor(b);y<=Math.ceil(d);y++)for(let x=Math.floor(a);x<=Math.ceil(c);x++)set(x,y,color)}
function lineWorld(x1,z1,x2,z2,width,color){const[a,b]=world(x1,z1),[c,d]=world(x2,z2),steps=Math.ceil(Math.hypot(c-a,d-b));for(let i=0;i<=steps;i++){const x=a+(c-a)*i/steps,y=b+(d-b)*i/steps;for(let yy=-width;yy<=width;yy++)for(let xx=-width;xx<=width;xx++)if(xx*xx+yy*yy<=width*width)set(x+xx,y+yy,color)}}
function circleWorld(x,z,r,color){const[cx,cy]=world(x,z),pr=r/480*size;for(let y=-pr;y<=pr;y++)for(let xx=-pr;xx<=pr;xx++)if(xx*xx+y*y<=pr*pr)set(cx+xx,cy+y,color)}

for(let y=0;y<size;y++)for(let x=0;x<size;x++){const wave=Math.round(7*Math.sin(x*.055)+5*Math.cos(y*.047));set(x,y,[4,60+wave,82+wave,255])}
const coast=[[22,85],[55,42],[138,18],[226,25],[292,15],[397,35],[454,82],[474,160],[464,278],[448,390],[395,445],[310,467],[218,462],[125,455],[53,410],[18,326],[10,210]]
const interior=[[35,94],[69,57],[145,34],[226,40],[292,31],[384,49],[436,91],[458,164],[449,273],[432,380],[383,426],[306,448],[218,444],[132,437],[69,396],[36,318],[27,213]]
worldPolygon(coast,[183,153,90,255]);worldPolygon(interior,[44,91,52,255])
for(const water of[[172.5,243.75,22,150],[240,307.5,150,22],[315,225,22,130],[444,217.5,66,132],[410,34,126,48],[86,20,140,38]])rectWorld(...water,[7,91,119,255])
const roads=[
  [75,183.75,75,303.75],[135,243.75,345,243.75],[240,243.75,240,416.25],[245.6,352.5,406.9,352.5],
  [240,84.4,240,245.6],[104,89,211,196],[281.2,225,408.8,225],[266,30,394,157]
]
for(const road of roads)lineWorld(...road,4,[54,57,59,255])
for(const bridge of[[172.5,243.75],[240,307.5],[315,225]])rectWorld(bridge[0],bridge[1],bridge[0]===240?8:35,bridge[0]===240?35:8,[126,102,55,255])
const frontier=[[12,54],[20,49],[29,52],[35,58],[31,71],[37,78],[30,91],[39,96],[47,94],[55,99],[70,96],[79,92],[86,87],[92,81],[101,80],[113,83],[15,107],[26,112],[38,115],[86,114],[98,116],[113,109],[118,94],[109,73],[94,69],[88,56],[95,42],[108,38],[117,31],[83,34],[76,17],[67,13],[49,13],[41,20],[39,31],[30,44],[13,47],[10,67],[11,91],[51,106],[74,116],[119,52],[112,17],[89,17]]
for(const[x,z]of frontier)rectWorld(x*3.75,z*3.75,5,5,[135,135,129,255])
const locations=[
  [75,281.25,[31,194,244,255]],[240,243.75,[245,171,42,255]],[232.5,405,[227,45,45,255]],
  [390,360,[59,207,111,255]],[93.75,116.25,[227,45,45,255]],[236.25,101.25,[36,188,232,255]],
  [405,217.5,[180,75,225,255]],[378.75,56.25,[245,202,64,255]]
]
for(const[x,z,color]of locations){circleWorld(x,z,9,[10,14,18,255]);circleWorld(x,z,6,color)}
const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;pixels.copy(raw,y*(size*4+1)+1,y*size*4,(y+1)*size*4)}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])
await writeFile(new URL('../images/project-exodus-minimap-source.png',import.meta.url),png)
console.log('Generated Project Exodus minimap from the actual 480x480 island layout')
