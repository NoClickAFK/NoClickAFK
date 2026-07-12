import {test,expect} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=436';
const ARTIFACT_DIR=path.resolve('review-artifacts/archive-sync-v436-review');
const ARCHIVED_AT_COLUMN='2026-07-11T12:08:33.094+00:00';
const ARCHIVED_AT_CANONICAL='2026-07-11T12:08:33.094Z';

function evidence(name,value){
  mkdirSync(ARTIFACT_DIR,{recursive:true});
  writeFileSync(path.join(ARTIFACT_DIR,name),JSON.stringify(value,null,2));
}

async function openApp(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.BogatkaSyncFieldCompatV416?.ready===true);
  await page.waitForFunction(()=>window.BogatkaSyncCompatibility?.ready===true);
  await page.waitForFunction(()=>window.BogatkaArchiveStateV436?.ready===true);
}

test('late archive fetch keeps terminal hydration authority after the legacy retry window',async({page})=>{
  test.setTimeout(120000);
  await openApp(page);

  const result=await page.evaluate(async({archivedAtColumn})=>{
    const rows=[
      {id:'remote-status-only',client_id:'status-only',status:'ready-column',form_data:{note:'status fixture'},archived_at:null},
      {id:'remote-object-only',client_id:'object-only',object_type:'Стрит ритейл',form_data:{note:'object fixture'},archived_at:null},
      {id:'remote-both',client_id:'both',status:'review-column',object_type:'Street retail',form_data:{note:'both fixture'},archived_at:archivedAtColumn},
      {id:'remote-explicit',client_id:'explicit',status:'column-must-not-win',object_type:'street-retail',form_data:{status:'',objectType:'',note:'explicit reset fixture'},archived_at:null},
      {id:'remote-explicit-values',client_id:'explicit-values',status:'column-status',object_type:'Street retail',form_data:{status:'form-status',objectType:'form-object'},archived_at:null},
    ];
    const responseFor=table=>table==='locations'
      ?{data:structuredClone(rows),error:null}
      :table==='photos'
        ?{data:[],error:null}
        :{data:null,error:null};
    const makeBuilder=result=>({
      select(){return this},
      eq(){return this},
      is(){return this},
      order(){return Promise.resolve(result)},
      maybeSingle(){return Promise.resolve(result)},
    });
    cloudClient={from(table){return makeBuilder(responseFor(table))}};
    cloudProjectId='late-fetch-hydration-project';

    const api=window.BogatkaSyncFieldCompatV416;
    const snapshot=()=>api._test.fetchAuthoritySnapshot?.()||{
      owner:null,terminalInstalled:Boolean(cloudFetchRemote?.__syncFieldCompatV416),
      archiveSource:Boolean(cloudFetchRemote?.__cloudArchiveV400),wrapperDepth:null,
      installCalls:null,rebinds:null,sourceChanges:null,
    };
    const summarize=payload=>(payload?.remoteLocations||[]).map(row=>({
      id:row.client_id||row.id,
      statusColumn:Object.hasOwn(row,'status')?row.status:'<absent>',
      objectTypeColumn:Object.hasOwn(row,'object_type')?row.object_type:'<absent>',
      formStatus:Object.hasOwn(row.form_data||{},'status')?row.form_data.status:'<absent>',
      formObjectType:Object.hasOwn(row.form_data||{},'objectType')?row.form_data.objectType:'<absent>',
      archivedAt:Object.hasOwn(row.form_data||{},'archivedAt')?row.form_data.archivedAt:'<absent>',
      archivedAtColumn:Object.hasOwn(row,'archived_at')?row.archived_at:'<absent>',
    }));

    const terminalBefore=cloudFetchRemote;
    const ownershipBefore=snapshot();
    const beforeLate=summarize(await cloudFetchRemote());

    const retryWindowStarted=Date.now();
    await new Promise(resolve=>setTimeout(resolve,30500));
    const waitedPastLegacyRetryWindow=Date.now()-retryWindowStarted>=30000;

    window.__bogatkaCloudArchiveV400=false;
    const failedScript=document.createElement('script');
    failedScript.src=`./cloud-archive-v400-missing.js?failed=${Date.now()}`;
    failedScript.async=false;
    const failedFirstLoad=await new Promise(resolve=>{
      failedScript.onload=()=>resolve(false);
      failedScript.onerror=()=>resolve(true);
      document.head.appendChild(failedScript);
    });
    failedScript.remove();

    const retryScript=document.createElement('script');
    retryScript.src=`./cloud-archive-v400.js?late-fetch=${Date.now()}`;
    retryScript.async=false;
    const retryLoaded=await new Promise((resolve,reject)=>{
      retryScript.onload=()=>resolve(true);
      retryScript.onerror=()=>reject(new Error('Late cloud archive retry failed to load'));
      document.head.appendChild(retryScript);
    });
    await new Promise(resolve=>setTimeout(resolve,30));

    const terminalAfterLate=cloudFetchRemote;
    const ownershipAfterLate=snapshot();
    const afterLate=summarize(await cloudFetchRemote());

    const sourceBeforeRepeat=cloudFetchRemote?.__source||cloudFetchRemote?.__base||null;
    for(let index=0;index<6;index++){
      api.installFetchAuthority?.();
      window.dispatchEvent(new CustomEvent('bogatka:cloud-archive-loaded',{detail:{delegatedToV436:true,repeat:index}}));
    }
    await new Promise(resolve=>setTimeout(resolve,30));
    const ownershipAfterRepeat=snapshot();
    const terminalAfterRepeat=cloudFetchRemote;
    const sourceAfterRepeat=cloudFetchRemote?.__source||cloudFetchRemote?.__base||null;
    const afterRepeat=summarize(await cloudFetchRemote());

    return{
      initialColumns:rows.map(row=>({
        id:row.client_id,
        status:Object.hasOwn(row,'status')?row.status:'<absent>',
        objectType:Object.hasOwn(row,'object_type')?row.object_type:'<absent>',
        formData:row.form_data,
        archivedAt:Object.hasOwn(row,'archived_at')?row.archived_at:'<absent>',
      })),
      beforeLate,afterLate,afterRepeat,
      waitedPastLegacyRetryWindow,failedFirstLoad,retryLoaded,
      terminalStableAfterLate:terminalAfterLate===terminalBefore,
      terminalStableAfterRepeat:terminalAfterRepeat===terminalAfterLate,
      sourceStableAfterRepeat:sourceAfterRepeat===sourceBeforeRepeat,
      ownershipBefore,ownershipAfterLate,ownershipAfterRepeat,
    };
  },{archivedAtColumn:ARCHIVED_AT_COLUMN});

  evidence('18-late-fetch-hydration-preserved.json',result);

  const byId=Object.fromEntries(result.afterLate.map(row=>[row.id,row]));
  expect(result.waitedPastLegacyRetryWindow).toBe(true);
  expect(result.failedFirstLoad).toBe(true);
  expect(result.retryLoaded).toBe(true);
  expect(byId['status-only'].formStatus).toBe('ready-column');
  expect(byId['object-only'].formObjectType).toBe('Стрит-ритейл');
  expect(byId.both).toMatchObject({formStatus:'review-column',formObjectType:'Стрит-ритейл',archivedAt:ARCHIVED_AT_CANONICAL,archivedAtColumn:ARCHIVED_AT_CANONICAL});
  expect(byId.explicit).toMatchObject({formStatus:'',formObjectType:''});
  expect(byId['explicit-values']).toMatchObject({formStatus:'form-status',formObjectType:'form-object'});
  expect(result.terminalStableAfterLate).toBe(true);
  expect(result.terminalStableAfterRepeat).toBe(true);
  expect(result.sourceStableAfterRepeat).toBe(true);
  expect(result.ownershipAfterLate).toMatchObject({owner:'sync-field-compat-v416',terminalInstalled:true,archiveSource:true,wrapperDepth:1});
  expect(result.ownershipAfterRepeat).toMatchObject({owner:'sync-field-compat-v416',terminalInstalled:true,archiveSource:true,wrapperDepth:1});
  expect(result.ownershipAfterRepeat.rebinds-result.ownershipAfterLate.rebinds).toBeLessThanOrEqual(1);
  expect(result.afterRepeat).toEqual(result.afterLate);
});
