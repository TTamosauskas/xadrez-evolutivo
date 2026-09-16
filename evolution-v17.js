(function(){
  const HUMAN_REPLY_MIN=900;
  const HUMAN_REPLY_MAX=1400;
  const EXPLANATION_STATE_KEY='explanationSeen';
  const FIRST_REPRO_KEY='firstReproductionProtected';
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const PIECE_INFO={
    'Peão':'Avança 1 casa para frente e captura 1 casa na diagonal para frente.',
    'Cavalo':'Move em L e pode saltar sobre outras peças.',
    'Bispo':'Move livremente pelas diagonais até encontrar um obstáculo.',
    'Torre':'Move livremente em linhas ortogonais até encontrar um obstáculo.',
    'Rei':'Move 1 casa em qualquer direção.',
    'Rainha':'Move livremente em linhas ortogonais ou diagonais até encontrar um obstáculo.'
  };
  const MUTATION_INFO={
    'Locomoção':{icon:'🐪',desc:'Permite uma segunda movimentação com a mesma peça no turno.'},
    'Voo':{icon:'🐦',desc:'Permite entrar, permanecer e atravessar casas perigosas com segurança.'},
    'Predação':{icon:'🦁',desc:'Ao capturar uma peça adversária, pode disparar reprodução mesmo fora de uma casa fértil.'},
    'Ovos':{icon:'🦎',desc:'Descendentes podem nascer a até 2 casas do progenitor.'},
    'Fertilidade':{icon:'🐇',desc:'Dobra a taxa de natalidade da peça.'},
    'Carapaça':{icon:'🐢',desc:'Só pode ser capturada por uma peça em casa adjacente.'},
    'Resistência':{icon:'🧬',desc:'Impede novas infecções pelo Patógeno Virulento.'},
    'Reprodução Sexuada':{icon:'❤️',desc:'Em casa fértil, permite combinar características com uma peça aliada adjacente.'},
    'Esterilidade':{icon:'🚫',desc:'Impede esta peça de se reproduzir. Ao entrar numa casa fértil, a casa ainda é consumida.'}
  };

  const explanationQueue=[];
  let explanationOpen=false;
  let pumpScheduled=false;
  let observedOrgIds=new Set(state?.organisms?.map(o=>o.id)||[]);
  let observedRepro={blue:state?.reproCount?.blue||0,amber:state?.reproCount?.amber||0};
  const pendingFertile={blue:false,amber:false};

  function isSinglePlayer(){return localStorage.getItem('xe_game_mode')==='single'}
  function humanReplyDelay(){return HUMAN_REPLY_MIN+Math.floor(Math.random()*(HUMAN_REPLY_MAX-HUMAN_REPLY_MIN+1))}
  function htmlEscape(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]))}

  function ensureExplanationState(target=state){
    if(!target)return {fertileReproduction:false,hazardDeath:false};
    if(!target[EXPLANATION_STATE_KEY]||typeof target[EXPLANATION_STATE_KEY]!=='object')target[EXPLANATION_STATE_KEY]={fertileReproduction:false,hazardDeath:false};
    if(typeof target[EXPLANATION_STATE_KEY].fertileReproduction!=='boolean')target[EXPLANATION_STATE_KEY].fertileReproduction=false;
    if(typeof target[EXPLANATION_STATE_KEY].hazardDeath!=='boolean')target[EXPLANATION_STATE_KEY].hazardDeath=false;
    return target[EXPLANATION_STATE_KEY];
  }
  function ensureFirstReproState(target=state,existing=false){
    if(!target)return {blue:true,amber:true};
    if(!target[FIRST_REPRO_KEY]||typeof target[FIRST_REPRO_KEY]!=='object'){
      target[FIRST_REPRO_KEY]={
        blue:existing?(target.reproCount?.blue||0)>0:false,
        amber:existing?(target.reproCount?.amber||0)>0:false
      };
    }
    for(const owner of ['blue','amber'])if(typeof target[FIRST_REPRO_KEY][owner]!=='boolean')target[FIRST_REPRO_KEY][owner]=existing?(target.reproCount?.[owner]||0)>0:false;
    return target[FIRST_REPRO_KEY];
  }
  function resetObservation(target=state){
    observedOrgIds=new Set(target?.organisms?.map(o=>o.id)||[]);
    observedRepro={blue:target?.reproCount?.blue||0,amber:target?.reproCount?.amber||0};
    pendingFertile.blue=false;pendingFertile.amber=false;
  }
  function resetExplanationUi(){
    explanationQueue.length=0;explanationOpen=false;pumpScheduled=false;window.xeModalBlocking=false;
    document.querySelector('#explanationModal')?.classList.remove('open');
  }

  function ensureExplanationModal(){
    let modal=document.querySelector('#explanationModal');if(modal)return modal;
    modal=document.createElement('div');modal.id='explanationModal';modal.className='modal-backdrop';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    modal.innerHTML='<div class="modal"><h2 id="explanationModalTitle">Acontecimento</h2><div id="explanationModalBody"></div><div class="modal-actions"><button class="btn primary" id="explanationModalContinue" type="button">Continuar</button></div></div>';
    document.body.appendChild(modal);modal.querySelector('#explanationModalContinue').addEventListener('click',closeCurrentExplanation);return modal;
  }
  function schedulePump(){
    if(pumpScheduled||explanationOpen)return;pumpScheduled=true;
    setTimeout(()=>{pumpScheduled=false;showNextExplanation()},0);
  }
  function enqueueExplanation(item,priority=false){
    if(priority)explanationQueue.unshift(item);else explanationQueue.push(item);
    window.xeModalBlocking=true;schedulePump();
  }
  function showNextExplanation(){
    if(explanationOpen)return;const item=explanationQueue.shift();
    if(!item){window.xeModalBlocking=false;document.dispatchEvent(new CustomEvent('xe:explanations-complete'));return}
    explanationOpen=true;window.xeModalBlocking=true;
    const modal=ensureExplanationModal();modal.querySelector('#explanationModalTitle').textContent=item.title;modal.querySelector('#explanationModalBody').innerHTML=item.body;modal.classList.add('open');modal.querySelector('#explanationModalContinue').focus();
  }
  function closeCurrentExplanation(){
    if(!explanationOpen)return;ensureExplanationModal().classList.remove('open');explanationOpen=false;
    if(explanationQueue.length)schedulePump();else{window.xeModalBlocking=false;document.dispatchEvent(new CustomEvent('xe:explanations-complete'))}
  }

  function fertileExplanation(){return {title:'Reprodução',body:'<p>Quando atinge uma casa fértil (verde) a peça se reproduz.</p><p>Sua prole herdará suas características.</p>'}}
  function hazardExplanation(){return {title:'Morte',body:'<p>Quando atinge uma casa perigosa (vermelha) a peça é eliminada.</p>'}}
  function cleanMutationName(name){return String(name||'').trim().replace(/[.]+$/,'')}
  function mutationExplanation(text){
    const pieceChange=text.match(/(?:Mutação|Downgrade) de peça:\s*([^→.]+)\s*→\s*([^\.]+)/i);
    if(pieceChange){
      const from=cleanMutationName(pieceChange[1]),to=cleanMutationName(pieceChange[2]),effect=PIECE_INFO[to]||`Agora usa o movimento de ${to}.`;
      return {title:`Mutação de peça: ${to}`,body:`<p>A peça passou de <strong>${htmlEscape(from)}</strong> para <strong>${htmlEscape(to)}</strong>.</p><p>${htmlEscape(effect)}</p>`};
    }
    const sterility=text.match(/(?:Mutação|Downgrade):\s*Esterilidade/i);
    if(sterility){
      const info=MUTATION_INFO.Esterilidade;
      return {title:`Mutação: Esterilidade ${info.icon}`,body:`<p>${info.desc}</p>`};
    }
    const gain=text.match(/Nova especialidade:\s*([^\.]+)/i);
    if(gain){const name=cleanMutationName(gain[1]),info=MUTATION_INFO[name];return info?{title:`Mutação: ${name} ${info.icon}`,body:`<p>${info.desc}</p>`}:{title:`Mutação: ${name}`,body:`<p>A peça adquiriu a especialização ${htmlEscape(name)}.</p>`}}
    const loss=text.match(/(?:Mutação|Downgrade):\s*perdeu\s+([^\.]+)/i);
    if(loss){const name=cleanMutationName(loss[1]),info=MUTATION_INFO[name];return info?{title:`Mutação: ${name} ${info.icon}`,body:`<p>A peça perdeu esta característica.</p><p><strong>Efeito perdido:</strong> ${info.desc}</p>`}:{title:`Mutação: ${name}`,body:`<p>A peça perdeu a especialização ${htmlEscape(name)}.</p>`}}
    return {title:'Mutação',body:`<p>${htmlEscape(text)}</p>`};
  }

  function mutationText(entry){
    if(!entry)return null;
    if(entry.kind==='piece'||entry.kind==='piece-downgrade')return `Mutação de peça: ${PIECES[entry.from]||'Peão'} → ${PIECES[entry.to]||'Peão'}`;
    if(entry.kind==='trait')return `Nova especialidade: ${entry.name}`;
    if(entry.kind==='trait-loss')return `Mutação: perdeu ${entry.name}`;
    if(entry.kind==='resistance')return 'Nova especialidade: Resistência';
    if(entry.kind==='resistance-loss')return 'Mutação: perdeu Resistência';
    if(entry.kind==='sexual')return 'Nova especialidade: Reprodução Sexuada';
    if(entry.kind==='sexual-loss')return 'Mutação: perdeu Reprodução Sexuada';
    if(entry.kind==='sterility')return 'Mutação: Esterilidade';
    return null;
  }
  function reverseMutation(p,m){
    if(!p||!m)return;
    if(m.kind==='piece'||m.kind==='piece-downgrade'){if(Number.isInteger(m.from))p.pieceRank=m.from}
    else if(m.kind==='trait')p.traits=(p.traits||[]).filter(t=>t!==m.name);
    else if(m.kind==='trait-loss'){p.traits=Array.isArray(p.traits)?p.traits:[];if(m.name&&!p.traits.includes(m.name))p.traits.push(m.name)}
    else if(m.kind==='resistance')p.resistance=false;
    else if(m.kind==='resistance-loss')p.resistance=true;
    else if(m.kind==='sexual')p.sexual=false;
    else if(m.kind==='sexual-loss')p.sexual=true;
    else if(m.kind==='sterility')p.sterile=false;
    if(Array.isArray(p.mutations)&&p.mutations.length)p.mutations.pop();
  }
  function mutationEntriesForChild(child){
    const p=state?.lineages?.[child.owner]?.[child.lineage];if(!p)return [];
    const stack=Array.isArray(p.mutationStack)?p.mutationStack:[];
    if(p.mate)return stack.filter(x=>!x.inherited);
    const parent=state?.lineages?.[child.owner]?.[p.parent];
    const inheritedLength=Array.isArray(parent?.mutationStack)?parent.mutationStack.length:0;
    return stack.slice(inheritedLength);
  }
  function sanitizeFirstBatch(children){
    for(const child of children){
      const p=state?.lineages?.[child.owner]?.[child.lineage];if(!p)continue;
      const stack=Array.isArray(p.mutationStack)?p.mutationStack:[];
      if(p.mate){
        while(stack.length&&!stack[stack.length-1].inherited){const m=stack.pop();reverseMutation(p,m)}
      }else{
        const parent=state?.lineages?.[child.owner]?.[p.parent];
        const inheritedLength=Array.isArray(parent?.mutationStack)?parent.mutationStack.length:0;
        while(stack.length>inheritedLength){const m=stack.pop();reverseMutation(p,m)}
      }
    }
  }
  function removeFirstBatchMutationLogs(owner){
    if(!Array.isArray(state?.logs))return;const ownerName=owners?.[owner]?.name||'';
    state.logs=state.logs.filter(x=>{
      const msg=String(x?.msg||'');
      return !(msg.startsWith(`${ownerName}:`)&&/(?:Mutação|Downgrade) de peça:|(?:Mutação|Downgrade):\s*perdeu |(?:Mutação|Downgrade):\s*Esterilidade|Nova especialidade:/i.test(msg));
    });
  }

  function inspectNewOffspring(){
    if(!state)return;
    const newChildren=(state.organisms||[]).filter(o=>!observedOrgIds.has(o.id));
    const firstState=ensureFirstReproState(state);
    const seen=ensureExplanationState(state);

    for(const owner of ['blue','amber']){
      const previous=observedRepro[owner]||0,current=state.reproCount?.[owner]||0;
      const children=newChildren.filter(o=>o.owner===owner);
      if(current>previous&&previous===0&&!firstState[owner]){
        sanitizeFirstBatch(children);
        removeFirstBatchMutationLogs(owner);
        firstState[owner]=true;
        if(pendingFertile[owner]&&!seen.fertileReproduction){seen.fertileReproduction=true;enqueueExplanation(fertileExplanation(),true)}
        pendingFertile[owner]=false;
        continue;
      }
      for(const child of children){
        for(const entry of mutationEntriesForChild(child)){
          const text=mutationText(entry);if(text)enqueueExplanation(mutationExplanation(text));
        }
      }
      if(current>previous&&pendingFertile[owner]){
        if(!seen.fertileReproduction){seen.fertileReproduction=true;enqueueExplanation(fertileExplanation(),true)}
        pendingFertile[owner]=false;
      }
    }
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next[EXPLANATION_STATE_KEY]={fertileReproduction:false,hazardDeath:false};
    next[FIRST_REPRO_KEY]={blue:false,amber:false};
    resetExplanationUi();resetObservation(next);return next;
  };
  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    ensureExplanationState(state);ensureFirstReproState(state,true);resetExplanationUi();resetObservation(state);return result;
  };

  ensureExplanationState(state);ensureFirstReproState(state,true);window.xeModalBlocking=false;

  const previousRender=render;
  render=function(){
    inspectNewOffspring();
    const result=previousRender.apply(this,arguments);
    resetObservation(state);
    return result;
  };

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const result=previousRemoveOrganism.apply(this,arguments),text=String(msg||''),seen=ensureExplanationState(state);
    if(!seen.hazardDeath&&/(casa mortal|área perigosa|zona perigosa|biohazard|habitat hostil|terreno perigoso|área perigosa do evento)/i.test(text)){
      seen.hazardDeath=true;enqueueExplanation(hazardExplanation(),true);
    }
    return result;
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(){if(window.xeModalBlocking)return;return previousHandleCellClick.apply(this,arguments)};

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    if(window.xeModalBlocking)return;
    const owner=org?.owner;
    const before=owner?(state?.reproCount?.[owner]||0):0;
    const fertile=!!(owner&&t&&inBounds(t.r,t.c)&&cell(t.r,t.c).terrain==='fertile'&&cell(t.r,t.c).resource>0);
    if(fertile)pendingFertile[owner]=true;
    const result=previousExecuteMove.apply(this,arguments);
    if(fertile&&owner&&(state?.reproCount?.[owner]||0)===before){
      const live=state?.organisms?.find(o=>o.id===org.id);
      const stillWaiting=live&&live.r===t.r&&live.c===t.c&&cell(t.r,t.c).terrain==='fertile'&&cell(t.r,t.c).resource>0;
      if(!stillWaiting)pendingFertile[owner]=false;
    }
    return result;
  };

  document.addEventListener('keydown',e=>{
    if(!window.xeModalBlocking)return;e.preventDefault();e.stopImmediatePropagation();
    if((e.key==='Enter'||e.key===' ')&&explanationOpen)closeCurrentExplanation();
  },true);

  const previousRenderActions=renderActions;
  renderActions=function(){
    previousRenderActions();
    const rules=document.querySelectorAll('#rulesModal p');
    if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> A primeira reprodução de cada lado não sofre mutações: toda a prole apenas herda ou recombina o perfil dos progenitores. A partir da segunda reprodução daquele lado, cada recém-nascido faz sua própria rolagem de mutação. Em condições normais a chance é 1/3; durante Tempestade Solar, 100%. Peões nunca recebem mutações negativas. A partir de Cavalo, uma mutação pode adicionar ou remover características, reduzir o tipo de peça ou causar Esterilidade 🚫. Para o jogador, todas essas alterações são apresentadas simplesmente como mutações. Descendentes de Reprodução Sexuada ❤️ recebem apenas mutações positivas adicionais.';
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const leavingHumanTurn=isSinglePlayer()&&state&&!state.gameOver&&state.current==='blue';
    if(!leavingHumanTurn)return previousFinishTurn.apply(this,arguments);
    const nativeSetTimeout=window.setTimeout,replyDelay=humanReplyDelay();
    window.setTimeout=function(callback,delay,...args){const ms=Number(delay)||0;if(ms>=250&&ms<=400)return nativeSetTimeout(callback,replyDelay,...args);return nativeSetTimeout(callback,ms,...args)};
    try{return previousFinishTurn.apply(this,arguments)}finally{window.setTimeout=nativeSetTimeout}
  };
})();