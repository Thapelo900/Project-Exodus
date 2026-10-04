import fs from 'node:fs'
import { PNG } from 'pngjs'

const sourcePath=process.argv[2]??'images/project-exodus-weapon-sheet.png'
const image=PNG.sync.read(fs.readFileSync(sourcePath)),cell=Math.floor(image.width/3)
for(const[name,column]of[['shotgun',0],['pistol',1],['rifle',2]]){
  const output=new PNG({width:cell,height:image.height});PNG.bitblt(image,output,column*cell,0,cell,image.height,0,0)
  // Image generation returned a rendered transparency checker. Remove only its bright neutral squares.
  for(let index=0;index<output.data.length;index+=4){const r=output.data[index],g=output.data[index+1],b=output.data[index+2],neutral=Math.max(r,g,b)-Math.min(r,g,b)<7;if(neutral&&(r+g+b)/3>174){output.data[index+3]=0}}
  fs.writeFileSync(`images/ui/weapon-${name}.png`,PNG.sync.write(output));console.log(`Generated images/ui/weapon-${name}.png`)
}
