(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const EFFECT_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça'];

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function normalizeProfile(p){
    if(!p)return;
    p.pieceRank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    p.traits=(p.traits||[]).filter(t=>EFFECT_TRAITS.includes(t));
    p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack.filter(x=>!(x.kind==='trait'&&x.name==='Superespecialização')):[];
    p.mutations=Array.isArray(p.mutations)?p.mutations.filter(x=>x!=='Superespecialização'):[];
  }
  function has(org,name){const p=profileOf(org);normalizeProfile(p);return !!p&&p.traits.includes(name)}
  function isTerrain(r,c,terrain){return inBounds(r,c)&&cell(r,c).terrain===terrain}

  function cloneProfile(parent,id){
    const src=profileOf(parent);normalizeProfile(src);
    const p={
      id,parent:parent.lineage,traits:[...src.traits],pieceRank:src.pieceRank,
      mutationStack:src.mutationStack.map(x=>({...x})),bornEpoch:state.epoch,
      mutations:[...src.mutations],nameCounter:0
    };
    state.lineages[parent.owner][id]=p;
    return p;
  }

  function mutationOptions(p){
    normalizeProfile(p);
    const out=[{kind:'piece'}];
    for(const name of EFFECT_TRAITS)if(!p.traits.includes(name))out.push({kind:'trait',name});
    if(p.mutationStack.length)out.push({kind:'reversal'});
    return out;
  }
  function applyMutation(child){
    const p=profileOf(child);normalizeProfile(p);
    const m=choice(mutationOptions(p));
    if(m.kind==='piece'){
      const from=p.pieceRank;
      const choices=[0,1,2,3,4,5].filter(rank=>rank!==from);
      const to=choice(choices);
      p.pieceRank=to;
      p.mutationStack.push({kind:'piece',from,to});
      p.mutations.push('Mutação de peça');
      return `Mutação de peça: ${PIECES[from]} → ${PIECES[to]}`;
    }
    if(m.kind==='reversal'){
      const x=p.mutationStack.pop();if(!x)return null;
      if(x.kind==='piece'){
        if(Number.isInteger(x.from))p.pieceRank=x.from;
        else p.pieceRank=Math.max(0,Math.min(5,p.pieceRank-(Number(x.delta)||0)));
      }else p.traits=p.traits.filter(t=>t!==x.name);
      p.mutations.push('Reversão');
      return x.kind==='piece'?'Reversão restaurou a forma de peça anterior':`Reversão removeu ${x.name}`;
    }
    p.traits.push(m.name);p.mutationStack.push({kind:'trait',name:m.name});p.mutations.push(m.name);
    return `Nova mutação: ${m.name}`;
  }

  function birthCells(parent){
    const range=has(parent,'Ovos')?2:1,out=[];
    for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
      if(!dr&&!dc)continue;
      const r=parent.r+dr,c=parent.c+dc;
      if(!inBounds(r,c)||organismAt(r,c))continue;
      if(isTerrain(r,c,'biohazard')&&!has(parent,'Voo'))continue;
      out.push({r,c});
    }
    return shuffle(out);
  }
  function makeChild(parent,r,c){
    const id=state.nextOrgId++,lineageId=`O${id}`;
    cloneProfile(parent,lineageId);
    const child={id,owner:parent.owner,lineage:lineageId,r,c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);
    if(Math.random()<(1/3)){
      const result=applyMutation(child);if(result)log(`${owners[child.owner].name}: ${result}.`);
    }else log(`${owners[child.owner].name}: descendente herdou as mutações sem nova alteração.`);
    return child;
  }
  function reproduce(parent,reason){
    if(playerOrganisms(parent.owner).length>=MAX_POP)return 0;
    const wanted=has(parent,'Fertilidade')?2:1,cells=birthCells(parent);let born=0;
    while(born<wanted&&cells.length&&playerOrganisms(parent.owner).length<MAX_POP){
      const t=cells.shift();makeChild(parent,t.r,t.c);born++;
    }
    if(born){state.reproCount[parent.owner]++;log(`${owners[parent.owner].name} gerou ${born} descendente(s) por ${reason}.`)}
    return born;
  }
  rollMutation=function(){return Math.random()<(1/3)};

  executeMove=function(org,t){
    const second=state.moveChain&&state.moveChain.orgId===org.id,locomotion=has(org,'Locomoção');
    if(!has(org,'Voo')&&t.path&&t.path.some(([r,c])=>isTerrain(r,c,'biohazard'))){
      removeOrganism(org.id,`${owners[org.owner].name} atravessou uma casa mortal e foi eliminado.`,true);
      checkExtinction();if(state.gameOver){render();return}finishTurn();return;
    }
    const destination=cell(t.r,t.c),fertile=destination.terrain==='fertile'&&destination.resource>0,defender=organismAt(t.r,t.c);
    if(defender){
      removeOrganism(defender.id,`${owners[defender.owner].name} perdeu uma peça em captura.`,true);
      org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} realizou uma captura.`);
    }else{org.r=t.r;org.c=t.c;markHabitat(org)}
    if(fertile){destination.resource=0;destination.terrain='neutral';reproduce(org,'casa fértil')}
    if(defender&&has(org,'Predação'))reproduce(org,'predação');
    checkExtinction();if(state.gameOver){render();return}
    if(locomotion&&!second&&state.organisms.some(o=>o.id===org.id)){
      const next=movementTargets(org);
      if(next.length){state.moveChain={orgId:org.id};state.selected=org.id;state.mode='move';render();return}
    }
    finishTurn();
  };

  function neighborCount(r,c,terrain){
    let n=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      if(isTerrain(r+dr,c+dc,terrain))n++;
    }
    return n;
  }
  function nextGeneration(terrain){
    const next=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const alive=isTerrain(r,c,terrain),n=neighborCount(r,c,terrain);
      next[r][c]=alive?(n===2||n===3):(n===3);
    }
    return next;
  }
  function terrainKeys(terrain){
    const set=new Set();
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(isTerrain(r,c,terrain))set.add(`${r},${c}`);
    return set;
  }
  function sameSet(a,b){if(a.size!==b.size)return false;for(const x of a)if(!b.has(x))return false;return true}
  function terrainCount(terrain){let n=0;for(const row of state.board)for(const ce of row)if(ce.terrain===terrain)n++;return n}

  function candidateClusters(){
    const clusters=[],shapes=[
      [[0,0],[1,0],[0,1]],[[0,0],[1,0],[0,-1]],
      [[0,0],[-1,0],[0,1]],[[0,0],[-1,0],[0,-1]]
    ];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)for(const shape of shapes){
      const coords=shape.map(([dr,dc])=>[r+dr,c+dc]);
      if(coords.every(([rr,cc])=>inBounds(rr,cc)&&!organismAt(rr,cc)))clusters.push(coords);
    }
    return clusters;
  }
  function seedCluster(terrain){
    const opposite=terrain==='fertile'?'biohazard':'fertile',clusters=candidateClusters();
    if(!clusters.length)return false;
    let bestScore=Infinity,best=[];
    for(const coords of clusters){
      let oppositeCount=0,nonNeutral=0;
      for(const [r,c] of coords){const t=cell(r,c).terrain;if(t===opposite)oppositeCount++;if(t!=='neutral')nonNeutral++}
      const score=oppositeCount*100+nonNeutral*10;
      if(score<bestScore){bestScore=score;best=[coords]}else if(score===bestScore)best.push(coords);
    }
    for(const [r,c] of choice(best)){
      const ce=cell(r,c);ce.terrain=terrain;ce.resource=terrain==='fertile'?1:0;ce.warning=null;ce.age=0;
    }
    return true;
  }
  function guaranteeEnvironmentalTypes(){
    if(terrainCount('fertile')===0)seedCluster('fertile');
    if(terrainCount('biohazard')===0)seedCluster('biohazard');
  }
  function pulseStillLife(terrain){
    const sources=[];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(isTerrain(r,c,terrain))sources.push([r,c]);
    const moves=[];
    for(const [r,c] of sources){
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;
        const rr=r+dr,cc=c+dc;
        if(inBounds(rr,cc)&&!organismAt(rr,cc)&&cell(rr,cc).terrain==='neutral')moves.push({from:[r,c],to:[rr,cc]});
      }
    }
    if(!moves.length){
      const neutral=[];
      for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(cell(r,c).terrain==='neutral'&&!organismAt(r,c))neutral.push([r,c]);
      if(!neutral.length||!sources.length)return false;
      moves.push({from:choice(sources),to:choice(neutral)});
    }
    const move=choice(moves),from=cell(move.from[0],move.from[1]),to=cell(move.to[0],move.to[1]);
    from.terrain='neutral';from.resource=0;
    to.terrain=terrain;to.resource=terrain==='fertile'?1:0;to.warning=null;to.age=0;
    log(terrain==='fertile'?'Still Life fértil sofreu um pulso ambiental.':'Still Life mortal sofreu um pulso ambiental.');
    return true;
  }
  function advanceDynamicConway(){
    const beforeFertile=terrainKeys('fertile'),beforeMortal=terrainKeys('biohazard');
    const nextFertile=nextGeneration('fertile'),nextMortal=nextGeneration('biohazard');
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c);
      if(nextFertile[r][c]){ce.terrain='fertile';ce.resource=1}
      else if(nextMortal[r][c]){ce.terrain='biohazard';ce.resource=0}
      else{ce.terrain='neutral';ce.resource=0}
      ce.warning=null;ce.age=0;
    }
    guaranteeEnvironmentalTypes();
    const afterFertile=terrainKeys('fertile'),afterMortal=terrainKeys('biohazard');
    if(beforeFertile.size&&sameSet(beforeFertile,afterFertile))pulseStillLife('fertile');
    if(beforeMortal.size&&sameSet(beforeMortal,afterMortal))pulseStillLife('biohazard');
    guaranteeEnvironmentalTypes();
    const doomed=[];
    for(const o of [...state.organisms])if(isTerrain(o.r,o.c,'biohazard')&&!has(o,'Voo'))doomed.push(o.id);
    doomed.forEach(id=>removeOrganism(id,'Uma casa mortal surgiu sob um organismo terrestre.',true));
    checkExtinction();
  }
  resolvePendingEvents=function(){advanceDynamicConway()};

  function profileSignature(p){normalizeProfile(p);return `${p.pieceRank}|${[...p.traits].sort().join(',')}`}
  function livingSummary(owner){
    const orgs=playerOrganisms(owner),profiles=new Map();
    for(const o of orgs){const p=profileOf(o);if(!p)continue;const key=profileSignature(p);if(!profiles.has(key))profiles.set(key,p)}
    let mutations=0;for(const p of profiles.values())mutations+=p.mutationStack.length;
    return {pieces:orgs.length,reproductions:state.reproCount[owner]||0,mutations,lineages:profiles.size};
  }
  function hasLegalMove(owner){return playerOrganisms(owner).some(o=>movementTargets(o).length>0)}
  function compareTechnical(a,b){
    for(const key of ['pieces','reproductions','mutations','lineages']){
      if(a[key]!==b[key])return {winner:a[key]>b[key]?'blue':'amber',criterion:key};
    }
    return {winner:null,criterion:null};
  }
  function technicalEnd(blockedOwner){
    const a=livingSummary('blue'),b=livingSummary('amber'),result=compareTechnical(a,b);
    state.gameOver=true;state.selected=null;state.moveChain=null;render();
    const labels={pieces:'número de peças',reproductions:'reproduções',mutations:'mutações acumuladas',lineages:'linhagens vivas'};
    $('#gameOverTitle').textContent=result.winner?`${owners[result.winner].name} vence por desempate técnico`:'Empate técnico';
    $('#gameOverBody').innerHTML=`
      <p>${owners[blockedOwner].name} ficou sem qualquer movimento legal.${result.winner?` O primeiro critério de desempate diferente foi <strong>${labels[result.criterion]}</strong>.`:' Os quatro critérios permaneceram iguais.'}</p>
      <table class="score-table"><thead><tr><th>Critério</th><th>Brancas</th><th>Pretas</th></tr></thead><tbody>
        <tr><td>Peças</td><td>${a.pieces}</td><td>${b.pieces}</td></tr>
        <tr><td>Reproduções</td><td>${a.reproductions}</td><td>${b.reproductions}</td></tr>
        <tr><td>Mutações acumuladas</td><td>${a.mutations}</td><td>${b.mutations}</td></tr>
        <tr><td>Linhagens vivas</td><td>${a.lineages}</td><td>${b.lineages}</td></tr>
      </tbody></table>`;
    $('#gameOverModal').classList.add('open');
  }

  finishTurn=function(){
    if(state.gameOver)return;
    state.moveChain=null;state.selected=null;state.mode='move';state.organisms.forEach(o=>o.newborn=false);
    checkExtinction();if(state.gameOver){render();return}
    state.turn++;state.current=opposing(state.current);
    if(state.turn%TURNS_PER_EPOCH===0)endEpoch();
    if(state.gameOver){render();return}
    if(!hasLegalMove(state.current)){technicalEnd(state.current);return}
    render();
  };

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[0])rules[0].innerHTML='<strong>Objetivo.</strong> A partida termina por extinção total. Se o jogador da vez não tiver nenhum movimento legal, ocorre desempate técnico por: peças, reproduções, mutações acumuladas e linhagens vivas, nessa ordem.';
  if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> Cada descendente herda todas as mutações do progenitor. Em 2/3 dos nascimentos ocorre apenas herança; em 1/3 ocorre uma nova mutação automática. A Mutação de peça escolhe aleatoriamente qualquer uma das outras cinco formas de xadrez.';
  if(rules[4])rules[4].innerHTML='<strong>Casas ambientais.</strong> Casas férteis e mortais evoluem por Conway a cada Época, com prioridade para a casa fértil em conflitos. Se uma cor desaparecer, um núcleo mínimo é recriado. Se uma cor entrar em Still Life, um pulso ambiental desloca uma de suas casas para quebrar a estabilidade.';
})();