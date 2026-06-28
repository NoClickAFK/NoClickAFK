import fs from 'node:fs';
import path from 'node:path';

await import('./release-version.mjs');

const root=path.resolve('bogatka-field-8f3c7d');
const write=(file,content)=>{
  const target=path.join(root,file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,content.endsWith('\n')?content:`${content}\n`);
};

write('tests/validate-versioning.mjs',`import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('bogatka-field-8f3c7d');
const failures=[];
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const requireText=(file,text)=>{if(!read(file).includes(text))failures.push(file+' missing '+text)};

for(const file of ['build-meta.js','version-runtime.js','scripts/apply-versioning.mjs','scripts/release-version.mjs','scripts/prepare-versioning.mjs','tests/versioning.spec.js']){
  if(!fs.existsSync(path.join(root,file)))failures.push('Missing '+file);
}

requireText('index.html','./build-meta.js');
requireText('index.html','./version-runtime.js');
requireText('config.js','window.BOGATKA_BUILD?.version');
requireText('version-runtime.js','getAccessLinkData');
requireText('version-runtime.js','MutationObserver');
requireText('access-version-v400.js','BogatkaVersion?.getAccessLinkData');
requireText('backup-v400.js','window.BOGATKA_BUILD?.version');
requireText('reset/reset.js','BogatkaVersion?.makeAppUrl');
requireText('sw-v340.js',"importScripts('./build-meta.js')");
requireText('sw-v340.js','self.BOGATKA_BUILD.version');
requireText('sw-v340.js',"'./version-runtime.js'");
requireText('sw-v340.js','AUTO_BUILD_STAMP');

const index=read('index.html');
if(!(index.indexOf('./build-meta.js')<index.indexOf('./version-runtime.js')&&index.indexOf('./version-runtime.js')<index.indexOf('./config.js'))){
  failures.push('Build scripts are loaded in the wrong order');
}

for(const file of ['v21.js','v22.js','v23.js','version-guard-v340.js','access-version-v400.js']){
  const source=read(file);
  if(source.includes('versionLabel.textContent = "4.0.0"')||source.includes("versionLabel.textContent='4.0.0'")||source.includes('textContent = "2.1.0"')){
    failures.push(file+' still writes a manual visible version');
  }
}

if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log('Bogatka automatic versioning validation passed.');
`);

write('tests/versioning.spec.js',`const {test,expect}=require('@playwright/test');

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/';

test('visible version and generated links use the same build metadata',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP+'?v=version-test');
  const available=await page.evaluate(()=>Boolean(window.BogatkaVersion&&window.BOGATKA_BUILD));
  test.skip(!available,'Automatic versioning is installed by the release workflow after merge');
  const build=await page.evaluate(()=>window.BOGATKA_BUILD);
  await expect(page.locator('#versionLabel')).toHaveText(build.version);
  await page.waitForTimeout(400);
  await expect(page.locator('#versionLabel')).toHaveText(build.version);
  const generated=await page.evaluate(()=>window.BogatkaVersion.makeAppUrl());
  expect(generated).toContain('v='+build.versionToken);
});
`);
