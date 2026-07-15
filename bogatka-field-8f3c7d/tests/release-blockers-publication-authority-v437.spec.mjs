import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const APP='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=publication-authority-v437';
const OUT=path.resolve('review-artifacts/startup-panels-v437-review');
let EVENT_HEAD='';
try{const event=JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH,'utf8'));EVENT_HEAD=event?.pull_request?.head?.sha||''}catch(_){ }
const EXACT_HEAD=process.env.BOGATKA_EXACT_HEAD||EVENT_HEAD||process.env.GITHUB_SHA||'local-uncommitted';

async function authorize(page){await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'))}
async function writeEvidence(name,value){await fs.mkdir(OUT,{recursive:true});await fs.writeFile(path.join(OUT,name),JSON.stringify({...value,head:EXACT_HEAD},null,2))}
async function openApp(page){
  await authorize(page);
  await page.goto(APP,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaMutationAuthorityV437?.ready&&
    typeof window.cloudPublishReport==='function'&&
    typeof window.cloudRenderModal==='function'&&
    document.querySelector('#shareReportBtn')
  ),{timeout:30000});
}

test('publication follows the central mutation authority for every role state',async({page})=>{
  test.setTimeout(90000);
  await openApp(page);

  const evidence=await page.evaluate(async()=>{
    const Authority=window.BogatkaMutationAuthorityV437;
    const deniedMessage='Публикация отчёта доступна владельцу и редактору проекта.';
    const signInMessage='Сначала войдите, чтобы создать постоянную ссылку на отчёт.';
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const clearAuthTokens=()=>{
      for(let index=localStorage.length-1;index>=0;index--){
        const key=localStorage.key(index)||'';
        if(/^sb-.*-auth-token$/.test(key))localStorage.removeItem(key);
      }
    };
    let online=true;
    try{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>online})}catch(_){ }

    const counters={sync:0,snapshot:0,insert:0,error:0,share:0};
    const resetCounters=()=>{for(const key of Object.keys(counters))counters[key]=0};
    const copyCounters=()=>({...counters});
    const original={
      sync:window.cloudSyncAll,
      snapshot:window.cloudBuildSnapshot,
      handleError:window.cloudHandleError,
      loadMembers:window.cloudLoadMembers,
      client:cloudClient,
      cloud:window.BogatkaCloud,
    };

    const fixtureSync=async()=>{counters.sync+=1;return{status:'fixture-synced'}};
    const fixtureSnapshot=async()=>{counters.snapshot+=1;return{version:1,fixture:true,locations:[],photos:[],global:{}}};
    const fixtureHandleError=error=>{counters.error+=1;return original.handleError(error)};
    const fixtureLoadMembers=async()=>{};
    window.cloudSyncAll=fixtureSync;try{cloudSyncAll=fixtureSync}catch(_){ }
    window.cloudBuildSnapshot=fixtureSnapshot;try{cloudBuildSnapshot=fixtureSnapshot}catch(_){ }
    window.cloudHandleError=fixtureHandleError;try{cloudHandleError=fixtureHandleError}catch(_){ }
    window.cloudLoadMembers=fixtureLoadMembers;try{cloudLoadMembers=fixtureLoadMembers}catch(_){ }
    try{Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{counters.share+=1}})}catch(_){ }

    cloudClient={
      from(table){
        if(table!=='reports')throw new Error(`Unexpected fixture table: ${table}`);
        return{
          insert(){
            counters.insert+=1;
            const denied=!['owner','editor'].includes(Authority.state);
            return{select(){return{single:async()=>denied
              ?{data:null,error:{message:'fixture RLS denied'}}
              :{data:{public_token:`fixture-${Authority.state}`},error:null}}}};
          },
        };
      },
    };

    const status=()=>({
      title:document.querySelector('#cloudStatusTitle')?.textContent||document.querySelector('#cloudSyncBtn')?.textContent||'',
      detail:document.querySelector('#cloudStatusDetail')?.textContent||'',
      pill:document.querySelector('#cloudTopPill')?.textContent||'',
      pillClass:document.querySelector('#cloudTopPill')?.className||'',
      message:document.querySelector('#cloudMessage')?.textContent||'',
      messageClass:document.querySelector('#cloudMessage')?.className||'',
    });

    async function setRoleState(kind){
      clearAuthTokens();
      online=true;
      window.BogatkaCloud=original.cloud;
      const userId=`fixture-${kind}`;
      const projectId=`project-${kind}`;
      if(kind==='signed-out-local'){
        cloudSession=null;cloudRole=null;cloudProjectId=null;window.cloudRole=null;
      }else if(kind==='session-pending'){
        localStorage.setItem(`sb-${kind}-auth-token`,JSON.stringify({access_token:'fixture',user:{id:userId}}));
        cloudSession={user:{}};
        cloudProjectId=projectId;
        cloudRole=null;window.cloudRole=null;
        window.BogatkaCloud={...(original.cloud||{}),ready:false,lastInitResult:null};
      }else if(kind==='error-readonly'){
        localStorage.setItem(`sb-${kind}-auth-token`,JSON.stringify({access_token:'fixture',user:{id:userId}}));
        cloudSession={user:{}};
        cloudProjectId=projectId;
        cloudRole=null;window.cloudRole=null;
        online=false;
        window.BogatkaCloud={...(original.cloud||{}),ready:true,lastInitResult:{status:'authority-failed',session:null}};
      }else{
        localStorage.setItem(`sb-${kind}-auth-token`,JSON.stringify({access_token:'fixture',user:{id:userId}}));
        cloudSession={user:{id:userId,email:`${kind}@example.test`,user_metadata:{display_name:kind}}};
        cloudProjectId=projectId;
        cloudRole=kind==='role-pending'||kind==='offline-cached-viewer'?null:kind;
        window.cloudRole=cloudRole;
        if(kind==='offline-cached-viewer'){
          Authority._test.writeCachedRole(userId,projectId,'viewer');
          online=false;
        }
      }
      Authority.refresh();
      await sleep(80);
    }

    async function openStablePublicationModal(){
      await setRoleState('owner');
      cloudOpenModal();
      await sleep(100);
      const modal=document.querySelector('#cloudPublishBtn');
      if(!modal)throw new Error('Publication modal button was not created.');
      return modal;
    }

    async function runDenied(kind){
      const modal=await openStablePublicationModal();
      await setRoleState(kind);
      cloudSetStatus('ready','fixture read-only');
      cloudSetMessage('fixture before','info');
      await sleep(20);
      resetCounters();
      const top=document.querySelector('#shareReportBtn');
      const before=status();
      top?.click();
      modal?.click();
      await window.cloudPublishReport().catch(window.cloudHandleError);
      await sleep(120);
      const message=document.querySelector('#cloudMessage')?.textContent||'';
      return{
        state:Authority.state,
        topDisabled:Boolean(top?.disabled),
        topAria:top?.getAttribute('aria-disabled'),
        modalDisabled:Boolean(modal?.disabled),
        modalAria:modal?.getAttribute('aria-disabled'),
        sameModalNode:modal===document.querySelector('#cloudPublishBtn'),
        modalCount:document.querySelectorAll('#cloudPublishBtn').length,
        counters:copyCounters(),
        before,
        after:status(),
        deniedMessageVisible:message.includes(deniedMessage),
        signInMessageVisible:message.includes(signInMessage),
      };
    }

    async function runAllowed(kind){
      await setRoleState(kind);
      cloudOpenModal();
      await sleep(100);
      cloudSetStatus('ready','fixture ready');
      cloudSetMessage('fixture before','info');
      resetCounters();
      const top=document.querySelector('#shareReportBtn');
      const modal=document.querySelector('#cloudPublishBtn');
      modal?.click();
      for(let attempt=0;attempt<40&&counters.insert<1;attempt++)await sleep(25);
      return{
        state:Authority.state,
        topDisabled:Boolean(top?.disabled),
        topAria:top?.getAttribute('aria-disabled'),
        modalDisabled:Boolean(modal?.disabled),
        modalAria:modal?.getAttribute('aria-disabled'),
        counters:copyCounters(),
        after:status(),
      };
    }

    const sessionPending=await runDenied('session-pending');
    const rolePending=await runDenied('role-pending');
    const viewer=await runDenied('viewer');
    const offlineCachedViewer=await runDenied('offline-cached-viewer');
    const errorReadonly=await runDenied('error-readonly');
    const owner=await runAllowed('owner');
    const editor=await runAllowed('editor');

    await setRoleState('signed-out-local');
    cloudSetStatus('ready','fixture local');
    resetCounters();
    const signedOutTop=document.querySelector('#shareReportBtn');
    await window.cloudPublishReport().catch(window.cloudHandleError);
    await sleep(80);
    const signedOut={
      state:Authority.state,
      topDisabled:Boolean(signedOutTop?.disabled),
      counters:copyCounters(),
      modalVisible:!document.querySelector('#cloudModal')?.classList.contains('hidden'),
      message:document.querySelector('#cloudMessage')?.textContent||'',
      messageClass:document.querySelector('#cloudMessage')?.className||'',
      status:status(),
    };

    await setRoleState('role-pending');
    cloudOpenModal();
    await sleep(100);
    const dynamicButton=document.querySelector('#cloudPublishBtn');
    const pendingDisabled=Boolean(dynamicButton?.disabled);
    await setRoleState('editor');
    const sameAfterEditor=dynamicButton===document.querySelector('#cloudPublishBtn');
    const editorEnabled=Boolean(dynamicButton&&!dynamicButton.disabled&&dynamicButton.getAttribute('aria-disabled')===null);
    await setRoleState('viewer');
    const sameAfterViewer=dynamicButton===document.querySelector('#cloudPublishBtn');
    const viewerDisabled=Boolean(dynamicButton?.disabled&&dynamicButton.getAttribute('aria-disabled')==='true');
    const dynamic={pendingDisabled,sameAfterEditor,editorEnabled,sameAfterViewer,viewerDisabled,modalCount:document.querySelectorAll('#cloudPublishBtn').length};

    window.cloudSyncAll=original.sync;try{cloudSyncAll=original.sync}catch(_){ }
    window.cloudBuildSnapshot=original.snapshot;try{cloudBuildSnapshot=original.snapshot}catch(_){ }
    window.cloudHandleError=original.handleError;try{cloudHandleError=original.handleError}catch(_){ }
    window.cloudLoadMembers=original.loadMembers;try{cloudLoadMembers=original.loadMembers}catch(_){ }
    cloudClient=original.client;
    window.BogatkaCloud=original.cloud;
    online=true;

    return{sessionPending,rolePending,viewer,offlineCachedViewer,errorReadonly,owner,editor,signedOut,dynamic,authorityDiagnostics:Authority.diagnostics};
  });

  await writeEvidence('09-report-publication-authority.json',evidence);

  for(const denied of [evidence.sessionPending,evidence.rolePending,evidence.viewer,evidence.offlineCachedViewer,evidence.errorReadonly]){
    expect(denied.topDisabled).toBe(true);
    expect(denied.topAria).toBe('true');
    expect(denied.modalDisabled).toBe(true);
    expect(denied.modalAria).toBe('true');
    expect(denied.sameModalNode).toBe(true);
    expect(denied.modalCount).toBe(1);
    expect(denied.counters).toEqual({sync:0,snapshot:0,insert:0,error:0,share:0});
    expect(denied.before.pillClass).not.toContain('error');
    expect(denied.after.pillClass).not.toContain('error');
    expect(denied.deniedMessageVisible).toBe(true);
    expect(denied.signInMessageVisible).toBe(false);
  }

  for(const allowed of [evidence.owner,evidence.editor]){
    expect(allowed.topDisabled).toBe(false);
    expect(allowed.topAria).toBeNull();
    expect(allowed.modalDisabled).toBe(false);
    expect(allowed.modalAria).toBeNull();
    expect(allowed.counters).toEqual({sync:1,snapshot:1,insert:1,error:0,share:1});
  }

  expect(evidence.signedOut.state).toBe('signed-out-local');
  expect(evidence.signedOut.topDisabled).toBe(false);
  expect(evidence.signedOut.counters).toEqual({sync:0,snapshot:0,insert:0,error:0,share:0});
  expect(evidence.signedOut.modalVisible).toBe(true);
  expect(evidence.signedOut.message).toContain('Сначала войдите');
  expect(evidence.signedOut.messageClass).not.toContain('error');
  expect(evidence.signedOut.status.pillClass).not.toContain('error');

  expect(evidence.dynamic).toEqual({
    pendingDisabled:true,
    sameAfterEditor:true,
    editorEnabled:true,
    sameAfterViewer:true,
    viewerDisabled:true,
    modalCount:1,
  });
});
