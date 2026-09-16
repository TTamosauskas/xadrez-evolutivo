(function(){
  const ALLUVIAL_RIVER={
    id:'alluvial-river',
    name:'Rio Aluvial',
    desc:'Uma diagonal fértil atravessa o tabuleiro do canto superior esquerdo ao canto inferior direito.'
  };

  function isEcoEventPool(a){
    return Array.isArray(a)&&a.length>=8&&a.every(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.desc==='string')&&a.some(x=>x.id==='volcano')&&a.some(x=>x.id==='pathogen');
  }

  const previousChoice=choice;
  choice=function(a){
    if(isEcoEventPool(a)){
      const options=[...a];
      const alreadyPresent=options.some(x=>x.id===ALLUVIAL_RIVER.id);
      if(!alreadyPresent&&state?.ecoCycle?.previousId!==ALLUVIAL_RIVER.id)options.push(ALLUVIAL_RIVER);
      return previousChoice(options);
    }
    return previousChoice(a);
  };

  function applyAlluvialRiver(ev){
    if(!ev||ev.id!==ALLUVIAL_RIVER.id||ev.alluvialRiverApplied)return;
    ev.alluvialRiverApplied=true;
    const coords=[];
    for(let i=0;i<SIZE;i++){
      const ce=cell(i,i);
      ce.terrain='fertile';
      ce.resource=1;
      ce.warning=null;
      ce.age=0;
      coords.push(coord(i,i));
    }
    log(`Rio Aluvial tornou fértil a diagonal ${coords.join(' → ')}.`);
    render();
  }

  const previousFinishTurn=finishTurn;
  finishTurn=function(...args){
    const result=previousFinishTurn.apply(this,args);
    const ev=state?.ecoCycle?.active;
    if(ev?.id===ALLUVIAL_RIVER.id&&!ev.alluvialRiverApplied&&!state.gameOver)applyAlluvialRiver(ev);
    return result;
  };

  function updateRule(){
    const ecoRule=document.querySelector('#rulesModal .eco-events-rule');
    if(!ecoRule)return;
    if(!ecoRule.textContent.includes('Rio Aluvial'))ecoRule.innerHTML+=' Rio Aluvial cria uma diagonal de 8 casas férteis de A8 até H1.';
  }

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    updateRule();
    return result;
  };

  updateRule();
})();
