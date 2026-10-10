export function tagName(tag:any):string{return typeof tag==='string'?tag:typeof tag?.name==='string'?tag.name:typeof tag?.meno==='string'?tag.meno:typeof tag?.label==='string'?tag.label:'';}
export function collectTags(...groups:any[][]):any[]{
 const tags=new Map<string,any>();
 for(const group of groups)for(const tag of group??[]){const name=tagName(tag);if(name&&!tags.has(name))tags.set(name,tag);}
 return [...tags.values()].sort((a,b)=>tagName(a).localeCompare(tagName(b),'sk',{numeric:true}));
}

function arnoldCatalog(tags:any[]=[]){const byId=new Map<string,any>();for(const tag of tags)if(tag&&typeof tag==='object'&&typeof tag.id==='string'&&tagName(tag))byId.set(tag.id,{...tag,name:tagName(tag)});return byId;}
function resolveTag(tag:any,byId:Map<string,any>){if(typeof tag==='string')return byId.get(tag)??tag;if(tag&&typeof tag==='object'&&tagName(tag)&&!tag.name)return {...tag,name:tagName(tag)};return tag;}
export function normalizeArnoldTagValues(values:any[],catalog:any[]=[]){const byId=arnoldCatalog(catalog);return (values??[]).map((tag:any)=>resolveTag(tag,byId));}
export function normalizeArnoldLegacy(legacy:any){
 if(!legacy||typeof legacy!=='object')return legacy;
 const source=Array.isArray(legacy.tags)?legacy.tags:[],byId=arnoldCatalog(source);
 const tags=collectTags(source.map((tag:any)=>resolveTag(tag,byId)).filter((tag:any)=>!(typeof tag==='string'&&byId.has(tag))));
 const changes=legacy.changes&&typeof legacy.changes==='object'?Object.fromEntries(Object.entries(legacy.changes).map(([id,value]:[string,any])=>[id,value&&typeof value==='object'?{...value,tags:Array.isArray(value.tags)?value.tags.map((tag:any)=>resolveTag(tag,byId)):value.tags}:value])):legacy.changes;
 return {...legacy,tags,changes};
}
export function normalizeArnoldProject(project:any){
 if(!project?.legacy)return project;
 const legacy=normalizeArnoldLegacy(project.legacy),byId=arnoldCatalog(Array.isArray(project.legacy.tags)?project.legacy.tags:[]);
 return {...project,legacy,documents:(project.documents??[]).map((doc:any)=>({...doc,state:{...doc.state,tags:(doc.state?.tags??[]).map((tag:any)=>resolveTag(tag,byId))}}))};
}
