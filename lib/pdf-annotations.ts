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
export async function loadObjectsWith(canvas:any,changes:any[],page:number,f:any){
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
