import fs from "node:fs";
import { spawn } from "node:child_process";
const config = JSON.parse(fs.readFileSync("dist/server/wrangler.json", "utf8"));
fs.mkdirSync(".sites-runtime", { recursive: true });
// Sites dispatch handles framework static-file markers in hosting. Local
// Wrangler needs an explicit asset binding in front of the generated handler.
fs.writeFileSync(
  "dist/server/local-entry.mjs",
  `import app from './index.js';
export default {async fetch(request,env,ctx){
 const url=new URL(request.url);
 if(request.method==='GET'||request.method==='HEAD'){
  const asset=await env.ASSETS.fetch(request);
  if(asset.status!==404)return asset;
 }
 return app.fetch(request,env,ctx);
}};`,
);
config.main = "dist/server/local-entry.mjs";
config.assets = {
  ...config.assets,
  directory: "dist/client",
  binding: "ASSETS",
  run_worker_first: true,
  not_found_handling: "none",
};
fs.writeFileSync("wrangler.local.json", JSON.stringify(config));
const p = spawn(
  process.execPath,
  [
    "node_modules/wrangler/bin/wrangler.js",
    "dev",
    "--config",
    "wrangler.local.json",
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--ip",
    "127.0.0.1",
    "--inspector-port",
    "0",
  ],
  { stdio: "inherit" },
);
p.on("exit", (code) => process.exit(code ?? 1));
