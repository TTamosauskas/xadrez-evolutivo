(function(){
  const rawPlayerOrganisms=playerOrganisms;
  const softBirthAllowance={blue:false,amber:false};
  const softBirthResetQueued={blue:false,amber:false};

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

    // Se o lote começou abaixo do limite, deixa o lote terminar inteiro.
    // A função de reprodução enxerga uma população abaixo de MAX_POP durante
    // esta chamada síncrona, mas todo o restante do jogo continua vendo o total real.
    if(softBirthAllowance[owner]&&list.length>=MAX_POP)return list.slice(0,Math.max(0,MAX_POP-1));
    return list;
  };

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function resistant(org){return !!profileOf(org)?.resistance}
  function signature(org){
    const p=profileOf(org)||{};
    return `${Number(p.pieceRank)||0}|${[...(p.traits||[])].sort().join(',')}|R${p.resistance?1:0}|S${p.sexual?1:0}`;
  }

  function ensureOverpopulationState(target=state){
    if(!target)return null;
    if(!target.overpopulationPathogen||typeof target.overpopulationPathogen!=='object'){
      target.overpopulationPathogen={
        blue:{active:false,blocked:false},
        amber:{active:false,blocked:false}
      };
    }
    for(const owner of ['blue','amber']){
      const current=target.overpopulationPathogen[owner];
      if(!current||typeof current!=='object')target.overpopulationPathogen[owner]={active:false,blocked:false};
      else{
        current.active=!!current.active;
        current.blocked=!!current.blocked;
      }
    }
    return target.overpopulationPathogen;
  }

  function susceptibleGroups(owner){
    const groups=new Map();
    for(const org of rawPlayerOrganisms(owner)){
      if(resistant(org)||org.ecoSick||org.overpopSick)continue;
      const key=signature(org);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(org);
    }
    return [...groups.values()];
  }

  function densestSusceptibleGroup(owner){
    const groups=susceptibleGroups(owner);
    if(!groups.length)return [];
    const top=Math.max(...groups.map(g=>g.length));
    return choice(groups.filter(g=>g.length===top));
  }

  function infectOverpopulation(org,sourceOwner){
    if(!org||resistant(org)||org.ecoSick||org.overpopSick)return false;
    org.overpopSick={remaining:4,sourceOwner};
    return true;
  }

  function refreshOutbreakFlags(){
    const outbreaks=ensureOverpopulationState();if(!outbreaks)return;
    for(const owner of ['blue','amber']){
      outbreaks[owner].active=state.organisms.some(o=>o.overpopSick?.sourceOwner===owner);
      if(rawPlayerOrganisms(owner).length<=MAX_POP)outbreaks[owner].blocked=false;
    }
  }

  function startOverpopulationOutbreak(owner){
    const outbreaks=ensureOverpopulationState();if(!outbreaks)return false;
    const population=rawPlayerOrganisms(owner).length;
    if(population<=MAX_POP){outbreaks[owner].blocked=false;return false}
    if(outbreaks[owner].active)return false;

    const group=densestSusceptibleGroup(owner);
    if(!group.length){
      if(!outbreaks[owner].blocked){
        outbreaks[owner].blocked=true;
        log(`${owners[owner].name}: superpopulação acima de ${MAX_POP}, mas nenhuma peça suscetível ao Patógeno Virulento.`);
      }
      return false;
    }

    let infected=0;
    for(const org of group)if(infectOverpopulation(org,owner))infected++;
    outbreaks[owner].active=infected>0;
    outbreaks[owner].blocked=false;
    if(infected){
      log(`${owners[owner].name}: superpopulação (${population}/${MAX_POP}) desencadeou Patógeno Virulento em ${infected} peça(s).`);
      return true;
    }
    return false;
  }

  function checkOverpopulationOutbreaks(){
    if(!state||state.gameOver)return;
    ensureOverpopulationState();
    refreshOutbreakFlags();
    for(const owner of ['blue','amber'])startOverpopulationOutbreak(owner);
  }

  function tickOverpopulationPathogen(){
    if(!state||state.gameOver)return;
    const existing=state.organisms.filter(o=>o.overpopSick);
    const newly=new Map();

    for(const org of existing){
      // Se o evento ecológico infectou a mesma peça, deixa o evento assumir
      // para não contar a doença duas vezes na mesma rodada.
      if(org.ecoSick){delete org.overpopSick;continue}
      if(resistant(org)){delete org.overpopSick;continue}
      const sourceOwner=org.overpopSick.sourceOwner||org.owner;
      for(const target of state.organisms){
        if(target.id===org.id||target.overpopSick||target.ecoSick||resistant(target))continue;
        if(Math.max(Math.abs(target.r-org.r),Math.abs(target.c-org.c))===1&&Math.random()<.5){
          if(!newly.has(target.id))newly.set(target.id,{target,sourceOwner});
        }
      }
    }

    for(const {target,sourceOwner} of newly.values())infectOverpopulation(target,sourceOwner);

    const doomed=[];
    for(const org of existing){
      if(!org.overpopSick)continue;
      org.overpopSick.remaining--;
      if(org.overpopSick.remaining<=0)doomed.push(org.id);
    }
    for(const id of doomed)removeOrganism(id,'Uma peça sucumbiu ao Patógeno Virulento causado por superpopulação.',true);
    if(doomed.length)checkExtinction();

    refreshOutbreakFlags();
    if(!state.gameOver)for(const owner of ['blue','amber'])startOverpopulationOutbreak(owner);
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
    return result;
  };

  const previousFinishTurn=finishTurn;
  finishTurn=function(...args){
    const before=state?.turn||0;
    const result=previousFinishTurn.apply(this,args);
    if(state&&!state.gameOver&&state.turn!==before&&state.turn%2===0)tickOverpopulationPathogen();
    return result;
  };

  const previousRender=render;
  render=function(){
    checkOverpopulationOutbreaks();
    return previousRender.apply(this,arguments);
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
        badge=document.createElement('span');
        badge.className='pathogen-badge';
        badge.textContent='🤢';
        orgEl.appendChild(badge);
      }
      badge.title=`Patógeno por superpopulação: ${org.overpopSick.remaining} rodada(s) até a morte`;
    }
  };

  function ensureOverpopulationRule(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let p=modal.querySelector('.overpopulation-rule');
    if(!p){
      p=document.createElement('p');p.className='overpopulation-rule';
      const actions=modal.querySelector('.modal-actions');modal.insertBefore(p,actions);
    }
    p.innerHTML=`<strong>Superpopulação.</strong> O limite de ${MAX_POP} peças é um limite ecológico. Se um lote começa abaixo desse valor, ele termina inteiro mesmo que ultrapasse o máximo. Ao ultrapassar, surge Patógeno Virulento 🤢: infectados morrem após 4 rodadas e podem contagiar peças adjacentes; Resistência 🧬 impede a infecção. Enquanto a população estiver no limite ou acima, novas reproduções ficam bloqueadas.`;
  }

  const previousRenderActions=renderActions;
  renderActions=function(){previousRenderActions();ensureOverpopulationRule()};

  ensureOverpopulationState(state);
  ensureOverpopulationRule();
  checkOverpopulationOutbreaks();
  render();
})();
