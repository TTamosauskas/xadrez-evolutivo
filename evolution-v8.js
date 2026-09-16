(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const EFFECT_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça'];

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function normalizeProfile(p){
    if(!p)return;
    p.pieceRank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    p.traits=(p.traits||[]).filter(t=>EFFECT_TRAITS.includes(t));
    p.mutationStack=(p.mutationStack||[]).filter(x=>!(x.kind==='trait'&&x.name==='Superespecialização'));
    p.mutations=(p.mutations||[]).filter(x=>x!=='Superespecialização');
  }
  function has(org,name){const p=profileOf(org);normalizeProfile(p);return !!p&&p.traits.includes(name)}
  function isMortal(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}

  function cloneProfile(parent,id){
    const src=profileOf(parent);normalizeProfile(src);
    const p={
      id,
      parent:parent.lineage,
      traits:[...src.traits],
      pieceRank:src.pieceRank,
      mutationStack:(src.mutationStack||[]).map(x=>({...x})),
      bornEpoch:state.epoch,
      mutations:[...(src.mutations||[])],
      nameCounter:0
    };
    state.lineages[parent.owner][id]=p;
    return p;
  }

  function mutationOptions(p){
    normalizeProfile(p);
    const out=[];
    if(p.pieceRank>0||p.pieceRank<5)out.push({kind:'piece'});
    for(const name of EFFECT_TRAITS)if(!p.traits.includes(name))out.push({kind:'trait',name});
    if(p.mutationStack.length)out.push({kind:'reversal'});
    return out;
  }
  function applyMutation(child){
    const p=profileOf(child);normalizeProfile(p);
    const options=mutationOptions(p);if(!options.length)return null;
    const m=choice(options);
    if(m.kind==='piece'){
      const dirs=[];if(p.pieceRank>0)dirs.push(-1);if(p.pieceRank<5)dirs.push(1);
      const delta=choice(dirs),from=PIECES[p.pieceRank];
      p.pieceRank=Math.max(0,Math.min(5,p.pieceRank+delta));
      p.mutationStack.push({kind:'piece',delta});p.mutations.push('Mutação de peça');
      return `Mutação de peça: ${from} → ${PIECES[p.pieceRank]}`;
    }
    if(m.kind==='reversal'){
      const x=p.mutationStack.pop();if(!x)return null;
      if(x.kind==='piece')p.pieceRank=Math.max(0,Math.min(5,p.pieceRank-x.delta));
      else p.traits=p.traits.filter(t=>t!==x.name);
      p.mutations.push('Reversão');
      return x.kind==='piece'?'Reversão removeu a última mudança de peça':`Reversão removeu ${x.name}`;
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
      if(isMortal(r,c)&&!has(parent,'Voo'))continue;
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
      const result=applyMutation(child);
      if(result)log(`${owners[child.owner].name}: ${result}.`);
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
    if(!has(org,'Voo')&&t.path&&t.path.some(([r,c])=>isMortal(r,c))){
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

  function profileKey(p){
    normalizeProfile(p);
    const stack=p.mutationStack.map(x=>x.kind==='piece'?`p:${x.delta}`:`t:${x.name}`).join('|');
    return `${p.pieceRank}::${[...p.traits].sort().join(',')}::${stack}`;
  }
  function livingSummary(owner){
    const orgs=playerOrganisms(owner),profiles=new Map();
    for(const o of orgs){const p=profileOf(o);if(!p)continue;normalizeProfile(p);const k=profileKey(p);if(!profiles.has(k))profiles.set(k,p)}
    let mutations=0;
    for(const p of profiles.values())mutations+=(p.mutationStack||[]).length;
    return {pieces:orgs.length,reproductions:state.reproCount[owner]||0,mutations,lineages:profiles.size};
  }
  renderPlayer=function(owner,el){
    const s=livingSummary(owner);
    el.innerHTML=`
      <div class="player-head compact-player-head"><div class="player-name ${owner}">${owners[owner].name}</div></div>
      <div class="player-summary-grid">
        <div class="player-summary-stat"><strong>${s.pieces}</strong><span>peças</span></div>
        <div class="player-summary-stat"><strong>${s.reproductions}</strong><span>reproduções</span></div>
        <div class="player-summary-stat"><strong>${s.mutations}</strong><span>mutações acumuladas</span></div>
        <div class="player-summary-stat"><strong>${s.lineages}</strong><span>linhagens vivas</span></div>
      </div>`;
  };
  renderPlayers=function(){renderPlayer('blue',$('#bluePanel'));renderPlayer('amber',$('#amberPanel'))};

  checkCollapse=function(){
    if(state?.collapse){state.collapse.blue=0;state.collapse.amber=0}
  };
  endByScore=function(){};
  endEpoch=function(){
    applyEpochHazards();if(state.gameOver)return;
    regenerateResources();
    state.epoch++;
    state.organisms.forEach(o=>{o.plasticity=null});
    Object.keys(state.activeEffects||{}).forEach(k=>{if(state.activeEffects[k]>0)state.activeEffects[k]--});
    resolvePendingEvents();if(state.gameOver)return;
    checkExtinction();if(state.gameOver)return;
    log(`Início da Época ${state.epoch}.`);
  };

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[0])rules[0].innerHTML='<strong>Objetivo.</strong> A partida termina apenas por extinção: vence o lado que eliminar todas as peças adversárias. Se as duas populações forem eliminadas simultaneamente, a partida termina empatada.';
  if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> Cada descendente herda todas as mutações do progenitor. Em 2/3 dos nascimentos ocorre apenas herança; em 1/3 ocorre uma nova mutação automática. Linhagens vivas correspondem a perfis evolutivos distintos ainda presentes no tabuleiro.';

  renderPlayers();
})();