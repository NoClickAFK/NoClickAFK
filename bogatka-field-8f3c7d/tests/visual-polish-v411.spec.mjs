import { test, expect } from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=411';

async function authorize(page){
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
}

async function waitForVisualPolish(page){
  await page.waitForFunction(()=>window.BogatkaVisualPolish?.version==='4.1.1');
}

test('summary metrics are compact and comparison entry is emphasized without touching its table',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForVisualPolish(page);

  await expect(page.locator('.summary-grid-v332 .metric')).toHaveCount(10);
  await expect(page.locator('#locationComparisonPanel')).toBeVisible();

  const geometry=await page.evaluate(()=>{
    const metric=document.querySelector('.summary-grid-v332 .metric');
    const comparison=document.querySelector('#locationComparisonPanel');
    const summary=comparison?.querySelector(':scope > summary');
    const table=comparison?.querySelector('.comparison-table-v332');
    const metricStyle=getComputedStyle(metric);
    const comparisonStyle=getComputedStyle(comparison);
    const summaryStyle=getComputedStyle(summary);
    return {
      metricHeight:metric.getBoundingClientRect().height,
      metricMinHeight:parseFloat(metricStyle.minHeight),
      metricStrong:parseFloat(getComputedStyle(metric.querySelector('strong')).fontSize),
      comparisonBorder:parseFloat(comparisonStyle.borderTopWidth),
      comparisonRadius:parseFloat(comparisonStyle.borderTopLeftRadius),
      comparisonOverflow:comparisonStyle.overflow,
      comparisonSummaryHeight:summary.getBoundingClientRect().height,
      comparisonBackground:summaryStyle.backgroundColor,
      tableClass:table?.className||'',
    };
  });

  expect(geometry.metricMinHeight).toBeLessThanOrEqual(66);
  expect(geometry.metricHeight).toBeLessThanOrEqual(72);
  expect(geometry.metricStrong).toBeLessThanOrEqual(20);
  expect(geometry.comparisonBorder).toBeGreaterThanOrEqual(2);
  expect(geometry.comparisonRadius).toBeGreaterThanOrEqual(17);
  expect(['clip','hidden']).toContain(geometry.comparisonOverflow);
  expect(geometry.comparisonSummaryHeight).toBeGreaterThanOrEqual(78);
  expect(geometry.comparisonBackground).not.toBe('rgb(240, 247, 243)');
  expect(geometry.tableClass).toContain('comparison-table-v332');
});

test('invitation history opens smoothly and member controls share one height',async({page})=>{
  await authorize(page);
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await waitForVisualPolish(page);

  await page.evaluate(()=>{
    const projectId='00000000-0000-0000-0000-000000000001';
    const ownerId='00000000-0000-0000-0000-000000000010';
    const editorId='00000000-0000-0000-0000-000000000020';
    const members=[
      {user_id:ownerId,role:'owner',created_at:'2026-06-01T10:00:00Z'},
      {user_id:editorId,role:'editor',created_at:'2026-06-02T10:00:00Z'},
    ];
    const profiles=[
      {id:ownerId,email:'owner@example.com',display_name:'Дмитрий'},
      {id:editorId,email:'editor@example.com',display_name:'Антон'},
    ];
    const invites=[
      {id:'10000000-0000-0000-0000-000000000001',email:'editor@example.com',role:'editor',created_at:'2026-06-25T10:00:00Z',expires_at:'2099-06-28T10:00:00Z',accepted_at:'2026-06-25T11:00:00Z',accepted_by:editorId,revoked_at:null},
      {id:'10000000-0000-0000-0000-000000000002',email:'old@example.com',role:'editor',created_at:'2026-06-20T10:00:00Z',expires_at:'2026-06-21T10:00:00Z',accepted_at:null,accepted_by:null,revoked_at:'2026-06-20T12:00:00Z'},
    ];
    function query(table){
      const data=table==='project_members'?members:table==='profiles'?profiles:table==='project_invites'?invites:[];
      return {
        data,error:null,
        select(){return this;},eq(){return this;},in(){return this;},order(){return this;},
        limit(){return Promise.resolve({data:this.data,error:null});},
        single(){return Promise.resolve({data:{role:'owner'},error:null});},
        maybeSingle(){return Promise.resolve({data:null,error:null});},
      };
    }
    const channel={on(){return this;},subscribe(){return this;}};
    cloudSession={user:{id:ownerId,email:'owner@example.com',user_metadata:{display_name:'Дмитрий'}}};
    cloudProjectId=projectId;
    cloudRole='owner';
    cloudClient={from:query,channel:()=>channel,removeChannel:async()=>{},rpc:async()=>({data:true,error:null})};
    cloudOpenModal();
  });

  const accordion=page.locator('.collaboration-accordion-v411');
  const trigger=page.locator('#inviteHistoryToggleV411');
  const panel=page.locator('#inviteHistoryPanelV411');
  await expect(accordion).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded','false');
  await expect(panel).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#inviteHistoryCountV411')).toHaveText('2 ссылки');
  await expect(page.locator('.invite-row-v408')).toHaveCount(2);

  const closedRows=await panel.evaluate(element=>getComputedStyle(element).gridTemplateRows);
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-expanded','true');
  await expect(panel).toHaveAttribute('aria-hidden','false');
  await expect(accordion).toHaveClass(/open/);
  await page.waitForTimeout(380);
  const openRows=await panel.evaluate(element=>getComputedStyle(element).gridTemplateRows);
  expect(openRows).not.toBe(closedRows);
  expect(parseFloat(openRows)).toBeGreaterThan(0);

  const editorCard=page.locator('[data-member-card-v410="00000000-0000-0000-0000-000000000020"]');
  await expect(editorCard).toBeVisible();
  await expect(editorCard.locator('.premium-select-trigger')).toBeVisible();
  const heights=await editorCard.evaluate(card=>({
    role:card.querySelector('.premium-select-trigger').getBoundingClientRect().height,
    save:card.querySelector('[data-save-member-v410]').getBoundingClientRect().height,
    remove:card.querySelector('[data-remove-member-v410]').getBoundingClientRect().height,
  }));
  expect(Math.abs(heights.role-heights.save)).toBeLessThanOrEqual(1);
  expect(Math.abs(heights.role-heights.remove)).toBeLessThanOrEqual(1);
  expect(heights.role).toBeGreaterThanOrEqual(44);
  expect(heights.role).toBeLessThanOrEqual(45);
});
