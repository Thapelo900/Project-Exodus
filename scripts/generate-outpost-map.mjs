import { writeFile } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const size=512,pixels=Buffer.alloc(size*size*4),range=44
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0)}return(crc^0xffffffff)>>>0}
function chunk(type,data){const name=Buffer.from(type),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum])}
function set(x,y,c){x=Math.round(x);y=Math.round(y);if(x<0||x>=size||y<0||y>=size)return;const p=(y*size+x)*4;pixels[p]=c[0];pixels[p+1]=c[1];pixels[p+2]=c[2];pixels[p+3]=c[3]??255}
function plan(x,z){return[(x+range)/(range*2)*size,(range-z)/(range*2)*size]}
function rect(cx,cz,sx,sz,color){const[a,b]=plan(cx-sx/2,cz+sz/2),[c,d]=plan(cx+sx/2,cz-sz/2);for(let y=Math.floor(b);y<=Math.ceil(d);y++)for(let x=Math.floor(a);x<=Math.ceil(c);x++)set(x,y,color)}
function ring(cx,cz,r,width,color){const[cxP,cyP]=plan(cx,cz),rp=r/(range*2)*size,wp=width/(range*2)*size;for(let y=-rp-wp;y<=rp+wp;y++)for(let x=-rp-wp;x<=rp+wp;x++){const d=Math.hypot(x,y);if(Math.abs(d-rp)<=wp)set(cxP+x,cyP+y,color)}}
function line(x1,z1,x2,z2,width,color){const[a,b]=plan(x1,z1),[c,d]=plan(x2,z2),steps=Math.max(1,Math.ceil(Math.hypot(c-a,d-b)));for(let i=0;i<=steps;i++){const x=a+(c-a)*i/steps,y=b+(d-b)*i/steps;for(let yy=-width;yy<=width;yy++)for(let xx=-width;xx<=width;xx++)if(xx*xx+yy*yy<=width*width)set(x+xx,y+yy,color)}}

for(let y=0;y<size;y++)for(let x=0;x<size;x++){const grid=(x%32<2||y%32<2)?8:0;set(x,y,[8+grid,16+grid,18+grid,255])}
ring(0,0,36,2,[53,78,82,255]);ring(0,0,29,1,[41,188,220,255])
rect(0,0,24,24,[38,47,50,255]);rect(0,0,8,8,[19,91,109,255]);ring(0,0,4.5,1,[62,220,245,255])
rect(0,-25,18,9,[44,52,55,255]);rect(0,18,24,10,[42,50,53,255]);rect(-19,0,10,16,[42,50,53,255]);rect(19,0,10,16,[42,50,53,255])
rect(0,12,7.5,3,[49,57,60,255]);rect(0,10.2,5,5.5,[63,72,75,255]);line(0,12,0,40,4,[90,96,91,255])
for(let i=0;i<16;i++){const a=i*Math.PI/8,x=Math.sin(a)*21,z=Math.cos(a)*21;rect(x,z,7,7,i%2?[38,47,50,255]:[52,60,62,255])}
for(const[x,z,color]of[[8,-10,[45,160,228,255]],[9.5,6.25,[241,173,53,255]],[-8,7.75,[36,188,232,255]],[0,0,[80,226,248,255]],[0,14,[231,50,50,255]]]){rect(x,z,1.8,1.8,color)}
const raw=Buffer.alloc((size*4+1)*size);for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;pixels.copy(raw,y*(size*4+1)+1,y*size*4,(y+1)*size*4)}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))])
await writeFile(new URL('../images/outpost-interior-map.png',import.meta.url),png)
console.log('Generated synchronized Outpost interior map')
