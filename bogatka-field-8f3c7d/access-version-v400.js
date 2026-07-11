(function(){
  import('./version-authority-v426.js')
    .then(module=>module.installVersionAuthority())
    .catch(error=>{
      console.error('Не удалось запустить автоматическое версирование.',error);
      const label=document.getElementById('versionLabel');
      if(label)label.textContent='4.3.5';
    });

  function installComparisonOpenCompatibility(){
    const panel=document.getElementById('locationComparisonPanel');
    if(!panel||Object.prototype.hasOwnProperty.call(panel,'open'))return;
    Object.defineProperty(panel,'open',{
      configurable:true,
      get(){return this.hasAttribute('open')},
      set(value){
        const open=Boolean(value);
        this.toggleAttribute('open',open);
        this.dataset.open=String(open);
        this.setAttribute('aria-expanded',String(open));
      },
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installComparisonOpenCompatibility,{once:true});
  else installComparisonOpenCompatibility();
  setTimeout(installComparisonOpenCompatibility,500);
})();
