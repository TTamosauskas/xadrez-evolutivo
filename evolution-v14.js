(function(){
  const EARTHQUAKE={
    id:'earthquake',
    name:'Terremoto',
    desc:'Todas as peças são deslocadas aleatoriamente para casas adjacentes.'
  };
  const ABUNDANT_RAINS={
    id:'abundant-rains',
    name:'Chuvas Abundantes',
    desc:'Um quadrante inteiro do tabuleiro se transforma em casas férteis.'
  };

  function isEcoEventPool(a){
    return Array.isArray(a)&&a.length>=8&&a.every(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&typeof x.desc==='string')&&a.some(x=>x.id==='volcano')&&a.some(x=>x.id==='pathogen');
  }

  const priorChoice=choice;
  choice=function(a){
    if(isEcoEventPool(a)){
      const options=[...a];
      if(state?.ecoCycle?.previousId!=='earthquake')options.push(EARTHQUAKE);
      if(state?.ecoCycle?.previousId!=='abundant-rains')options.push(ABUNDANT_RAINS);
      return options[randInt(options.length)];
    }
    return priorChoice(a);
  };

  function founderColumns(s){
    const cols=[...new Set((s.organisms||[]).map(o=>o.c))];
    return cols.sort((a,b)=>a-b).slice(0,2);
  }

  function clearOpeningCorridorFertile(s,cols){
    for(const c of cols){
      for(let r=1;r<=6;r++){
        const ce=s.board[r][c];
        if(ce.terrain==='fertile'){
          ce.terrain='neutral';ce.resource=0;ce.warning=null;ce.age=0;
        }
      }
    }
  }

  function pickFertileInHalf(s,c,rows){
    const occupied=new Set((s.organisms||[]).map(o=>`${o.r},${o.c}`));
    const candidates=shuffle(rows
      .filter(r=>!occupied.has(`${r},${c}`))
      .map(r=>s.board[r][c]));
    if(!candidates.length)return;
    const neutral=candidates.filter(ce=>ce.terrain==='neutral');
    const ce=(neutral.length?neutral:candidates)[0];
    ce.terrain='fertile';ce.resource=1;ce.warning=null;ce.age=0;
  }

  function guaranteeOpeningFertile(s){
    if(!s?.board||!Array.isArray(s.organisms))return;
    const cols=founderColumns(s);
    if(cols.length<2)return;
    clearOpeningCorridorFertile(s,cols);
    for(const c of cols){
      pickFertileInHalf(s,c,[1,2,3]);
      pickFertileInHalf(s,c,[4,5,6]);
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

  function quadrantCells(q){
    const out=[],r0=q<2?0:4,c0=q%2===0?0:4;
    for(let r=r0;r<r0+4;r++)for(let c=c0;c<c0+4;c++)out.push([r,c]);
    return out;
  }

  function applyAbundantRains(ev){
    if(!ev||ev.id!=='abundant-rains'||ev.rainsApplied)return;
    ev.rainsApplied=true;
    ev.quadrant=randInt(4);
    const coords=quadrantCells(ev.quadrant);
    for(const [r,c] of coords){
      const ce=cell(r,c);
      ce.terrain='fertile';
      ce.resource=1;
      ce.warning=null;
      ce.age=0;
    }
    const names=['superior esquerdo','superior direito','inferior esquerdo','inferior direito'];
    log(`Chuvas Abundantes tornaram férteis as 16 casas do quadrante ${names[ev.quadrant]}.`);
    render();
  }

  const priorFinishTurn=finishTurn;
  finishTurn=function(){
    const result=priorFinishTurn.apply(this,arguments);
    const ev=state?.ecoCycle?.active;
    if(ev?.id==='earthquake'&&!ev.quakeApplied&&!state.gameOver)applyEarthquake(ev);
    if(ev?.id==='abundant-rains'&&!ev.rainsApplied&&!state.gameOver)applyAbundantRains(ev);
    return result;
  };

  if(state&&state.turn===0){guaranteeOpeningFertile(state);render()}

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao avançar sobre uma casa fértil, ela é consumida e a reprodução acontece automaticamente. Na abertura, as duas colunas dos peões fundadores recebem quatro casas férteis: duas por coluna, com uma sorteada na metade superior e outra na metade inferior do tabuleiro. Assim, cada peão tem duas casas férteis no próprio corredor de avanço, com variação de altura entre partidas. Casas férteis evoluem por Conway e, se desaparecerem totalmente, um núcleo mínimo de três casas é reintroduzido.';
  const ecoRule=document.querySelector('#rulesModal .eco-events-rule');
  if(ecoRule)ecoRule.innerHTML='<strong>Eventos ecológicos.</strong> A cada 10 rodadas completas um evento é sorteado, anunciado em uma janela e aplicado. O evento anterior termina quando o próximo começa. Áreas perigosas temporárias funcionam como casas mortais; Voo oferece imunidade. Terremoto desloca simultaneamente todas as peças para casas adjacentes aleatórias. Chuvas Abundantes transforma as 16 casas de um quadrante aleatório em casas férteis.';
})();
