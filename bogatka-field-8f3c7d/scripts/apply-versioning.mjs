import fs from 'node:fs';
import path from 'node:path';

const repoRoot=process.cwd();
const appRoot=path.join(repoRoot,'bogatka-field-8f3c7d');
const sourceCommit=String(process.env.SOURCE_SHA||'').trim()||'unknown';
const builtAt=String(process.env.BUILD_TIME||'').trim()||new Date().toISOString();

const read=relative=>fs.readFileSync(path.join(repoRoot,relative),'utf8');
const write=(relative,content)=>{
  const target=path.join(repoRoot,relative);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,content.endsWith('\n')?content:`${content}\n`);
};
const replace=(relative,from,to,{required=false}={})=>{
  const source=read(relative);
  if(source.includes(to))return false;
  if(!source.includes(from)){
    if(required)throw new Error(`${relative}: expected marker not found: ${from}`);
    return false;
  }
  write(relative,source.replace(from,to));
  return true;
};

const metaPath='bogatka-field-8f3c7d/build-meta.js';
const existing=fs.existsSync(path.join(repoRoot,metaPath))?read(metaPath):'';
const current=existing.match(/version:'(\d+)\.(\d+)\.(\d+)'/)?.slice(1).map(Number)||[4,2,5];
const next=[current[0],current[1],current[2]+1];
const version=next.join('.');
const versionToken=next.join('');

write(metaPath,`(function(scope){
  'use strict';

  const build=Object.freeze({
    version:'${version}',
    versionToken:'${versionToken}',
    sourceCommit:'${sourceCommit.replace(/[^a-f0-9]/gi,'').slice(0,40)||'unknown'}',
    builtAt:'${builtAt.replace(/'/g,'')}',
  });

  scope.BOGATKA_BUILD=build;
})(typeof self!=='undefined'?self:globalThis);
`);

write('bogatka-field-8f3c7d/version-runtime.js',`(function(scope){
  'use strict';

  const build=scope.BOGATKA_BUILD;
  if(!build||!/^\\d+\\.\\d+\\.\\d+$/.test(String(build.version||''))){
    throw new Error('Не загружены корректные метаданные версии приложения.');
  }

  const version=String(build.version);
  const token=String(build.versionToken||version.replace(/\\D/g,''));
  let observer=null;

  function apply(){
    if(typeof document==='undefined')return version;
    const label=document.getElementById('versionLabel');
    if(!label)return version;
    if(label.textContent!==version)label.textContent=version;
    label.dataset.buildVersion=version;
    label.dataset.buildCommit=String(build.sourceCommit||'');
    label.title=build.sourceCommit
      ? \\`Сборка \\${version} · \\${String(build.sourceCommit).slice(0,7)} · \\${build.builtAt||''}\\`
      : \\`Сборка \\${version}\\`;
    if(!observer){
      observer=new MutationObserver(()=>{
        if(label.textContent!==version)label.textContent=version;
      });
      observer.observe(label,{childList:true,characterData:true,subtree:true});
    }
    return version;
  }

  function makeAppUrl(accessToken=null,baseHref=scope.location?.href||'http://localhost/'){
    const url=new URL(baseHref,scope.location?.href||'http://localhost/');
    url.hash='';
    url.search='';
    url.searchParams.set('v',token);
    if(accessToken)url.hash=\\`access=\\${encodeURIComponent(accessToken)}\\`;
    return url.href;
  }

  function getAccessLinkData(accessToken=null){
    return {url:makeAppUrl(accessToken),hasFullKey:Boolean(accessToken)};
  }

  scope.BogatkaVersion=Object.freeze({build,version,token,apply,makeAppUrl,getAccessLinkData});
  scope.addEventListener?.('DOMContentLoaded',apply,{once:true});
  scope.addEventListener?.('load',apply);
})(typeof window!=='undefined'?window:globalThis);
`);

replace('bogatka-field-8f3c7d/index.html',
  '<script src="./supabase-config.js" defer></script>',
  '<script src="./build-meta.js" defer></script>\n<script src="./version-runtime.js" defer></script>\n<script src="./supabase-config.js" defer></script>',
  {required:true});

replace('bogatka-field-8f3c7d/config.js',
  'const APP_VERSION = "4.0.0";',
  'const APP_VERSION = window.BOGATKA_BUILD?.version || "0.0.0";',
  {required:true});

for(const [file,oldLine] of [
  ['bogatka-field-8f3c7d/v21.js','  if ($("#versionLabel")) $("#versionLabel").textContent = "2.1.0";'],
  ['bogatka-field-8f3c7d/v22.js','  if (document.getElementById("versionLabel")) document.getElementById("versionLabel").textContent = "4.0.0";'],
  ['bogatka-field-8f3c7d/v23.js',"  if(versionLabel)versionLabel.textContent='4.0.0';"],
])replace(file,oldLine,'  window.BogatkaVersion?.apply?.();');

