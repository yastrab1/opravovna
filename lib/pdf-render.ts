import { largestImageBounds } from './pdf-image';

export async function flattenPdfWith(bytes:Uint8Array,state:any,{fabric:f,pdfjs,loadObjects}:{fabric:any;pdfjs:()=>Promise<any>;loadObjects:(canvas:any,changes:any[],page:number)=>Promise<void>}){
 const {PDFDocument,degrees,rgb}=await import('pdf-lib');
 const output=await PDFDocument.load(bytes);
 let input:any;
 try{
  if(state.changes?.length||Object.values(state.rotations??{}).some((value:any)=>value!==0)){
   const js=await pdfjs();
   input=await js.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
  }
  for(let n=0;n<(state.extraPages??0);n++)output.addPage([595.28,841.89]);
  for(let n=0;n<output.getPageCount();n++){
   let page=output.getPage(n);
   const turn=((state.rotations?.[n]??0)%360+360)%360;
   if(turn){
    const source=n<input.numPages?await input.getPage(n+1):null,oldRotation=page.getRotation().angle;
    const bounds=source&&oldRotation===0?await largestImageBounds(source,await pdfjs()):null;
    if(source&&bounds){
     const viewport=source.getViewport({scale:1}),renderScale=3,canvas=f.getEnv().document.createElement('canvas');canvas.width=Math.ceil(viewport.width*renderScale);canvas.height=Math.ceil(viewport.height*renderScale);const ctx=canvas.getContext('2d');
     const render=source.render({canvasContext:ctx,viewport,transform:[renderScale,0,0,renderScale,0,0]});await render.promise;
     const crop=f.getEnv().document.createElement('canvas');crop.width=Math.max(1,Math.round(bounds.width*renderScale));crop.height=Math.max(1,Math.round(bounds.height*renderScale));crop.getContext('2d').drawImage(canvas,Math.round(bounds.left*renderScale),Math.round(bounds.top*renderScale),crop.width,crop.height,0,0,crop.width,crop.height);
     ctx.fillStyle='#fff';ctx.fillRect(bounds.left*renderScale,bounds.top*renderScale,bounds.width*renderScale,bounds.height*renderScale);
     const rotatedWidth=turn%180?bounds.height:bounds.width,rotatedHeight=turn%180?bounds.width:bounds.height,availableHeight=viewport.height-bounds.top,scale=Math.min(viewport.width/rotatedWidth,availableHeight/rotatedHeight);
     const scanCrop=await output.embedPng(crop.toDataURL('image/png'));
     const targetWidth=page.getWidth(),targetHeight=page.getHeight(),drawWidth=bounds.width*scale,drawHeight=bounds.height*scale,centerX=targetWidth/2,centerY=(targetHeight-bounds.top)/2;
     page.drawRectangle({x:bounds.left,y:targetHeight-bounds.top-bounds.height,width:bounds.width,height:bounds.height,color:rgb(1,1,1)});
     page.drawImage(scanCrop,{x:centerX-drawWidth/2,y:centerY-drawHeight/2,width:drawWidth,height:drawHeight,rotate:degrees(turn)});
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
