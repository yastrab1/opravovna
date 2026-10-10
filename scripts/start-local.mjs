import fs from 'node:fs';import {spawn} from 'node:child_process';
const config=JSON.parse(fs.readFileSync('dist/server/wrangler.json','utf8'));
config.main='dist/server/index.js';config.assets.directory='dist/client';
fs.writeFileSync('wrangler.local.json',JSON.stringify(config));
const p=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','dev','--config','wrangler.local.json','--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--inspector-port','0'],{stdio:'inherit'});
p.on('exit',code=>process.exit(code??1));
