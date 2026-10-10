export async function api(path:string,init:RequestInit={}):Promise<any> {
 const res=await fetch('/api/'+path,{...init,headers:{...(typeof init.body==='string'?{'Content-Type':'application/json'}:{}),...init.headers}});
 if(!res.ok){const data:any=await res.json().catch(()=>({error:'Chyba spojenia.'}));throw Object.assign(new Error(data.error),{status:res.status});}
 return res.json();
}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
