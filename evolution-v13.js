(function(){
  let lastAnnouncedEvent='';
  let modal=null;

  function ensureEventModal(){
    if(modal)return modal;
    modal=document.createElement('div');
    modal.className='modal-backdrop';
    modal.id='ecoEventModal';
    modal.innerHTML=`
      <div class="modal eco-event-modal-card" role="dialog" aria-modal="true" aria-labelledby="ecoEventModalTitle">
        <div class="eco-event-modal-kicker">Evento ecológico</div>
        <h2 id="ecoEventModalTitle">Evento ecológico</h2>
        <p id="ecoEventModalDescription"></p>
        <p class="eco-event-modal-duration"><strong>Duração:</strong> 10 rodadas completas</p>
        <div class="modal-actions"><button class="btn primary" id="ecoEventModalClose">Continuar</button></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#ecoEventModalClose')?.addEventListener('click',closeEventModal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeEventModal()});
    return modal;
  }

  function closeEventModal(){
    ensureEventModal().classList.remove('open');
  }

  function showEventModal(name,description){
    if(!name||name===lastAnnouncedEvent)return;
    lastAnnouncedEvent=name;
    const el=ensureEventModal();
    el.querySelector('#ecoEventModalTitle').textContent=name;
    el.querySelector('#ecoEventModalDescription').textContent=description||'';
    el.classList.add('open');
    el.querySelector('#ecoEventModalClose')?.focus();
  }

  function inspectBanner(){
    const banner=document.querySelector('#ecoEventBanner');
    if(!banner||!banner.classList.contains('active')||!banner.classList.contains('announce'))return;
    const name=banner.querySelector('strong')?.textContent?.trim()||'';
    const description=banner.querySelector('span')?.textContent?.trim()||'';
    showEventModal(name,description);
  }

  function watchBanner(){
    const banner=document.querySelector('#ecoEventBanner');
    if(!banner)return;
    const observer=new MutationObserver(()=>queueMicrotask(inspectBanner));
    observer.observe(banner,{attributes:true,childList:true,subtree:true,characterData:true});
    inspectBanner();
  }

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&document.querySelector('#ecoEventModal.open'))closeEventModal();
  });

  ensureEventModal();
  watchBanner();
})();
