(function(){
  const COLLECTOR='Coletor';
  const ICON='🐿';
  const STERILITY='Esterilidade';
  const LOCOMOTION='Locomoção';
  const DYSFUNCTIONAL='Mutação Disfuncional';
  const POSITIVE_KINDS=new Set(['piece-up','trait-gain','resistance-gain','sexual-gain']);
  const NEGATIVE_KINDS=new Set(['piece-down','trait-loss','resistance-loss','sexual-loss','sterility','deleterious']);
  let collectorSeedAttempt=null;
  let temporaryFertileCell=null;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function profileHasMutation(profile,name){
    if(!profile)return false;
    if(name===STERILITY&&profile.sterile)return true;
    let active=Array.isArray(profile.traits)&&profile.traits.includes(name);
    for(const entry of Array.isArray(profile.mutationStack)?profile.mutationStack:[]){
      if(entry?.name!==name)continue;
      if(entry.kind==='trait')active=true;
      else if(entry.kind==='trait-loss')active=false;
    }
    return active;
  }
  function hasMutation(org,name){
    const profile=profileOf(org);
    if(name===COLLECTOR||name===DYSFUNCTIONAL)return profileHasMutation(profile,name);
    if(name===STERILITY)return !!profile?.sterile;
    if(typeof window.xeProfileHasMutation==='function')return !!window.xeProfileHasMutation(org,name);
    return profileHasMutation(profile,name);
  }
  function seedCount(org){return Math.max(0,Math.floor(Number(org?.collectorSeeds)||0))}
  function setSeedCount(org,value){if(org)org.collectorSeeds=Math.max(0,Math.floor(Number(value)||0))}
  function isActiveFertile(r,c){
    if(!inBounds(r,c))return false;
    const ce=cell(r,c);return ce?.terrain==='fertile'&&Number(ce.resource)>0;
  }
  function roundNow(){return Math.floor((Number(state?.turn)||0)/2)+1}
  function dysfunctionalBlocked(org){
    if(!hasMutation(org,DYSFUNCTIONAL))return false;
    const last=Number(org?.dysfunctionalLastMoveRound);
    return Number.isFinite(last)&&roundNow()<=last+1;
  }
  function newestNewborn(){
    const orgs=state?.organisms||[];
    for(let i=orgs.length-1;i>=0;i--)if(orgs[i]?.newborn)return orgs[i];
    return null;
  }
  function isPool(a,kinds){return Array.isArray(a)&&a.length>0&&a.every(x=>x&&typeof x.kind==='string'&&kinds.has(x.kind))}

  const previousChoice=choice;
  choice=function(a){
    if(isPool(a,POSITIVE_KINDS)){
      const options=[...a],child=newestNewborn();
      if(child&&!hasMutation(child,COLLECTOR)&&!options.some(x=>x.kind==='trait-gain'&&x.name===COLLECTOR)){
        options.push({kind:'trait-gain',name:COLLECTOR,collectorInjected:true});
      }
      return previousChoice(options);
    }
    if(isPool(a,NEGATIVE_KINDS)){
      const options=[...a],child=newestNewborn();
      if(child&&hasMutation(child,COLLECTOR)&&!options.some(x=>x.kind==='trait-loss'&&x.name===COLLECTOR)){
        options.push({kind:'trait-loss',name:COLLECTOR,collectorLoss:true});
      }
      return previousChoice(options);
    }
    return previousChoice(a);
  };

  function resolveSexualInheritance(){
    if(!state?.lineages)return;
    for(const owner of ['blue','amber'])for(const p of Object.values(state.lineages[owner]||{})){
      if(!p?.mate||p.collectorSexualResolved)continue;
      if(profileHasMutation(p,COLLECTOR)){p.collectorSexualResolved=true;continue}
      const parent=state.lineages[owner]?.[p.parent],mate=state.lineages[owner]?.[p.mate];
      const a=profileHasMutation(parent,COLLECTOR),b=profileHasMutation(mate,COLLECTOR);
      const inherit=a&&b?true:(a||b?Math.random()<.5:false);
      if(inherit){
        p.traits=Array.isArray(p.traits)?p.traits:[];
        if(!p.traits.includes(COLLECTOR))p.traits.push(COLLECTOR);
        p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack:[];
        p.mutationStack.push({kind:'trait',name:COLLECTOR,direction:'up',inherited:true});
        p.mutations=Array.isArray(p.mutations)?p.mutations:[];
        if(!p.mutations.includes(COLLECTOR))p.mutations.push(COLLECTOR);
      }
      p.collectorSexualResolved=true;
    }
  }

  function fertileNeighborhood(r,c){
    const out=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const rr=r+dr,cc=c+dc;
      if(inBounds(rr,cc)&&isActiveFertile(rr,cc))out.push({r:rr,c:cc});
    }
    return out;
  }
  function harvestAt(org,r,c){
    if(!org||!hasMutation(org,COLLECTOR)||!isActiveFertile(r,c))return 0;
    const fertile=fertileNeighborhood(r,c);if(!fertile.length)return 0;
    for(const pos of fertile){
      const ce=cell(pos.r,pos.c);ce.terrain='neutral';ce.resource=0;
    }
    setSeedCount(org,seedCount(org)+fertile.length);
    log(`${owners[org.owner].name}: ${ICON} Coletor recolheu a fertilidade da região e passou a transportá-la.`);
    return fertile.length;
  }

  function restoreTemporaryFertileCell(){
    if(!temporaryFertileCell)return;
    const snap=temporaryFertileCell;temporaryFertileCell=null;
    if(!inBounds(snap.r,snap.c))return;
    const ce=cell(snap.r,snap.c);
    ce.terrain=snap.terrain;ce.resource=snap.resource;
  }
  function finalizeCollectorSeedAttempt(clearIfNoBirth=false){
    const attempt=collectorSeedAttempt;if(!attempt)return false;
    const current=Number(state?.reproCount?.[attempt.owner])||0;
    if(current>attempt.beforeReproCount){
      const org=state?.organisms?.find(o=>o.id===attempt.orgId);
      if(org)setSeedCount(org,seedCount(org)-1);
      collectorSeedAttempt=null;
      return true;
    }
    if(clearIfNoBirth)collectorSeedAttempt=null;
    return false;
  }

  const previousMovementTargets=movementTargets;
  movementTargets=function(org){
    let targets=previousMovementTargets.apply(this,arguments)||[];
    if(!org||!hasMutation(org,COLLECTOR))return targets;
    const ownStay=t=>t?.stay===true&&t.r===org.r&&t.c===org.c&&!t.dysfunctionalRest;
    if(hasMutation(org,STERILITY)||dysfunctionalBlocked(org)||org.collectorStationaryUsedTurn===state?.turn){
      return targets.filter(t=>!ownStay(t));
    }
    const canStay=seedCount(org)>0||isActiveFertile(org.r,org.c);
    if(canStay&&!targets.some(ownStay))targets.push({r:org.r,c:org.c,kind:'collector-stay',dist:0,capture:false,stay:true,collectorStay:true,path:[]});
    return targets;
  };

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    resolveSexualInheritance();
    if(!org||!hasMutation(org,COLLECTOR))return previousExecuteMove.apply(this,arguments);

    harvestAt(org,org.r,org.c);
    const staying=!!t&&t.stay===true&&t.r===org.r&&t.c===org.c;
    if(staying&&seedCount(org)>0&&!hasMutation(org,STERILITY)&&!dysfunctionalBlocked(org)&&org.collectorStationaryUsedTurn!==state?.turn){
      org.collectorStationaryUsedTurn=state?.turn;
      if(hasMutation(org,DYSFUNCTIONAL))org.dysfunctionalLastMoveRound=roundNow();
      collectorSeedAttempt={
        orgId:org.id,
        owner:org.owner,
        beforeReproCount:Number(state?.reproCount?.[org.owner])||0,
        turn:Number(state?.turn)||0
      };
      const ce=cell(org.r,org.c);
      temporaryFertileCell={r:org.r,c:org.c,terrain:ce.terrain,resource:ce.resource};
      ce.terrain='fertile';ce.resource=Math.max(1,Number(ce.resource)||0);
      let result;
      try{
        result=previousExecuteMove.call(this,org,{...t,stay:true,collectorStay:true,path:[]});
      }finally{
        restoreTemporaryFertileCell();
        finalizeCollectorSeedAttempt(false);
      }
      return result;
    }

    if(!staying&&t&&inBounds(t.r,t.c)&&isActiveFertile(t.r,t.c))harvestAt(org,t.r,t.c);
    return previousExecuteMove.apply(this,arguments);
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    finalizeCollectorSeedAttempt(true);
    restoreTemporaryFertileCell();
    return previousFinishTurn.apply(this,arguments);
  };

  function spreadSeeds(r,c,count){
    if(!Number.isFinite(count)||count<=0)return 0;
    const center={r,c},around=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=r+dr,cc=c+dc;if(inBounds(rr,cc))around.push({r:rr,c:cc});
    }
    const ordered=[center,...shuffle(around)],eligible=[];
    for(const pos of ordered){
      if(!inBounds(pos.r,pos.c))continue;
      const ce=cell(pos.r,pos.c);
      if(!ce||ce.terrain!=='neutral')continue;
      eligible.push(pos);
    }
    let planted=0;
    for(const pos of eligible){
      if(planted>=count)break;
      const ce=cell(pos.r,pos.c);ce.terrain='fertile';ce.resource=Math.max(1,Number(ce.resource)||0);planted++;
    }
    return planted;
  }

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const org=state?.organisms?.find(o=>o.id===id);
    const carried=org&&hasMutation(org,COLLECTOR)?seedCount(org):0;
    const death=org?{r:org.r,c:org.c,owner:org.owner}:null;
    const result=previousRemoveOrganism.apply(this,arguments);
    const removed=death&&!state?.organisms?.some(o=>o.id===id);
    if(removed&&carried>0){
      const planted=spreadSeeds(death.r,death.c,carried);
      if(planted>0)log(`${owners[death.owner].name}: ${ICON} as sementes do Coletor foram espalhadas no local da morte e ao redor.`);
      if(collectorSeedAttempt?.orgId===id)collectorSeedAttempt=null;
      restoreTemporaryFertileCell();
    }
    return result;
  };

  function ensureStyles(){
    if(document.querySelector('#collectorMutationStyles'))return;
    const style=document.createElement('style');style.id='collectorMutationStyles';
    style.textContent=`
      .cell.collector-carried-fertility.square-light,
      .cell.collector-carried-fertility.square-dark,
      .cell.collector-carried-fertility.terrain-biohazard{background:#4f9558!important}
    `;
    document.head.appendChild(style);
  }
  function renderCollectorBoard(){
    resolveSexualInheritance();
    for(const org of state?.organisms||[]){
      if(!hasMutation(org,COLLECTOR))continue;
      const cellEl=boardEl?.children?.[org.r*SIZE+org.c],orgEl=cellEl?.querySelector?.('.org');if(!orgEl)continue;
      let icons=orgEl.querySelector('.mutation-icons');
      if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}
      if(!icons.querySelector('[data-collector-icon]')){
        const icon=document.createElement('span');icon.className='mutation-icon';icon.dataset.collectorIcon='1';icon.title=COLLECTOR;icon.textContent=ICON;icons.appendChild(icon);
      }
      if(!orgEl.title.includes(COLLECTOR))orgEl.title+=`${orgEl.title?' · ':''}${COLLECTOR}`;
      if(seedCount(org)>0){
        cellEl.classList.add('collector-carried-fertility');
        if(!cellEl.title.includes('fertilidade transportada'))cellEl.title+=`${cellEl.title?' · ':''}fertilidade transportada pelo Coletor`;
      }
    }
  }

  function renderCollectorLegend(){
    const box=document.querySelector('#boardMutationLegend');if(!box)return;
    box.querySelector('[data-collector-row]')?.remove();
    const anyCollector=(state?.organisms||[]).some(o=>hasMutation(o,COLLECTOR));
    if(!anyCollector)return;
    box.querySelector('.board-mutation-empty')?.remove();
    box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-collector-row><span class="board-circle-icon">🐿</span><div><strong>Coletor</strong><small>Recolhe casas férteis adjacentes e transporta a fertilidade. Enquanto guarda sementes, sua casa fica verde e pode reproduzir permanecendo nela. Esterilidade impede apenas a reprodução; ao morrer, as sementes restantes são espalhadas.</small></div></div>');
  }

  function patchMutationModal(){
    const modal=document.querySelector('#explanationModal');if(!modal?.classList.contains('open'))return;
    const title=modal.querySelector('#explanationModalTitle'),body=modal.querySelector('#explanationModalBody');if(!title||!body)return;
    const combined=`${title.textContent||''} ${body.textContent||''}`;
    if(!/Coletor/i.test(combined))return;
    const lost=/perdeu|efeito perdido/i.test(body.textContent||'');
    const desiredTitle=`Mutação: ${COLLECTOR} ${ICON}`;
    const desiredBody=lost
      ?`<p>A peça perdeu ${COLLECTOR} ${ICON}.</p><p><strong>Efeito perdido:</strong> deixa de recolher e transportar fertilidade.</p>`
      :`<p>Esta peça recebeu ${COLLECTOR} ${ICON}.</p><p>Ao alcançar uma casa fértil, recolhe a fertilidade dela e das casas férteis adjacentes. Enquanto houver sementes armazenadas, sua casa fica verde e ela pode se reproduzir permanecendo parada. Esterilidade 🚫 bloqueia essa reprodução sem impedir o transporte. Ao morrer, as sementes restantes são espalhadas.</p>`;
    if(title.textContent!==desiredTitle)title.textContent=desiredTitle;
    if(body.innerHTML!==desiredBody)body.innerHTML=desiredBody;
  }

  const previousRenderBoard=renderBoard;
  renderBoard=function(){const result=previousRenderBoard.apply(this,arguments);renderCollectorBoard();return result};

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    renderCollectorLegend();patchMutationModal();
    const sel=typeof currentSelected==='function'?currentSelected():null;
    const hint=document.querySelector('#hint');
    if(sel&&hasMutation(sel,COLLECTOR)&&seedCount(sel)>0&&!hasMutation(sel,STERILITY)&&state?.mode==='move'&&hint&&!window.xeModalBlocking){
      if(!hint.textContent.includes('Coletor'))hint.textContent+=' 🐿 Coletor: você pode permanecer na casa atual para usar a fertilidade transportada.';
    }
    return result;
  };

  const previousRender=render;
  render=function(){
    restoreTemporaryFertileCell();
    finalizeCollectorSeedAttempt(false);
    resolveSexualInheritance();
    const result=previousRender.apply(this,arguments);
    renderCollectorBoard();renderCollectorLegend();patchMutationModal();
    return result;
  };

  const observer=new MutationObserver(()=>patchMutationModal());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  ensureStyles();resolveSexualInheritance();renderCollectorBoard();renderCollectorLegend();patchMutationModal();
})();
