(function(){
  import('./version-authority-v426.js')
    .then(module=>module.installVersionAuthority())
    .catch(error=>{
      console.error('Не удалось запустить автоматическое версионирование.',error);
      const label=document.getElementById('versionLabel');
      if(label)label.textContent='4.3.0';
    });
})();
