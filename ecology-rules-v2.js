(function(){
  const HOSTILE_DEATH_CHANCE=.5;
  const CARAPACE_DEATH_CHANCE=.34;
  let captureContext=null;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function has(org,name){
    if(typeof window.xeProfileHasMutation==='function')return !!window.xeProfileHasMutation(org,name);
    const p=profileOf(org);return !!p?.traits?.includes(name);
  }
  function flies(org){return has(org,'Voo')}
  function resistant(org){return !!profileOf(org)?.resistance}
  function completedRound(){return Math.floor((state?.turn||0)/2)}
  function isHostileCell(org){return !!org&&inBounds(org.r,org.c)&&cell(org.r,org.c).terrain==='biohazard'}
  function hostileDeathChance(org){return has(org,'Carapaça')?CARAPACE_DEATH_CHANCE:HOSTILE_DEATH_CHANCE}

  const previousLog=log;
  log=function(message){
    let text=String(message??'');
    text=text.replace(/Erupção Vulcânica\. Uma área 2×2 adicional é marcada como perigosa\./i,'Erupção Vulcânica. Uma área 3×3 de 9 casas é marcada como perigosa.');
    return previousLog.call(this,text);
  };

  function infectionSnapshot(org){
    if(org?.ecoSick?.managed)return {kind:'eco',data:{...org.ecoSick}};
    if(org?.overpopSick)return {kind:'overpop',data:{...org.overpopSick}};
    return null;
  }
  function transferredInfectionData(source){
    const next={...source,infectedRound:completedRound()};
    const delay=Number(source?.diseaseDelay);
    if(Number.isInteger(delay)&&delay>=2&&delay<=6){
      next.diseaseDelay=delay;
      next.deathRemaining=delay;
      next.remaining=delay;
    }else{
      delete next.deathRemaining;
      if(Number(next.remaining)>6)delete next.remaining;
    }
    return next;
  }
  function transferPathogen(attacker,snapshot){
    if(!attacker||!snapshot||resistant(attacker)||attacker.ecoSick||attacker.overpopSick)return false;
    if(snapshot.kind==='eco')attacker.ecoSick={...transferredInfectionData(snapshot.data),managed:true};
    else attacker.overpopSick=transferredInfectionData(snapshot.data);
    log(`${owners[attacker.owner].name}: a peça que capturou uma peça infectada contraiu Patógeno Virulento 🤢.`);
    return true;
  }

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const victim=state?.organisms?.find(o=>o.id===id);
    const text=String(msg||'');

    if(victim&&/área perigosa do evento eliminou uma peça terrestre/i.test(text)&&isHostileCell(victim)&&!flies(victim)){
      return false;
    }

    if(captureContext&&captureContext.defenderId===id&&captureContext.infection){
      const attacker=state?.organisms?.find(o=>o.id===captureContext.attackerId);
      transferPathogen(attacker,captureContext.infection);
    }
    return previousRemoveOrganism.apply(this,arguments);
  };

  function pieceRank(org){return Math.max(0,Math.min(5,Number(profileOf(org)?.pieceRank)||0))}
  function straightPath(org,t){
    if(!org||!t||t.stay)return [];
    if(pieceRank(org)===1)return [[t.r,t.c]];
    const rr=t.r-org.r,cc=t.c-org.c,ar=Math.abs(rr),ac=Math.abs(cc);
    if(!(rr===0||cc===0||ar===ac))return [[t.r,t.c]];
    const steps=Math.max(ar,ac),dr=Math.sign(rr),dc=Math.sign(cc),out=[];
    for(let i=1;i<=steps;i++)out.push([org.r+dr*i,org.c+dc*i]);
    return out;
  }
  function traversalCells(org,t){
    if(!org||!t||t.stay)return [];
    if(pieceRank(org)===1)return [[t.r,t.c]];
    const source=Array.isArray(t.path)&&t.path.length?t.path:straightPath(org,t);
    const out=[],seen=new Set();
    for(const pos of source){
      if(!Array.isArray(pos)||pos.length<2)continue;
      const r=Number(pos[0]),c=Number(pos[1]);
      if(!Number.isInteger(r)||!Number.isInteger(c)||!inBounds(r,c)||(r===org.r&&c===org.c))continue;
      const k=`${r},${c}`;if(seen.has(k))continue;seen.add(k);out.push([r,c]);
    }
    const dk=`${t.r},${t.c}`;
    if(inBounds(t.r,t.c)&&!seen.has(dk))out.push([t.r,t.c]);
    return out;
  }
  function hostileTraversalDeath(org,t){
    if(!org||!t||flies(org))return false;
    const chance=hostileDeathChance(org),carapace=has(org,'Carapaça');
    for(const [r,c] of traversalCells(org,t)){
      if(cell(r,c).terrain!=='biohazard')continue;
      if(Math.random()>=chance)continue;
      const msg=carapace
        ?`Uma casa hostil eliminou a peça durante o deslocamento, apesar da Carapaça 🐢 (34% de risco por casa).`
        :`Uma casa hostil eliminou a peça durante o deslocamento (50% de risco por casa).`;
      removeOrganism(org.id,msg,true);
      checkExtinction();
      if(state.gameOver)render();else finishTurn();
      return true;
    }
    if(inBounds(t.r,t.c)&&cell(t.r,t.c).terrain==='biohazard'){
      // A entrada na casa de destino já foi testada. O próximo teste por permanência
      // só ocorre ao fim da rodada seguinte, não novamente no mesmo ciclo.
      org.hostileRiskRound=completedRound()+1;
    }
    return false;
  }

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    if(hostileTraversalDeath(org,t))return;

    const defender=org&&t?organismAt(t.r,t.c):null;
    const priorContext=captureContext;
    if(defender&&defender.owner!==org.owner){
      captureContext={attackerId:org.id,defenderId:defender.id,infection:infectionSnapshot(defender)};
    }else captureContext=null;

    let target=t;
    if(org&&t&&!flies(org)&&Array.isArray(t.path)&&t.path.some(([r,c])=>inBounds(r,c)&&cell(r,c).terrain==='biohazard')){
      // A rota já foi testada casa a casa acima. Esvazia o path apenas para impedir
      // a regra legada de morte automática (100%) de evolution-v16.
      target={...t,path:[]};
    }
    try{return previousExecuteMove.call(this,org,target)}finally{captureContext=priorContext}
  };

  function expandActiveVolcano(){
    const ev=state?.ecoCycle?.active;
    if(!ev||ev.id!=='volcano'||ev.volcanoNineCells)return false;
    const existing=(ev.hazardCells||[]).map(k=>String(k).split(',').map(Number)).filter(([r,c])=>Number.isInteger(r)&&Number.isInteger(c));
    if(!existing.length)return false;
    const minR=Math.min(...existing.map(x=>x[0])),minC=Math.min(...existing.map(x=>x[1]));
    const r0=Math.max(0,Math.min(SIZE-3,minR)),c0=Math.max(0,Math.min(SIZE-3,minC));
    ev.hazardCells=Array.isArray(ev.hazardCells)?ev.hazardCells:[];
    ev.snapshots=Array.isArray(ev.snapshots)?ev.snapshots:[];
    const known=new Set(ev.hazardCells);
    for(let r=r0;r<r0+3;r++)for(let c=c0;c<c0+3;c++){
      const k=`${r},${c}`,ce=cell(r,c);
      if(!known.has(k)){
        ev.hazardCells.push(k);
        ev.snapshots.push({r,c,terrain:ce.terrain,resource:ce.resource||0});
        known.add(k);
      }
      ce.terrain='biohazard';ce.resource=0;
    }
    ev.volcanoNineCells=true;
    ev.desc='Uma área 3×3 é marcada como perigosa.';
    log('Erupção Vulcânica: a zona perigosa ocupa 9 casas em uma área 3×3.');
    return true;
  }

  function rollHostileSurvival(){
    if(!state||state.gameOver)return 0;
    const round=completedRound(),doomed=[];
    for(const org of [...state.organisms]){
      if(!isHostileCell(org)||flies(org))continue;
      if(org.hostileRiskRound===round)continue;
      org.hostileRiskRound=round;
      const chance=hostileDeathChance(org);
      if(Math.random()<chance)doomed.push({id:org.id,carapace:has(org,'Carapaça')});
    }
    for(const entry of doomed){
      if(!state.organisms.some(o=>o.id===entry.id))continue;
      const msg=entry.carapace
        ?'Uma casa hostil eliminou a peça apesar da Carapaça 🐢 após o sorteio de 34% de risco desta rodada.'
        :'Uma casa hostil eliminou a peça após o sorteio de risco de 50% desta rodada.';
      previousRemoveOrganism.call(this,entry.id,msg,true);
    }
    if(doomed.length)checkExtinction();
    return doomed.length;
  }

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const before=state?.turn||0;
    const result=previousFinishTurn.apply(this,arguments);
    if(!state)return result;
    expandActiveVolcano();
    if(state.turn!==before&&state.turn%2===0&&!state.gameOver){
      const deaths=rollHostileSurvival();
      if(deaths&&!state.gameOver)render();
    }
    return result;
  };

  function rewriteUi(){
    const legend=[...document.querySelectorAll('.legend span')].find(el=>/casa mortal|casa hostil/i.test(el.textContent||''));
    if(legend&&legend.textContent.trim()!=='casa hostil · 50% de risco · Carapaça 🐢: 66% de sobrevivência'){
      const icon=legend.querySelector('i');legend.textContent=' casa hostil · 50% de risco · Carapaça 🐢: 66% de sobrevivência';if(icon)legend.prepend(icon);
    }

    const fresh=document.querySelector('#rulesModal .overpopulation-rule');
    let pathogenRule=document.querySelector('#rulesModal .population-pathogen-rule');
    if(fresh){
      if(pathogenRule&&pathogenRule!==fresh)pathogenRule.remove();
      fresh.classList.remove('overpopulation-rule');fresh.classList.add('population-pathogen-rule');pathogenRule=fresh;
    }
    if(pathogenRule){
      const html='<strong>Patógeno Virulento.</strong> O surto por população começa ao atingir 32 peças totais. Ele nasce na cor mais numerosa, na peça suscetível mais distante possível da cor menos numerosa. Capturar uma peça infectada transfere a mesma doença para a peça vencedora, exceto quando ela possui Resistência 🧬. A transmissão ambiental dura 10 rodadas; o prazo letal continua sendo o da doença.';
      if(pathogenRule.innerHTML!==html)pathogenRule.innerHTML=html;
    }

    const modal=document.querySelector('#rulesModal .modal');
    if(modal){
      let p=modal.querySelector('.hostile-risk-rule');
      if(!p){p=document.createElement('p');p.className='hostile-risk-rule';modal.insertBefore(p,modal.querySelector('.modal-actions'))}
      const html='<strong>Casas hostis.</strong> Cada casa hostil atravessada ou alcançada faz uma rolagem independente de risco: 50% de morte para peças terrestres e 34% com Carapaça 🐢. Cavalo salta as casas intermediárias e testa apenas a casa onde pousa. Voo 🐦 ignora esse risco. Uma peça que permanecer numa casa hostil faz novo sorteio a cada rodada. Erupção Vulcânica cria uma área hostil 3×3, totalizando 9 casas.';
      if(p.innerHTML!==html)p.innerHTML=html;
    }

    const ev=state?.ecoCycle?.active;
    if(ev?.id==='volcano'){
      const span=document.querySelector('#ecoEventBanner span');if(span)span.textContent='Uma área 3×3 de 9 casas está perigosa.';
    }
  }

  const previousRender=render;
  render=function(){
    expandActiveVolcano();
    const result=previousRender.apply(this,arguments);
    expandActiveVolcano();rewriteUi();
    return result;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){const result=previousRenderActions.apply(this,arguments);rewriteUi();return result};

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    for(const org of state?.organisms||[])if(!isHostileCell(org))delete org.hostileRiskRound;
    expandActiveVolcano();rewriteUi();
    return result;
  };

  expandActiveVolcano();rewriteUi();
})();