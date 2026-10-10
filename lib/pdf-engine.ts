import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
// Browser-only modules are imported on demand, never while server-rendering.
export async function pdfjs(){const p=await import('pdfjs-dist/legacy/build/pdf.mjs');p.GlobalWorkerOptions.workerSrc=workerUrl;return p;}
export function legacyToFabric(change:any){
 const d={...change.data};const t=change.type;
 d.type=({Text:'Textbox',Path:'Path',Image:'Image',Rect:'Rect',Circle:'Circle',Ellipse:'Ellipse',Line:'Line',Triangle:'Triangle',Group:'Group'} as any)[t]??t;
 // Fabric 6 uses centered origins only when explicitly specified; legacy uses top/left.
 d.originX??='left';d.originY??='top';
 if(typeof d.fill==='string' && /^#[0-9a-f]{8}$/i.test(d.fill))d.fill=cssColor(d.fill);
 if(typeof d.stroke==='string' && /^#[0-9a-f]{8}$/i.test(d.stroke))d.stroke=cssColor(d.stroke);
 if(t==='Path' && typeof d.path==='string') { /* Fabric accepts SVG paths during construction, not hydration. */ }
 return d;
}
export function fabricToLegacy(obj:any,page:number){
 const data=obj.toObject(['name']);const type=obj.type.toLowerCase();
 // The existing software's verified interchange primitives are Text, Path and Image.
 // Serialize geometric tools as ordinary SVG paths to avoid new object types.
 if(['rect','ellipse','circle','line','triangle'].includes(type)){
  const w=data.width,h=data.height,k=.5522847498;
  let path='';
  if(type==='rect')path=`M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  if(type==='triangle')path=`M 0 ${h} L ${w/2} 0 L ${w} ${h} Z`;
  if(type==='line')path=`M ${data.x1} ${data.y1} L ${data.x2} ${data.y2}`;
  if(type==='ellipse'||type==='circle')path=`M ${w} ${h/2} C ${w} ${h/2+k*h/2} ${w/2+k*w/2} ${h} ${w/2} ${h} C ${w/2-k*w/2} ${h} 0 ${h/2+k*h/2} 0 ${h/2} C 0 ${h/2-k*h/2} ${w/2-k*w/2} 0 ${w/2} 0 C ${w/2+k*w/2} 0 ${w} ${h/2-k*h/2} ${w} ${h/2} Z`;
  delete data.type;data.path=path;return {page,type:'Path',data};
 }
 const mapping:any={'i-text':'Text',itext:'Text',textbox:'Text',text:'Text',path:'Path',image:'Image',rect:'Rect',circle:'Circle',line:'Line',triangle:'Triangle',group:'Group'};
 if(['i-text','itext','textbox','text'].includes(type))data.styles=structuredClone(obj.styles??{});
 if(type==='path'&&Array.isArray(data.path))data.path=data.path.map((x:any)=>x.join(' ')).join(' ');
 return {page,type:mapping[type]??obj.type,data};
}
function cssColor(hex:string){return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${parseInt(hex.slice(7,9),16)/255})`;}
export async function ensureFonts(){if(typeof document!=='undefined'&&document.fonts)await Promise.all(['Ubuntu','Open Sans','Gloria Hallelujah'].map(font=>document.fonts.load(`20px "${font}"`)));}
export async function loadObjects(canvas:any,changes:any[],page:number){
 await ensureFonts();const f=await import('fabric');
 for(const change of changes.filter(x=>x.page===page)) {
  const d=legacyToFabric(change);
  try {
   let obj:any;
   if(change.type==='Path'&&typeof d.path==='string'){const {type,...options}=d;obj=new f.Path(d.path,options);}
   else if(change.type==='Text'){const {type,...options}=d;obj=new f.Textbox(d.text??'',options);}
   else [obj]=await f.util.enlivenObjects([d]);
   if(obj){obj.name??=crypto.randomUUID();canvas.add(obj);}
  }catch(e:any){console.error('Annotation hydration failed',change.type,e);throw new Error(`Anotáciu ${change.type} sa nepodarilo načítať. Upravovanie je zastavené, aby sa nestratila.`);}
 }
}
export async function flattenPdf(bytes:Uint8Array,state:any){
 const {PDFDocument,degrees}=await import('pdf-lib');
 const f=await import('fabric');const js=await pdfjs();
 const input=await js.getDocument({data:bytes.slice()}).promise;
 const output=await PDFDocument.load(bytes);
 for(let n=0;n<(state.extraPages??0);n++)output.addPage([595.28,841.89]);
 for(let n=0;n<output.getPageCount();n++){
  const page=output.getPage(n);const view=n<input.numPages?(await input.getPage(n+1)).getViewport({scale:1}):{width:595.28,height:841.89,rotation:0};
  const c=new f.StaticCanvas(undefined,{width:view.width,height:view.height,enableRetinaScaling:false});
  await loadObjects(c,state.changes??[],n);c.renderAll();
  if(c.getObjects().length){const png=await output.embedPng(c.toDataURL({format:'png',multiplier:2}));
   const angle=((page.getRotation().angle%360)+360)%360;const w=page.getWidth(),h=page.getHeight();
   // Map the rendered page coordinate system back into the PDF's unrotated space.
   const placements:any={0:{x:0,y:0,width:w,height:h},90:{x:w,y:0,width:h,height:w,rotate:degrees(90)},180:{x:w,y:h,width:w,height:h,rotate:degrees(180)},270:{x:0,y:h,width:h,height:w,rotate:degrees(270)}};
   page.drawImage(png,placements[angle]??placements[0]);
  }
  page.setRotation(degrees((page.getRotation().angle+(state.rotations?.[n]??0))%360));
  await c.dispose();
 }
 await input.destroy();return output.save();
}
