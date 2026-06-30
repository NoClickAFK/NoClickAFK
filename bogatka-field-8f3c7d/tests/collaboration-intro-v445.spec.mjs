import {test,expect} from '@playwright/test';

const APP_URL='http://127.0.0.1:4173/bogatka-field-8f3c7d/?v=445';

async function openPane(page,pane){
  await page.evaluate(targetPane=>{
    const card=document.querySelector('[data-location-card]');
    const collaboration=card?.querySelector('.collaboration-v400');
    if(collaboration)collaboration.open=true;
    const button=card?.querySelector(`[data-collab-tab="${targetPane}"]`);
    if(button&&!button.classList.contains('active'))button.click();
  },pane);
}

async function readIntro(page,pane,selector){
  await openPane(page,pane);
  return page.locator('[data-location-card]').first().locator(`[data-collab-pane="${pane}"]`).evaluate((root,introSelector)=>{
    const intro=root.querySelector(introSelector);
    const title=intro?.querySelector(':scope > strong');
    const description=intro?.querySelector(':scope > span');
    const next=intro?.nextElementSibling;
    if(!intro||!title||!description||!next)throw new Error('Collaboration intro structure is incomplete');
    const properties=[
      'display','gridTemplateColumns','gridAutoFlow','alignContent','alignItems','justifyContent','justifyItems','rowGap','columnGap',
      'width','minWidth','maxWidth','marginTop','marginRight','marginBottom','marginLeft','paddingTop','paddingRight','paddingBottom','paddingLeft',
      'borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','borderRadius','backgroundColor','boxShadow','color',
      'fontFamily','fontSize','fontStyle','fontVariant','fontWeight','fontStretch','fontKerning','fontFeatureSettings','letterSpacing',
      'lineHeight','textAlign','textDecorationLine','textIndent','textTransform','whiteSpace','wordSpacing',
    ];
    const readStyle=element=>{
      const style=getComputedStyle(element);
      return Object.fromEntries(properties.map(property=>[property,style[property]]));
    };
    const introRect=intro.getBoundingClientRect();
    const paneRect=root.getBoundingClientRect();
    const nextRect=next.getBoundingClientRect();
    return {
      marker:intro.dataset.collaborationIntroV445,
      titleMarker:title.dataset.collaborationIntroTitleV445,
      descriptionMarker:description.dataset.collaborationIntroDescriptionV445,
      childTags:[...intro.children].map(element=>element.tagName),
      container:readStyle(intro),
      title:readStyle(title),
      description:readStyle(description),
      geometry:{
        top:introRect.top-paneRect.top,
        left:introRect.left-paneRect.left,
        width:introRect.width,
        nextGap:nextRect.top-introRect.bottom,
      },
    };
  },selector);
}

test('task and comments introductions use one identical typography and spacing system',async({page})=>{
  await page.setViewportSize({width:1600,height:1000});
  await page.addInitScript(()=>localStorage.setItem('bogatka_access_authorized_v1','1'));
  await page.goto(APP_URL,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>Boolean(
    window.BogatkaWorkflowRefineV440?.ready&&
    document.querySelector('.task-form-help-v414.collaboration-intro-v445')&&
    document.querySelector('.structured-notes-head-v414.collaboration-intro-v445')
  ));

  const task=await readIntro(page,'tasks','.task-form-help-v414');
  const comments=await readIntro(page,'comments','.structured-notes-head-v414');

  expect(task.marker).toBe('1');
  expect(comments.marker).toBe('1');
  expect(task.titleMarker).toBe('1');
  expect(comments.titleMarker).toBe('1');
  expect(task.descriptionMarker).toBe('1');
  expect(comments.descriptionMarker).toBe('1');
  expect(task.childTags).toEqual(['STRONG','SPAN']);
  expect(comments.childTags).toEqual(task.childTags);

  expect(comments.container).toEqual(task.container);
  expect(comments.title).toEqual(task.title);
  expect(comments.description).toEqual(task.description);
  expect(comments.title.fontFamily).toContain('Segoe UI');
  expect(comments.title.fontSize).toBe('15px');
  expect(comments.title.fontWeight).toBe('700');
  expect(parseFloat(comments.title.lineHeight)).toBeCloseTo(19.5,1);
  expect(comments.description.fontSize).toBe('11px');
  expect(comments.description.fontWeight).toBe('400');
  expect(parseFloat(comments.description.lineHeight)).toBeCloseTo(17.05,1);

  expect(Math.abs(task.geometry.top-comments.geometry.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(task.geometry.left-comments.geometry.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(task.geometry.width-comments.geometry.width)).toBeLessThanOrEqual(1);
  expect(task.geometry.nextGap).toBe(comments.geometry.nextGap);
  expect(task.geometry.nextGap).toBe(13);
});
