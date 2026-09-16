(function(){
  const REMOVED='Superespecialização';
  const ALLOWED_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça'];
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];

  for(let i=traitCatalog.length-1;i>=0;i--)if(traitCatalog[i].name===REMOVED)traitCatalog.splice(i,1);

  function cleanProfile(p){
    if(!p)return;
    p.traits=(p.traits||[]).filter(t=>t!==REMOVED);
    p.mutationStack=(p.mutationStack||[]).filter(x=>!(x.kind==='trait'&&x.name===REMOVED));
    p.mutations=(p.mutations||[]).filter(x=>x!==REMOVED);
  }
  function cleanAllProfiles(){
    if(!state?.lineages)return;
    for(const owner of ['blue','amber'])for(const p of Object.values(state.lineages[owner]||{}))cleanProfile(p);
  }
  function sample(items,count){return shuffle(items).slice(0,Math.min(count,items.length))}
  function trimInitialMortalCells(s){
    const top=[],bottom=[];
    for(const row of s.board)for(const ce of row)if(ce.terrain==='biohazard'){
      (ce.r<4?top:bottom).push(ce);
    }
    const all=[...top,...bottom];
    if(all.length<=7)return;
    const topTarget=Math.random()<.5?4:3;
    let keep=[...sample(top,topTarget),...sample(bottom,7-topTarget)];
    if(keep.length<7){
      const ids=new Set(keep.map(c=>`${c.r},${c.c}`));
      keep.push(...sample(all.filter(c=>!ids.has(`${c.r},${c.c}`)),7-keep.length));
    }
    const keepIds=new Set(keep.map(c=>`${c.r},${c.c}`));
    for(const ce of all)if(!keepIds.has(`${ce.r},${ce.c}`)){ce.terrain='neutral';ce.resource=0;}
  }
  function replaceRemovedMutation(p){
    cleanProfile(p);
    const options=[];
    const rank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    if(rank>0||rank<5)options.push({kind:'piece'});
    for(const name of ALLOWED_TRAITS)if(!p.traits.includes(name))options.push({kind:'trait',name});
    if(p.mutationStack.length)options.push({kind:'reversal'});
    if(!options.length)return;
    const m=choice(options);
    if(m.kind==='piece'){
      const dirs=[];if(rank>0)dirs.push(-1);if(rank<5)dirs.push(1);const delta=choice(dirs);
      p.pieceRank=rank+delta;p.mutationStack.push({kind:'piece',delta});p.mutations.push('Mutação de peça');
      return;
    }
    if(m.kind==='trait'){
      p.traits.push(m.name);p.mutationStack.push({kind:'trait',name:m.name});p.mutations.push(m.name);return;
    }
    const x=p.mutationStack.pop();
    if(!x)return;
    if(x.kind==='piece')p.pieceRank=Math.max(0,Math.min(5,(Number(p.pieceRank)||0)-x.delta));
    else p.traits=p.traits.filter(t=>t!==x.name);
    p.mutations.push('Reversão');
  }
  function repairNewChildren(beforeIds){
    for(const o of state.organisms){
      if(beforeIds.has(o.id))continue;
      const p=state.lineages[o.owner]?.[o.lineage];if(!p)continue;
      if((p.traits||[]).includes(REMOVED)){
        cleanProfile(p);replaceRemovedMutation(p);
      }
    }
  }
  function replaceTerms(s){
    return String(s)
      .replace(/bioma de uso único/gi,'casa fértil')
      .replace(/Biohazard/gi,'casa mortal');
  }
  function refreshLabels(){
    const legend=document.querySelector('.legend');
    if(legend)legend.innerHTML=`
      <span><i class="checker-swatch"></i> habitat neutro</span>
      <span><i class="legend-color biome"></i> casa fértil</span>
      <span><i class="legend-color biohazard"></i> casa mortal</span>`;
    const rules=document.querySelectorAll('#rulesModal p');
    if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao avançar sobre uma casa fértil, ela é consumida e a reprodução acontece automaticamente.';
    if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> As mutações possíveis são Mutação de peça, Locomoção, Voo, Predação, Ovos, Fertilidade, Carapaça e Reversão. Em 25% dos nascimentos há apenas herança; nos outros 75% ocorre uma nova mutação.';
    if(rules[4])rules[4].innerHTML='<strong>Casa mortal.</strong> Casas vermelhas eliminam organismos terrestres ao entrar ou atravessar. Voo oferece imunidade. A cada Época, as casas mortais mudam pelas quatro regras de Conway.';
  }

  const priorTerrainName=terrainName;
  terrainName=function(t){
    if(t==='fertile')return 'casa fértil';
    if(t==='biohazard')return 'casa mortal';
    return priorTerrainName(t);
  };
  const priorLog=log;
  log=function(msg){return priorLog(replaceTerms(msg))};

  const priorNewState=newState;
  newState=function(){const s=priorNewState();trimInitialMortalCells(s);return s};

  const priorDeserialize=deserializeState;
  deserializeState=function(raw){priorDeserialize(raw);cleanAllProfiles();trimInitialMortalCells(state);refreshLabels();render();};

  const priorExecuteMove=executeMove;
  executeMove=function(org,t){
    const before=new Set(state.organisms.map(o=>o.id));
    priorExecuteMove(org,t);
    repairNewChildren(before);cleanAllProfiles();render();
  };

  const priorRenderActions=renderActions;
  renderActions=function(){
    priorRenderActions();
    const pass=document.querySelector('#passTurnBtn');
    if(pass)pass.disabled=!!state?.gameOver;
    refreshLabels();
  };

  const pass=document.querySelector('#passTurnBtn');
  if(pass)pass.addEventListener('click',()=>{
    if(!state||state.gameOver)return;
    log(`${owners[state.current].name} passou a vez.`);
    finishTurn();
  });

  cleanAllProfiles();
  refreshLabels();
  init();
})();
