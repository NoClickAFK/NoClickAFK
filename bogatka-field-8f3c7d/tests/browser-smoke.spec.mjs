import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=410';
const RESET_URL = 'http://127.0.0.1:4173/bogatka-field-8f3c7d/reset/';

async function authorize(page) {
  await page.addInitScript(() => localStorage.setItem('bogatka_access_authorized_v1', '1'));
}

async function waitForV410(page) {
  await page.waitForFunction(() => window.BogatkaInviteManager?.version === '4.1.0');
  await page.waitForFunction(() => window.BogatkaCollaboration?.version === '4.1.0');
}

test('Bogatka resolved version loads and passes acceptance checks', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await authorize(page);
  await page.goto(APP_URL, { waitUntil: 'networkidle' });
  await waitForV410(page);

  await expect(page.locator('#app')).toBeVisible();
  await page.waitForFunction(() => /^4\.2\.\d+$/.test(window.BOGATKA_BUILD?.version || ''));
  const resolvedVersion = await page.evaluate(() => window.BOGATKA_BUILD.version);
  await expect(page.locator('#versionLabel')).toHaveText(resolvedVersion);
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
      collaboration: window.BogatkaCollaboration?.version,
      normalized: window.BogatkaAddressFix?.normalizeAddress('Гродно, ул. Лидская, 34'),
      duplicate: window.BogatkaAddressFix?.findAddressDuplicate('г. Гродно, улица Лидская, 34')?.exact,
      backupTaskIds: merged?.tasks?.map(item => item.id).sort(),
      backupComments: merged?.comments?.length,
      weakPasswordError: window.bogatkaValidateNewPassword?.('weak123'),
      strongPasswordError: window.bogatkaValidateNewPassword?.('StrongPassword2026'),
    };
  });

  expect(resolvedVersion).toMatch(/^4\.2\.\d+$/);
  expect(state.selfTest?.version).toBe('4.0.0');
  expect(state.selfTest?.ok).toBe(true);
  expect(state.selfTest?.checks?.length).toBeGreaterThan(10);
  expect(state.archiveSync).toBe(true);
  expect(state.inviteManager).toBe('4.1.0');
  expect(state.collaboration).toBe('4.1.0');
  expect(state.normalized).toBe('лидская 34');
  expect(state.duplicate).toBe(true);
  expect(state.backupTaskIds).toEqual(['local-task','remote-task']);
  expect(state.backupComments).toBe(0);
  expect(state.weakPasswordError).toContain('12');
  expect(state.strongPasswordError).toBe('');
  expect(pageErrors).toEqual([]);
});

