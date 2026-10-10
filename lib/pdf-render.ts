import { largestImageBounds } from './pdf-image';

export async function flattenPdfWith(bytes:Uint8Array,state:any,{fabric:f,pdfjs,loadObjects,createCanvas}:{fabric:any;pdfjs:()=>Promise<any>;loadObjects:(canvas:any,changes:any[],page:number)=>Promise<void>;createCanvas?:(width:number,height:number)=>any}){
 const {PDFDocument,degrees,rgb}=await import('pdf-lib');
 const output=await PDFDocument.load(bytes);
 let input:any,js:any;
 try{
  if(state.changes?.length||Object.values(state.rotations??{}).some((value:any)=>value!==0)){
   js=await pdfjs();
   input=await js.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
  }
  for(let n=0;n<(state.extraPages??0);n++)output.addPage([595.28,841.89]);
  for(let n=0;n<output.getPageCount();n++){
   let page=output.getPage(n);
   const turn=((state.rotations?.[n]??0)%360+360)%360;
   if(turn){
    const source=n<input.numPages?await input.getPage(n+1):null,oldRotation=page.getRotation().angle;
    const bounds=source&&oldRotation===0?await largestImageBounds(source,js):null;
    let image:any;if(source&&bounds?.axisAligned&&bounds.imageId)image=await new Promise(resolve=>source.objs.get(bounds.imageId,resolve));
    if(source&&bounds?.axisAligned&&image?.data&&image.width&&image.height&&(image.kind===js.ImageKind.RGB_24BPP||image.kind===js.ImageKind.RGBA_32BPP)){
     const viewport=source.getViewport({scale:1}),makeCanvas=createCanvas??((width:number,height:number)=>{const element=f.getEnv().document.createElement('canvas');element.width=width;element.height=height;return element;}),crop=makeCanvas(image.width,image.height),cropContext=crop.getContext('2d'),pixels=cropContext.createImageData(image.width,image.height),data=image.data;
     if(image.kind===js.ImageKind.RGBA_32BPP)pixels.data.set(data);else for(let i=0,j=0;i<pixels.data.length;i+=4,j+=3){pixels.data[i]=data[j];pixels.data[i+1]=data[j+1];pixels.data[i+2]=data[j+2];pixels.data[i+3]=255;}
     cropContext.putImageData(pixels,0,0);
     const rotatedWidth=turn%180?bounds.height:bounds.width,rotatedHeight=turn%180?bounds.width:bounds.height,availableHeight=viewport.height-bounds.top,scale=Math.min(viewport.width/rotatedWidth,availableHeight/rotatedHeight);
     const scanCrop=await output.embedJpg(crop.toDataURL('image/jpeg',0.94));
     const targetWidth=page.getWidth(),targetHeight=page.getHeight(),drawWidth=bounds.width*scale,drawHeight=bounds.height*scale,centerX=targetWidth/2,centerY=(targetHeight-bounds.top)/2,placement:any={0:{x:centerX-drawWidth/2,y:centerY-drawHeight/2},90:{x:centerX+drawHeight/2,y:centerY-drawWidth/2},180:{x:centerX+drawWidth/2,y:centerY+drawHeight/2},270:{x:centerX-drawHeight/2,y:centerY+drawWidth/2}};
     page.drawRectangle({x:bounds.left,y:targetHeight-bounds.top-bounds.height,width:bounds.width,height:bounds.height,color:rgb(1,1,1)});
     page.drawImage(scanCrop,{...placement[turn],width:drawWidth,height:drawHeight,rotate:degrees(turn)});
    }else{
     const embedded=await output.embedPage(page),naturalWidth=embedded.width,naturalHeight=embedded.height,targetWidth=page.getWidth(),targetHeight=page.getHeight(),angle=((oldRotation+turn)%360+360)%360,rotatedWidth=angle%180?naturalHeight:naturalWidth,rotatedHeight=angle%180?naturalWidth:naturalHeight,scale=Math.min(targetWidth/rotatedWidth,targetHeight/rotatedHeight),drawWidth=naturalWidth*scale,drawHeight=naturalHeight*scale;
     output.removePage(n);page=output.insertPage(n,[targetWidth,targetHeight]);page.drawPage(embedded,{x:(targetWidth-drawWidth)/2,y:(targetHeight-drawHeight)/2,width:drawWidth,height:drawHeight,rotate:degrees(angle)});
    }
   }
   if((state.changes??[]).some((change:any)=>change.page===n)){
    const view=n<input.numPages?(await input.getPage(n+1)).getViewport({scale:1}):{width:595.28,height:841.89,rotation:0};
    const canvas=new f.StaticCanvas(undefined,{width:view.width,height:view.height,enableRetinaScaling:false});
    try{
     await loadObjects(canvas,state.changes??[],n);canvas.renderAll();
     if(canvas.getObjects().length){
      const png=await output.embedPng(canvas.toDataURL({format:'png',multiplier:2}));
      const angle=((page.getRotation().angle%360)+360)%360,w=page.getWidth(),h=page.getHeight();
      // Map the rendered page coordinates back into the unrotated PDF space.
      const placements:any={0:{x:0,y:0,width:w,height:h},90:{x:w,y:0,width:h,height:w,rotate:degrees(90)},180:{x:w,y:h,width:w,height:h,rotate:degrees(180)},270:{x:0,y:h,width:h,height:w,rotate:degrees(270)}};
      page.drawImage(png,placements[angle]??placements[0]);
     }
    }finally{await canvas.dispose();}
   }
  }
  return await output.save();
 }finally{await input?.destroy();}
}
