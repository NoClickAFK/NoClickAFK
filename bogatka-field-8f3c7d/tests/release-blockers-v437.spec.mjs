import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=release-blockers-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');
let EVENT_HEAD='';
try{const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));EVENT_HEAD=event?.pull_request?.head?.sha||''}catch(_){ }
const EXACT_HEAD=process.env.BOGATKA_EXACT_HEAD||EVENT_HEAD||process.env.GITHUB_SHA||'local-uncommitted';

async function authorize(page){await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'))}
async function writeEvidence(name,value){await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,name),JSON.stringify({...value,head:EXACT_HEAD},null,2))}
async function openApp(page){
  await authorize(page);
  await page.goto(APP,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.BogatkaMutationAuthorityV437?.ready&&window.BogatkaInitialBackgroundEditProtectionV437?.ready&&window.BogatkaCloudInitAuthorityV437?.ready),{timeout:30000});
}

test('local-only early input is persisted through the existing per-location queue before debounce',async({page})=>{
  test.setTimeout(60000);
  await openApp(page);
  const id='local-only-release-v437';
  await page.evaluate(async id=>{
    window.BogatkaMutationAuthorityV437._test.setState('owner','focused-test');
    const Protection=window.BogatkaInitialBackgroundEditProtectionV437;
    Protection._test.resetForTest();
    clearTimeout(cloudSyncTimer);clearTimeout(cloudRealtimeTimer);
    locations=[{id,title:'Local only release fixture',address:'Fixture',note:'',custom:true}];
    await window.BogatkaSyncState.rawPut()(STORE,{contact:'OLD',updatedAt:'2026-07-14T10:00:00.000Z'},`location:${id}`);
    await window.BogatkaSyncState.rawPut()(STORE,locations,'meta:locations');
    cloudProjectId='project-release-v437';cloudSession={user:{id:'owner-release-v437'}};cloudRole='owner';window.cloudRole='owner';
    cloudWriteState({projectId:cloudProjectId,userId:cloudSession.user.id,dirtyLocations:[],dirtyPhotos:[],deletedPhotos:{},knownLocationIds:[],knownPhotoIds:[],stateDirty:false,metaDirty:false});
    renderLocations();
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(document.querySelector(`[data-location-card="${id}"]`),false,{persist:false});
    await restoreAllForms({preserveActive:true});
    await Protection.captureStartupSnapshot({force:true});
  },id);
  const control=page.locator(`[data-location="${id}"][data-field="contact"]`);
  await expect(control).toHaveCount(1);
  await control.evaluate(element=>{
    element.value='DURABLE-EARLY';
    element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'DURABLE-EARLY'}));
    if(element._saveTimer){clearTimeout(element._saveTimer);element._saveTimer=null}
  });
  await page.waitForFunction(()=>window.BogatkaMutationAuthorityV437.diagnostics.durableEarlyWrites>=1,{timeout:10000});
  const evidence=await page.evaluate(async id=>{
    const stored=await getLocationData(id);
    const state=cloudReadState();
    const Protection=window.BogatkaInitialBackgroundEditProtectionV437;
    const entry=Protection._test.entriesFor(id).find(item=>item.path==='contact');
    return{
      storedValue:stored.contact,
      dirtyLocations:state.dirtyLocations||[],
      journalValue:entry?.value,
      revision:entry?.revision,
      flushedRevision:entry?.flushedRevision,
      savedRevision:entry?.savedRevision,
      authority:window.BogatkaMutationAuthorityV437.diagnostics,
    };
  },id);
  expect(evidence.storedValue).toBe('DURABLE-EARLY');
  expect(evidence.dirtyLocations).toContain(id);
  expect(evidence.journalValue).toBe('DURABLE-EARLY');
  expect(evidence.flushedRevision).toBeGreaterThanOrEqual(evidence.revision);
  expect(evidence.savedRevision).toBeGreaterThanOrEqual(evidence.revision);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.BogatkaMutationAuthorityV437?.ready));
  const persisted=await page.evaluate(async id=>(await getLocationData(id)).contact,id);
  expect(persisted).toBe('DURABLE-EARLY');
  await writeEvidence('06-local-only-early-edit-durability.json',{...evidence,reloadValue:persisted,noStaleDebounceWrite:true});
});

