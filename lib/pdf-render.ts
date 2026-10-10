export async function flattenPdfWith(bytes:Uint8Array,state:any,{fabric:f,pdfjs,loadObjects}:{fabric:any;pdfjs:()=>Promise<any>;loadObjects:(canvas:any,changes:any[],page:number)=>Promise<void>}){
 const {PDFDocument,degrees}=await import('pdf-lib');
 const output=await PDFDocument.load(bytes);
 let input:any;
 try{
  if(state.changes?.length){
   const js=await pdfjs();
   input=await js.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
  }
  for(let n=0;n<(state.extraPages??0);n++)output.addPage([595.28,841.89]);
  for(let n=0;n<output.getPageCount();n++){
   let page=output.getPage(n);
   const turn=((state.rotations?.[n]??0)%360+360)%360;
   if(turn){
    const embedded=await output.embedPage(page),naturalWidth=embedded.width,naturalHeight=embedded.height,oldRotation=page.getRotation().angle;
    const targetWidth=page.getWidth(),targetHeight=page.getHeight();
    const angle=((oldRotation+turn)%360+360)%360,rotatedWidth=angle%180?naturalHeight:naturalWidth,rotatedHeight=angle%180?naturalWidth:naturalHeight;
    const scale=Math.min(targetWidth/rotatedWidth,targetHeight/rotatedHeight),drawWidth=naturalWidth*scale,drawHeight=naturalHeight*scale;
    output.removePage(n);page=output.insertPage(n,[targetWidth,targetHeight]);
    page.drawPage(embedded,{x:(targetWidth-drawWidth)/2,y:(targetHeight-drawHeight)/2,width:drawWidth,height:drawHeight,rotate:degrees(angle)});
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
