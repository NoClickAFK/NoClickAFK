import fs from 'node:fs';
import path from 'node:path';

await import('./apply-versioning.mjs');

const repoRoot=process.cwd();
const swPath=path.join(repoRoot,'bogatka-field-8f3c7d','sw-v340.js');
let sw=fs.readFileSync(swPath,'utf8');
if(!sw.includes("'./version-runtime.js'")){
  sw=sw.replace('const CORE_ASSETS=[','const CORE_ASSETS=[\n  \'./build-meta.js\',\'./version-runtime.js\',');
}
fs.writeFileSync(swPath,sw.endsWith('\n')?sw:`${sw}\n`);
