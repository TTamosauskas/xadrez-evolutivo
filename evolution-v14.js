(function(){
  const EARTHQUAKE={
    id:'earthquake',
    name:'Terremoto',
    desc:'Todas as peças são deslocadas aleatoriamente para casas adjacentes.'
  };

  function isEcoEventPool(a){
    return Array.isArray(a)&&a.length>=8&&a.every(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.desc==='string')&&a.some(x=>x.id==='volcano')&&a.some(x=>x.id==='pathogen');
  }

  const priorChoice=choice;
  choice=function(a){
    if(isEcoEventPool(a)){
      const options=[...a];
      if(state?.ecoCycle?.previousId!=='earthquake')options.push(EARTHQUAKE);
      return options[randInt(options.length)];
    }
    return priorChoice(a);
  };

  function pawnForwardCorridor(s,org){
    const dir=org.owner==='blue'?-1:1,out=[];
    for(let step=1;step<=2;step++){
      const r=org.r+dir*step,c=org.c;
      if(r>=0&&r<SIZE&&!s.organisms.some(o=>o.r===r&&o.c===c))out.push(s.board[r][c]);
    }
    return out;
  }

  function guaranteePawnFertile(s,org){
    const corridor=pawnForwardCorridor(s,org);
    if(!corridor.length||corridor.some(ce=>ce.terrain==='fertile'))return;
    const neutral=shuffle(corridor.filter(ce=>ce.terrain==='neutral'));
    const fallback=shuffle(corridor.filter(ce=>ce.terrain!=='neutral'));
    const ce=(neutral.length?neutral:fallback)[0];
    if(!ce)return;
    ce.terrain='fertile';ce.resource=1;ce.warning=null;ce.age=0;
  }

  function guaranteeOpeningFertile(s){
    if(!s?.board||!Array.isArray(s.organisms))return;
    for(const owner of ['blue','amber']){
      const founders=s.organisms.filter(o=>o.owner===owner);
      for(const org of founders)guaranteePawnFertile(s,org);
    }
  }

  const priorNewState=newState;
  newState=function(){
    const s=priorNewState();
    guaranteeOpeningFertile(s);
    return s;
  };

  function quakeCandidateKeys(org){
    const adjacent=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const r=org.r+dr,c=org.c;
      if(inBounds(r,c))adjacent.push(`${r},${c}`);
    }
    return [...shuffle(adjacent),`${org.r},${org.c}`];
  }

  function buildQuakeAssignment(){
    const orgs=shuffle([...state.organisms]);
    const byId=new Map(orgs.map(o=>[o.id,o]));
    const candidates=new Map(orgs.map(o=>[o.id,quakeCandidateKeys(o)]));
    const cellOwner=new Map();
    const assigned=new Map();

    function assign(org,seen){
      for(const k of candidates.get(org.id)||[]){
        if(seen.has(k))continue;
        seen.add(k);
        const otherId=cellOwner.get(k);
        if(otherId===undefined||assign(byId.get(otherId),seen)){
          cellOwner.set(k,org.id);
          assigned.set(org.id,k);
          return true;
        }
      }
      return false;
    }

    for(const org of orgs)assign(org,new Set());
    return assigned;
  }

  function applyEarthquake(ev){
    if(!ev||ev.id!=='earthquake'||ev.quakeApplied)return;
    ev.quakeApplied=true;
    const before=new Map(state.organisms.map(o=>[o.id,{r:o.r,c:o.c}]));
    const assigned=buildQuakeAssignment();
    let moved=0;
    for(const org of state.organisms){
      const k=assigned.get(org.id);if(!k)continue;
      const [r,c]=k.split(',').map(Number),old=before.get(org.id);
      org.r=r;org.c=c;if(old&&(old.r!==r||old.c!==c))moved++;
      markHabitat(org);
    }
    const doomed=[];
    for(const org of [...state.organisms]){
      if(cell(org.r,org.c).terrain==='biohazard'&&!hasTrait(org.owner,org.lineage,'Voo'))doomed.push(org.id);
    }
    doomed.forEach(id=>removeOrganism(id,'Uma peça foi lançada pelo Terremoto para uma casa mortal.',true));
    log(`Terremoto deslocou ${moved} peça(s) para casas adjacentes.`);
    checkExtinction();
    render();
  }

  const priorFinishTurn=finishTurn;
  finishTurn=function(){
    const result=priorFinishTurn.apply(this,arguments);
    if(state?.ecoCycle?.active?.id==='earthquake'&&!state.ecoCycle.active.quakeApplied&&!state.gameOver){
      applyEarthquake(state.ecoCycle.active);
    }
    return result;
  };

  if(state&&state.turn===0){guaranteeOpeningFertile(state);render()}

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao avançar sobre uma casa fértil, ela é consumida e a reprodução acontece automaticamente. Na abertura, cada peão fundador tem garantida pelo menos uma casa fértil em sua própria coluna de avanço, sorteada entre a primeira e a segunda casa à sua frente. Casas férteis evoluem por Conway e, se desaparecerem totalmente, um núcleo mínimo de três casas é reintroduzido.';
  const ecoRule=document.querySelector('#rulesModal .eco-events-rule');
  if(ecoRule)ecoRule.innerHTML='<strong>Eventos ecológicos.</strong> A cada 10 rodadas completas um evento é sorteado, anunciado em uma janela e aplicado. O evento anterior termina quando o próximo começa. Áreas perigosas temporárias funcionam como casas mortais; Voo oferece imunidade. Terremoto desloca simultaneamente todas as peças para casas adjacentes aleatórias.';
})();
