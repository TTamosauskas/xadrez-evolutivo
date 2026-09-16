(function(){
  const TRANSMISSION_ROUNDS=10;
  const MIN_LETHAL_ROUNDS=2;
  const MAX_LETHAL_ROUNDS=6;
  const LEGACY_PATHOGEN_DEATHS=new Set([
    'Uma peça sucumbiu ao Patógeno Virulento.',
    'Uma peça sucumbiu ao Patógeno Virulento causado por superpopulação.',
    'Uma peça sucumbiu ao Patógeno Virulento do evento ecológico.'
  ]);

  function randomLethalDelay(){
    return MIN_LETHAL_ROUNDS+Math.floor(Math.random()*(MAX_LETHAL_ROUNDS-MIN_LETHAL_ROUNDS+1));
  }
  function completedRounds(){return Math.floor((state?.turn||0)/2)}
  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function resistant(org){return !!profileOf(org)?.resistance}
  function modeAllows(modeId,dr,dc){
    const adr=Math.abs(dr),adc=Math.abs(dc);
    if(!adr&&!adc)return false;
    if(modeId==='diagonal')return adr===1&&adc===1;
    if(modeId==='orthogonal')return adr+adc===1;
    return Math.max(adr,adc)===1;
  }
  function diseaseRegistry(target=state){
    if(!target)return {};
    if(!target.pathogenDiseases||typeof target.pathogenDiseases!=='object')target.pathogenDiseases={};
    return target.pathogenDiseases;
  }
  function ensureDisease(id,preferredDelay){
    if(!id)return null;
    const registry=diseaseRegistry();
    let disease=registry[id];
    if(!disease||typeof disease!=='object')disease=registry[id]={};
    if(!Number.isInteger(disease.lethalDelay)||disease.lethalDelay<MIN_LETHAL_ROUNDS||disease.lethalDelay>MAX_LETHAL_ROUNDS){
      disease.lethalDelay=Number.isInteger(preferredDelay)&&preferredDelay>=MIN_LETHAL_ROUNDS&&preferredDelay<=MAX_LETHAL_ROUNDS?preferredDelay:randomLethalDelay();
    }
    return disease;
  }
  function ecoDiseaseId(ev){
    if(!ev)return null;
    if(!ev.pathogenDiseaseId)ev.pathogenDiseaseId=`eco-${ev.startRound??completedRounds()}-${ev.pathogenMode||'omnidirectional'}`;
    return ev.pathogenDiseaseId;
  }
  function ensureActiveDiseaseDefinitions(){
    if(!state)return;
    const ev=state.ecoCycle?.active;
    if(ev?.id==='pathogen'&&ev.managedPathogen){
      const id=ecoDiseaseId(ev),disease=ensureDisease(id,ev.pathogenLethalDelay);
      ev.pathogenLethalDelay=disease.lethalDelay;
    }
    const outbreaks=state.overpopulationPathogen||{};
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(!outbreak?.active||!outbreak.outbreakId)continue;
      const id=`overpop-${outbreak.outbreakId}`;
      const disease=ensureDisease(id,outbreak.pathogenLethalDelay);
      outbreak.pathogenDiseaseId=id;
      outbreak.pathogenLethalDelay=disease.lethalDelay;
    }
  }
  function diseaseForInfection(org,kind){
    const inf=kind==='eco'?org.ecoSick:org.overpopSick;
    if(!inf)return null;
    let id=inf.diseaseId;
    let preferred=inf.diseaseDelay;
    if(kind==='eco'){
      const ev=state.ecoCycle?.active;
      if(!id&&ev?.id==='pathogen'&&ev.managedPathogen){
        id=ecoDiseaseId(ev);preferred=ev.pathogenLethalDelay;
      }
      if(!id)id=`eco-lingering-${inf.outbreakId||'legacy'}`;
    }else{
      if(!id&&inf.outbreakId)id=`overpop-${inf.outbreakId}`;
      const outbreaks=state.overpopulationPathogen||{};
      const active=Object.values(outbreaks).find(o=>o?.outbreakId===inf.outbreakId);
      if(active){preferred=active.pathogenLethalDelay;active.pathogenDiseaseId=id||active.pathogenDiseaseId}
      if(!id)id=`overpop-lingering-${inf.sourceOwner||org.owner}`;
    }
    const disease=ensureDisease(id,preferred);
    inf.diseaseId=id;
    inf.diseaseDelay=disease.lethalDelay;
    return disease;
  }
  function initializeInfection(org,kind,round=completedRounds()){
    const inf=kind==='eco'?org.ecoSick:org.overpopSick;
    if(!inf)return;
    const disease=diseaseForInfection(org,kind);if(!disease)return;
    if(!Number.isInteger(inf.infectedRound))inf.infectedRound=round;
    if(!Number.isInteger(inf.deathRemaining)||inf.deathRemaining<0||inf.deathRemaining>MAX_LETHAL_ROUNDS)inf.deathRemaining=disease.lethalDelay;
    inf.remaining=inf.deathRemaining;
  }
  function syncInfections(round=completedRounds()){
    ensureActiveDiseaseDefinitions();
    for(const org of state?.organisms||[]){
      if(org.ecoSick?.managed)initializeInfection(org,'eco',round);
      if(org.overpopSick)initializeInfection(org,'overpop',round);
    }
  }
  function predictFinalEcoSpread(beforeTurn){
    if(!state||beforeTurn%2!==1)return null;
    const ev=state.ecoCycle?.active;
    if(!ev||ev.id!=='pathogen'||!ev.managedPathogen)return null;
    const finishingRound=Math.floor((beforeTurn+1)/2);
    if(finishingRound<Number(state.ecoCycle?.nextEventRound||Infinity))return null;
    ensureActiveDiseaseDefinitions();syncInfections(completedRounds());
    const diseaseId=ecoDiseaseId(ev),disease=ensureDisease(diseaseId,ev.pathogenLethalDelay);
    const records=new Map();
    const sources=(state.organisms||[]).filter(o=>o.ecoSick?.managed);
    for(const source of sources){
      records.set(source.id,{...source.ecoSick,diseaseId,diseaseDelay:disease.lethalDelay});
      for(const target of state.organisms||[]){
        if(target.id===source.id||resistant(target)||target.ecoSick||target.overpopSick)continue;
        if(!modeAllows(ev.pathogenMode,target.r-source.r,target.c-source.c))continue;
        if(!records.has(target.id))records.set(target.id,{
          managed:true,diseaseId,diseaseDelay:disease.lethalDelay,
          deathRemaining:disease.lethalDelay,infectedRound:finishingRound,remaining:disease.lethalDelay
        });
      }
    }
    return {records,round:finishingRound};
  }
  function restoreFinalEcoSpread(snapshot){
    if(!snapshot?.records)return;
    for(const [id,data] of snapshot.records){
      const org=(state.organisms||[]).find(o=>o.id===id);if(!org)continue;
      if(org.overpopSick)continue;
      if(!org.ecoSick?.managed)org.ecoSick={...data};
      else{
        const current=org.ecoSick;
        current.managed=true;
        current.diseaseId=data.diseaseId;
        current.diseaseDelay=data.diseaseDelay;
        if(!Number.isInteger(current.deathRemaining))current.deathRemaining=data.deathRemaining;
        if(!Number.isInteger(current.infectedRound))current.infectedRound=data.infectedRound;
      }
    }
  }
  function tickIndividualDeaths(round){
    const doomed=[];
    for(const org of [...((state&&state.organisms)||[])]){
      for(const kind of ['eco','overpop']){
        const inf=kind==='eco'?org.ecoSick:org.overpopSick;
        if(!inf||(kind==='eco'&&!inf.managed))continue;
        initializeInfection(org,kind,round);
        if(inf.infectedRound>=round)continue;
        inf.deathRemaining=Math.max(0,inf.deathRemaining-1);
        inf.remaining=inf.deathRemaining;
        if(inf.deathRemaining<=0){doomed.push({id:org.id,kind,delay:inf.diseaseDelay});break}
      }
    }
    for(const d of doomed){
      const org=(state.organisms||[]).find(o=>o.id===d.id);if(!org)continue;
      removeOrganism(d.id,`Uma peça sucumbiu ao Patógeno Virulento após ${d.delay} rodada(s) de infecção.`,true);
    }
    if(doomed.length)checkExtinction();
  }
  function transmissionRemainingFor(org,kind){
    if(kind==='eco'){
      const ev=state.ecoCycle?.active;
      if(ev?.id==='pathogen'&&ev.managedPathogen&&org.ecoSick?.diseaseId===ev.pathogenDiseaseId)return Math.max(0,Number(ev.pathogenRemaining)||0);
      return 0;
    }
    const id=org.overpopSick?.outbreakId;
    const outbreaks=state.overpopulationPathogen||{};
    const active=Object.values(outbreaks).find(o=>o?.active&&o.outbreakId===id);
    return active?Math.max(0,Number(active.remaining)||0):0;
  }
  function updatePathogenBadges(){
    for(const org of state?.organisms||[]){
      const kind=org.ecoSick?.managed?'eco':org.overpopSick?'overpop':null;if(!kind)continue;
      const inf=kind==='eco'?org.ecoSick:org.overpopSick;
      initializeInfection(org,kind,completedRounds());
      const cellEl=boardEl?.children?.[org.r*SIZE+org.c],orgEl=cellEl?.querySelector?.('.org');if(!orgEl)continue;
      let badge=orgEl.querySelector('.pathogen-badge');
      if(!badge){badge=document.createElement('span');badge.className='pathogen-badge';badge.textContent='🤢';orgEl.appendChild(badge)}
      const tx=transmissionRemainingFor(org,kind);
      badge.title=`Patógeno Virulento: morte em ${inf.deathRemaining} rodada(s). A doença tem letalidade de ${inf.diseaseDelay} rodada(s). ${tx>0?`Transmissão ativa por mais ${tx} rodada(s).`:'Transmissão encerrada.'}`;
    }
  }
  function rewriteUiText(){
    const row=document.querySelector('#boardMutationLegend [data-pathogen-row] small');
    const legendText='Peça infectada. Cada doença sorteia uma letalidade de 2 a 6 rodadas; cada infectado morre após esse prazo contado desde sua infecção. O surto transmite por até 10 rodadas.';
    if(row&&row.textContent!==legendText)row.textContent=legendText;
    const body=document.querySelector('#pathogenInfoBody');
    if(body&&body.closest('.modal-backdrop')?.classList.contains('open')){
      const paragraphs=[...body.querySelectorAll('p')];
      const old=paragraphs.find(p=>/Ao fim da 10ª rodada|surto dura 10 rodadas/i.test(p.textContent||''));
      const modalText=`O surto pode gerar novas infecções durante ${TRANSMISSION_ROUNDS} rodadas. Cada doença sorteia uma única letalidade entre ${MIN_LETHAL_ROUNDS} e ${MAX_LETHAL_ROUNDS} rodadas; cada peça infectada morre quando completa esse prazo desde a própria infecção. Quando as ${TRANSMISSION_ROUNDS} rodadas terminam, apenas novas infecções são interrompidas.`;
      if(old&&old.innerHTML!==modalText)old.innerHTML=modalText;
      const extra=paragraphs.find(p=>/Ao fim da 10ª rodada/i.test(p.textContent||''));if(extra)extra.remove();
    }
    const rule=document.querySelector('#rulesModal .overpopulation-rule');
    const ruleText=`<strong>Patógeno Virulento.</strong> Tanto o evento ecológico quanto a superpopulação começam infectando uma única peça. Cada doença sorteia uma letalidade única entre ${MIN_LETHAL_ROUNDS} e ${MAX_LETHAL_ROUNDS} rodadas; toda peça contaminada por aquela doença morre após esse prazo, contado a partir de sua própria infecção. O surto pode transmitir por ${TRANSMISSION_ROUNDS} rodadas usando um padrão sorteado — contágio diagonal, contágio ortogonal ou contato omnidirecional — e pode atingir peças dos dois lados. Ao fim da 10ª rodada apenas a transmissão é encerrada; infectados remanescentes continuam doentes até completar o prazo letal. Resistência 🧬 impede novas infecções. <strong>Superpopulação.</strong> Se um lote começa abaixo de ${MAX_POP} peças, ele termina inteiro mesmo que ultrapasse o máximo; enquanto a população estiver no limite ou acima, novas reproduções ficam bloqueadas.`;
    if(rule&&rule.innerHTML!==ruleText)rule.innerHTML=ruleText;
  }

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const text=String(msg||'');
    if(LEGACY_PATHOGEN_DEATHS.has(text))return false;
    return previousRemoveOrganism.apply(this,arguments);
  };

  const previousLog=log;
  log=function(message){
    let text=String(message??'');
    text=text.replace(/terminou o surto de Patógeno Virulento por superpopulação\./i,'encerrou a fase de transmissão do Patógeno Virulento por superpopulação.');
    return previousLog.call(this,text);
  };

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    next.pathogenDiseases={};
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    diseaseRegistry(state);syncInfections(completedRounds());
    return result;
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const before=state?.turn||0;
    const completesRound=!!state&&!state.gameOver&&before%2===1;
    syncInfections(completedRounds());
    const finalEcoSnapshot=completesRound?predictFinalEcoSpread(before):null;
    const result=previousFinishTurn.apply(this,arguments);
    if(!state)return result;
    if(finalEcoSnapshot)restoreFinalEcoSpread(finalEcoSnapshot);
    syncInfections(completedRounds());
    if(completesRound&&!state.gameOver)tickIndividualDeaths(Math.floor((before+1)/2));
    updatePathogenBadges();rewriteUiText();
    return result;
  };

  const previousRenderBoard=renderBoard;
  renderBoard=function(){
    const result=previousRenderBoard.apply(this,arguments);
    syncInfections(completedRounds());updatePathogenBadges();
    return result;
  };

  const previousRender=render;
  render=function(){
    syncInfections(completedRounds());
    const result=previousRender.apply(this,arguments);
    syncInfections(completedRounds());updatePathogenBadges();rewriteUiText();
    return result;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    rewriteUiText();return result;
  };

  const observer=new MutationObserver(()=>{rewriteUiText();updatePathogenBadges()});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  diseaseRegistry(state);syncInfections(completedRounds());rewriteUiText();updatePathogenBadges();
})();
