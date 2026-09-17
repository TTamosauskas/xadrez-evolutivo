(function(){
  let blackPassedNotice=false;
  let populationCapBypassDepth=0;

  function withPopulationCapBypass(fn){
    populationCapBypassDepth++;
    try{return fn()}finally{populationCapBypassDepth=Math.max(0,populationCapBypassDepth-1)}
  }

  // Mantém a população real para placar, eventos, patógeno e IA.
  // O antigo MAX_POP só é neutralizado durante a execução real de reprodução.
  playerOrganisms=function(owner){
    const list=(state?.organisms||[]).filter(o=>o.owner===owner);
    const sexualSelection=!!document.querySelector?.('.sexual-partner');
    if((populationCapBypassDepth>0||sexualSelection)&&list.length>=MAX_POP){
      return list.slice(0,Math.max(0,MAX_POP-1));
    }
    return list;
  };

  function hostileTerms(value){
    let text=String(value??'');
    text=text.replace(/\bCasas mortais\b/g,'Casas hostis');
    text=text.replace(/\bcasas mortais\b/g,'casas hostis');
    text=text.replace(/\bCasa mortal\b/g,'Casa hostil');
    text=text.replace(/\bcasa mortal\b/g,'casa hostil');
    text=text.replace(/Quando atinge uma casa fértil \(verde\) a peça se reproduz\./gi,'Quando uma peça atinge uma casa fértil (verde) ela se reproduz.');
    return text;
  }

  function ensureHostileTutorialState(target=state){
    if(!target)return;
    if(typeof target.hostileEntryTutorialSeen!=='boolean')target.hostileEntryTutorialSeen=false;
  }

  function ensureHostileTutorialModal(){
    let modal=document.querySelector('#hostileTutorialModal');
    if(modal)return modal;
    modal=document.createElement('div');
    modal.id='hostileTutorialModal';
    modal.className='modal-backdrop';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.innerHTML='<div class="modal"><h2>Casa hostil</h2><p>Quando uma peça está em uma casa hostil (vermelha) ela tem 50% de chance de morrer.</p><div class="modal-actions"><button class="btn primary" type="button" data-hostile-tutorial-close>Entendi</button></div></div>';
    document.body.appendChild(modal);
    modal.querySelector('[data-hostile-tutorial-close]').addEventListener('click',()=>{
      modal.classList.remove('open');
      if(!document.querySelector('.modal-backdrop.open'))window.xeModalBlocking=false;
    });
    return modal;
  }

  function showHostileTutorial(){
    const modal=ensureHostileTutorialModal();
    modal.classList.add('open');
    window.xeModalBlocking=true;
    modal.querySelector('[data-hostile-tutorial-close]')?.focus();
  }

  const previousLog=log;
  log=function(message){
    const original=String(message??'');
    if(localStorage.getItem('xe_game_mode')==='single'&&state?.current==='amber'&&/(?:passou(?:\s+a\s+vez)?|passa automaticamente)/i.test(original)){
      blackPassedNotice=true;
    }
    return previousLog.call(this,hostileTerms(original));
  };

  function rewriteNode(node){
    if(!node)return;
    if(node.nodeType===Node.TEXT_NODE){
      const parent=node.parentElement;
      if(parent?.closest('script,style'))return;
      const next=hostileTerms(node.nodeValue);
      if(next!==node.nodeValue)node.nodeValue=next;
      return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE)return;
    const el=node;
    if(el.matches('script,style')||el.closest('script,style'))return;
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    let textNode;
    while((textNode=walker.nextNode())){
      if(textNode.parentElement?.closest('script,style'))continue;
      const next=hostileTerms(textNode.nodeValue);
      if(next!==textNode.nodeValue)textNode.nodeValue=next;
    }
    for(const target of [el,...el.querySelectorAll('[title],[aria-label]')]){
      for(const attr of ['title','aria-label']){
        if(!target.hasAttribute?.(attr))continue;
        const current=target.getAttribute(attr),next=hostileTerms(current);
        if(next!==current)target.setAttribute(attr,next);
      }
    }
  }

  function setHostileLegend(){
    const span=[...document.querySelectorAll('.legend span')].find(el=>el.querySelector('.legend-color.biohazard')||/casa hostil|casa mortal/i.test(el.textContent||''));
    if(!span)return;
    const icon=span.querySelector('i');
    if((span.textContent||'').trim()==='casa hostil')return;
    span.textContent=' casa hostil';
    if(icon)span.prepend(icon);
  }

  function applyBlackPassHint(){
    if(localStorage.getItem('xe_game_mode')!=='single'){
      blackPassedNotice=false;
      return;
    }
    if(!state||state.gameOver)return;
    if(state.current!=='blue'){
      if(blackPassedNotice)blackPassedNotice=false;
      return;
    }
    if(!blackPassedNotice)return;
    const hint=document.querySelector('#hint');
    if(hint)hint.textContent='Pretas passaram. Turno das Brancas. Selecione uma peça.';
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next.hostileEntryTutorialSeen=false;
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    ensureHostileTutorialState(state);
    return result;
  };

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    ensureHostileTutorialState(state);
    const entersHostile=!!org&&!!t&&!state.hostileEntryTutorialSeen&&(org.r!==t.r||org.c!==t.c)&&inBounds(t.r,t.c)&&cell(t.r,t.c).terrain==='biohazard';
    if(entersHostile)state.hostileEntryTutorialSeen=true;
    const result=withPopulationCapBypass(()=>previousExecuteMove.apply(this,arguments));
    if(entersHostile)showHostileTutorial();
    return result;
  };

  if(typeof window.xeReproduceFromMutation==='function'){
    const previousMutationReproduction=window.xeReproduceFromMutation;
    window.xeReproduceFromMutation=function(){
      return withPopulationCapBypass(()=>previousMutationReproduction.apply(this,arguments));
    };
  }

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(){
    if(blackPassedNotice&&localStorage.getItem('xe_game_mode')==='single'&&state?.current==='blue')blackPassedNotice=false;
    return previousHandleCellClick.apply(this,arguments);
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    setHostileLegend();rewriteNode(document.body);applyBlackPassHint();
    return result;
  };

  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    setHostileLegend();rewriteNode(document.body);applyBlackPassHint();
    return result;
  };

  const observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)rewriteNode(node);
    setHostileLegend();applyBlackPassHint();
  });
  observer.observe(document.body,{subtree:true,childList:true});

  ensureHostileTutorialState(state);
  setHostileLegend();rewriteNode(document.body);applyBlackPassHint();
})();
