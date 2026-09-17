(function(){
  const rawPlayerOrganisms=playerOrganisms;
  const softBirthAllowance={blue:false,amber:false};
  const softBirthResetQueued={blue:false,amber:false};
  const PATHOGEN_ROUNDS=10;
  const TOTAL_PATHOGEN_THRESHOLD=32;
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
  function boardDistance(a,b){return Math.max(Math.abs(a.r-b.r),Math.abs(a.c-b.c))}

  function ensureOverpopulationState(target=state){
    if(!target)return null;
    if(!target.overpopulationPathogen||typeof target.overpopulationPathogen!=='object'){
      target.overpopulationPathogen={blue:{active:false},amber:{active:false},thresholdLatched:false};
    }
    for(const owner of ['blue','amber']){
      let current=target.overpopulationPathogen[owner];
      if(!current||typeof current!=='object')current=target.overpopulationPathogen[owner]={active:false};
      current.active=!!current.active;
      if(!PATHOGEN_MODES.some(m=>m.id===current.mode))current.mode=null;
      if(!Number.isFinite(current.remaining))current.remaining=0;
      if(!current.outbreakId)current.outbreakId=null;
    }
    target.overpopulationPathogen.thresholdLatched=!!target.overpopulationPathogen.thresholdLatched;
    return target.overpopulationPathogen;
  }

  function populationOwners(){
    const blue=rawPlayerOrganisms('blue').length,amber=rawPlayerOrganisms('amber').length;
    if(blue===amber){const dominant=Math.random()<.5?'blue':'amber';return {dominant,minority:dominant==='blue'?'amber':'blue',blue,amber}}
    return blue>amber?{dominant:'blue',minority:'amber',blue,amber}:{dominant:'amber',minority:'blue',blue,amber};
  }

  function farthestSusceptibleSeed(dominant,minority){
    const candidates=rawPlayerOrganisms(dominant).filter(susceptible);
    if(!candidates.length)return null;
    const others=rawPlayerOrganisms(minority);
    if(!others.length)return choice(candidates);
    let best=-1,bestCandidates=[];
    for(const org of candidates){
      const nearest=Math.min(...others.map(other=>boardDistance(org,other)));
      if(nearest>best){best=nearest;bestCandidates=[org]}
      else if(nearest===best)bestCandidates.push(org);
    }
    return choice(bestCandidates);
  }

  function infectOverpopulation(org,outbreak){
    if(!susceptible(org))return false;
    org.overpopSick={remaining:outbreak.remaining,sourceOwner:outbreak.owner,outbreakId:outbreak.outbreakId};
    return true;
  }

  function startGlobalPopulationOutbreak(){
    const outbreaks=ensureOverpopulationState();if(!outbreaks||state?.gameOver)return false;
    const total=state.organisms.length;
    if(total<TOTAL_PATHOGEN_THRESHOLD){outbreaks.thresholdLatched=false;return false}
    if(outbreaks.thresholdLatched)return false;
    if(outbreaks.blue.active||outbreaks.amber.active)return false;

    const counts=populationOwners(),owner=counts.dominant,minority=counts.minority;
    const seed=farthestSusceptibleSeed(owner,minority);
    outbreaks.thresholdLatched=true;
    if(!seed){
      log(`População total chegou a ${total}, mas a cor mais numerosa não possui peça suscetível ao Patógeno Virulento.`);
      return false;
    }

    const outbreak=outbreaks[owner],mode=randomMode();
    outbreak.active=true;
    outbreak.owner=owner;
    outbreak.mode=mode.id;
    outbreak.remaining=PATHOGEN_ROUNDS;
    outbreak.outbreakId=`population-${owner}-${outbreakSerial++}`;
    infectOverpopulation(seed,outbreak);
    log(`Patógeno Virulento por alta população: ${total} peças totais. O foco surgiu em ${owners[owner].name}, em ${coord(seed.r,seed.c)}, na peça suscetível mais distante possível de ${owners[minority].name} — ${mode.name}, transmissão por ${PATHOGEN_ROUNDS} rodadas.`);
    return true;
  }

  function spreadPopulationOutbreak(outbreak){
    const sources=state.organisms.filter(o=>o.overpopSick?.outbreakId===outbreak.outbreakId);
    const targets=new Map();
    for(const source of sources)for(const target of adjacentTargets(source,outbreak.mode))targets.set(target.id,target);
    for(const target of targets.values())infectOverpopulation(target,outbreak);
  }

  function tickPopulationPathogens(){
    if(!state||state.gameOver)return;
    const outbreaks=ensureOverpopulationState();
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(!outbreak.active)continue;
      spreadPopulationOutbreak(outbreak);
      outbreak.remaining=Math.max(0,outbreak.remaining-1);
      for(const org of state.organisms)if(org.overpopSick?.outbreakId===outbreak.outbreakId)org.overpopSick.remaining=outbreak.remaining;
      if(outbreak.remaining<=0){
        outbreak.active=false;
        log(`A fase de transmissão do Patógeno Virulento por alta população terminou; peças já infectadas continuam doentes.`);
      }
    }
    startGlobalPopulationOutbreak();
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
    const mode=randomMode(),seed=candidates.length?choice(candidates):null;
    ev.managedPathogen=true;
    ev.pathogenMode=mode.id;
    ev.pathogenRemaining=PATHOGEN_ROUNDS;
    ev.desc=`Começa em uma única peça e se espalha por ${mode.name.toLowerCase()} durante ${PATHOGEN_ROUNDS} rodadas.`;
    if(seed)seed.ecoSick={remaining:PATHOGEN_ROUNDS,managed:true};
    log(`Patógeno Virulento ecológico: 1 peça inicial — ${mode.name}, transmissão por ${PATHOGEN_ROUNDS} rodadas.`);
    return true;
  }

  function spreadEcoPathogen(ev){
    const sources=state.organisms.filter(o=>o.ecoSick?.managed),targets=new Map();
    for(const source of sources)for(const target of adjacentTargets(source,ev.pathogenMode))targets.set(target.id,target);
    for(const target of targets.values())target.ecoSick={remaining:ev.pathogenRemaining,managed:true};
  }
  function tickEcoPathogen(ev){
    if(!ev?.managedPathogen||ev.pathogenRemaining<=0)return;
    spreadEcoPathogen(ev);
    ev.pathogenRemaining=Math.max(0,ev.pathogenRemaining-1);
    for(const org of state.organisms)if(org.ecoSick?.managed)org.ecoSick.remaining=ev.pathogenRemaining;
    if(ev.pathogenRemaining<=0)log('A fase de transmissão do Patógeno Virulento ecológico terminou; peças já infectadas continuam doentes.');
  }

  function updateEcoBanner(ev){
    if(!ev?.managedPathogen)return;
    const span=document.querySelector('#ecoEventBanner')?.querySelector('span');
    if(span)span.textContent=ev.desc;
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next.overpopulationPathogen={blue:{active:false},amber:{active:false},thresholdLatched:false};
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    ensureOverpopulationState(state);initializeEcoPathogen();startGlobalPopulationOutbreak();
    return result;
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(...args){
    const before=state?.turn||0;
    const completesRound=!!state&&!state.gameOver&&before%2===1;
    let ev=managedEcoPathogen(),hiddenLegacy=false;
    if(completesRound&&ev){
      tickEcoPathogen(ev);
      if(state.gameOver)return;
      const finishingRound=Math.floor((before+1)/2);
      const isFinalRound=finishingRound>=Number(state?.ecoCycle?.nextEventRound||Infinity);
      if(!isFinalRound&&state?.ecoCycle?.active===ev){ev.id='pathogen-managed';hiddenLegacy=true}
    }
    let result;
    try{result=previousFinishTurn.apply(this,args)}finally{
      if(hiddenLegacy&&state?.ecoCycle?.active===ev)ev.id='pathogen';
      if(state?.ecoCycle?.previousId==='pathogen-managed')state.ecoCycle.previousId='pathogen';
    }
    if(state&&!state.gameOver){
      const initialized=initializeEcoPathogen();if(initialized)render();
      if(completesRound)tickPopulationPathogens();
      startGlobalPopulationOutbreak();
    }
    return result;
  };

  const previousRender=render;
  render=function(){
    startGlobalPopulationOutbreak();
    const result=previousRender.apply(this,arguments);
    updateEcoBanner(managedEcoPathogen());
    return result;
  };

  const previousRenderBoard=renderBoard;
  renderBoard=function(){
    previousRenderBoard();
    for(const org of state.organisms){
      if(!org.overpopSick)continue;
      const orgEl=boardEl.children[org.r*SIZE+org.c]?.querySelector('.org');if(!orgEl)continue;
      let badge=orgEl.querySelector('.pathogen-badge');
      if(!badge){badge=document.createElement('span');badge.className='pathogen-badge';badge.textContent='🤢';orgEl.appendChild(badge)}
      badge.title='Patógeno Virulento por alta população';
    }
    const ev=managedEcoPathogen();
    if(ev)for(const org of state.organisms){
      if(!org.ecoSick?.managed)continue;
      const badge=boardEl.children[org.r*SIZE+org.c]?.querySelector('.org .pathogen-badge');
      if(badge)badge.title=`Patógeno ecológico — ${modeById(ev.pathogenMode).name}: ${ev.pathogenRemaining} rodada(s) restantes de transmissão`;
    }
  };

  function ensureOverpopulationRule(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let p=modal.querySelector('.overpopulation-rule');
    if(!p){p=document.createElement('p');p.className='overpopulation-rule';modal.insertBefore(p,modal.querySelector('.modal-actions'))}
    const html=`<strong>Patógeno Virulento.</strong> O surto por população é disparado quando existem ${TOTAL_PATHOGEN_THRESHOLD} ou mais peças no tabuleiro. Ele começa na cor com maior população, na peça suscetível cuja casa está o mais distante possível da cor menos populosa. Em empate populacional, a cor inicial é sorteada. Cada surto transmite por ${PATHOGEN_ROUNDS} rodadas segundo um padrão sorteado — diagonal, ortogonal ou omnidirecional — e pode atingir peças dos dois lados. Resistência 🧬 impede novas infecções. O fim das ${PATHOGEN_ROUNDS} rodadas apenas encerra novas transmissões; peças infectadas seguem o tempo letal da doença.`;
    if(p.innerHTML!==html)p.innerHTML=html;
  }

  const previousRenderActions=renderActions;
  renderActions=function(){const result=previousRenderActions.apply(this,arguments);ensureOverpopulationRule();return result};

  ensureOverpopulationState(state);initializeEcoPathogen();ensureOverpopulationRule();startGlobalPopulationOutbreak();render();
})();
