import fs from "node:fs";
if (!fs.existsSync("dist/server/index.js"))
  throw new Error("Run npm run build first.");
fs.writeFileSync(
  "dist/server/test-entry.mjs",
  `import app from './index.js';
export default {async fetch(request,env,ctx){
 if(request.method==='GET'||request.method==='HEAD'){
  const asset=await env.ASSETS.fetch(request);
  if(asset.status!==404)return asset;
 }
 return app.fetch(request,env,ctx);
}};`,
);
console.log("Prepared Cloudflare test Worker.");
