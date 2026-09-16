(function(){
  const HUMAN_REPLY_MIN=900;
  const HUMAN_REPLY_MAX=1400;
  const EXPLANATION_STATE_KEY='explanationSeen';
  const explanationQueue=[];
  let explanationOpen=false;
  let pumpScheduled=false;

  function isSinglePlayer(){
    return localStorage.getItem('xe_game_mode')==='single';
  }

  function humanReplyDelay(){
    return HUMAN_REPLY_MIN+Math.floor(Math.random()*(HUMAN_REPLY_MAX-HUMAN_REPLY_MIN+1));
  }

  function ensureExplanationState(target=state){
    if(!target)return {fertileReproduction:false,hazardDeath:false};
    if(!target[EXPLANATION_STATE_KEY]||typeof target[EXPLANATION_STATE_KEY]!=='object'){
      target[EXPLANATION_STATE_KEY]={fertileReproduction:false,hazardDeath:false};
    }
    if(typeof target[EXPLANATION_STATE_KEY].fertileReproduction!=='boolean')target[EXPLANATION_STATE_KEY].fertileReproduction=false;
    if(typeof target[EXPLANATION_STATE_KEY].hazardDeath!=='boolean')target[EXPLANATION_STATE_KEY].hazardDeath=false;
    return target[EXPLANATION_STATE_KEY];
  }

  function htmlEscape(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
    }[ch]));
  }

  function resetExplanationUi(){
    explanationQueue.length=0;
    explanationOpen=false;
    pumpScheduled=false;
    window.xeModalBlocking=false;
    const modal=document.querySelector('#explanationModal');
    if(modal)modal.classList.remove('open');
  }

  function ensureExplanationModal(){
    let modal=document.querySelector('#explanationModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='explanationModal';
    modal.className='modal-backdrop';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML=`
      <div class="modal">
        <h2 id="explanationModalTitle">Acontecimento</h2>
        <div id="explanationModalBody"></div>
        <div class="modal-actions">
          <button class="btn primary" id="explanationModalContinue" type="button">Continuar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#explanationModalContinue').addEventListener('click',closeCurrentExplanation);
    return modal;
  }

  function schedulePump(){
    if(pumpScheduled||explanationOpen)return;
    pumpScheduled=true;
    setTimeout(()=>{
      pumpScheduled=false;
      showNextExplanation();
    },0);
  }

  function enqueueExplanation(item,priority=false){
    if(priority)explanationQueue.unshift(item);
    else explanationQueue.push(item);
    window.xeModalBlocking=true;
    schedulePump();
  }

  function showNextExplanation(){
    if(explanationOpen)return;
    const item=explanationQueue.shift();
    if(!item){
      window.xeModalBlocking=false;
      document.dispatchEvent(new CustomEvent('xe:explanations-complete'));
      return;
    }
    explanationOpen=true;
    window.xeModalBlocking=true;
    const modal=ensureExplanationModal();
    modal.querySelector('#explanationModalTitle').textContent=item.title;
    modal.querySelector('#explanationModalBody').innerHTML=item.body;
    modal.classList.add('open');
    modal.querySelector('#explanationModalContinue').focus();
  }

  function closeCurrentExplanation(){
    if(!explanationOpen)return;
    const modal=ensureExplanationModal();
    modal.classList.remove('open');
    explanationOpen=false;
    if(explanationQueue.length)schedulePump();
    else{
      window.xeModalBlocking=false;
      document.dispatchEvent(new CustomEvent('xe:explanations-complete'));
    }
  }

  function profileSummary(org){
    const p=org&&state?.lineages?.[org.owner]?.[org.lineage];
    if(!p)return '';
    const pieces=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
    const rank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    const specs=[...(p.traits||[])];
    if(p.resistance)specs.push('Resistência 🧬');
    if(p.sexual)specs.push('Reprodução Sexuada ❤️');
    return `<p><strong>Perfil perdido:</strong> ${pieces[rank]}${specs.length?` · ${htmlEscape(specs.join(', '))}`:''}.</p>`;
  }

  function fertileExplanation(text){
    return {
      title:'Reprodução em casa fértil',
      body:`
        <p><strong>O que aconteceu.</strong> Uma peça entrou numa casa fértil 🌿 e gerou um lote de descendentes. A casa fértil é consumida depois da reprodução.</p>
        <p><strong>Hereditariedade.</strong> Na reprodução comum, cada filho começa herdando o tipo de peça e as especializações do progenitor. Depois, cada recém-nascido faz sua própria rolagem de mutação, por isso irmãos podem terminar com perfis diferentes.</p>
        <p>Quando ❤️ Reprodução Sexuada participa, o descendente usa a peça de maior valor como base e recombina aproximadamente metade das especializações de cada progenitor. A mutação adicional de um filho sexuado nunca é downgrade.</p>
        <p><strong>Resultado desta reprodução:</strong> ${htmlEscape(text)}</p>`
    };
  }

  function hazardExplanation(text,victim){
    return {
      title:'Morte em casa perigosa',
      body:`
        <p><strong>O que aconteceu.</strong> Uma peça foi eliminada por uma casa perigosa ou por uma área ambiental mortal. Peças terrestres podem morrer ao entrar, atravessar ou permanecer numa zona que se torne perigosa; Voo 🐦 oferece imunidade às casas mortais.</p>
        <p><strong>Hereditariedade.</strong> A morte elimina este indivíduo e impede que ele gere novos descendentes, mas não apaga características que já tenham sido herdadas por outras peças vivas. Cada descendente mantém seu próprio perfil evolutivo.</p>
        ${profileSummary(victim)}
        <p><strong>Ocorrência:</strong> ${htmlEscape(text)}</p>`
    };
  }

  function mutationExplanation(text){
    const negative=/downgrade|perdeu|perda de/i.test(text);
    return {
      title:negative?'Mutação negativa — downgrade':'Mutação positiva',
      body:`
        <p><strong>${negative?'Downgrade':'Ganho evolutivo'}.</strong> ${htmlEscape(text)}</p>
        <p>Esta mutação foi calculada para este descendente individualmente. ${negative?'O novo perfil perdeu uma característica ou reduziu o valor da peça.':'O novo perfil ganhou uma característica ou aumentou o valor da peça.'}</p>
        <p><strong>Hereditariedade.</strong> A partir de agora, este novo perfil é a base hereditária desta peça. Se ela gerar descendentes, eles partem desse perfil antes de suas próprias mutações. Em Reprodução Sexuada ❤️, o perfil pode ser recombinado com o segundo progenitor.</p>`
    };
  }

  function isActualMutationLog(text){
    return /(?:^|:\s*❤️?\s*)(?:Mutação de peça:|Downgrade de peça:|Downgrade: perdeu |Nova especialidade:)/i.test(text);
  }

  function isFertileReproductionLog(text){
    return /gerou \d+ descendente\(s\) por .*casa fértil/i.test(text)||
      /❤️ reprodução sexuada entre .* gerou \d+ descendente\(s\)/i.test(text);
  }

  function isHazardDeathMessage(text){
    return /(casa mortal|área perigosa|zona perigosa|biohazard|habitat hostil|terreno perigoso|área perigosa do evento)/i.test(text);
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next[EXPLANATION_STATE_KEY]={fertileReproduction:false,hazardDeath:false};
    resetExplanationUi();
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    ensureExplanationState(state);
    resetExplanationUi();
    return result;
  };

  ensureExplanationState(state);
  window.xeModalBlocking=false;

  const previousLog=log;
  log=function(msg){
    const result=previousLog.apply(this,arguments);
    const text=String(msg||'');
    const seen=ensureExplanationState(state);

    if(isActualMutationLog(text)){
      enqueueExplanation(mutationExplanation(text));
    }

    if(!seen.fertileReproduction&&isFertileReproductionLog(text)){
      seen.fertileReproduction=true;
      enqueueExplanation(fertileExplanation(text),true);
    }
    return result;
  };

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const victim=state?.organisms?.find(o=>o.id===id);
    const result=previousRemoveOrganism.apply(this,arguments);
    const text=String(msg||'');
    const seen=ensureExplanationState(state);
    if(!seen.hazardDeath&&isHazardDeathMessage(text)){
      seen.hazardDeath=true;
      enqueueExplanation(hazardExplanation(text,victim),true);
    }
    return result;
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(){
    if(window.xeModalBlocking)return;
    return previousHandleCellClick.apply(this,arguments);
  };

  const previousExecuteMove=executeMove;
  executeMove=function(){
    if(window.xeModalBlocking)return;
    return previousExecuteMove.apply(this,arguments);
  };

  document.addEventListener('keydown',e=>{
    if(!window.xeModalBlocking)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if((e.key==='Enter'||e.key===' ')&&explanationOpen)closeCurrentExplanation();
  },true);

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const leavingHumanTurn=isSinglePlayer()&&state&&!state.gameOver&&state.current==='blue';
    if(!leavingHumanTurn)return previousFinishTurn.apply(this,arguments);

    const nativeSetTimeout=window.setTimeout;
    const replyDelay=humanReplyDelay();

    // Durante a transição Brancas → Pretas, alonga apenas o timer normal
    // que agenda o início da resposta da IA. Timers imediatos de resolução
    // ambiental/bloqueio e a animação interna da jogada das Pretas permanecem intactos.
    window.setTimeout=function(callback,delay,...args){
      const ms=Number(delay)||0;
      if(ms>=250&&ms<=400)return nativeSetTimeout(callback,replyDelay,...args);
      return nativeSetTimeout(callback,ms,...args);
    };

    try{
      return previousFinishTurn.apply(this,arguments);
    }finally{
      window.setTimeout=nativeSetTimeout;
    }
  };
})();
