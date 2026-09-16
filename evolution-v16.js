(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const BIRTH_RATES=[4,3,2,2,1,1];
  const BASE_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça'];

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function normalizeProfile(p){
    if(!p)return;
    p.pieceRank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    p.traits=(p.traits||[]).filter(t=>BASE_TRAITS.includes(t));
    p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack.filter(x=>!(x.kind==='trait'&&x.name==='Superespecialização')):[];
    p.mutations=Array.isArray(p.mutations)?p.mutations.filter(x=>x!=='Superespecialização'):[];
    p.resistance=!!p.resistance;
  }
  function has(org,name){
    const p=profileOf(org);normalizeProfile(p);
    if(name==='Resistência')return !!p?.resistance;
    return !!p&&p.traits.includes(name);
  }
  function isMortal(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}
  function mutationChance(){return state?.ecoCycle?.active?.id==='solar'?1:(1/3)}

  function cloneProfile(parent,id){
    const src=profileOf(parent);normalizeProfile(src);
    const p={
      id,parent:parent.lineage,traits:[...src.traits],pieceRank:src.pieceRank,
      resistance:!!src.resistance,
      mutationStack:src.mutationStack.map(x=>({...x})),bornEpoch:state.epoch,
      mutations:[...src.mutations],nameCounter:0
    };
    state.lineages[parent.owner][id]=p;
    return p;
  }

  function gainOptions(p){
    normalizeProfile(p);const out=[];
    for(let rank=p.pieceRank+1;rank<=5;rank++)out.push({kind:'piece-up',to:rank});
    for(const name of BASE_TRAITS)if(!p.traits.includes(name))out.push({kind:'trait-gain',name});
    if(!p.resistance)out.push({kind:'resistance-gain'});
    return out;
  }
  function downgradeOptions(p){
    normalizeProfile(p);const out=[];
    if(p.pieceRank>0)out.push({kind:'piece-down',to:p.pieceRank-1});
    for(const name of p.traits)out.push({kind:'trait-loss',name});
    if(p.resistance)out.push({kind:'resistance-loss'});
    return out;
  }
  function applyMutation(child){
    const p=profileOf(child);normalizeProfile(p);
    let downgrade=Math.random()<(1/3),options=downgrade?downgradeOptions(p):gainOptions(p);
    if(!options.length){downgrade=!downgrade;options=downgrade?downgradeOptions(p):gainOptions(p)}
    if(!options.length)return null;
    const m=choice(options);
    if(m.kind==='piece-up'){
      const from=p.pieceRank,to=m.to;p.pieceRank=to;
      p.mutationStack.push({kind:'piece',from,to,direction:'up'});p.mutations.push('Mutação de peça');
      return `Mutação de peça: ${PIECES[from]} → ${PIECES[to]}`;
    }
    if(m.kind==='piece-down'){
      const from=p.pieceRank,to=m.to;p.pieceRank=to;
      p.mutationStack.push({kind:'piece-downgrade',from,to,direction:'down'});p.mutations.push('Downgrade de peça');
      return `Downgrade de peça: ${PIECES[from]} → ${PIECES[to]}`;
    }
    if(m.kind==='trait-gain'){
      p.traits.push(m.name);p.mutationStack.push({kind:'trait',name:m.name,direction:'up'});p.mutations.push(m.name);
      return `Nova especialidade: ${m.name}`;
    }
    if(m.kind==='trait-loss'){
      p.traits=p.traits.filter(t=>t!==m.name);p.mutationStack.push({kind:'trait-loss',name:m.name,direction:'down'});p.mutations.push(`Perda de ${m.name}`);
      return `Downgrade: perdeu ${m.name}`;
    }
    if(m.kind==='resistance-gain'){
      p.resistance=true;p.mutationStack.push({kind:'resistance',direction:'up'});p.mutations.push('Resistência');
      return 'Nova especialidade: Resistência';
    }
    p.resistance=false;p.mutationStack.push({kind:'resistance-loss',direction:'down'});p.mutations.push('Perda de Resistência');
    return 'Downgrade: perdeu Resistência';
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

  function birthTarget(parent){
    const p=profileOf(parent);normalizeProfile(p);
    const base=BIRTH_RATES[p?.pieceRank||0]||1;
    return has(parent,'Fertilidade')?base*2:base;
  }

  function makeChild(parent,r,c){
    const id=state.nextOrgId++,lineageId=`O${id}`;
    cloneProfile(parent,lineageId);
    const child={id,owner:parent.owner,lineage:lineageId,r,c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);

    // Cada descendente recebe sua própria rolagem independente de mutação.
    if(Math.random()<mutationChance()){
      const result=applyMutation(child);
      if(result)log(`${owners[child.owner].name}: ${result}.`);
    }else{
      log(`${owners[child.owner].name}: descendente herdou as mutações sem nova alteração.`);
    }
    return child;
  }

  function reproduce(parent,reason){
    if(playerOrganisms(parent.owner).length>=MAX_POP)return 0;
    const p=profileOf(parent);normalizeProfile(p);
    const intended=birthTarget(parent),cells=birthCells(parent);let born=0;
    while(born<intended&&cells.length&&playerOrganisms(parent.owner).length<MAX_POP){
      const t=cells.shift();makeChild(parent,t.r,t.c);born++;
    }
    if(born){
      state.reproCount[parent.owner]++;
      const type=PIECES[p?.pieceRank||0];
      log(`${owners[parent.owner].name}: ${type} gerou ${born} descendente(s) por ${reason}${born<intended?` (taxa ${intended}, limitada por espaço/população)`:''}.`);
    }
    return born;
  }

  rollMutation=function(){return Math.random()<mutationChance()};

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
    }else{
      org.r=t.r;org.c=t.c;markHabitat(org);
    }
    const predation=!!defender&&has(org,'Predação');
    if(fertile){destination.resource=0;destination.terrain='neutral'}
    if(fertile||predation){
      const reason=fertile&&predation?'casa fértil + predação':fertile?'casa fértil':'predação';
      reproduce(org,reason);
    }
    checkExtinction();if(state.gameOver){render();return}
    if(locomotion&&!second&&state.organisms.some(o=>o.id===org.id)){
      const next=movementTargets(org);
      if(next.length){state.moveChain={orgId:org.id};state.selected=org.id;state.mode='move';render();return}
    }
    finishTurn();
  };

  function applyBirthRuleText(){
    const rules=document.querySelectorAll('#rulesModal p');
    if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao entrar numa casa fértil, a peça gera descendentes semelhantes antes das mutações: Peão 4, Cavalo 3, Bispo 2, Torre 2, Rei 1 e Rainha 1. Fertilidade 🐇 dobra essa taxa. Predação 🦁 também pode disparar reprodução após uma captura, mas cada movimento gera no máximo um lote, mesmo se a captura ocorrer sobre uma casa fértil. O número efetivo ainda depende de casas livres próximas e do limite populacional. Cada novo descendente recebe sua própria rolagem independente de mutação.';
    if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> Cada descendente começa herdando o perfil do progenitor e depois faz sua própria rolagem de mutação. Em condições normais, cada recém-nascido tem 1/3 de chance de mutar; durante Tempestade Solar, 100%. Entre as mutações, 1/3 são downgrades e 2/3 ganhos. Resistência 🧬 torna a peça imune a novas infecções pelo Patógeno Virulento.';
  }

  const previousRenderActions=renderActions;
  renderActions=function(){previousRenderActions();applyBirthRuleText()};
  applyBirthRuleText();
})();