test('owner panel renders clear history, role controls, removal, and active account email', async ({ page }) => {
  await authorize(page);
  await page.goto(APP_URL, { waitUntil:'networkidle' });
  await waitForV410(page);
  page.on('dialog', dialog => dialog.accept());

  await page.evaluate(() => {
    const projectId='00000000-0000-0000-0000-000000000001';
    const ownerId='00000000-0000-0000-0000-000000000010';
    const editorId='00000000-0000-0000-0000-000000000020';
    let memberRows=[
      {user_id:ownerId,role:'owner',created_at:'2026-06-01T10:00:00Z'},
      {user_id:editorId,role:'editor',created_at:'2026-06-02T10:00:00Z'},
    ];
    const profiles=[
      {id:ownerId,email:'owner@example.com',display_name:'Дмитрий'},
      {id:editorId,email:'editor@example.com',display_name:'Антон'},
    ];
    const inviteRows=[
      {id:'10000000-0000-0000-0000-000000000001',email:'new@example.com',role:'viewer',created_at:'2026-06-26T10:00:00Z',expires_at:'2099-06-29T10:00:00Z',accepted_at:null,accepted_by:null,revoked_at:null},
      {id:'10000000-0000-0000-0000-000000000002',email:'editor@example.com',role:'editor',created_at:'2026-06-25T10:00:00Z',expires_at:'2099-06-28T10:00:00Z',accepted_at:'2026-06-25T11:00:00Z',accepted_by:editorId,revoked_at:null},
      {id:'10000000-0000-0000-0000-000000000003',email:'old@example.com',role:'editor',created_at:'2026-06-20T10:00:00Z',expires_at:'2026-06-21T10:00:00Z',accepted_at:null,accepted_by:null,revoked_at:'2026-06-20T12:00:00Z'},
    ];
    const calls=[];

    function query(table){
      const builder={
        table,
        data:table==='project_members'?memberRows:table==='profiles'?profiles:table==='project_invites'?inviteRows:[],
        error:null,
        select(){return this;},
        eq(){return this;},
        in(){return this;},
        order(){return this;},
        limit(){return Promise.resolve({data:this.data,error:null});},
        single(){return Promise.resolve({data:{role:'owner'},error:null});},
        maybeSingle(){return Promise.resolve({data:null,error:null});},
      };
      return builder;
    }
    const channel={on(){return this;},subscribe(){return this;}};

    cloudSession={user:{id:ownerId,email:'owner@example.com',user_metadata:{display_name:'Дмитрий'}}};
    cloudProjectId=projectId;
    cloudRole='owner';
    cloudClient={
      from:query,
      channel:()=>channel,
      removeChannel:async()=>{},
      rpc:async(name,args)=>{
        calls.push({name,args});
        if(name==='update_project_member_role'){
          memberRows=memberRows.map(item=>item.user_id===args.p_user_id?{...item,role:args.p_role}:item);
          return {data:true,error:null};
        }
        if(name==='remove_project_member'){
          memberRows=memberRows.filter(item=>item.user_id!==args.p_user_id);
          return {data:true,error:null};
        }
        if(name==='revoke_project_invite')return {data:true,error:null};
        return {data:null,error:null};
      },
    };
    window.__collaborationCalls=calls;
    cloudSetStatus('ready');
    cloudOpenModal();
  });

  await expect(page.locator('#bogatkaInviteForm')).toBeVisible();
  await expect(page.locator('.application-link-copy-v409 b')).toHaveText('Ссылка на вход и регистрацию');
  await expect(page.locator('.application-link-copy-v409 small')).toContainText('сама по себе не выдаёт доступ к проекту');
  await expect(page.locator('.application-link-copy-v409 small')).toContainText('регистрация и приглашение владельца');
  await expect(page.locator('#cloudAccountPillV410')).toContainText('owner@example.com');
  await expect(page.locator('#cloudAccountPillV410')).toContainText('Владелец');

  await expect(page.locator('.invite-row-v408')).toHaveCount(3);
  await expect(page.locator('.invite-status-badge-v410.status-active')).toHaveText('Ожидает принятия');
  await expect(page.locator('.invite-status-badge-v410.status-accepted')).toHaveText('Принято');
  await expect(page.locator('.invite-status-badge-v410.status-revoked')).toHaveText('Ссылка отозвана');
  await expect(page.locator('.invite-revoke-v410')).toHaveCount(1);

  await expect(page.locator('.cloud-member-premium')).toHaveCount(2);
  const editorCard=page.locator('[data-member-card-v410="00000000-0000-0000-0000-000000000020"]');
  await expect(editorCard).toContainText('Антон');
  await editorCard.locator('[data-member-role-v410]').selectOption('viewer');
  await expect(editorCard.locator('[data-save-member-v410]')).toBeEnabled();
  await editorCard.locator('[data-save-member-v410]').click();
  await expect(page.locator('[data-member-card-v410="00000000-0000-0000-0000-000000000020"] [data-member-role-v410]')).toHaveValue('viewer');

  await page.locator('[data-member-card-v410="00000000-0000-0000-0000-000000000020"] [data-remove-member-v410]').click();
  await expect(page.locator('.cloud-member-premium')).toHaveCount(1);
  await expect(page.locator('.invite-status-badge-v410.status-removed')).toHaveText('Доступ отключён');

  const calls=await page.evaluate(()=>window.__collaborationCalls);
  expect(calls.some(item=>item.name==='update_project_member_role'&&item.args.p_role==='viewer')).toBe(true);
  expect(calls.some(item=>item.name==='remove_project_member')).toBe(true);
});

