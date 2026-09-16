(function(){
  const rawPlayerOrganisms=playerOrganisms;
  const softBirthAllowance={blue:false,amber:false};
  const softBirthResetQueued={blue:false,amber:false};
  const PATHOGEN_ROUNDS=10;
  const PATHOGEN_MODES=[
    {id:'diagonal',name:'Contágio diagonal'},
    {id:'orthogonal',name:'Contágio ortogonal'},
    {id:'omnidirectional',name:'Contato omnidirecional'}
  ];
  let outbreakSerial=1;

  function isReproductionStack(){
    try{return /\breproduce(?:Sexually)?\b/.test(new Error().stack||'')}catch(_){return false}
  }

  playerOrganisms=function(owner){
    const list=rawPlayerOrganisms(owner);
    if(!isReproductionStack())return list;

    if(!softBirthAllowance[owner]&&list.length<MAX_POP){
      softBirthAllowance[owner]=true;
      if(!softBirthResetQueued[owner]){
        softBirthResetQueued[owner]=true;
        Promise.resolve().then(()=>{
          softBirthAllowance[owner]=false;
          softBirthResetQueued[owner]=false;
        });
      }
    }

    if(softBirthAllowance[owner]&&list.length>=MAX_POP)return list.slice(0,Math.max(0,MAX_POP-1));
    return list;
  };

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function resistant(org){return !!profileOf(org)?.resistance}
  function signature(org){
    const p=profileOf(org)||{};
    return `${Number(p.pieceRank)||0}|${[...(p.traits||[])].sort().join(',')}|R${p.resistance?1:0}|S${p.sexual?1:0}`;
  }
  function modeById(id){return PATHOGEN_MODES.find(m=>m.id===id)||PATHOGEN_MODES[2]}
  function randomMode(){return choice(PATHOGEN_MODES)}
  function modeAllows(modeId,dr,dc){
    const adr=Math.abs(dr),adc=Math.abs(dc);
    if(!adr&&!adc)return false;
    if(modeId==='diagonal')return adr===1&&adc===1;
    if(modeId==='orthogonal')return adr+adc===1;
    return Math.max(adr,adc)===1;
  }
  function susceptible(org){return !!org&&!resistant(org)&&!org.ecoSick&&!org.overpopSick}
  function adjacentTargets(source,modeId){
    return state.organisms.filter(target=>target.id!==source.id&&susceptible(target)&&modeAllows(modeId,target.r-source.r,target.c-source.c));
  }

  function ensureOverpopulationState(target=state){
    if(!target)return null;
    if(!target.overpopulationPathogen||typeof target.overpopulationPathogen!=='object'){
      target.overpopulationPathogen={blue:{active:false,blocked:false},amber:{active:false,blocked:false}};
    }
    for(const owner of ['blue','amber']){
      let current=target.overpopulationPathogen[owner];
      if(!current||typeof current!=='object')current=target.overpopulationPathogen[owner]={active:false,blocked:false};
      current.active=!!current.active;
      current.blocked=!!current.blocked;
      if(!PATHOGEN_MODES.some(m=>m.id===current.mode))current.mode=null;
      if(!Number.isFinite(current.remaining))current.remaining=0;
      if(!current.outbreakId)current.outbreakId=null;
    }
    return target.overpopulationPathogen;
  }

  function densestSusceptibleSeed(owner){
    const groups=new Map();
    for(const org of rawPlayerOrganisms(owner)){
      if(!susceptible(org))continue;
      const key=signature(org);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(org);
    }
    if(!groups.size)return null;
    const top=Math.max(...[...groups.values()].map(g=>g.length));
    const group=choice([...groups.values()].filter(g=>g.length===top));
    return choice(group);
  }

  function infectOverpopulation(org,outbreak){
    if(!susceptible(org))return false;
    org.overpopSick={remaining:outbreak.remaining,sourceOwner:outbreak.owner,outbreakId:outbreak.outbreakId};
    return true;
  }

  function startOverpopulationOutbreak(owner){
    const outbreaks=ensureOverpopulationState();if(!outbreaks)return false;
    const population=rawPlayerOrganisms(owner).length,outbreak=outbreaks[owner];
    if(population<=MAX_POP){outbreak.blocked=false;return false}
    if(outbreak.active)return false;

    const seed=densestSusceptibleSeed(owner);
    if(!seed){
      if(!outbreak.blocked){
        outbreak.blocked=true;
        log(`${owners[owner].name}: superpopulação acima de ${MAX_POP}, mas nenhuma peça suscetível ao Patógeno Virulento.`);
      }
      return false;
    }

    const mode=randomMode();
    outbreak.active=true;
    outbreak.blocked=false;
    outbreak.owner=owner;
    outbreak.mode=mode.id;
    outbreak.remaining=PATHOGEN_ROUNDS;
    outbreak.outbreakId=`overpop-${owner}-${outbreakSerial++}`;
    infectOverpopulation(seed,outbreak);
    log(`${owners[owner].name}: superpopulação (${population}/${MAX_POP}) iniciou Patógeno Virulento em 1 peça — ${mode.name}, duração ${PATHOGEN_ROUNDS} rodadas.`);
    return true;
  }

  function checkOverpopulationOutbreaks(){
    if(!state||state.gameOver)return;
    const outbreaks=ensureOverpopulationState();
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(outbreak.active){
        const alive=state.organisms.some(o=>o.overpopSick?.outbreakId===outbreak.outbreakId);
        if(!alive&&outbreak.remaining<=0)outbreak.active=false;
      }
      startOverpopulationOutbreak(owner);
    }
  }

  function spreadOverpopulation(outbreak){
    const sources=state.organisms.filter(o=>o.overpopSick?.outbreakId===outbreak.outbreakId);
    const targets=new Map();
    for(const source of sources){
      for(const target of adjacentTargets(source,outbreak.mode))targets.set(target.id,target);
    }
    for(const target of targets.values())infectOverpopulation(target,outbreak);
  }

  function finishOverpopulationOutbreak(owner,outbreak){
    const doomed=state.organisms.filter(o=>o.overpopSick?.outbreakId===outbreak.outbreakId).map(o=>o.id);
    for(const id of doomed)removeOrganism(id,'Uma peça sucumbiu ao Patógeno Virulento causado por superpopulação.',true);
    outbreak.active=false;
    outbreak.remaining=0;
    outbreak.mode=null;
    outbreak.outbreakId=null;
    if(doomed.length)checkExtinction();
    if(!state.gameOver)log(`${owners[owner].name}: terminou o surto de Patógeno Virulento por superpopulação.`);
  }

  function tickOverpopulationPathogens(){
    if(!state||state.gameOver)return;
    const outbreaks=ensureOverpopulationState();
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(!outbreak.active)continue;
      spreadOverpopulation(outbreak);
      outbreak.remaining=Math.max(0,outbreak.remaining-1);
      for(const org of state.organisms){
        if(org.overpopSick?.outbreakId===outbreak.outbreakId)org.overpopSick.remaining=outbreak.remaining;
      }
      if(outbreak.remaining<=0)finishOverpopulationOutbreak(owner,outbreak);
    }
    if(!state.gameOver)checkOverpopulationOutbreaks();
  }

  function ecoEvent(){return state?.ecoCycle?.active||null}
  function managedEcoPathogen(){
    const ev=ecoEvent();
    return ev&&ev.id==='pathogen'&&ev.managedPathogen?ev:null;
  }
  function initializeEcoPathogen(){
    const ev=ecoEvent();
    if(!ev||ev.id!=='pathogen'||ev.managedPathogen)return false;

    const legacySeeds=state.organisms.filter(o=>o.ecoSick&&!resistant(o)&&!o.overpopSick);
    for(const org of state.organisms)delete org.ecoSick;
    const candidates=legacySeeds.length?legacySeeds:state.organisms.filter(susceptible);
    const mode=randomMode();
    const seed=candidates.length?choice(candidates):null;

    ev.managedPathogen=true;
    ev.pathogenMode=mode.id;
    ev.pathogenRemaining=PATHOGEN_ROUNDS;
    ev.desc=`Começa em uma única peça e se espalha por ${mode.name.toLowerCase()} durante ${PATHOGEN_ROUNDS} rodadas.`;
    if(seed)seed.ecoSick={remaining:PATHOGEN_ROUNDS,managed:true};
    log(`Patógeno Virulento ecológico: 1 peça inicial — ${mode.name}, duração ${PATHOGEN_ROUNDS} rodadas.`);
    return true;
  }

  function spreadEcoPathogen(ev){
    const sources=state.organisms.filter(o=>o.ecoSick?.managed);
    const targets=new Map();
    for(const source of sources){
      for(const target of adjacentTargets(source,ev.pathogenMode))targets.set(target.id,target);
    }
    for(const target of targets.values())target.ecoSick={remaining:ev.pathogenRemaining,managed:true};
  }

  function tickEcoPathogen(ev){
    if(!ev?.managedPathogen||ev.pathogenRemaining<=0)return;
    spreadEcoPathogen(ev);
    ev.pathogenRemaining=Math.max(0,ev.pathogenRemaining-1);
    for(const org of state.organisms)if(org.ecoSick?.managed)org.ecoSick.remaining=ev.pathogenRemaining;
    if(ev.pathogenRemaining<=0){
      const doomed=state.organisms.filter(o=>o.ecoSick?.managed).map(o=>o.id);
      for(const id of doomed)removeOrganism(id,'Uma peça sucumbiu ao Patógeno Virulento do evento ecológico.',true);
      if(doomed.length)checkExtinction();
    }
  }

  function updateEcoBanner(ev){
    if(!ev?.managedPathogen)return;
    const banner=document.querySelector('#ecoEventBanner');
    const span=banner?.querySelector('span');
    if(span)span.textContent=ev.desc;
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next.overpopulationPathogen={blue:{active:false,blocked:false},amber:{active:false,blocked:false}};
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    ensureOverpopulationState(state);
    initializeEcoPathogen();
    return result;
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(...args){
    const before=state?.turn||0;
    const completesRound=!!state&&!state.gameOver&&before%2===1;
    let ev=managedEcoPathogen();
    let hiddenLegacy=false;

    if(completesRound&&ev){
      tickEcoPathogen(ev);
      if(state.gameOver)return;
      const finishingRound=Math.floor((before+1)/2);
      const isFinalRound=finishingRound>=Number(state?.ecoCycle?.nextEventRound||Infinity);
      if(!isFinalRound&&state?.ecoCycle?.active===ev){
        ev.id='pathogen-managed';
        hiddenLegacy=true;
      }
    }

    let result;
    try{result=previousFinishTurn.apply(this,args)}finally{
      if(hiddenLegacy&&state?.ecoCycle?.active===ev)ev.id='pathogen';
      if(state?.ecoCycle?.previousId==='pathogen-managed')state.ecoCycle.previousId='pathogen';
    }

    if(state&&!state.gameOver){
      const initialized=initializeEcoPathogen();
      if(initialized)render();
      if(completesRound)tickOverpopulationPathogens();
      checkOverpopulationOutbreaks();
    }
    return result;
  };

  const previousRender=render;
  render=function(){
    checkOverpopulationOutbreaks();
    const result=previousRender.apply(this,arguments);
    updateEcoBanner(managedEcoPathogen());
    return result;
  };

  const previousRenderBoard=renderBoard;
  renderBoard=function(){
    previousRenderBoard();
    for(const org of state.organisms){
      if(!org.overpopSick)continue;
      const cellEl=boardEl.children[org.r*SIZE+org.c],orgEl=cellEl?.querySelector('.org');
      if(!orgEl)continue;
      let badge=orgEl.querySelector('.pathogen-badge');
      if(!badge){
        badge=document.createElement('span');badge.className='pathogen-badge';badge.textContent='🤢';orgEl.appendChild(badge);
      }
      const source=owners[org.overpopSick.sourceOwner]?.name||'superpopulação';
      badge.title=`Patógeno por superpopulação (${source}): ${org.overpopSick.remaining} rodada(s) restantes no surto`;
    }
    const ev=managedEcoPathogen();
    if(ev){
      for(const org of state.organisms){
        if(!org.ecoSick?.managed)continue;
        const cellEl=boardEl.children[org.r*SIZE+org.c],orgEl=cellEl?.querySelector('.org');
        const badge=orgEl?.querySelector('.pathogen-badge');
        if(badge)badge.title=`Patógeno ecológico — ${modeById(ev.pathogenMode).name}: ${ev.pathogenRemaining} rodada(s) restantes no surto`;
      }
    }
  };

  function ensureOverpopulationRule(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let p=modal.querySelector('.overpopulation-rule');
    if(!p){
      p=document.createElement('p');p.className='overpopulation-rule';
      const actions=modal.querySelector('.modal-actions');modal.insertBefore(p,actions);
    }
    p.innerHTML=`<strong>Patógeno Virulento.</strong> Tanto o evento ecológico quanto a superpopulação começam infectando uma única peça e duram ${PATHOGEN_ROUNDS} rodadas. A cada surto é sorteado um padrão: contágio diagonal, contágio ortogonal ou contato omnidirecional. A infecção se espalha a cada rodada apenas para peças adjacentes compatíveis com esse padrão. Resistência 🧬 impede a infecção. Ao fim da 10ª rodada, as peças ainda infectadas sucumbem. <strong>Superpopulação.</strong> Se um lote começa abaixo de ${MAX_POP} peças, ele termina inteiro mesmo que ultrapasse o máximo; enquanto a população estiver no limite ou acima, novas reproduções ficam bloqueadas.`;
  }

  const previousRenderActions=renderActions;
  renderActions=function(){previousRenderActions();ensureOverpopulationRule()};

  ensureOverpopulationState(state);
  initializeEcoPathogen();
  ensureOverpopulationRule();
  checkOverpopulationOutbreaks();
  render();
})();
