(function(){
  const MIN_MORTALITY=60;
  const MAX_MORTALITY=100;
  const MODE_NAMES={
    diagonal:'Contágio diagonal',
    orthogonal:'Contágio ortogonal',
    omnidirectional:'Contato omnidirecional'
  };

  function randomMortality(){
    return MIN_MORTALITY+Math.floor(Math.random()*(MAX_MORTALITY-MIN_MORTALITY+1));
  }

  function registry(){
    if(!state)return {};
    if(!state.pathogenDiseases||typeof state.pathogenDiseases!=='object')state.pathogenDiseases={};
    return state.pathogenDiseases;
  }

  function ensureDisease(id){
    if(!id)return null;
    const diseases=registry();
    let disease=diseases[id];
    if(!disease||typeof disease!=='object')disease=diseases[id]={};
    if(!Number.isInteger(disease.mortalityPercent)||disease.mortalityPercent<MIN_MORTALITY||disease.mortalityPercent>MAX_MORTALITY){
      disease.mortalityPercent=randomMortality();
    }
    if(!Array.isArray(disease.mortalityInfectedIds))disease.mortalityInfectedIds=[];
    if(!Array.isArray(disease.mortalitySurvivorIds))disease.mortalitySurvivorIds=[];
    if(!Number.isInteger(disease.mortalityDeaths)||disease.mortalityDeaths<0)disease.mortalityDeaths=0;
    return disease;
  }

  function activeOverpopulationOutbreak(){
    const outbreaks=state?.overpopulationPathogen||{};
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(outbreak?.active)return outbreak;
    }
    return null;
  }

  function diseaseIdFor(org,kind){
    const inf=kind==='eco'?org?.ecoSick:org?.overpopSick;
    if(!inf)return null;
    if(inf.diseaseId)return inf.diseaseId;

    if(kind==='eco'){
      const ev=state?.ecoCycle?.active;
      if(ev?.id==='pathogen'&&ev.managedPathogen&&ev.pathogenDiseaseId){
        inf.diseaseId=ev.pathogenDiseaseId;
        return inf.diseaseId;
      }
    }else{
      const outbreaks=state?.overpopulationPathogen||{};
      const outbreak=Object.values(outbreaks).find(o=>o?.outbreakId===inf.outbreakId);
      if(outbreak?.pathogenDiseaseId){
        inf.diseaseId=outbreak.pathogenDiseaseId;
        return inf.diseaseId;
      }
    }
    return null;
  }

  function registerInfection(org,kind){
    const inf=kind==='eco'?org?.ecoSick:org?.overpopSick;
    if(!inf)return null;
    const id=diseaseIdFor(org,kind);
    if(!id)return null;
    const disease=ensureDisease(id);
    if(!disease)return null;
    if(!disease.mortalityInfectedIds.includes(org.id))disease.mortalityInfectedIds.push(org.id);
    inf.mortalityPercent=disease.mortalityPercent;
    return {id,disease,inf,kind};
  }

  function targetDeaths(disease){
    const infected=disease?.mortalityInfectedIds?.length||0;
    if(!infected)return 0;
    return Math.min(infected,Math.ceil(infected*disease.mortalityPercent/100));
  }

  function clearRecoveredReinfection(org,kind,record){
    if(!record?.disease?.mortalitySurvivorIds?.includes(org.id))return;
    if(kind==='eco')delete org.ecoSick;
    else delete org.overpopSick;
  }

  function syncMortalityState(){
    if(!state)return;

    const ev=state.ecoCycle?.active;
    if(ev?.id==='pathogen'&&ev.managedPathogen&&ev.pathogenDiseaseId){
      const disease=ensureDisease(ev.pathogenDiseaseId);
      ev.pathogenMortalityPercent=disease.mortalityPercent;
    }

    const outbreaks=state.overpopulationPathogen||{};
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(!outbreak?.pathogenDiseaseId)continue;
      const disease=ensureDisease(outbreak.pathogenDiseaseId);
      outbreak.pathogenMortalityPercent=disease.mortalityPercent;
    }

    for(const org of [...(state.organisms||[])]){
      if(org.ecoSick?.managed){
        const record=registerInfection(org,'eco');
        if(record)clearRecoveredReinfection(org,'eco',record);
      }
      if(org.overpopSick){
        const record=registerInfection(org,'overpop');
        if(record)clearRecoveredReinfection(org,'overpop',record);
      }
    }
  }

  function recordForPathogenDeath(org){
    if(org?.ecoSick?.managed){
      const record=registerInfection(org,'eco');
      if(record)return record;
    }
    if(org?.overpopSick){
      const record=registerInfection(org,'overpop');
      if(record)return record;
    }
    return null;
  }

  function markSurvivor(org,record){
    const survivors=record.disease.mortalitySurvivorIds;
    if(!survivors.includes(org.id))survivors.push(org.id);
    if(record.kind==='eco')delete org.ecoSick;
    else delete org.overpopSick;
  }

  function currentDiseaseForModal(){
    const body=document.querySelector('#pathogenInfoBody');
    const text=(body?.textContent||'').toLowerCase();
    const ev=state?.ecoCycle?.active;

    if(text.includes('evento ecológico')&&ev?.id==='pathogen'&&ev.pathogenDiseaseId){
      return ensureDisease(ev.pathogenDiseaseId);
    }

    const outbreaks=state?.overpopulationPathogen||{};
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(!outbreak?.active||!outbreak.pathogenDiseaseId)continue;
      const name=String(owners?.[owner]?.name||owner).toLowerCase();
      if(text.includes(name))return ensureDisease(outbreak.pathogenDiseaseId);
    }

    const active=[];
    if(ev?.id==='pathogen'&&ev.managedPathogen&&ev.pathogenDiseaseId)active.push(ensureDisease(ev.pathogenDiseaseId));
    for(const owner of ['blue','amber']){
      const outbreak=outbreaks[owner];
      if(outbreak?.active&&outbreak.pathogenDiseaseId)active.push(ensureDisease(outbreak.pathogenDiseaseId));
    }
    return active.length===1?active[0]:null;
  }

  function bannerData(){
    const pop=activeOverpopulationOutbreak();
    if(pop?.pathogenDiseaseId){
      const disease=ensureDisease(pop.pathogenDiseaseId);
      return {
        title:'Patógeno Virulento — Superpopulação',
        disease,
        mode:MODE_NAMES[pop.mode]||MODE_NAMES.omnidirectional,
        remaining:Math.max(0,Number(pop.remaining)||0),
        delay:Number(pop.pathogenLethalDelay)||Number(disease.lethalDelay)||null,
        triggerOwner:pop.triggerOwner
      };
    }

    const ev=state?.ecoCycle?.active;
    if(ev?.id==='pathogen'&&ev.managedPathogen&&ev.pathogenDiseaseId){
      const disease=ensureDisease(ev.pathogenDiseaseId);
      return {
        title:'Patógeno Virulento — Evento ecológico',
        disease,
        mode:MODE_NAMES[ev.pathogenMode]||MODE_NAMES.omnidirectional,
        remaining:Math.max(0,Number(ev.pathogenRemaining)||0),
        delay:Number(ev.pathogenLethalDelay)||Number(disease.lethalDelay)||null,
        triggerOwner:null
      };
    }
    return null;
  }

  function updateBanner(){
    const data=bannerData();
    if(!data)return;
    const banner=document.querySelector('#ecoEventBanner');
    if(!banner)return;

    const delay=data.delay?`${data.delay} rodada(s)`:'2–6 rodadas';
    const trigger=data.triggerOwner?`Gatilho: ${owners[data.triggerOwner].name} atingiu 17 peças`:'';
    const html=`<strong>${data.title}</strong><span>Mortalidade: ${data.disease.mortalityPercent}% · Desfecho: ${delay} · Contágio: ${data.mode} · Transmissão: ${data.remaining} rodada(s) restante(s)</span><small>${trigger}</small>`;
    banner.classList.add('active');
    if(banner.innerHTML!==html)banner.innerHTML=html;
  }

  function rewriteUi(){
    syncMortalityState();

    const legend=document.querySelector('#boardMutationLegend [data-pathogen-row] small');
    const legendText=`Peça infectada. Cada patógeno sorteia mortalidade entre ${MIN_MORTALITY}% e ${MAX_MORTALITY}% e mata infectados até atingir essa proporção. O surto transmite por até 10 rodadas.`;
    if(legend&&legend.textContent!==legendText)legend.textContent=legendText;

    for(const org of state?.organisms||[]){
      const kind=org.ecoSick?.managed?'eco':org.overpopSick?'overpop':null;
      if(!kind)continue;
      const record=registerInfection(org,kind);
      if(!record)continue;
      const cellEl=boardEl?.children?.[org.r*SIZE+org.c];
      const badge=cellEl?.querySelector?.('.org .pathogen-badge');
      if(!badge)continue;
      const remaining=Number.isInteger(record.inf.deathRemaining)?record.inf.deathRemaining:'?';
      const title=`Patógeno Virulento: desfecho em ${remaining} rodada(s). Mortalidade deste patógeno: ${record.disease.mortalityPercent}%.`;
      if(badge.title!==title)badge.title=title;
    }

    const body=document.querySelector('#pathogenInfoBody');
    if(body&&body.closest('.modal-backdrop')?.classList.contains('open')){
      const disease=currentDiseaseForModal();
      const paragraphs=[...body.querySelectorAll('p')];
      const target=paragraphs.find(p=>/surto.*rodadas|letalidade|mortalidade|Ao fim da 10ª rodada/i.test(p.textContent||''));
      if(target){
        const mortality=disease?`${disease.mortalityPercent}%`:`entre ${MIN_MORTALITY}% e ${MAX_MORTALITY}%`;
        const delay=disease?.lethalDelay?`${disease.lethalDelay} rodada(s)`:'2 a 6 rodadas';
        const text=`O surto pode transmitir por até 10 rodadas. Mortalidade: ${mortality}. O desfecho ocorre após ${delay} de infecção; o patógeno mata infectados até atingir a mortalidade sorteada, e os demais sobrevivem.`;
        if(target.textContent!==text)target.textContent=text;
      }
    }

    updateBanner();
  }

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const text=String(msg||'');
    if(!/sucumbiu ao Patógeno Virulento após/i.test(text)){
      return previousRemoveOrganism.apply(this,arguments);
    }

    syncMortalityState();
    const org=(state?.organisms||[]).find(o=>o.id===id);
    const record=recordForPathogenDeath(org);
    if(!org||!record)return previousRemoveOrganism.apply(this,arguments);

    const target=targetDeaths(record.disease);
    if(record.disease.mortalityDeaths>=target){
      markSurvivor(org,record);
      return false;
    }

    const result=previousRemoveOrganism.apply(this,arguments);
    if(!(state?.organisms||[]).some(o=>o.id===id))record.disease.mortalityDeaths++;
    return result;
  };

  const previousLog=log;
  log=function(message){
    syncMortalityState();
    let text=String(message??'');
    if(/Patógeno Virulento/i.test(text)){
      const data=bannerData();
      if(data){
        text=text.replace(
          /letalidade\s+\d+\s+rodada\(s\)/i,
          `mortalidade ${data.disease.mortalityPercent}%; desfecho após ${data.delay||data.disease.lethalDelay||'?'} rodada(s)`
        );
      }
    }
    return previousLog.call(this,text);
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    syncMortalityState();
    rewriteUi();
    return result;
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    syncMortalityState();
    const result=previousFinishTurn.apply(this,arguments);
    syncMortalityState();
    rewriteUi();
    return result;
  };

  const previousRender=render;
  render=function(){
    syncMortalityState();
    const result=previousRender.apply(this,arguments);
    syncMortalityState();
    rewriteUi();
    return result;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    rewriteUi();
    return result;
  };

  const observer=new MutationObserver(()=>rewriteUi());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  syncMortalityState();
  rewriteUi();
})();
