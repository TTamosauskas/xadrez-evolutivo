(function(){
  const PLAYER_THRESHOLD=17;
  const TRANSMISSION_ROUNDS=10;
  const MIN_LETHALITY=2;
  const MAX_LETHALITY=6;
  const MODES={
    diagonal:'Contágio diagonal',
    orthogonal:'Contágio ortogonal',
    omnidirectional:'Contato omnidirecional'
  };

  function actualOrganisms(owner){
    return (state?.organisms||[]).filter(o=>o.owner===owner);
  }

  function ensureState(target=state){
    if(!target)return null;
    if(!target.populationPathogenThreshold17||typeof target.populationPathogenThreshold17!=='object'){
      target.populationPathogenThreshold17={blue:false,amber:false};
    }
    target.populationPathogenThreshold17.blue=!!target.populationPathogenThreshold17.blue;
    target.populationPathogenThreshold17.amber=!!target.populationPathogenThreshold17.amber;

    if(!target.overpopulationPathogen||typeof target.overpopulationPathogen!=='object'){
      target.overpopulationPathogen={blue:{active:false},amber:{active:false}};
    }
    for(const owner of ['blue','amber']){
      if(!target.overpopulationPathogen[owner]||typeof target.overpopulationPathogen[owner]!=='object'){
        target.overpopulationPathogen[owner]={active:false};
      }
    }

    // Mantém desativado o antigo gatilho global de 32 peças de evolution-v18.
    target.overpopulationPathogen.thresholdLatched=true;
    if(!Number.isInteger(target.populationPathogenSerial)||target.populationPathogenSerial<1)target.populationPathogenSerial=1;
    return target.populationPathogenThreshold17;
  }

  function resetLatchesBelowThreshold(){
    const latches=ensureState();if(!latches)return;
    for(const owner of ['blue','amber']){
      if(actualOrganisms(owner).length<PLAYER_THRESHOLD)latches[owner]=false;
    }
  }

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function susceptible(org){return !!org&&!profileOf(org)?.resistance&&!org.ecoSick&&!org.overpopSick}
  function distance(a,b){return Math.max(Math.abs(a.r-b.r),Math.abs(a.c-b.c))}
  function modeName(id){return MODES[id]||MODES.omnidirectional}
  function randomMode(){return choice(Object.keys(MODES))}
  function completedRounds(){return Math.floor((state?.turn||0)/2)}
  function randomLethality(){return MIN_LETHALITY+Math.floor(Math.random()*(MAX_LETHALITY-MIN_LETHALITY+1))}

  function populationOrder(){
    const blue=actualOrganisms('blue').length,amber=actualOrganisms('amber').length;
    if(blue===amber){
      const dominant=Math.random()<.5?'blue':'amber';
      return {dominant,minority:dominant==='blue'?'amber':'blue',blue,amber};
    }
    return blue>amber?{dominant:'blue',minority:'amber',blue,amber}:{dominant:'amber',minority:'blue',blue,amber};
  }

  function farthestSusceptibleSeed(dominant,minority){
    const candidates=actualOrganisms(dominant).filter(susceptible);
    if(!candidates.length)return null;
    const others=actualOrganisms(minority);
    if(!others.length)return choice(candidates);
    let best=-1,bestCandidates=[];
    for(const org of candidates){
      const nearest=Math.min(...others.map(other=>distance(org,other)));
      if(nearest>best){best=nearest;bestCandidates=[org]}
      else if(nearest===best)bestCandidates.push(org);
    }
    return choice(bestCandidates);
  }

  function activePopulationOutbreak(){
    ensureState();
    for(const owner of ['blue','amber']){
      const outbreak=state.overpopulationPathogen[owner];
      if(outbreak?.active)return outbreak;
    }
    return null;
  }

  function chooseTriggerOwner(latches){
    const candidates=['blue','amber'].filter(owner=>actualOrganisms(owner).length>=PLAYER_THRESHOLD&&!latches[owner]);
    if(!candidates.length)return null;
    if(candidates.length===1)return candidates[0];
    const max=Math.max(...candidates.map(owner=>actualOrganisms(owner).length));
    return choice(candidates.filter(owner=>actualOrganisms(owner).length===max));
  }

  function infectSeed(seed,outbreak){
    const round=completedRounds();
    seed.overpopSick={
      remaining:TRANSMISSION_ROUNDS,
      sourceOwner:outbreak.owner,
      outbreakId:outbreak.outbreakId,
      diseaseId:outbreak.pathogenDiseaseId,
      diseaseDelay:outbreak.pathogenLethalDelay,
      deathRemaining:outbreak.pathogenLethalDelay,
      infectedRound:round
    };
  }

  function startThresholdOutbreak(){
    const latches=ensureState();if(!latches||state?.gameOver)return false;
    resetLatchesBelowThreshold();
    if(activePopulationOutbreak())return false;

    const triggerOwner=chooseTriggerOwner(latches);if(!triggerOwner)return false;
    const counts=populationOrder(),owner=counts.dominant,minority=counts.minority;
    const seed=farthestSusceptibleSeed(owner,minority);
    latches[triggerOwner]=true;

    if(!seed){
      log(`${owners[triggerOwner].name} atingiu ${PLAYER_THRESHOLD} peças, mas a cor mais populosa não possui peça suscetível ao Patógeno Virulento.`);
      return false;
    }

    const outbreak=state.overpopulationPathogen[owner];
    const mode=randomMode(),lethality=randomLethality(),serial=state.populationPathogenSerial++;
    const outbreakId=`population17-${triggerOwner}-${owner}-${serial}`;
    const diseaseId=`overpop-${outbreakId}-${completedRounds()}`;

    Object.assign(outbreak,{
      active:true,
      owner,
      triggerOwner,
      mode,
      remaining:TRANSMISSION_ROUNDS,
      outbreakId,
      pathogenDiseaseId:diseaseId,
      pathogenLethalDelay:lethality,
      threshold:PLAYER_THRESHOLD
    });
    infectSeed(seed,outbreak);

    log(`${owners[triggerOwner].name} atingiu ${PLAYER_THRESHOLD} peças e disparou Patógeno Virulento. O foco surgiu em ${owners[owner].name}, em ${coord(seed.r,seed.c)}, na peça suscetível mais distante possível de ${owners[minority].name}. ${modeName(mode)}; letalidade ${lethality} rodada(s); transmissão por ${TRANSMISSION_ROUNDS} rodadas.`);
    return true;
  }

  function pathogenBannerData(){
    const pop=activePopulationOutbreak();
    if(pop){
      const infected=(state.organisms||[]).find(o=>o.overpopSick?.outbreakId===pop.outbreakId);
      return {
        title:'Patógeno Virulento — Superpopulação',
        mode:modeName(pop.mode),
        lethality:Number(pop.pathogenLethalDelay)||Number(infected?.overpopSick?.diseaseDelay)||null,
        remaining:Math.max(0,Number(pop.remaining)||0),
        triggerOwner:pop.triggerOwner
      };
    }
    const ev=state?.ecoCycle?.active;
    if(ev?.id==='pathogen'&&ev.managedPathogen){
      const infected=(state.organisms||[]).find(o=>o.ecoSick?.managed);
      return {
        title:'Patógeno Virulento — Evento ecológico',
        mode:modeName(ev.pathogenMode),
        lethality:Number(ev.pathogenLethalDelay)||Number(infected?.ecoSick?.diseaseDelay)||null,
        remaining:Math.max(0,Number(ev.pathogenRemaining)||0),
        triggerOwner:null
      };
    }
    return null;
  }

  function updatePathogenBanner(){
    const data=pathogenBannerData();if(!data)return;
    const banner=document.querySelector('#ecoEventBanner');if(!banner)return;
    const lethality=data.lethality?`${data.lethality} rodada(s)`:'2–6 rodadas';
    const trigger=data.triggerOwner?` · Gatilho: ${owners[data.triggerOwner].name} atingiu ${PLAYER_THRESHOLD} peças`:'';
    banner.classList.add('active');
    banner.innerHTML=`<strong>${data.title}</strong><span>Letalidade: ${lethality} · Contágio: ${data.mode} · Transmissão: ${data.remaining} rodada(s) restante(s)</span><small>${trigger.replace(/^ · /,'')}</small>`;
  }

  function suppressLegacyGlobalTrigger(){
    ensureState();
    if(state?.overpopulationPathogen)state.overpopulationPathogen.thresholdLatched=true;
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next.populationPathogenThreshold17={blue:false,amber:false};
    next.populationPathogenSerial=1;
    ensureState(next);
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(raw){
    let prepared=raw;
    try{
      const parsed=JSON.parse(raw);
      if(!parsed.overpopulationPathogen||typeof parsed.overpopulationPathogen!=='object')parsed.overpopulationPathogen={blue:{active:false},amber:{active:false}};
      parsed.overpopulationPathogen.thresholdLatched=true;
      if(!parsed.populationPathogenThreshold17)parsed.populationPathogenThreshold17={blue:false,amber:false};
      prepared=JSON.stringify(parsed);
    }catch(_){/* usa o conteúdo original */}
    const result=previousDeserializeState.call(this,prepared);
    suppressLegacyGlobalTrigger();
    const started=startThresholdOutbreak();
    if(started)render();else updatePathogenBanner();
    return result;
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    suppressLegacyGlobalTrigger();
    const result=previousFinishTurn.apply(this,arguments);
    suppressLegacyGlobalTrigger();
    const started=startThresholdOutbreak();
    if(started&&!state?.gameOver)render();else updatePathogenBanner();
    return result;
  };

  const previousRender=render;
  render=function(){
    suppressLegacyGlobalTrigger();
    let result=previousRender.apply(this,arguments);
    suppressLegacyGlobalTrigger();
    const started=startThresholdOutbreak();
    if(started){
      suppressLegacyGlobalTrigger();
      result=previousRender.apply(this,arguments);
      suppressLegacyGlobalTrigger();
    }
    updatePathogenBanner();
    return result;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    updatePathogenBanner();
    return result;
  };

  suppressLegacyGlobalTrigger();
  resetLatchesBelowThreshold();
  const started=startThresholdOutbreak();
  if(started)render();else updatePathogenBanner();
})();
