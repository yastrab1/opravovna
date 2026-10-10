export function tagName(tag:any):string{return typeof tag==='string'?tag:typeof tag?.name==='string'?tag.name:'';}
export function collectTags(...groups:any[][]):any[]{
 const tags=new Map<string,any>();
 for(const group of groups)for(const tag of group??[]){const name=tagName(tag);if(name&&!tags.has(name))tags.set(name,tag);}
 return [...tags.values()].sort((a,b)=>tagName(a).localeCompare(tagName(b),'sk',{numeric:true}));
}
