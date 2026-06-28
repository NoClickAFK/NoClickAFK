(function(){
  const label=document.getElementById('versionLabel');
  if(label&&window.BOGATKA_BUILD)label.textContent=window.BOGATKA_BUILD.version;
})();
