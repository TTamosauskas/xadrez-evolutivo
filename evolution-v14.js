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

  function openingZoneCells(s,rows){
    const occupied=new Set((s.organisms||[]).map(o=>`${o.r},${o.c}`));
    const out=[];
    for(const r of rows)for(let c=0;c<SIZE;c++)if(!occupied.has(`${r},${c}`))out.push(s.board[r][c]);
    return out;
  }

  function guaranteeZoneFertile(s,rows,count=2){
    const cells=openingZoneCells(s,rows);
    const already=cells.filter(ce=>ce.terrain==='fertile');
    let needed=Math.max(0,count-already.length);
    if(!needed)return;
    const neutral=shuffle(cells.filter(ce=>ce.terrain==='neutral'));
    const fallback=shuffle(cells.filter(ce=>ce.terrain!=='fertile'&&ce.terrain!=='neutral'));
    for(const ce of [...neutral,...fallback]){
      if(!needed)break;
      ce.terrain='fertile';ce.resource=1;ce.warning=null;ce.age=0;needed--;
    }
  }

  function guaranteeOpeningFertile(s){
    if(!s?.board||!Array.isArray(s.organisms))return;
    guaranteeZoneFertile(s,[5,6],2);
    guaranteeZoneFertile(s,[1,2],2);
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
      const r=org.r+dr,c=org.c+dc;
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
  if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao avançar sobre uma casa fértil, ela é consumida e a reprodução acontece automaticamente. Na abertura, cada lado começa com pelo menos duas casas férteis distribuídas aleatoriamente nas duas fileiras à frente de seus peões. Casas férteis evoluem por Conway e, se desaparecerem totalmente, um núcleo mínimo de três casas é reintroduzido.';
  const ecoRule=document.querySelector('#rulesModal .eco-events-rule');
  if(ecoRule)ecoRule.innerHTML='<strong>Eventos ecológicos.</strong> A cada 10 rodadas completas um evento é sorteado, anunciado em uma janela e aplicado. O evento anterior termina quando o próximo começa. Áreas perigosas temporárias funcionam como casas mortais; Voo oferece imunidade. Terremoto desloca simultaneamente todas as peças para casas adjacentes aleatórias.';
})();
