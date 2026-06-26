import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=409';
const RESET_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/reset/';

async function authorize(page) {
  await page.addInitScript(() => localStorage.setItem('bogatka_access_authorized_v1', '1'));
}

test('Bogatka 4.0.0 loads and passes acceptance checks', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await authorize(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });

  await expect(page.locator('#app')).toBeVisible();
  await expect(page.locator('#versionLabel')).toHaveText('4.0.0');
  await expect(page.locator('#shareAccessBtn')).toHaveText('Пригласить участника', { timeout: 10_000 });
  await expect(page.locator('[data-location-card]')).toHaveCount(7);
  await expect(page.locator('#diagnosticsPillV400')).toHaveText('Самопроверка: OK', { timeout: 20_000 });

  const state = await page.evaluate(async () => {
    const selfTest = await window.BogatkaSelftest?.run();
    const merged = window.BogatkaBackupImport?.mergeRecord(
      { tasks:[{id:'local-task',title:'Local',updatedAt:'2026-01-01T00:00:00Z'}], comments:[{id:'removed-comment',text:'Old'}], deletedCommentIds:[] },
      { tasks:[{id:'remote-task',title:'Remote',updatedAt:'2026-01-02T00:00:00Z'}], comments:[], deletedCommentIds:['removed-comment'] }
    );
    return {
      selfTest,
      archiveSync: Boolean(window.BogatkaCloudArchive?.enabled),
      inviteManager: window.BogatkaInviteManager?.version,
      normalized: window.BogatkaAddressFix?.normalizeAddress('Гродно, ул. Лидская, 34'),
      duplicate: window.BogatkaAddressFix?.findAddressDuplicate('г. Гродно, улица Лидская, 34')?.exact,
      backupTaskIds: merged?.tasks?.map(item => item.id).sort(),
      backupComments: merged?.comments?.length,
      weakPasswordError: window.bogatkaValidateNewPassword?.('weak123'),
      strongPasswordError: window.bogatkaValidateNewPassword?.('StrongPassword2026'),
    };
  });

  expect(state.selfTest?.version).toBe('4.0.0');
  expect(state.selfTest?.ok).toBe(true);
  expect(state.selfTest?.checks?.length).toBeGreaterThan(10);
  expect(state.archiveSync).toBe(true);
  expect(state.inviteManager).toBe('4.0.9');
  expect(state.normalized).toBe('лидская 34');
  expect(state.duplicate).toBe(true);
  expect(state.backupTaskIds).toEqual(['local-task','remote-task']);
  expect(state.backupComments).toBe(0);
  expect(state.weakPasswordError).toContain('12');
  expect(state.strongPasswordError).toBe('');
  expect(pageErrors).toEqual([]);
});

test('owner invitation panel explains link lifetime and separates the application link', async ({ page }) => {
  await authorize(page);
  await page.goto(APP_URL, { waitUntil:'networkidle' });
  await page.evaluate(() => {
    cloudSession={user:{id:'00000000-0000-0000-0000-000000000001',email:'owner@example.com',user_metadata:{display_name:'Owner'}}};
    cloudProjectId='00000000-0000-0000-0000-000000000001';
    cloudRole='owner';
    const chain=()=>({
      data:[],
      error:null,
      select(){return this;},
      eq(){return this;},
      in(){return this;},
      order(){return this;},
      limit(){return Promise.resolve({data:[],error:null});},
      single(){return Promise.resolve({data:{role:'owner'},error:null});},
    });
    cloudClient={from:()=>chain(),rpc:async()=>({data:null,error:null})};
    cloudOpenModal();
  });

  await expect(page.locator('#bogatkaInviteForm')).toBeVisible();
  await expect(page.locator('#bogatkaInviteForm')).toContainText('Срок действия ссылки');
  await expect(page.locator('.invite-lifetime-help-v409')).toContainText('После регистрации доступ к проекту сохраняется');
  await expect(page.locator('#bogatkaInviteLifetime option')).toHaveCount(3);
  await expect(page.locator('#bogatkaInviteLifetime')).not.toContainText('30 дней');
  await expect(page.locator('.application-link-copy-v409 b')).toHaveText('Постоянная ссылка на приложение');
  await expect(page.locator('.application-link-copy-v409 small')).toContainText('не выдаёт доступ к проекту');
  await expect(page.locator('#bogatkaCopyAppLink')).toHaveText('Копировать');
  const layout=await page.locator('.application-link-v408').evaluate(element=>({
    display:getComputedStyle(element).display,
    marginTop:getComputedStyle(element).marginTop,
    buttonWidth:getComputedStyle(element.querySelector('#bogatkaCopyAppLink')).minWidth,
  }));
  expect(layout.display).toBe('grid');
  expect(parseFloat(layout.marginTop)).toBeGreaterThanOrEqual(20);
  expect(parseFloat(layout.buttonWidth)).toBeGreaterThanOrEqual(130);
});

