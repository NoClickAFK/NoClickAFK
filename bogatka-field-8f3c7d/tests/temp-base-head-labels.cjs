const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');

async function measure(page,url){
  await page.setViewportSize({width:1440,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaInspectionLayoutV461?.ready&&
    window.BogatkaLocationDataV452?.ready&&
    window.BogatkaTrafficCompetitorsV453?.ready&&
    window.BogatkaTechnicalEconomicsV450?.ready&&
    document.querySelector('[data-location-card]')
  ),{timeout:30000});
  await page.evaluate(async()=>{
    try{cloudRole=null}catch(_){ }
    window.cloudRole=null;
    await window.BogatkaTrafficCompetitorsV453.enhanceAll();
    await window.BogatkaTechnicalEconomicsV450.enhanceAll();
    const card=document.querySelector('[data-location-card]');
    window.BogatkaLocationCardCollapseV422?.setCollapsed?.(card,false,{persist:false});
    for(const details of card.querySelectorAll('details'))details.open=true;
  });
  const card=page.locator('[data-location-card]').first();
  if(await card.locator('.traffic-measurement-v453').count()===0)await card.locator('[data-stage7-action="add-traffic"]').click();
  await card.locator('.traffic-measurement-v453').first().waitFor({state:'visible'});
  await page.waitForFunction(()=>{
    const control=document.querySelector('[data-location-card] [data-field="tech.rentPerMonth"]');
    return Boolean(control?.closest('label.field')?.querySelector('.profile-caption-v416,.evaluation-caption-v446,.technical-caption-v450'));
  },{timeout:30000});
  return card.evaluate(node=>{
    const field=name=>[...node.querySelectorAll(`[data-field="${name}"]`)].find(item=>!item.hasAttribute('data-stage6-marker-v461'));
    const caption=control=>control?.closest('label.field,.stage7-field-v453')?.querySelector('.profile-caption-v416,.evaluation-caption-v446,.technical-caption-v450')||null;
    const traffic=node.querySelector('.traffic-measurement-v453');
    const controls={
      inspection:field('inspectionPurpose'),
      landlord:field('ownerName'),
      technical:field('tech.rentPerMonth'),
      traffic:traffic?.querySelector('[data-stage7-field="peopleCount"]'),
    };
    return Object.fromEntries(Object.entries(controls).map(([key,control])=>{
      const label=caption(control);
      if(!label)return[key,null];
      const style=getComputedStyle(label);
      return[key,{size:style.fontSize,weight:style.fontWeight,lineHeight:style.lineHeight,tag:label.tagName,className:label.className}];
    }));
  });
}

(async()=>{
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage();
    const base=await measure(page,'http://127.0.0.1:4174/bogatka-field-8f3c7d/?v=base-label-proof');
    const head=await measure(page,'http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=head-label-proof');
    console.log('BASE_LABELS='+JSON.stringify(base));
    console.log('HEAD_LABELS='+JSON.stringify(head));
    for(const [revision,snapshot] of Object.entries({base,head})){
      for(const [name,value] of Object.entries(snapshot)){
        assert.ok(value,`${revision}:${name}:missing canonical caption`);
        assert.deepEqual({size:value.size,weight:value.weight,lineHeight:value.lineHeight},{size:'11px',weight:'800',lineHeight:'14.85px'},`${revision}:${name}`);
      }
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
