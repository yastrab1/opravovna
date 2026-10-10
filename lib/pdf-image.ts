type Bounds={left:number;top:number;width:number;height:number;imageId?:string;imageWidth?:number;imageHeight?:number;axisAligned:boolean};

// Locate the largest raster image painted on a PDF page. PDF.js exposes the
// image's unit-square transform in the operator list; converting its corners
// through the page viewport gives bounds in the same coordinates as rendering.
export async function largestImageBounds(page:any,pdfjs:any):Promise<Bounds|null>{
 const viewport=page.getViewport({scale:1}),operators=await page.getOperatorList();
 const {OPS,Util}=pdfjs;let ctm=[1,0,0,1,0,0];const stack:number[][]=[],images:Bounds[]=[];
 for(let i=0;i<operators.fnArray.length;i++){
  const fn=operators.fnArray[i],args=operators.argsArray[i];
  if(fn===OPS.save){stack.push(ctm);continue;}
  if(fn===OPS.restore){ctm=stack.pop()??[1,0,0,1,0,0];continue;}
  if(fn===OPS.transform&&args){ctm=Util.transform(ctm,args);continue;}
  if(fn!==OPS.paintImageXObject&&fn!==OPS.paintInlineImageXObject&&fn!==OPS.paintImageMaskXObject&&fn!==OPS.paintJpegXObject)continue;
  const corners=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>viewport.convertToViewportPoint(ctm[0]*x+ctm[2]*y+ctm[4],ctm[1]*x+ctm[3]*y+ctm[5]));
  const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]),left=Math.max(0,Math.min(...xs)),top=Math.max(0,Math.min(...ys)),right=Math.min(viewport.width,Math.max(...xs)),bottom=Math.min(viewport.height,Math.max(...ys));
  if(right>left&&bottom>top)images.push({left,top,width:right-left,height:bottom-top,imageId:typeof args?.[0]==='string'?args[0]:undefined,imageWidth:Number(args?.[1])||undefined,imageHeight:Number(args?.[2])||undefined,axisAligned:Math.abs(ctm[1])<1e-6&&Math.abs(ctm[2])<1e-6&&ctm[0]>0&&ctm[3]>0});
 }
 return images.sort((a,b)=>b.width*b.height-a.width*a.height)[0]??null;
}
