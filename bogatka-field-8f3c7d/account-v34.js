(function ensureBogatkaAccountButton(){
  const toolbar=document.querySelector('.toolbar');
  if(!toolbar)return;
  let button=document.querySelector('#accountBtn');
  if(!button){
    button=document.createElement('button');
    button.type='button';
    button.id='accountBtn';
    button.className='btn account';
    button.textContent='Личный кабинет';
    const clearButton=document.querySelector('#clearAllBtn');
    if(clearButton)clearButton.insertAdjacentElement('afterend',button);
    else toolbar.appendChild(button);
  }
  if(button.dataset.bound==='1')return;
  button.dataset.bound='1';
  button.addEventListener('click',()=>{
    if(typeof cloudOpenModal==='function')cloudOpenModal();
    else document.querySelector('#cloudModal')?.classList.remove('hidden');
  });
})();
