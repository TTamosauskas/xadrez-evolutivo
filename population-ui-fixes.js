(function(){
  let blackPassedNotice=false;

  function stackText(){
    try{return new Error().stack||''}catch(_){return ''}
  }

  // O limite populacional antigo continua existindo como constante histórica,
  // mas não deve mais bloquear reprodução. Mantemos a população real em todos
  // os demais sistemas (placar, eventos e gatilho do patógeno).
  const previousPlayerOrganisms=playerOrganisms;
  playerOrganisms=function(owner){
    const list=previousPlayerOrganisms(owner);
    const stack=stackText();

    // Nunca falsear população durante renderização, placar ou controle do patógeno.
    if(/\b(?:render|renderPlayer|renderPlayers|renderStatus|livingSummary|scoreFor|startGlobalPopulationOutbreak|checkOverpopulationOutbreaks)\b/.test(stack))return list;

    // A IA não deve considerar a população antiga como falta de espaço reprodutivo.
    if(/\b(?:projectedBirthsForMove|fertileGrowthValue)\b/.test(stack))return [];

    // Reprodução assexuada/sexuada e a checagem que oferece parceiro sexual
    // devem enxergar sempre uma população abaixo do antigo MAX_POP.
    if(/\b(?:reproduce|reproduceSexually|executeMove)\b/.test(stack)&&list.length>=MAX_POP){
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
    return text;
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

  setHostileLegend();rewriteNode(document.body);applyBlackPassHint();
})();
