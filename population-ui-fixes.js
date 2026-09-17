(function(){
  let blackPassedNotice=false;
  const MUTATION_ICONS={
    'Locomoção':'🐪','Voo':'🐦','Predação':'🦁','Ovos':'🦎','Fertilidade':'🐇','Carapaça':'🐢',
    'Ooteca':'🕷','Veneno':'🐍','Mutação Deletéria':'💀','Mutação Disfuncional':'🦵','Camuflagem':'👀'
  };

  // A população real é usada por placar, IA, eventos e patógeno.
  // Não existe mais teto artificial de população: o limite prático é o espaço do tabuleiro.
  playerOrganisms=function(owner){
    return (state?.organisms||[]).filter(o=>o.owner===owner);
  };

  function hostileTerms(value){
    let text=String(value??'');
    text=text.replace(/\bCasas mortais\b/g,'Casas hostis');
    text=text.replace(/\bcasas mortais\b/g,'casas hostis');
    text=text.replace(/\bCasa mortal\b/g,'Casa hostil');
    text=text.replace(/\bcasa mortal\b/g,'casa hostil');
    text=text.replace(/\bHabitats hostis\b/g,'Casas neutras');
    text=text.replace(/\bhabitats hostis\b/g,'casas neutras');
    text=text.replace(/\bHabitat hostil\b/g,'Casa neutra');
    text=text.replace(/\bhabitat hostil\b/g,'casa neutra');
    text=text.replace(/Quando atinge uma casa fértil \(verde\) a peça se reproduz\./gi,'Quando uma peça atinge uma casa fértil (verde) ela se reproduz.');
    text=text.replace(/\b(\d+)\s*\/\s*64\s+organismos\b/g,'$1 organismos');
    return text;
  }

  function ensureInterfaceStyles(){
    let style=document.querySelector('#populationInterfacePolish');
    if(!style){style=document.createElement('style');style.id='populationInterfacePolish';document.head.appendChild(style)}
    style.textContent=`
      .controls-panel .hint{min-height:18px!important;margin-top:5px!important;margin-bottom:2px!important;line-height:1.3}
      .controls-panel #passTurnBtn{margin-top:0!important}
      .controls-panel .legend{display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;align-items:center!important;justify-content:flex-start!important;gap:14px!important;width:100%!important}
      .controls-panel .legend span{display:inline-flex!important;align-items:center!important;white-space:nowrap!important;width:auto!important;flex:0 0 auto!important;margin:0!important}
      .selected-piece-summary{margin:8px 0 10px;padding:8px 10px;border:1px solid rgba(190,151,113,.28);border-radius:10px;background:rgba(126,91,63,.12)}
      .selected-piece-summary-label{display:block;font-size:10px;color:var(--muted);margin-bottom:3px}
      .selected-piece-summary-value{display:flex;align-items:center;min-height:42px;line-height:1;color:var(--text)}
      .selected-piece-summary-piece{display:block;width:42px;height:42px;object-fit:contain;flex:0 0 42px}
      .selected-piece-summary-separator{font-size:18px;font-weight:800;line-height:1;margin:0 6px 0 2px}
      .selected-piece-summary-icons{display:inline-flex;align-items:center;gap:3px}
      .selected-piece-summary-icon{position:static!important;transform:none!important;flex:0 0 17px!important;margin:0!important}
    `;
  }

  function forceTerrainLegendLayout(){
    const legend=document.querySelector('.controls-panel .legend');
    if(!legend)return;
    const set=(el,name,value)=>el.style.setProperty(name,value,'important');
    set(legend,'display','flex');
    set(legend,'flex-direction','row');
    set(legend,'flex-wrap','nowrap');
    set(legend,'align-items','center');
    set(legend,'justify-content','flex-start');
    set(legend,'gap','14px');
    set(legend,'width','100%');
    for(const span of legend.querySelectorAll(':scope > span')){
      set(span,'display','inline-flex');
      set(span,'align-items','center');
      set(span,'white-space','nowrap');
      set(span,'width','auto');
      set(span,'flex','0 0 auto');
      set(span,'margin','0');
    }
  }

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function profileTraitActive(profile,name){
    if(!profile)return false;
    let active=Array.isArray(profile.traits)&&profile.traits.includes(name);
    for(const entry of Array.isArray(profile.mutationStack)?profile.mutationStack:[]){
      if(entry?.name!==name)continue;
      if(entry.kind==='trait')active=true;
      else if(entry.kind==='trait-loss')active=false;
    }
    return active;
  }

  function selectedPieceIcons(org,profile){
    const icons=[],seen=new Set();
    const add=icon=>{if(icon&&!seen.has(icon)){seen.add(icon);icons.push(icon)}};
    const cellEl=boardEl?.children?.[org.r*SIZE+org.c],orgEl=cellEl?.querySelector?.('.org');
    if(orgEl)for(const el of orgEl.querySelectorAll('.mutation-icons .mutation-icon'))add((el.textContent||'').trim());
    for(const [name,icon] of Object.entries(MUTATION_ICONS))if(profileTraitActive(profile,name))add(icon);
    if(profile?.resistance)add('🧬');
    if(profile?.sexual)add('❤️');
    if(profile?.sterile)add('🚫');
    if(org.ecoSick||org.overpopSick)add('🤢');
    if(org.venomPoison)add('💀');
    return icons;
  }

  function renderSelectedPieceSummary(){
    const legend=document.querySelector('#boardMutationLegend,.board-mutation-legend');if(!legend?.parentNode)return;
    let box=document.querySelector('#selectedPieceSummary');
    if(!box){
      box=document.createElement('div');
      box.id='selectedPieceSummary';box.className='selected-piece-summary';
      box.innerHTML='<span class="selected-piece-summary-label">Peça selecionada:</span><div class="selected-piece-summary-value">—</div>';
      legend.parentNode.insertBefore(box,legend);
    }else if(box.nextElementSibling!==legend){
      legend.parentNode.insertBefore(box,legend);
    }

    const value=box.querySelector('.selected-piece-summary-value');
    const org=typeof currentSelected==='function'?currentSelected():null;
    if(!org){
      if(value&&value.textContent!=='—'){value.textContent='—';delete value.dataset.summaryKey}
      return;
    }

    const profile=profileOf(org);
    const cellEl=boardEl?.children?.[org.r*SIZE+org.c];
    const orgEl=cellEl?.querySelector?.('.org');
    const boardImg=orgEl?.querySelector?.('img');
    const icons=selectedPieceIcons(org,profile);
    const pieceKey=boardImg?.currentSrc||boardImg?.src||`${org.owner}:${org.lineage}`;
    const key=`${pieceKey}|${icons.join('|')}`;
    if(!value||value.dataset.summaryKey===key)return;

    value.replaceChildren();
    if(boardImg){
      const pieceImg=boardImg.cloneNode(false);
      pieceImg.className='selected-piece-summary-piece';
      pieceImg.removeAttribute('width');pieceImg.removeAttribute('height');
      pieceImg.draggable=false;
      value.appendChild(pieceImg);
    }else{
      const fallback=document.createElement('strong');fallback.textContent=org.lineage||'Peça';fallback.style.fontSize='24px';value.appendChild(fallback);
    }

    const separator=document.createElement('span');separator.className='selected-piece-summary-separator';separator.textContent=':';value.appendChild(separator);
    const iconsEl=document.createElement('span');iconsEl.className='selected-piece-summary-icons';
    for(const icon of icons){
      const iconEl=document.createElement('span');
      iconEl.className='mutation-icon selected-piece-summary-icon';
      iconEl.textContent=icon;
      iconsEl.appendChild(iconEl);
    }
    value.appendChild(iconsEl);value.dataset.summaryKey=key;
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
    if((span.textContent||'').trim()!=='casa hostil'){
      span.textContent=' casa hostil';
      if(icon)span.prepend(icon);
    }
    forceTerrainLegendLayout();
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
    const result=previousExecuteMove.apply(this,arguments);
    if(entersHostile)showHostileTutorial();
    return result;
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(){
    if(blackPassedNotice&&localStorage.getItem('xe_game_mode')==='single'&&state?.current==='blue')blackPassedNotice=false;
    return previousHandleCellClick.apply(this,arguments);
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    setHostileLegend();forceTerrainLegendLayout();rewriteNode(document.body);applyBlackPassHint();renderSelectedPieceSummary();
    return result;
  };

  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    setHostileLegend();forceTerrainLegendLayout();rewriteNode(document.body);applyBlackPassHint();renderSelectedPieceSummary();
    return result;
  };

  const observer=new MutationObserver(records=>{
    for(const record of records)for(const node of record.addedNodes)rewriteNode(node);
    setHostileLegend();forceTerrainLegendLayout();applyBlackPassHint();
  });
  observer.observe(document.body,{subtree:true,childList:true});

  ensureInterfaceStyles();ensureHostileTutorialState(state);
  setHostileLegend();forceTerrainLegendLayout();rewriteNode(document.body);applyBlackPassHint();renderSelectedPieceSummary();
})();