test('personal invite opens the registration form immediately', async ({ page }) => {
  const token='a'.repeat(64);
  const email='worker@example.com';
  await page.goto(`http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=410&invite=${token}&email=${encodeURIComponent(email)}`, { waitUntil:'networkidle' });
  await page.waitForFunction(() => typeof window.bogatkaPendingInvite === 'function');

  await expect(page.locator('#cloudModal')).not.toHaveClass(/hidden/, { timeout:10_000 });
  await expect(page.locator('[data-cloud-tab="signup"]')).toHaveClass(/active/);
  await expect(page.locator('#cloudDisplayName')).toBeVisible();
  await expect(page.locator('#cloudEmail')).toHaveValue(email);
  await expect(page.locator('#cloudEmail')).toHaveAttribute('readonly','');
  await expect(page.locator('#cloudMessage')).toContainText('Создайте аккаунт');

  const state=await page.evaluate(() => ({
    invite:window.bogatkaPendingInvite(),
    redirect:window.bogatkaInviteRedirectUrl(),
    authorized:localStorage.getItem('bogatka_access_authorized_v1'),
  }));
  expect(state.invite).toEqual({token,email});
  expect(state.redirect).toContain('v=410');
  expect(state.redirect).toContain(`invite=${token}`);
  expect(state.redirect).toContain('email=worker%40example.com');
  expect(state.authorized).toBe('1');
});

test('concurrent project initialization accepts a raw invite token only once', async ({ page }) => {
  const token='b'.repeat(64);
  const email='worker@example.com';
  await page.goto(`http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=410&invite=${token}&email=${encodeURIComponent(email)}`, { waitUntil:'networkidle' });
  await page.waitForFunction(() => typeof window.bogatkaPendingInvite === 'function');

  const state=await page.evaluate(async ({token,email})=>{
    const calls=[];
    cloudSession={user:{id:'00000000-0000-0000-0000-000000000002',email}};
    cloudProjectId=null;
    cloudRole=null;
    cloudClient={
      rpc:async(name,args)=>{
        calls.push({name,args:args||null});
        if(name==='accept_bogatka_project_invite'){
          await new Promise(resolve=>setTimeout(resolve,30));
          return {data:'00000000-0000-0000-0000-000000000001',error:null};
        }
        if(name==='claim_bogatka_project')return {data:'00000000-0000-0000-0000-000000000001',error:null};
        return {data:null,error:{message:`Unexpected RPC ${name}`}};
      },
      from:()=>({
        select(){return this;},
        eq(){return this;},
        async single(){return {data:{role:'editor'},error:null};},
      }),
    };
    const projectIds=await Promise.all([cloudEnsureProject(),cloudEnsureProject(),cloudEnsureProject()]);
    return {
      projectIds,
      role:cloudRole,
      calls,
      pending:window.bogatkaPendingInvite(),
      url:location.href,
    };
  },{token,email});

  expect(state.projectIds).toEqual([
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
  ]);
  expect(state.role).toBe('editor');
  expect(state.calls.filter(item=>item.name==='accept_bogatka_project_invite')).toHaveLength(1);
  expect(state.calls.find(item=>item.name==='accept_bogatka_project_invite')?.args).toEqual({p_token:token});
  expect(state.pending).toBeNull();
  expect(state.url).toContain('v=410');
  expect(state.url).not.toContain('invite=');
  expect(state.url).not.toContain('email=');
});

test('invitation result and action buttons have deliberate spacing', async ({ page }) => {
  await authorize(page);
  await page.goto(APP_URL, { waitUntil:'networkidle' });
  await waitForV410(page);
  await page.evaluate(() => {
    const result=document.createElement('div');
    result.className='invite-result-v408';
    result.innerHTML='<strong>Ссылка</strong><input class="invite-link-input-v410"><div class="invite-actions-v408"><button class="btn">Копировать</button><button class="btn secondary">Поделиться</button></div><p class="invite-result-note-v410">Примечание</p>';
    document.body.append(result);
  });
  const spacing=await page.locator('.invite-result-v408').evaluate(element=>({
    gap:parseFloat(getComputedStyle(element).rowGap),
    actionGap:parseFloat(getComputedStyle(element.querySelector('.invite-actions-v408')).columnGap),
    notePadding:parseFloat(getComputedStyle(element.querySelector('.invite-result-note-v410')).paddingTop),
  }));
  expect(spacing.gap).toBeGreaterThanOrEqual(12);
  expect(spacing.actionGap).toBeGreaterThanOrEqual(8);
  expect(spacing.notePadding).toBeGreaterThanOrEqual(10);
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

test('password recovery uses current security policy and dynamic return URL', async ({ page }) => {
  await page.goto(RESET_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#newPassword')).toHaveAttribute('minlength', '12');
  await expect(page.locator('#repeatPassword')).toHaveAttribute('minlength', '12');
  const href=await page.locator('#returnToApp').getAttribute('href');
  expect(href).toMatch(/^\.\.\/(?:\?v=\d+)?$/);
  expect(href).not.toContain('v=400');
});
