(function(){
  function accessLinkV400(){
    const token=localStorage.getItem(TOKEN_KEY);
    const baseUrl=`${location.origin}${location.pathname}?v=400`;
    return {url:token?`${baseUrl}#access=${encodeURIComponent(token)}`:baseUrl,hasFullKey:Boolean(token)};
  }
  window.getAccessLinkData=accessLinkV400;
  try{getAccessLinkData=accessLinkV400}catch(_){}
  const label=document.getElementById('versionLabel');
  if(label)label.textContent='4.0.0';
})();
