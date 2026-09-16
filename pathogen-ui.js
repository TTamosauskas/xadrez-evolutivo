(function(){
  const PATHOGEN_ROUNDS=10;
  const MODE_NAMES={
    diagonal:'Contágio diagonal',
    orthogonal:'Contágio ortogonal',
    omnidirectional:'Contato omnidirecional'
  };
  const modalQueue=[];
  let modalOpen=false;
  let pumpTimer=null;

  function ensureSeen(){
    if(!state)return [];
    if(!Array.isArray(state.pathogenUiSeen))state.pathogenUiSeen=[];
    return state.pathogenUiSeen;
  }
  function remember(key){
    const seen=ensureSeen();
    if(seen.includes(key))return false;
    seen.push(key);return true;
  }
  function modeName(id){return MODE_NAMES[id]||'Contato omnidirecional'}

  function ensureModal(){
    let modal=document.querySelector('#pathogenInfoModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='pathogenInfoModal';
    modal.className='modal-backdrop';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML='<div class="modal"><h2>Patógeno Virulento 🤢</h2><div id="pathogenInfoBody"></div><div class="modal-actions"><button class="btn primary" id="pathogenInfoContinue" type="button">Continuar</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('#pathogenInfoContinue').addEventListener('click',closeModal);
    return modal;
  }
  function otherModalOpen(){
    return [...document.querySelectorAll('.modal-backdrop.open')].some(el=>el.id!=='pathogenInfoModal');
  }
  function schedulePump(){
    if(pumpTimer!==null||modalOpen||!modalQueue.length)return;
    pumpTimer=setTimeout(()=>{pumpTimer=null;pumpModal()},40);
  }
  function enqueueModal(item){modalQueue.push(item);schedulePump()}
  function pumpModal(){
    if(modalOpen||!modalQueue.length)return;
    if(otherModalOpen()){schedulePump();return}
    const item=modalQueue.shift();
    const modal=ensureModal();
    modal.querySelector('#pathogenInfoBody').innerHTML=`<p>Uma peça foi infectada pelo Patógeno Virulento.</p><p><strong>Transmissão:</strong> ${item.mode}.</p><p>O surto dura ${PATHOGEN_ROUNDS} rodadas e se espalha a cada rodada apenas pelo padrão sorteado. Resistência 🧬 impede a infecção.</p><p>Ao fim da 10ª rodada, as peças que ainda estiverem infectadas são eliminadas.</p>${item.source?`<p><strong>Origem:</strong> ${item.source}.</p>`:''}`;
    modal.classList.add('open');
    modalOpen=true;
    window.xeModalBlocking=true;
    modal.querySelector('#pathogenInfoContinue').focus();
  }
  function closeModal(){
    const modal=ensureModal();
    modal.classList.remove('open');modalOpen=false;
    if(modalQueue.length){schedulePump();return}
    if(!otherModalOpen())window.xeModalBlocking=false;
    if(typeof isSinglePlayer==='function'&&isSinglePlayer()&&state&&!state.gameOver&&state.current==='amber'&&typeof scheduleSystemTurn==='function')scheduleSystemTurn(300);
  }

  function inspectOutbreaks(){
    if(!state||state.gameOver)return;
    const ev=state.ecoCycle?.active;
    if(ev?.id==='pathogen'&&ev.managedPathogen){
      const key=`eco:${ev.startRound??'active'}:${ev.pathogenMode||'omnidirectional'}`;
      if(remember(key))enqueueModal({mode:modeName(ev.pathogenMode),source:'evento ecológico'});
    }
    const outbreaks=state.overpopulationPathogen||{};
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(!outbreak?.active||!outbreak.outbreakId)continue;
      const key=`over:${outbreak.outbreakId}`;
      if(remember(key))enqueueModal({mode:modeName(outbreak.mode),source:`superpopulação de ${owners?.[owner]?.name||owner}`});
    }
  }

  function renderLegend(){
    const box=document.querySelector('#boardMutationLegend');
    if(!box)return;
    box.querySelector('[data-pathogen-row]')?.remove();
    const infected=(state?.organisms||[]).some(o=>o.ecoSick||o.overpopSick);
    if(!infected)return;
    box.querySelector('.board-mutation-empty')?.remove();
    box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-pathogen-row><span class="board-circle-icon">🤢</span><div><strong>Patógeno Virulento</strong><small>Peça infectada. O surto dura 10 rodadas e se espalha conforme o padrão sorteado; Resistência 🧬 impede a infecção.</small></div></div>');
  }

  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    renderLegend();inspectOutbreaks();
    return result;
  };

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next.pathogenUiSeen=[];
    modalQueue.length=0;modalOpen=false;
    document.querySelector('#pathogenInfoModal')?.classList.remove('open');
    return next;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    renderLegend();inspectOutbreaks();
    return result;
  };

  renderLegend();inspectOutbreaks();
})();