test('role-pending and viewer block mutations while owner editor and signed-out local allow them',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const Authority=window.BogatkaMutationAuthorityV437;
    const input=document.querySelector('[data-global="inspector"]');
    const original={session:cloudSession,role:cloudRole,projectId:cloudProjectId,token:localStorage.getItem('sb-release-auth-token')};
    const attempt=()=>{
      const before=input.value;
      input.value=`attempt-${Authority.state}`;
      input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:Authority.state}));
      return{state:Authority.state,disabled:input.disabled,before,after:input.value,allowed:Authority.canMutate()};
    };
    localStorage.setItem('sb-release-auth-token',JSON.stringify({access_token:'fixture',user:{id:'viewer-release-v437'}}));
    cloudSession={user:{id:'viewer-release-v437'}};cloudProjectId='project-release-v437';cloudRole=null;window.cloudRole=null;
    Authority.refresh();
    const pending=attempt();
    cloudRole='viewer';window.cloudRole='viewer';Authority.refresh();
    const viewer=attempt();
    cloudRole='owner';window.cloudRole='owner';Authority.refresh();
    const owner=attempt();
    cloudRole='editor';window.cloudRole='editor';Authority.refresh();
    const editor=attempt();
    cloudSession=null;cloudRole=null;cloudProjectId=null;window.cloudRole=null;localStorage.removeItem('sb-release-auth-token');Authority.refresh();
    const signedOut=attempt();
    cloudSession=original.session;cloudRole=original.role;cloudProjectId=original.projectId;window.cloudRole=original.role;
    if(original.token===null)localStorage.removeItem('sb-release-auth-token');else localStorage.setItem('sb-release-auth-token',original.token);
    Authority.refresh();
    return{pending,viewer,owner,editor,signedOut,diagnostics:Authority.diagnostics};
  });
  expect(result.pending).toMatchObject({state:'role-pending',disabled:true,allowed:false});
  expect(result.viewer).toMatchObject({state:'viewer',disabled:true,allowed:false});
  expect(result.owner).toMatchObject({state:'owner',disabled:false,allowed:true});
  expect(result.editor).toMatchObject({state:'editor',disabled:false,allowed:true});
  expect(result.signedOut).toMatchObject({state:'signed-out-local',disabled:false,allowed:true});
  expect(result.pending.after).toBe(result.pending.before);
  expect(result.viewer.after).toBe(result.viewer.before);
  await writeEvidence('07-delayed-role-mutation-authority.json',result);
});

test('legacy load and local-first callers delegate to one canonical cloud singleton',async({page})=>{
  await openApp(page);
  const result=await page.evaluate(async()=>{
    const Authority=window.BogatkaCloudInitAuthorityV437;
    let singletonCalls=0;
    let resolve;
    const shared=new Promise(done=>{resolve=done});
    const original=window.BogatkaCloud.init;
    window.BogatkaCloud.init=()=>{singletonCalls+=1;return shared};
    Authority.installIntegrityDelegate();
    window.__bogatkaSyncIntegrityGateV412=false;
    installSyncIntegrityGate();
    const first=cloudInit({source:'legacy-load'});
    const second=Authority.singleton({source:'local-first'});
    resolve({status:'ready'});
    const values=await Promise.all([first,second]);
    window.BogatkaCloud.init=original;
    return{singletonCalls,sameResult:values[0]===values[1],values,diagnostics:Authority.diagnostics,delegateMarker:Boolean(cloudInit.__cloudInitAuthorityV437)};
  });
  expect(result.singletonCalls).toBe(2);
  expect(result.sameResult).toBe(true);
  expect(result.delegateMarker).toBe(true);
  expect(result.diagnostics.appCreateClientCalls).toBeLessThanOrEqual(1);
  expect(result.diagnostics.appAuthListenerCalls).toBeLessThanOrEqual(1);
  await writeEvidence('08-cloud-init-singleton-counters.json',result);
});
