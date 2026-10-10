export function normalizedState(s:any={}){return {...s,changes:s.changes??[],tags:s.tags??[],scoring:s.scoring??{},rotations:s.rotations??{},extraPages:s.extraPages??0};}
export function hasEdits(s:any){s=normalizedState(s);return !!(s.changes.length||s.tags.length||s.scoring.points!=null||s.extraPages||Object.values(s.rotations).some(x=>x!==0));}
function canonical(x:any):string {if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().filter(k=>x[k]!==undefined).map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
export function mergeDecision(first:any,second:any):'keep'|'replace'|'conflict'{if(!hasEdits(second))return 'keep';if(!hasEdits(first))return 'replace';return canonical(normalizedState(first))===canonical(normalizedState(second))?'keep':'conflict';}
export function mergeLegacy(first:any,second:any){
 const tags=[...(first.tags??[])];for(const tag of second.tags??[])if(!tags.some(x=>canonical(x)===canonical(tag)))tags.push(tag);
 return {...second,...first,tags,changes:{...(first.changes??{}),...(second.changes??{})},scoringCriteria:first.scoringCriteria?.length?first.scoringCriteria:(second.scoringCriteria??[])};
}