write('bogatka-field-8f3c7d/version-guard-v340.js',`(function(){
  function set(){return window.BogatkaVersion?.apply?.()||''}
  const base=window.enhancePremiumUi;
  window.enforceCurrentVersion=set;
  try{enforceCurrentVersion=set}catch(_){}
  if(typeof base==='function'){
    const wrapped=function(){base();set()};
    window.enhancePremiumUi=wrapped;
    try{enhancePremiumUi=wrapped}catch(_){}
  }
  const link=function(){
    const token=localStorage.getItem(TOKEN_KEY);
    return window.BogatkaVersion?.getAccessLinkData?.(token)||{url:location.href,hasFullKey:Boolean(token)};
  };
  window.getAccessLinkData=link;
  try{getAccessLinkData=link}catch(_){}
  set();
})();
`);

write('bogatka-field-8f3c7d/access-version-v400.js',`(function(){
  function accessLink(){
    const token=localStorage.getItem(TOKEN_KEY);
    return window.BogatkaVersion?.getAccessLinkData?.(token)||{url:location.href,hasFullKey:Boolean(token)};
  }
  window.getAccessLinkData=accessLink;
  try{getAccessLinkData=accessLink}catch(_){}
  window.BogatkaVersion?.apply?.();
})();
`);

replace('bogatka-field-8f3c7d/backup-v400.js',
  "appVersion:'4.0.0'",
  "appVersion:(window.BOGATKA_BUILD?.version||APP_VERSION)",
  {required:true});

replace('bogatka-field-8f3c7d/reset/index.html',
  '  <script src="../supabase-config.js" defer></script>',
  '  <script src="../build-meta.js" defer></script>\n  <script src="../version-runtime.js" defer></script>\n  <script src="../supabase-config.js" defer></script>',
  {required:true});
replace('bogatka-field-8f3c7d/reset/index.html','href="../?v=400"','href="../"');
replace('bogatka-field-8f3c7d/reset/reset.js',
  "const APP_URL='../?v=400';",
  "const APP_URL=window.BogatkaVersion?.makeAppUrl(null,new URL('../',location.href).href)||'../';",
  {required:true});

{
  const swPath='bogatka-field-8f3c7d/sw-v340.js';
  let sw=read(swPath);
  if(sw.startsWith("const CACHE_NAME='bogatka-location-v423';")){
    sw=sw.replace("const CACHE_NAME='bogatka-location-v423';",`// AUTO_BUILD_STAMP: ${version} ${sourceCommit}\nimportScripts('./build-meta.js');\nconst CACHE_NAME=\\`bogatka-location-v\\${self.BOGATKA_BUILD.version}\\`;`);
  }else{
    sw=sw.replace(/^\/\/ AUTO_BUILD_STAMP:.*$/m,`// AUTO_BUILD_STAMP: ${version} ${sourceCommit}`);
  }
  if(!sw.includes("'./build-meta.js'"))sw=sw.replace('const CORE_ASSETS=[','const CORE_ASSETS=[\n  \'./build-meta.js\',\'./version-runtime.js\',');
  write(swPath,sw);
}

replace('.github/workflows/bogatka-validation.yml',
  "      - name: Validate hardening integration\n        run: node bogatka-field-8f3c7d/tests/validate-hardening.mjs",
  "      - name: Validate hardening integration\n        run: node bogatka-field-8f3c7d/tests/validate-hardening.mjs\n\n      - name: Validate automatic versioning\n        run: node bogatka-field-8f3c7d/tests/validate-versioning.mjs",
  {required:true});

{
  const file='bogatka-field-8f3c7d/tests/validate-files.mjs';
  let source=read(file);
  source=source.replace("'reset/index.html','reset/reset.js','sw.js','sw-v340.js'","'build-meta.js','version-runtime.js','scripts/apply-versioning.mjs','tests/validate-versioning.mjs','reset/index.html','reset/reset.js','sw.js','sw-v340.js'");
  source=source.replace("if (!serviceWorker.includes(\"CACHE_NAME='bogatka-location-v423'\")) failures.push('Service Worker cache name is not v423');","if (!serviceWorker.includes(\"importScripts('./build-meta.js')\") || !serviceWorker.includes('self.BOGATKA_BUILD.version')) failures.push('Service Worker cache is not derived from build metadata');");
  source=source.replace("if (!signup.includes('length<12') || !signup.includes('\\\\p{L}')) failures.push('Signup password policy is weaker than required');\n  if (!reset.includes('length<12') || !reset.includes(\"APP_URL='../?v=400'\")) failures.push('Recovery password policy or return URL is outdated');\n\n  for (const file of ['v22.js','v23.js','access-version-v400.js','backup-v400.js']) {\n    if (!read(file).includes('4.0.0') && !read(file).includes('v=400')) failures.push(`${file} is not aligned with version 4.0.0`);\n  }","if (!signup.includes('length<12') || !signup.includes('\\\\p{L}')) failures.push('Signup password policy is weaker than required');\n  if (!reset.includes('length<12') || !reset.includes('BogatkaVersion?.makeAppUrl')) failures.push('Recovery password policy or versioned return URL is outdated');");
  write(file,source);
}

{
  const file='bogatka-field-8f3c7d/tests/validate-hardening.mjs';
  let source=read(file);
  source=source.replace("for(const asset of ['./location-card-collapse-v422.js'","for(const asset of ['./build-meta.js','./version-runtime.js','./location-card-collapse-v422.js'");
  write(file,source);
}

console.log(JSON.stringify({previousVersion:current.join('.'),version,versionToken,sourceCommit,builtAt}));