test('personal invitation preserves token and email for confirmation', async ({ page }) => {
  const token='a'.repeat(64);
  const email='worker@example.com';
  await page.goto(`http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=409&invite=${token}&email=${encodeURIComponent(email)}`, { waitUntil:'networkidle' });
  await page.waitForFunction(() => typeof window.bogatkaPendingInvite === 'function');
  const state=await page.evaluate(() => ({
    invite:window.bogatkaPendingInvite(),
    redirect:window.bogatkaInviteRedirectUrl(),
    authorized:localStorage.getItem('bogatka_access_authorized_v1'),
  }));
  expect(state.invite).toEqual({token,email});
  expect(state.redirect).toContain('v=409');
  expect(state.redirect).toContain(`invite=${token}`);
  expect(state.redirect).toContain('email=worker%40example.com');
  expect(state.authorized).toBe('1');
});

test('personal invitation is accepted through the raw token RPC', async ({ page }) => {
  const token='b'.repeat(64);
  const email='worker@example.com';
  await page.goto(`http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=409&invite=${token}&email=${encodeURIComponent(email)}`, { waitUntil:'networkidle' });
  await page.waitForFunction(() => typeof window.bogatkaPendingInvite === 'function');
  const state=await page.evaluate(async ({token,email})=>{
    const calls=[];
    cloudSession={user:{id:'00000000-0000-0000-0000-000000000002',email}};
    cloudProjectId=null;
    cloudRole=null;
    cloudClient={
      rpc:async(name,args)=>{
        calls.push({name,args:args||null});
        if(name==='accept_bogatka_project_invite')return {data:'00000000-0000-0000-0000-000000000001',error:null};
        if(name==='claim_bogatka_project')return {data:'00000000-0000-0000-0000-000000000001',error:null};
        return {data:null,error:{message:`Unexpected RPC ${name}`}};
      },
      from:()=>({
        select(){return this;},
        eq(){return this;},
        async single(){return {data:{role:'editor'},error:null};},
      }),
    };
    const projectId=await cloudEnsureProject();
    return {
      projectId,
      role:cloudRole,
      calls,
      pending:window.bogatkaPendingInvite(),
      url:location.href,
    };
  },{token,email});
  expect(state.projectId).toBe('00000000-0000-0000-0000-000000000001');
  expect(state.role).toBe('editor');
  expect(state.calls[0]).toEqual({name:'accept_bogatka_project_invite',args:{p_token:token}});
  expect(state.calls[1]?.name).toBe('claim_bogatka_project');
  expect(state.pending).toBeNull();
  expect(state.url).not.toContain('invite=');
  expect(state.url).not.toContain('email=');
});

test('mobile layout does not create page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await authorize(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await expect(page.locator('#app')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('password recovery uses current security policy and return URL', async ({ page }) => {
  await page.goto(RESET_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#newPassword')).toHaveAttribute('minlength', '12');
  await expect(page.locator('#repeatPassword')).toHaveAttribute('minlength', '12');
  await expect(page.locator('#returnToApp')).toHaveAttribute('href', '../?v=400');
});
