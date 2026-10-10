import { env } from 'cloudflare:workers';
import { getUser } from '@/lib/auth';
import { parseSubmission, projectTitle } from '@/lib/archive';
import { unpack } from 'msgpackr';
import { mergeLegacy } from '@/lib/merge';
export const dynamic = 'force-dynamic';
const E = () => env as unknown as { DB: D1Database; BUCKET: R2Bucket };
const json = (x: unknown, status=200) => Response.json(x,{status,headers:{'Cache-Control':'no-store'}});
function fail(message: string,status=400): never { throw Object.assign(new Error(message),{status}); }
const id=()=>crypto.randomUUID();
async function body(req:Request){const b=await req.text();if(b.length>3_000_000)fail('Príliš veľa údajov.',413);return JSON.parse(b);}
async function handle(req:Request) {
 try {
 const u=await getUser();if(!u)return json({error:'Prihláste sa.'},401);
 const email=u.email.toLowerCase();const {DB,BUCKET}=E();
 const url=new URL(req.url);const p=url.pathname.slice(5).split('/');
 if(req.method!=='GET' && req.headers.get('origin') && req.headers.get('origin')!==url.origin)fail('Nepovolený pôvod požiadavky.',403);
 if(p[0]==='me')return json(u);
 if(p[0]==='join' && req.method==='POST'){
  const {token}=await body(req);const project=await DB.prepare('SELECT * FROM projects WHERE share=?').bind(token).first<any>();if(!project)fail('Odkaz už neplatí.',404);
  if(project.owner!==u.userId)await DB.prepare('INSERT OR IGNORE INTO members(id,project,email,role) SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM members WHERE project=? AND email=?)').bind(id(),project.id,email,'editor',project.id,email).run();
  return json({id:project.id});
 }
 if(p[0]!=='projects')fail('Nenájdené.',404);
 if(!p[1]){
  if(req.method==='GET')return json((await DB.prepare('SELECT DISTINCT p.* FROM projects p LEFT JOIN members m ON m.project=p.id WHERE p.owner=? OR m.email=? ORDER BY p.created DESC').bind(u.userId,email).all()).results.map((x:any)=>({...x,legacy:undefined,share:undefined})));
  if(req.method==='POST'){const b=await body(req);if(typeof b.title!=='string'||!b.title.trim()||b.title.length>200)fail('Zadajte názov projektu.');const pid=id();await DB.prepare('INSERT INTO projects(id,owner,title,created) VALUES(?,?,?,?)').bind(pid,u.userId,b.title.trim(),Date.now()).run();return json({id:pid});}
  fail('Nepovolená metóda.',405);
 }
 const project=await DB.prepare('SELECT * FROM projects WHERE id=?').bind(p[1]).first<any>();if(!project)fail('Projekt neexistuje.',404);
 const membership=await DB.prepare('SELECT role FROM members WHERE project=? AND email=?').bind(project.id,email).first<any>();
 const role=project.owner===u.userId?'owner':membership?.role;if(!role)fail('Nemáte prístup k projektu.',403);
 if(req.method!=='GET'&&role==='viewer')fail('Projekt je iba na čítanie.',403);
 if(!p[2]){
  if(req.method==='GET')return json({...project,role,legacy:JSON.parse(project.legacy),share:role==='owner'?project.share:undefined,documents:(await DB.prepare('SELECT id,path,metadata,state,revision,updated,graded FROM documents WHERE project=? ORDER BY path').bind(project.id).all()).results.map((d:any)=>({...d,metadata:JSON.parse(d.metadata),state:JSON.parse(d.state),graded:!!d.graded}))});
  if(req.method==='PATCH'){const b=await body(req);if(role!=='owner')fail('Iba vlastník môže meniť projekt.',403);if(!b.title?.trim()||b.title.length>200)fail('Neplatný názov.');await DB.prepare('UPDATE projects SET title=? WHERE id=?').bind(b.title.trim(),project.id).run();return json({ok:true});}
 }
 if(p[2]==='members'){
  if(role!=='owner')fail('Iba vlastník spravuje zdieľanie.',403);
  if(req.method==='GET')return json((await DB.prepare('SELECT id,email,role FROM members WHERE project=?').bind(project.id).all()).results);
  const b=await body(req);
  if(req.method==='DELETE'){await DB.prepare('DELETE FROM members WHERE project=? AND id=?').bind(project.id,b.id).run();return json({ok:true});}
  if(req.method==='POST'){if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)||!['editor','viewer'].includes(b.role))fail('Neplatný e-mail alebo rola.');await DB.batch([DB.prepare('DELETE FROM members WHERE project=? AND email=?').bind(project.id,b.email.toLowerCase()),DB.prepare('INSERT INTO members(id,project,email,role) VALUES(?,?,?,?)').bind(id(),project.id,b.email.toLowerCase(),b.role)]);return json({ok:true});}
 }
 if(p[2]==='share'&&req.method==='POST'){
  if(role!=='owner')fail('Iba vlastník spravuje zdieľanie.',403);const b=await body(req);const token=b.revoke?null:id()+id();await DB.prepare('UPDATE projects SET share=? WHERE id=?').bind(token,project.id).run();return json({token});
 }
 if(p[2]==='archive'){
  if(req.method==='GET'){if(!project.archive)fail('Archív ešte nie je uložený.',404);const f=await BUCKET.get(project.archive);if(!f)fail('Archív sa nenašiel.',404);return new Response(f.body,{headers:{'Content-Type':'application/zip','Cache-Control':'private, no-store'}});}
  if(req.method==='POST'){
   const key=`${project.id}/archives/${id()}.zip`;const upload=await BUCKET.createMultipartUpload(key);const uid=id();await DB.prepare('INSERT INTO uploads(id,project,user,key,multipart) VALUES(?,?,?,?,?)').bind(uid,project.id,u.userId,key,upload.uploadId).run();return json({id:uid});
  }
 }
 if(p[2]==='uploads'){
  const up=await DB.prepare('SELECT * FROM uploads WHERE id=? AND project=? AND user=?').bind(p[3],project.id,u.userId).first<any>();if(!up)fail('Upload neexistuje.',404);
  const multipart=BUCKET.resumeMultipartUpload(up.key,up.multipart);
  if(req.method==='PUT'){const n=Number(url.searchParams.get('part'));if(!Number.isInteger(n)||n<1||n>10000)fail('Neplatný blok.');const buf=await req.arrayBuffer();if(buf.byteLength>8*1024*1024)fail('Blok je príliš veľký.',413);const part=await multipart.uploadPart(n,buf);const parts=JSON.parse(up.parts).filter((x:any)=>x.partNumber!==n);parts.push(part);await DB.prepare('UPDATE uploads SET parts=? WHERE id=?').bind(JSON.stringify(parts),up.id).run();return json(part);}
  if(req.method==='POST'){await multipart.complete(JSON.parse(up.parts).sort((a:any,b:any)=>a.partNumber-b.partNumber));await DB.batch([DB.prepare('UPDATE projects SET archive=? WHERE id=?').bind(up.key,project.id),DB.prepare('DELETE FROM uploads WHERE id=?').bind(up.id)]);return json({ok:true});}
  if(req.method==='DELETE'){await multipart.abort();await DB.prepare('DELETE FROM uploads WHERE id=?').bind(up.id).run();return json({ok:true});}
 }
 if(p[2]==='legacy'&&req.method==='PUT'){
  const bytes=await req.arrayBuffer();if(bytes.byteLength>3_000_000)fail('Metadáta sú príliš veľké.',413);
  let legacy:any;try{legacy=unpack(new Uint8Array(bytes));}catch{fail('changes.arn sa nepodarilo načítať.');}
  if(!legacy||typeof legacy!=='object'||!legacy.changes)fail('Neplatný formát changes.arn.');
  if(url.searchParams.get('merge')==='1')legacy=mergeLegacy(JSON.parse(project.legacy),legacy);
  await DB.prepare('UPDATE projects SET legacy=? WHERE id=?').bind(JSON.stringify(legacy),project.id).run();return json({ok:true});
 }
 if(p[2]==='documents'&&!p[3]&&req.method==='POST'){
  const path=decodeURIComponent(req.headers.get('x-file-path')||'');let meta;try{meta=parseSubmission(path);}catch{fail('Neplatná cesta v archíve.');}if(!meta)fail('Neplatný názov PDF.');
  const existing=await DB.prepare('SELECT id,state,revision FROM documents WHERE project=? AND path=?').bind(project.id,path).first();if(existing)return json({...existing,state:JSON.parse((existing as any).state),existing:true});
  const bytes=await req.arrayBuffer();if(bytes.byteLength>40*1024*1024)fail('PDF je príliš veľké (max. 40 MB).',413);if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail('Súbor nie je PDF.');
  const did=id(),key=`${project.id}/documents/${did}/original.pdf`;await BUCKET.put(key,bytes);
  const legacy=JSON.parse(project.legacy);const old=legacy.changes?.[meta.submissionId]??{};
  const state={changes:old.changes??[],tags:old.tags??[],scoring:old.scoring??{},rotations:{},extraPages:0};
  await DB.prepare('INSERT INTO documents(id,project,path,metadata,original,state,updated) VALUES(?,?,?,?,?,?,?)').bind(did,project.id,path,JSON.stringify(meta),key,JSON.stringify(state),Date.now()).run();
  if(!project.folder)await DB.prepare("UPDATE projects SET folder=?, title=CASE WHEN title='Nový projekt' THEN ? ELSE title END WHERE id=?").bind(meta.folder,projectTitle(meta.folder),project.id).run();return json({id:did});
 }
 if(p[2]==='documents'&&p[3]){
  const doc=await DB.prepare('SELECT * FROM documents WHERE id=? AND project=?').bind(p[3],project.id).first<any>();if(!doc)fail('PDF neexistuje.',404);
  if(p[4]==='file'&&req.method==='GET'){const key=url.searchParams.get('graded')==='1'&&doc.graded?doc.graded:doc.original;const f=await BUCKET.get(key);if(!f)fail('Súbor sa nenašiel.',404);return new Response(f.body,{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store'}});}
  if(p[4]==='graded'&&req.method==='PUT'){const bytes=await req.arrayBuffer();if(bytes.byteLength>50*1024*1024||new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')fail('Neplatný PDF súbor.');const key=`${project.id}/documents/${doc.id}/graded.pdf`;await BUCKET.put(key,bytes);await DB.prepare('UPDATE documents SET graded=? WHERE id=?').bind(key,doc.id).run();return json({ok:true});}
  if(req.method==='PATCH'){
   const b=await body(req);if(!b.state||!Array.isArray(b.state.changes)||!Array.isArray(b.state.tags)||!Number.isInteger(b.revision))fail('Neplatné údaje.');const points=b.state.scoring?.points;if(points!=null&&(typeof points!=='number'||!Number.isFinite(points)||points<0||points>5)&&points!==JSON.parse(doc.state).scoring?.points)fail('Body musia byť číslo od 0 do 5.');
   const out=await DB.prepare('UPDATE documents SET state=?, revision=revision+1, updated=? WHERE id=? AND revision=?').bind(JSON.stringify(b.state),Date.now(),doc.id,b.revision).run();
   if(!out.meta.changes)return json({error:'Dokument medzitým upravil iný používateľ. Vaše zmeny ostali otvorené.',conflict:true},409);
   return json({revision:b.revision+1});
  }
 }
 fail('Nenájdené.',404);
 }catch(e:any){return json({error:e.message??'Serverová chyba.'},e.status??500);}
}
export const GET=handle;export const POST=handle;export const PUT=handle;export const PATCH=handle;export const DELETE=handle;
