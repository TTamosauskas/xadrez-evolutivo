(function(){
  const ALLUVIAL_RIVER={
    id:'alluvial-river',
    name:'Rio Aluvial',
    desc:'Uma faixa diagonal larga de casas férteis corta o tabuleiro, como uma versão fértil da Barreira Geográfica.'
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

  function riverBandCells(anti){
    const out=[],seen=new Set();
    for(let r=0;r<SIZE;r++){
      const center=anti?SIZE-1-r:r;
      for(let offset=-1;offset<=1;offset++){
        const c=center+offset;
        if(!inBounds(r,c))continue;
        const k=`${r},${c}`;
        if(seen.has(k))continue;
        seen.add(k);out.push([r,c]);
      }
    }
    return out;
  }

  function makeFertile(r,c){
    const ce=cell(r,c);
    ce.terrain='fertile';
    ce.resource=1;
    ce.warning=null;
    ce.age=0;
  }

  function applyAlluvialRiver(ev){
    if(!ev||ev.id!==ALLUVIAL_RIVER.id||ev.alluvialRiverApplied)return;
    ev.alluvialRiverApplied=true;
    ev.anti=Math.random()<.5;
    const coords=riverBandCells(ev.anti);
    for(const [r,c] of coords)makeFertile(r,c);
    const direction=ev.anti?'canto superior direito ao inferior esquerdo':'canto superior esquerdo ao inferior direito';
    log(`Rio Aluvial formou uma faixa fértil diagonal de ${coords.length} casas, do ${direction}.`);
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
    if(!ecoRule.textContent.includes('Rio Aluvial'))ecoRule.innerHTML+=' Rio Aluvial cria uma faixa diagonal de casas férteis, com três casas de largura e orientação aleatória, como uma versão fértil da Barreira Geográfica.';
  }

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    updateRule();
    return result;
  };

  updateRule();
})();
