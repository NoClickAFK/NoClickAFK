(function(){
  if(window.__bogatkaAddressFixV400)return;
  window.__bogatkaAddressFixV400=true;
  const S=window.BogatkaSuite;
  if(!S)return;

  const STOP_WORDS=new Set(['республика','беларусь','гродненская','область','г','город','гродно','улица','ул','проспект','пр','т','переулок','пер','шоссе','бульвар','бул','тц','жк']);

  function normalizeAddress(value){
    return String(value||'')
      .toLowerCase()
      .replace(/ё/g,'е')
      .replace(/[^a-zа-я0-9]+/giu,' ')
      .trim()
      .split(/\s+/u)
      .filter(token=>token&&!STOP_WORDS.has(token))
      .join(' ');
  }

  function addressSimilarity(left,right){
    const a=new Set(normalizeAddress(left).split(' ').filter(Boolean));
    const b=new Set(normalizeAddress(right).split(' ').filter(Boolean));
    if(!a.size||!b.size)return 0;
    const intersection=[...a].filter(token=>b.has(token)).length;
    return intersection/Math.max(a.size,b.size);
  }

  function findAddressDuplicate(address,excludeId=''){
    const normalized=normalizeAddress(address);
    if(!normalized)return null;
    let near=null;
    for(const item of locations){
      if(item.id===excludeId)continue;
      const candidate=normalizeAddress(item.address);
      if(!candidate)continue;
      if(candidate===normalized)return {item,exact:true,similarity:1};
      const similarity=addressSimilarity(address,item.address);
      if(similarity>=0.8&&(!near||similarity>near.similarity))near={item,exact:false,similarity};
    }
    return near;
  }

  async function saveLocationFromModalFixed(){
    const editId=document.querySelector('#editLocationId')?.value||'';
    const title=document.querySelector('#locationTitle')?.value.trim()||'';
    const address=document.querySelector('#locationAddress')?.value.trim()||'';
    const note=document.querySelector('#locationNote')?.value.trim()||'';
    if(!address)return alert('Укажите адрес для карты.');

    const duplicate=findAddressDuplicate(address,editId);
    if(duplicate?.exact){
      alert(`Этот адрес уже есть в списке: «${duplicate.item.title||duplicate.item.address}».`);
      closeLocationModal();
      document.querySelector(`[data-location-card="${CSS.escape(duplicate.item.id)}"]`)?.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    if(duplicate&&!confirm(`Возможный дубль: «${duplicate.item.title||duplicate.item.address}». Всё равно сохранить новую локацию?`))return;

    let targetId=editId;
    if(editId){
      const index=locations.findIndex(item=>item.id===editId);
      if(index>=0){
        const before=locations[index];
        locations[index]={...before,title:title||address,address,note};
        const data=await getLocationData(editId);
        S.appendActivityToData(data,{action:'Изменены реквизиты локации',label:'Адрес и название',from:`${before.title||''} · ${before.address||''}`,to:`${title||address} · ${address}`});
        data.updatedAt=new Date().toISOString();
        await idbPut(STORE,data,`location:${editId}`);
      }
    }else{
      targetId=`custom-${crypto.randomUUID()}`;
      locations.push({id:targetId,title:title||address,address,note,custom:true,createdAt:new Date().toISOString()});
      const data={createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      S.appendActivityToData(data,{action:'Создана локация',label:'Новая локация',to:title||address,details:address});
      await idbPut(STORE,data,`location:${targetId}`);
    }
    await saveLocations();
    closeLocationModal();
    renderLocations();
    document.querySelector(`[data-location-card="${CSS.escape(targetId)}"]`)?.scrollIntoView({behavior:'smooth'});
  }

  S.normalizeAddress=normalizeAddress;
  S.addressSimilarity=addressSimilarity;
  S.findAddressDuplicate=findAddressDuplicate;
  window.saveLocationFromModal=saveLocationFromModalFixed;
  try{saveLocationFromModal=saveLocationFromModalFixed}catch(_){}
  window.BogatkaAddressFix={normalizeAddress,addressSimilarity,findAddressDuplicate};
})();
