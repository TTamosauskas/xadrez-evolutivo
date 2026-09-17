(function(){
  const DYSFUNCTIONAL='Mutação Disfuncional';
  const NEGATIVE_KINDS=new Set(['piece-down','trait-loss','resistance-loss','sexual-loss','sterility','deleterious']);
  let activeDysfunctionalActionOrgId=null;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function profileHasDysfunction(p){
    if(!p)return false;
    let active=Array.isArray(p.traits)&&p.traits.includes(DYSFUNCTIONAL);
    for(const entry of Array.isArray(p.mutationStack)?p.mutationStack:[]){
      if(entry?.name!==DYSFUNCTIONAL)continue;
      if(entry.kind==='trait')active=true;
      else if(entry.kind==='trait-loss')active=false;
    }
    return active;
  }
  function hasDysfunction(org){return profileHasDysfunction(profileOf(org))}
  function roundNow(){return Math.floor(Math.max(0,Number(state?.turn)||0)/2)+1}
  function isBlocked(org){
    if(!hasDysfunction(org)||!Number.isInteger(org?.dysfunctionalLastMoveRound))return false;
    return roundNow()<=org.dysfunctionalLastMoveRound+1;
  }
  function negativeMutationPool(a){
    return Array.isArray(a)&&a.length>0&&a.every(x=>x&&typeof x.kind==='string'&&NEGATIVE_KINDS.has(x.kind));
  }
  function newestNewborn(){
    const orgs=state?.organisms||[];
    for(let i=orgs.length-1;i>=0;i--)if(orgs[i]?.newborn)return orgs[i];
    return null;
  }

  const previousChoice=choice;
  choice=function(a){
    if(negativeMutationPool(a)){
      const options=[...a],child=newestNewborn();
      if(child&&!hasDysfunction(child))options.push({kind:'trait-gain',name:DYSFUNCTIONAL,dysfunctionalNegative:true});
      return previousChoice(options);
    }
    return previousChoice(a);
  };

  const previousMovementTargets=movementTargets;
  function otherUsablePiece(org){
    return playerOrganisms(org.owner).some(other=>{
      if(other.id===org.id||isBlocked(other))return false;
      const targets=previousMovementTargets(other)||[];
      return targets.length>0;
    });
  }
  movementTargets=function(org){
    const targets=previousMovementTargets.apply(this,arguments)||[];
    if(!org||!isBlocked(org))return targets;
    if(activeDysfunctionalActionOrgId===org.id)return [];
    if(otherUsablePiece(org))return [];
    return [{r:org.r,c:org.c,kind:'dysfunctional-rest',capture:false,path:[],dysfunctionalRest:true,hidden:true}];
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    try{return previousFinishTurn.apply(this,arguments)}finally{activeDysfunctionalActionOrgId=null}
  };

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    if(t?.dysfunctionalRest){
      log(`${owners[org.owner].name}: 🦵 a peça com Mutação Disfuncional permaneceu em repouso nesta rodada.`);
      state.selected=null;state.moveChain=null;state.mode='move';
      finishTurn();
      return;
    }
    if(org&&isBlocked(org)){
      if(typeof flashHint==='function')flashHint('🦵 Esta peça precisa descansar nesta rodada antes de voltar a se mover.');
      return;
    }
    if(org&&hasDysfunction(org)){
      org.dysfunctionalLastMoveRound=roundNow();
      activeDysfunctionalActionOrgId=org.id;
      try{return previousExecuteMove.apply(this,arguments)}finally{
        if(state&&!state.gameOver)render();
      }
    }
    return previousExecuteMove.apply(this,arguments);
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(r,c){
    const sel=typeof currentSelected==='function'?currentSelected():null;
    const occ=typeof organismAt==='function'?organismAt(r,c):null;
    if(sel&&occ?.id===sel.id&&isBlocked(sel)){
      const rest=movementTargets(sel).find(t=>t.dysfunctionalRest);
      if(rest)return executeMove(sel,rest);
      if(typeof flashHint==='function')flashHint('🦵 Esta peça está em repouso nesta rodada. Escolha outra peça.');
      return;
    }
    return previousHandleCellClick.apply(this,arguments);
  };

  function ensureIcon(org){
    if(!hasDysfunction(org)){
      delete org.dysfunctionalLastMoveRound;
      return;
    }
    const cellEl=boardEl?.children?.[org.r*SIZE+org.c],orgEl=cellEl?.querySelector?.('.org');
    if(!cellEl||!orgEl)return;
    let icons=orgEl.querySelector('.mutation-icons');
    if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}
    let icon=icons.querySelector('[data-dysfunctional-icon]');
    if(!icon){
      icon=document.createElement('span');icon.className='mutation-icon dysfunctional-mutation-icon';
      icon.dataset.dysfunctionalIcon='1';icon.textContent='🦵';icons.appendChild(icon);
    }
    if(isBlocked(org)){
      icon.title='Mutação Disfuncional — em repouso nesta rodada';
      orgEl.style.opacity='.42';orgEl.style.filter='grayscale(1)';
      const badge=document.createElement('span');
      badge.textContent='🦵';badge.title='Em repouso por Mutação Disfuncional';
      badge.dataset.dysfunctionalRestBadge='1';
      badge.style.position='absolute';badge.style.right='3px';badge.style.top='2px';badge.style.zIndex='8';badge.style.fontSize='1.2rem';badge.style.lineHeight='1';badge.style.pointerEvents='none';badge.style.filter='none';badge.style.opacity='1';
      cellEl.appendChild(badge);
    }else icon.title='Mutação Disfuncional — depois de se mover, deve descansar durante a rodada seguinte';
  }
  function renderIcons(){for(const org of state?.organisms||[])ensureIcon(org)}

  function renderLegend(){
    const box=document.querySelector('#boardMutationLegend');if(!box)return;
    box.querySelector('[data-dysfunctional-row]')?.remove();
    const any=(state?.organisms||[]).some(hasDysfunction);if(!any)return;
    box.querySelector('.board-mutation-empty')?.remove();
    box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-dysfunctional-row><span class="board-circle-icon">🦵</span><div><strong>Mutação Disfuncional</strong><small>Mutação negativa hereditária. Depois de se mover, a peça deve ficar uma rodada inteira em repouso antes de poder se mover novamente.</small></div></div>');
  }
  function ensureRule(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let row=modal.querySelector('.dysfunctional-mutation-rule');
    if(!row){row=document.createElement('p');row.className='dysfunctional-mutation-rule';modal.insertBefore(row,modal.querySelector('.modal-actions'))}
    const html='<strong>Mutação Disfuncional 🦵.</strong> É uma mutação negativa hereditária. Depois que a peça realiza um movimento, ela fica desbotada e precisa permanecer em repouso durante toda a rodada seguinte. Na rodada posterior volta a poder se mover. Locomoção 🐪 não concede um segundo movimento no turno em que a Mutação Disfuncional entra em repouso.';
    if(row.innerHTML!==html)row.innerHTML=html;
  }
  function patchMutationModal(){
    const modal=document.querySelector('#explanationModal');if(!modal?.classList.contains('open'))return;
    const title=modal.querySelector('#explanationModalTitle'),body=modal.querySelector('#explanationModalBody');if(!title||!body)return;
    if(!/Mutação Disfuncional/i.test(title.textContent||'')&&!/Mutação Disfuncional/i.test(body.textContent||''))return;
    const lost=/perdeu|efeito perdido/i.test(body.textContent||'');
    const desiredTitle='Mutação: Mutação Disfuncional 🦵';
    const desiredBody=lost
      ?'<p>A peça perdeu a Mutação Disfuncional 🦵 e pode voltar a se mover em rodadas consecutivas.</p>'
      :'<p>Esta peça recebeu a Mutação Disfuncional 🦵.</p><p>Depois de se mover, ela deve descansar durante a rodada seguinte inteira e só pode voltar a se mover na rodada posterior.</p>';
    if(title.textContent!==desiredTitle)title.textContent=desiredTitle;
    if(body.innerHTML!==desiredBody)body.innerHTML=desiredBody;
  }
  function patchDisplayedLogs(){
    const root=document.querySelector('#log');if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){
      if(node.nodeValue?.includes('Nova especialidade: Mutação Disfuncional'))node.nodeValue=node.nodeValue.replaceAll('Nova especialidade: Mutação Disfuncional','Mutação: Mutação Disfuncional');
    }
  }
  function updateHint(){
    const sel=typeof currentSelected==='function'?currentSelected():null,hint=document.querySelector('#hint');
    if(sel&&isBlocked(sel)&&hint)hint.textContent='🦵 Mutação Disfuncional: esta peça está em repouso nesta rodada. Escolha outra peça ou passe a vez.';
  }

  const previousRenderBoard=renderBoard;
  renderBoard=function(){const result=previousRenderBoard.apply(this,arguments);renderIcons();return result};
  const previousRenderActions=renderActions;
  renderActions=function(){const result=previousRenderActions.apply(this,arguments);renderLegend();ensureRule();patchMutationModal();patchDisplayedLogs();updateHint();return result};
  const previousRender=render;
  render=function(){const result=previousRender.apply(this,arguments);renderIcons();renderLegend();ensureRule();patchMutationModal();patchDisplayedLogs();updateHint();return result};

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    activeDysfunctionalActionOrgId=null;
    const result=previousDeserializeState.apply(this,arguments);
    for(const org of state?.organisms||[])if(!hasDysfunction(org))delete org.dysfunctionalLastMoveRound;
    return result;
  };

  const previousNewState=newState;
  newState=function(){activeDysfunctionalActionOrgId=null;return previousNewState.apply(this,arguments)};

  const observer=new MutationObserver(()=>{patchMutationModal();patchDisplayedLogs()});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  renderIcons();renderLegend();ensureRule();patchMutationModal();patchDisplayedLogs();updateHint();
})();