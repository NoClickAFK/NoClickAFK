(function(){
  'use strict';
  if(window.BogatkaReleaseIntegrityV456?.ready)return;

  const VERSION='4.5.6';
  const requiredApis=['BogatkaTrafficCompetitorsV453','BogatkaLaunchGateV454','BogatkaOpeningProjectV455','BogatkaSyncMerge','BogatkaCriticalDeal','BogatkaSuite'];

  function duplicateIds(items){
    if(!Array.isArray(items))return[];
    const seen=new Set(),duplicates=new Set();
    for(const item of items){
      const id=item?.id;
      if(!id)continue;
      if(seen.has(id))duplicates.add(id);else seen.add(id);
    }
    return[...duplicates];
  }

  function auditLocation(data={},locationId=''){
    const failures=[];
    const warnings=[];
    if(data.trafficMeasurements!==undefined&&!Array.isArray(data.trafficMeasurements))failures.push('trafficMeasurements:not-array');
    if(data.competitors!==undefined&&!Array.isArray(data.competitors))failures.push('competitors:not-array');
    for(const [key,value] of [['trafficMeasurements',data.trafficMeasurements],['competitors',data.competitors]]){
      const duplicates=duplicateIds(value);
      if(duplicates.length)failures.push(`${key}:duplicate-ids:${duplicates.join(',')}`);
    }
    const project=data.launchProject;
    if(project?.enabled){
      if(!Array.isArray(project.milestones))failures.push('launchProject.milestones:not-array');
      const duplicates=duplicateIds(project.milestones);
      if(duplicates.length)failures.push(`launchProject.milestones:duplicate-ids:${duplicates.join(',')}`);
      const unknownStatus=(project.milestones||[]).filter(item=>!['todo','doing','waiting','done'].includes(item.status||'todo'));
      if(unknownStatus.length)warnings.push(`launchProject.milestones:unknown-status:${unknownStatus.length}`);
    }
    if(data.traffic&&typeof data.traffic!=='object')warnings.push('legacy-traffic:unexpected-type');
    if(data.competitor&&typeof data.competitor!=='object')warnings.push('legacy-competitor:unexpected-type');
    return{locationId,ok:failures.length===0,failures,warnings};
  }

  async function auditAll(){
    const failures=[];
    const warnings=[];
    for(const name of requiredApis)if(!window[name]?.ready&&name!=='BogatkaSyncMerge'&&name!=='BogatkaCriticalDeal'&&name!=='BogatkaSuite')failures.push(`api:${name}:not-ready`);
    for(const name of ['BogatkaSyncMerge','BogatkaCriticalDeal','BogatkaSuite'])if(!window[name])failures.push(`api:${name}:missing`);
    let items=[];
    try{if(typeof locations!=='undefined'&&Array.isArray(locations))items=locations;}catch(_){ }
    if(!items.length&&Array.isArray(window.locations))items=window.locations;
    const locationsAudit=[];
    for(const item of items){
      const result=auditLocation(await getLocationData(item.id),item.id);
      locationsAudit.push(result);
      failures.push(...result.failures.map(value=>`${item.id}:${value}`));
      warnings.push(...result.warnings.map(value=>`${item.id}:${value}`));
    }
    return{version:VERSION,ok:failures.length===0,failures,warnings,locations:locationsAudit,checkedAt:new Date().toISOString()};
  }

  function integrationSnapshot(){
    return{
      version:VERSION,
      trafficVersion:window.BogatkaTrafficCompetitorsV453?.version||null,
      gateVersion:window.BogatkaLaunchGateV454?.version||null,
      openingVersion:window.BogatkaOpeningProjectV455?.version||null,
      criticalDealVersion:window.BogatkaCriticalDeal?.VERSION||null,
      syncMergeVersion:window.BogatkaSyncMerge?.version||null,
      viewer:typeof cloudRole!=='undefined'?cloudRole:null,
    };
  }

  window.BogatkaReleaseIntegrityV456={version:VERSION,ready:true,requiredApis,duplicateIds,auditLocation,auditAll,integrationSnapshot};
})();
