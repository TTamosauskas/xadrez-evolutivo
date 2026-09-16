(function(){
  const HUMAN_REPLY_MIN=900;
  const HUMAN_REPLY_MAX=1400;
  const EXPLANATION_STATE_KEY='explanationSeen';
  const MUTATION_INFO={
    'Locomoção':{icon:'🐪',desc:'Permite uma segunda movimentação com a mesma peça no turno.'},
    'Voo':{icon:'🐦',desc:'Permite entrar, permanecer e atravessar casas perigosas com segurança.'},
    'Predação':{icon:'🦁',desc:'Ao capturar uma peça adversária, pode disparar reprodução mesmo fora de uma casa fértil.'},
    'Ovos':{icon:'🦎',desc:'Descendentes podem nascer a até 2 casas do progenitor.'},
    'Fertilidade':{icon:'🐇',desc:'Dobra a taxa de natalidade da peça.'},
    'Carapaça':{icon:'🐢',desc:'Só pode ser capturada por uma peça em casa adjacente.'},
    'Resistência':{icon:'🧬',desc:'Impede novas infecções pelo Patógeno Virulento.'},
    'Reprodução Sexuada':{icon:'❤️',desc:'Em casa fértil, permite combinar características com uma peça aliada adjacente.'}
  };
  const PIECE_INFO={
    'Peão':'Avança 1 casa para frente e captura 1 casa na diagonal para frente.',
    'Cavalo':'Move em L e pode saltar sobre outras peças.',
    'Bispo':'Move livremente pelas diagonais até encontrar um obstáculo.',
    'Torre':'Move livremente em linhas ortogonais até encontrar um obstáculo.',
    'Rei':'Move 1 casa em qualquer direção.',
    'Rainha':'Move livremente em linhas ortogonais ou diagonais até encontrar um obstáculo.'
  };
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

  function fertileExplanation(){
    return {
      title:'Reprodução',
      body:'<p>Quando atinge uma casa fértil (verde) a peça se reproduz.</p><p>Sua prole herdará suas características.</p>'
    };
  }

  function hazardExplanation(){
    return {
      title:'Morte',
      body:'<p>Quando atinge uma casa perigosa (vermelha) a peça é eliminada.</p>'
    };
  }

  function cleanMutationName(name){
    return String(name||'').trim().replace(/[.]+$/,'');
  }

  function mutationExplanation(text){
    const pieceUp=text.match(/Mutação de peça:\s*([^→.]+)\s*→\s*([^\.]+)/i);
    if(pieceUp){
      const from=cleanMutationName(pieceUp[1]),to=cleanMutationName(pieceUp[2]);
      const effect=PIECE_INFO[to]||`Agora usa o movimento de ${to}.`;
      return {
        title:`Mutação de peça: ${to}`,
        body:`<p>A peça passou de <strong>${htmlEscape(from)}</strong> para <strong>${htmlEscape(to)}</strong>.</p><p>${htmlEscape(effect)}</p>`
      };
    }

    const pieceDown=text.match(/Downgrade de peça:\s*([^→.]+)\s*→\s*([^\.]+)/i);
    if(pieceDown){
      const from=cleanMutationName(pieceDown[1]),to=cleanMutationName(pieceDown[2]);
      const effect=PIECE_INFO[to]||`Agora usa o movimento de ${to}.`;
      return {
        title:`Downgrade de peça: ${to}`,
        body:`<p>A peça passou de <strong>${htmlEscape(from)}</strong> para <strong>${htmlEscape(to)}</strong>.</p><p>${htmlEscape(effect)}</p>`
      };
    }

    const gain=text.match(/Nova especialidade:\s*([^\.]+)/i);
    if(gain){
      const name=cleanMutationName(gain[1]),info=MUTATION_INFO[name];
      if(info)return {title:`Mutação: ${name} ${info.icon}`,body:`<p>${info.desc}</p>`};
      return {title:`Mutação: ${name}`,body:`<p>A peça adquiriu a especialização ${htmlEscape(name)}.</p>`};
    }

    const loss=text.match(/Downgrade:\s*perdeu\s+([^\.]+)/i);
    if(loss){
      const name=cleanMutationName(loss[1]),info=MUTATION_INFO[name];
      if(info)return {
        title:`Downgrade: ${name} ${info.icon}`,
        body:`<p>A peça perdeu esta mutação.</p><p><strong>Efeito perdido:</strong> ${info.desc}</p>`
      };
      return {title:`Downgrade: ${name}`,body:`<p>A peça perdeu a especialização ${htmlEscape(name)}.</p>`};
    }

    return {title:'Mutação',body:`<p>${htmlEscape(text)}</p>`};
  }

  function isActualMutationLog(text){
    return /Mutação de peça:|Downgrade de peça:|Downgrade:\s*perdeu |Nova especialidade:/i.test(text);
  }

  function isFertileReproductionLog(text){
    return /gerou \d+ descendente\(s\) por .*casa fértil/i.test(text)||
      /❤️ reprodução sexuada entre .* gerou \d+ descendente\(s\)/i.test(text);
  }

  function isHazardDeathMessage(text){
    return /(casa mortal|área perigosa|zona perigosa|biohazard|habitat hostil|terreno perigoso|área perigosa do evento)/i.test(text);
  }

  function ownerFromMutationLog(text){
    for(const owner of ['blue','amber']){
      const name=owners?.[owner]?.name;
      if(name&&text.startsWith(`${name}:`))return owner;
    }
    return null;
  }

  function latestNewborn(owner){
    for(let i=(state?.organisms?.length||0)-1;i>=0;i--){
      const org=state.organisms[i];
      if(org.owner===owner&&org.newborn)return org;
    }
    return null;
  }

  function revertLatestMutation(owner){
    const child=latestNewborn(owner);if(!child)return false;
    const p=state?.lineages?.[owner]?.[child.lineage];if(!p)return false;
    p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack:[];
    p.mutations=Array.isArray(p.mutations)?p.mutations:[];
    const m=p.mutationStack[p.mutationStack.length-1];if(!m||m.inherited)return false;

    if(m.kind==='piece'||m.kind==='piece-downgrade'){
      if(Number.isInteger(m.from))p.pieceRank=m.from;
    }else if(m.kind==='trait'){
      p.traits=(p.traits||[]).filter(t=>t!==m.name);
    }else if(m.kind==='trait-loss'){
      p.traits=Array.isArray(p.traits)?p.traits:[];
      if(m.name&&!p.traits.includes(m.name))p.traits.push(m.name);
    }else if(m.kind==='resistance'){
      p.resistance=false;
    }else if(m.kind==='resistance-loss'){
      p.resistance=true;
    }else if(m.kind==='sexual'){
      p.sexual=false;
    }else if(m.kind==='sexual-loss'){
      p.sexual=true;
    }else return false;

    p.mutationStack.pop();
    if(p.mutations.length)p.mutations.pop();
    return true;
  }

  function suppressFirstReproductionMutation(text){
    if(!isActualMutationLog(text)||!state)return null;
    const owner=ownerFromMutationLog(text);if(!owner)return null;
    if((state.reproCount?.[owner]||0)!==0)return null;
    if(!revertLatestMutation(owner))return null;
    return `${owners[owner].name}: primeira reprodução — descendente herdou o perfil sem mutação.`;
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
    let text=String(msg||'');
    const replacement=suppressFirstReproductionMutation(text);
    if(replacement){
      text=replacement;
      msg=replacement;
    }

    const result=previousLog.call(this,msg);
    const seen=ensureExplanationState(state);

    if(!replacement&&isActualMutationLog(text)){
      enqueueExplanation(mutationExplanation(text));
    }

    if(!seen.fertileReproduction&&isFertileReproductionLog(text)){
      seen.fertileReproduction=true;
      enqueueExplanation(fertileExplanation(),true);
    }
    return result;
  };

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const result=previousRemoveOrganism.apply(this,arguments);
    const text=String(msg||'');
    const seen=ensureExplanationState(state);
    if(!seen.hazardDeath&&isHazardDeathMessage(text)){
      seen.hazardDeath=true;
      enqueueExplanation(hazardExplanation(),true);
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
