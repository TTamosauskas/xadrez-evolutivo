(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const BIRTH_RATES=[4,3,2,2,1,1];
  const BASE_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça','Ooteca','Veneno'];
  const PASSIVE_TRAITS=['Ooteca','Veneno'];
  const SEXUAL_TRAIT='Reprodução Sexuada';
  const STERILITY_TRAIT='Esterilidade';
  let sexualPending=null;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function normalizeProfile(p){
    if(!p)return;
    p.pieceRank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    p.traits=(p.traits||[]).filter(t=>BASE_TRAITS.includes(t));
    p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack.filter(x=>!(x.kind==='trait'&&x.name==='Superespecialização')):[];
    for(const name of PASSIVE_TRAITS){
      let active=p.traits.includes(name);
      for(const entry of p.mutationStack){
        if(entry?.name!==name)continue;
        if(entry.kind==='trait')active=true;
        else if(entry.kind==='trait-loss')active=false;
      }
      if(active&&!p.traits.includes(name))p.traits.push(name);
      if(!active&&p.traits.includes(name))p.traits=p.traits.filter(t=>t!==name);
    }
    p.mutations=Array.isArray(p.mutations)?p.mutations.filter(x=>x!=='Superespecialização'):[];
    p.resistance=!!p.resistance;
    p.sexual=!!p.sexual;
    p.sterile=!!p.sterile;
  }
  function has(org,name){
    const p=profileOf(org);normalizeProfile(p);
    if(name==='Resistência')return !!p?.resistance;
    if(name===SEXUAL_TRAIT)return !!p?.sexual;
    if(name===STERILITY_TRAIT)return !!p?.sterile;
    return !!p&&p.traits.includes(name);
  }
  function isMortal(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}
  function mutationChance(){return state?.ecoCycle?.active?.id==='solar'?1:(1/3)}
  function isSinglePlayer(){return localStorage.getItem('xe_game_mode')==='single'}

  function cloneProfile(parent,id){
    const src=profileOf(parent);normalizeProfile(src);
    const p={
      id,parent:parent.lineage,traits:[...src.traits],pieceRank:src.pieceRank,
      resistance:!!src.resistance,sexual:!!src.sexual,sterile:!!src.sterile,
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
    if(!p.sexual)out.push({kind:'sexual-gain'});
    return out;
  }
  function downgradeOptions(p){
    normalizeProfile(p);const out=[];
    if(p.pieceRank===0)return out;
    out.push({kind:'piece-down',to:p.pieceRank-1});
    for(const name of p.traits)out.push({kind:'trait-loss',name});
    if(p.resistance)out.push({kind:'resistance-loss'});
    if(p.sexual)out.push({kind:'sexual-loss'});
    if(!p.sterile)out.push({kind:'sterility'});
    return out;
  }
  function applyChosenMutation(p,m){
    if(m.kind==='piece-up'){
      const from=p.pieceRank,to=m.to;p.pieceRank=to;
      p.mutationStack.push({kind:'piece',from,to,direction:'up'});p.mutations.push('Mutação de peça');
      return `Mutação de peça: ${PIECES[from]} → ${PIECES[to]}`;
    }
    if(m.kind==='piece-down'){
      const from=p.pieceRank,to=m.to;p.pieceRank=to;
      p.mutationStack.push({kind:'piece-downgrade',from,to,direction:'down'});p.mutations.push('Mutação de peça');
      return `Mutação de peça: ${PIECES[from]} → ${PIECES[to]}`;
    }
    if(m.kind==='trait-gain'){
      p.traits.push(m.name);p.mutationStack.push({kind:'trait',name:m.name,direction:'up'});p.mutations.push(m.name);
      return `Nova especialidade: ${m.name}`;
    }
    if(m.kind==='trait-loss'){
      p.traits=p.traits.filter(t=>t!==m.name);p.mutationStack.push({kind:'trait-loss',name:m.name,direction:'down'});p.mutations.push(`Perda de ${m.name}`);
      return `Mutação: perdeu ${m.name}`;
    }
    if(m.kind==='resistance-gain'){
      p.resistance=true;p.mutationStack.push({kind:'resistance',direction:'up'});p.mutations.push('Resistência');
      return 'Nova especialidade: Resistência';
    }
    if(m.kind==='resistance-loss'){
      p.resistance=false;p.mutationStack.push({kind:'resistance-loss',direction:'down'});p.mutations.push('Perda de Resistência');
      return 'Mutação: perdeu Resistência';
    }
    if(m.kind==='sexual-gain'){
      p.sexual=true;p.mutationStack.push({kind:'sexual',direction:'up'});p.mutations.push(SEXUAL_TRAIT);
      return `Nova especialidade: ${SEXUAL_TRAIT}`;
    }
    if(m.kind==='sexual-loss'){
      p.sexual=false;p.mutationStack.push({kind:'sexual-loss',direction:'down'});p.mutations.push(`Perda de ${SEXUAL_TRAIT}`);
      return `Mutação: perdeu ${SEXUAL_TRAIT}`;
    }
    if(m.kind==='sterility'){
      p.sterile=true;p.mutationStack.push({kind:'sterility',direction:'down'});p.mutations.push(STERILITY_TRAIT);
      return `Mutação: ${STERILITY_TRAIT}`;
    }
    return null;
  }
  function applyMutation(child){
    const p=profileOf(child);normalizeProfile(p);
    let negative=p.pieceRank>0&&Math.random()<(1/3),options=negative?downgradeOptions(p):gainOptions(p);
    if(!options.length){negative=!negative;options=negative?downgradeOptions(p):gainOptions(p)}
    if(!options.length)return null;
    return applyChosenMutation(p,choice(options));
  }
  function applyGainMutation(child){
    const p=profileOf(child);normalizeProfile(p);
    const options=gainOptions(p);if(!options.length)return null;
    return applyChosenMutation(p,choice(options));
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
    if(Math.random()<mutationChance()){
      const result=applyMutation(child);
      if(result)log(`${owners[child.owner].name}: ${result}.`);
    }else log(`${owners[child.owner].name}: descendente herdou as mutações sem nova alteração.`);
    return child;
  }
  function reproduce(parent,reason){
    if(has(parent,STERILITY_TRAIT)){
      log(`${owners[parent.owner].name}: 🚫 ${STERILITY_TRAIT} impediu a reprodução por ${reason}.`);
      return 0;
    }
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

  function specializationPool(p){
    normalizeProfile(p);const out=[...p.traits];
    if(p.resistance)out.push('Resistência');
    if(p.sexual)out.push(SEXUAL_TRAIT);
    return [...new Set(out)];
  }
  function sample(items,count){return shuffle([...items]).slice(0,Math.min(count,items.length))}
  function mixedSpecializations(a,b){
    const pa=specializationPool(a),pb=specializationPool(b);
    const union=[...new Set([...pa,...pb])];
    const target=Math.min(union.length,Math.round((pa.length+pb.length)/2));
    if(!target)return [];
    let takeA=Math.floor(target/2),takeB=target-takeA;
    if(target%2&&Math.random()<.5){const x=takeA;takeA=takeB;takeB=x}
    takeA=Math.min(takeA,pa.length);takeB=Math.min(takeB,pb.length);
    while(takeA+takeB<target){
      if(takeA<pa.length&&(takeB>=pb.length||Math.random()<.5))takeA++;
      else if(takeB<pb.length)takeB++;
      else break;
    }
    let chosen=[...new Set([...sample(pa,takeA),...sample(pb,takeB)])];
    const remaining=shuffle(union.filter(x=>!chosen.includes(x)));
    while(chosen.length<target&&remaining.length)chosen.push(remaining.shift());
    return chosen;
  }
  function sexualBlueprint(parent,mate){
    const a=profileOf(parent),b=profileOf(mate);normalizeProfile(a);normalizeProfile(b);
    const specs=mixedSpecializations(a,b),pieceRank=Math.max(a.pieceRank,b.pieceRank);
    const traits=specs.filter(x=>BASE_TRAITS.includes(x));
    const resistance=specs.includes('Resistência'),sexual=specs.includes(SEXUAL_TRAIT);
    const mutationStack=[];
    if(pieceRank>0)mutationStack.push({kind:'piece',from:0,to:pieceRank,direction:'up',inherited:true});
    for(const name of traits)mutationStack.push({kind:'trait',name,direction:'up',inherited:true});
    if(resistance)mutationStack.push({kind:'resistance',direction:'up',inherited:true});
    if(sexual)mutationStack.push({kind:'sexual',direction:'up',inherited:true});
    const mutations=[];
    if(pieceRank>0)mutations.push('Mutação de peça');
    mutations.push(...traits);
    if(resistance)mutations.push('Resistência');
    if(sexual)mutations.push(SEXUAL_TRAIT);
    return {pieceRank,traits,resistance,sexual,mutationStack,mutations};
  }
  function sexualBirthCells(parent,blueprint){
    const range=blueprint.traits.includes('Ovos')?2:1,out=[];
    for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
      if(!dr&&!dc)continue;
      const r=parent.r+dr,c=parent.c+dc;
      if(!inBounds(r,c)||organismAt(r,c))continue;
      if(isMortal(r,c)&&!blueprint.traits.includes('Voo'))continue;
      out.push({r,c});
    }
    return shuffle(out);
  }
  function sexualBirthTarget(blueprint){
    const base=BIRTH_RATES[blueprint.pieceRank]||1;
    return blueprint.traits.includes('Fertilidade')?base*2:base;
  }
  function createSexualProfile(parent,mate,blueprint,id){
    const p={
      id,parent:parent.lineage,mate:mate.lineage,traits:[...blueprint.traits],pieceRank:blueprint.pieceRank,
      resistance:!!blueprint.resistance,sexual:!!blueprint.sexual,sterile:false,
      mutationStack:blueprint.mutationStack.map(x=>({...x})),bornEpoch:state.epoch,
      mutations:[...blueprint.mutations],nameCounter:0
    };
    state.lineages[parent.owner][id]=p;return p;
  }
  function makeSexualChild(parent,mate,blueprint,r,c){
    const id=state.nextOrgId++,lineageId=`O${id}`;
    createSexualProfile(parent,mate,blueprint,lineageId);
    const child={id,owner:parent.owner,lineage:lineageId,r,c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);
    if(Math.random()<mutationChance()){
      const result=applyGainMutation(child);
      if(result)log(`${owners[child.owner].name}: ❤️ ${result}.`);
      else log(`${owners[child.owner].name}: ❤️ recombinação sem ganho adicional.`);
    }else log(`${owners[child.owner].name}: ❤️ descendente recombinado sem nova mutação.`);
    return child;
  }
  function reproduceSexually(parent,mate,reason){
    if(has(parent,STERILITY_TRAIT)||has(mate,STERILITY_TRAIT)){
      log(`${owners[parent.owner].name}: 🚫 ${STERILITY_TRAIT} impediu a reprodução sexuada.`);
      return 0;
    }
    if(playerOrganisms(parent.owner).length>=MAX_POP)return 0;
    const blueprint=sexualBlueprint(parent,mate),intended=sexualBirthTarget(blueprint),cells=sexualBirthCells(parent,blueprint);let born=0;
    while(born<intended&&cells.length&&playerOrganisms(parent.owner).length<MAX_POP){
      const t=cells.shift();makeSexualChild(parent,mate,blueprint,t.r,t.c);born++;
    }
    if(born){
      state.reproCount[parent.owner]++;
      log(`${owners[parent.owner].name}: ❤️ reprodução sexuada entre ${PIECES[profileOf(parent).pieceRank]} e ${PIECES[profileOf(mate).pieceRank]} gerou ${born} descendente(s) com base ${PIECES[blueprint.pieceRank]}${born<intended?` (taxa ${intended}, limitada por espaço/população)`:''}.`);
    }
    return born;
  }

  function adjacentAllies(org){
    return state.organisms.filter(o=>o.id!==org.id&&o.owner===org.owner&&!has(o,STERILITY_TRAIT)&&Math.max(Math.abs(o.r-org.r),Math.abs(o.c-org.c))===1);
  }
  function validPending(){
    if(!sexualPending||!state||state.gameOver)return null;
    const parent=state.organisms.find(o=>o.id===sexualPending.orgId);
    if(!parent||parent.owner!==state.current){sexualPending=null;return null}
    return {pending:sexualPending,parent};
  }
  function mateScore(mate){
    const p=profileOf(mate);normalizeProfile(p);
    return p.pieceRank*30+p.traits.length*6+(p.resistance?5:0)+(p.sexual?4:0)+(p.traits.includes('Fertilidade')?8:0);
  }
  function continueAfterMove(org,second,locomotion){
    checkExtinction();if(state.gameOver){render();return}
    if(locomotion&&!second&&state.organisms.some(o=>o.id===org.id)){
      const next=movementTargets(org);
      if(next.length){state.moveChain={orgId:org.id};state.selected=org.id;state.mode='move';render();return}
    }
    finishTurn();
  }
  function completeSexualReproduction(mate){
    const ctx=validPending();if(!ctx)return;
    const {pending,parent}=ctx;
    if(!pending.partnerIds.includes(mate?.id)||mate.owner!==parent.owner||has(parent,STERILITY_TRAIT)||has(mate,STERILITY_TRAIT)||Math.max(Math.abs(mate.r-parent.r),Math.abs(mate.c-parent.c))!==1){
      flashHint('Escolha uma das peças aliadas férteis marcadas com ❤️.');return;
    }
    const ce=cell(pending.fertileR,pending.fertileC);
    if(ce.terrain==='fertile'&&ce.resource>0){ce.resource=0;ce.terrain='neutral'}
    const reason=pending.predation?'casa fértil + predação + reprodução sexuada':'casa fértil + reprodução sexuada';
    sexualPending=null;
    reproduceSexually(parent,mate,reason);
    continueAfterMove(parent,pending.second,pending.locomotion);
  }
  function beginSexualSelection(org,mates,context){
    sexualPending={
      orgId:org.id,partnerIds:mates.map(o=>o.id),fertileR:org.r,fertileC:org.c,
      second:context.second,locomotion:context.locomotion,predation:context.predation
    };
    state.selected=org.id;state.mode='move';render();
    if(isSinglePlayer()&&org.owner==='amber'){
      setTimeout(()=>{
        const ctx=validPending();if(!ctx||!isSinglePlayer()||ctx.parent.owner!=='amber')return;
        const candidates=ctx.pending.partnerIds.map(id=>state.organisms.find(o=>o.id===id)).filter(o=>o&&!has(o,STERILITY_TRAIT));
        if(!candidates.length){sexualPending=null;render();continueAfterMove(ctx.parent,ctx.pending.second,ctx.pending.locomotion);return}
        const best=Math.max(...candidates.map(mateScore));
        completeSexualReproduction(choice(candidates.filter(m=>mateScore(m)===best)));
      },420);
    }
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
    const mates=fertile&&!has(org,STERILITY_TRAIT)&&has(org,SEXUAL_TRAIT)&&playerOrganisms(org.owner).length<MAX_POP?adjacentAllies(org):[];
    if(mates.length){
      beginSexualSelection(org,mates,{second,locomotion,predation});
      return;
    }
    if(fertile){destination.resource=0;destination.terrain='neutral'}
    if(fertile||predation){
      const reason=fertile&&predation?'casa fértil + predação':fertile?'casa fértil':'predação';
      reproduce(org,reason);
    }
    continueAfterMove(org,second,locomotion);
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(r,c){
    const ctx=validPending();
    if(ctx){
      if(isSinglePlayer()&&ctx.parent.owner==='amber')return;
      const mate=organismAt(r,c);
      if(mate&&ctx.pending.partnerIds.includes(mate.id)){completeSexualReproduction(mate);return}
      flashHint('Escolha uma das peças aliadas marcadas com ❤️.');return;
    }
    return previousHandleCellClick(r,c);
  };

  const previousRenderBoard=renderBoard;
  renderBoard=function(){
    previousRenderBoard();
    for(const o of state.organisms){
      const p=profileOf(o);normalizeProfile(p);if(!p?.sexual&&!p?.sterile)continue;
      const cellEl=boardEl.children[o.r*SIZE+o.c],orgEl=cellEl?.querySelector('.org');if(!orgEl)continue;
      let icons=orgEl.querySelector('.mutation-icons');if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}
      if(p.sexual&&!icons.querySelector('[data-sexual-icon]')){const heart=document.createElement('span');heart.className='mutation-icon';heart.dataset.sexualIcon='1';heart.title=SEXUAL_TRAIT;heart.textContent='❤️';icons.appendChild(heart)}
      if(p.sterile&&!icons.querySelector('[data-sterility-icon]')){const sterile=document.createElement('span');sterile.className='mutation-icon';sterile.dataset.sterilityIcon='1';sterile.title=STERILITY_TRAIT;sterile.textContent='🚫';icons.appendChild(sterile)}
      if(p.sexual&&!orgEl.title.includes(SEXUAL_TRAIT))orgEl.title+=`${orgEl.title?' · ':''}${SEXUAL_TRAIT}`;
      if(p.sterile&&!orgEl.title.includes(STERILITY_TRAIT))orgEl.title+=`${orgEl.title?' · ':''}${STERILITY_TRAIT}`;
    }
    const ctx=validPending();if(!ctx)return;
    for(const id of ctx.pending.partnerIds){
      const mate=state.organisms.find(o=>o.id===id);if(!mate)continue;
      const cellEl=boardEl.children[mate.r*SIZE+mate.c];if(!cellEl)continue;
      cellEl.classList.add('sexual-partner');
      const heart=document.createElement('span');heart.className='sexual-partner-heart';heart.textContent='❤️';heart.title='Parceiro para reprodução sexuada';cellEl.appendChild(heart);
    }
  };

  const previousRenderPlayer=renderPlayer;
  renderPlayer=function(owner,el){
    previousRenderPlayer(owner,el);
    const profiles=new Map();
    for(const o of playerOrganisms(owner)){
      const p=profileOf(o);normalizeProfile(p);if(!p)continue;
      const sig=`${p.pieceRank}|${[...p.traits].sort().join(',')}|R${p.resistance?1:0}|S${p.sexual?1:0}|X${p.sterile?1:0}`;
      if(!profiles.has(sig))profiles.set(sig,p);
    }
    let mutations=0;for(const p of profiles.values())mutations+=p.mutationStack.length;
    const stats=el.querySelectorAll('.player-summary-stat strong');
    if(stats[2])stats[2].textContent=mutations;if(stats[3])stats[3].textContent=profiles.size;
  };

  function applyBirthRuleText(){
    const rules=document.querySelectorAll('#rulesModal p');
    if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao entrar numa casa fértil, a peça gera descendentes semelhantes antes das mutações: Peão 4, Cavalo 3, Bispo 2, Torre 2, Rei 1 e Rainha 1. Fertilidade 🐇 dobra essa taxa. Predação 🦁 também pode disparar reprodução após uma captura, mas cada movimento gera no máximo um lote. Com Reprodução Sexuada ❤️, uma peça em casa fértil com aliados adjacentes escolhe um parceiro não estéril marcado em roxo antes do nascimento; o descendente usa a peça de maior valor como base e combina aproximadamente metade das especializações de cada progenitor. Esterilidade 🚫 impede a peça de gerar descendentes, mas uma casa fértil ainda é consumida quando ela entra nela.';
    if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> Cada descendente assexuado começa herdando o perfil do progenitor e depois faz sua própria rolagem de mutação. Em condições normais, cada recém-nascido tem 1/3 de chance de mutar; durante Tempestade Solar, 100%. Na reprodução comum, peças a partir de Cavalo podem receber mutações positivas ou negativas; Peões nunca recebem mutações negativas. Esterilidade 🚫 é uma mutação negativa possível apenas a partir de Cavalo. Descendentes de Reprodução Sexuada ❤️ também rolam mutação individualmente, porém sua mutação adicional, quando ocorre, é sempre positiva. Resistência 🧬 continua sendo uma especialização hereditária.';
  }
  function renderSexualLegend(){
    const box=document.querySelector('#boardMutationLegend');if(!box)return;
    box.querySelector('[data-sexual-row]')?.remove();
    box.querySelector('[data-sterility-row]')?.remove();
    const anySexual=state.organisms.some(o=>{const p=profileOf(o);normalizeProfile(p);return !!p?.sexual});
    const anySterile=state.organisms.some(o=>{const p=profileOf(o);normalizeProfile(p);return !!p?.sterile});
    if(!anySexual&&!anySterile)return;
    box.querySelector('.board-mutation-empty')?.remove();
    if(anySexual)box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-sexual-row><span class="board-circle-icon">❤️</span><div><strong>Reprodução Sexuada</strong><small>Em casa fértil, permite escolher uma peça aliada adjacente e recombinar os dois perfis; a mutação adicional dos descendentes é sempre positiva.</small></div></div>');
    if(anySterile)box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-sterility-row><span class="board-circle-icon">🚫</span><div><strong>Esterilidade</strong><small>Mutação que impede esta peça de se reproduzir. Casas férteis ainda são consumidas ao serem alcançadas.</small></div></div>');
  }

  const previousRenderActions=renderActions;
  renderActions=function(){
    previousRenderActions();applyBirthRuleText();renderSexualLegend();
    const ctx=validPending();
    const save=document.querySelector('#saveBtn');if(save)save.disabled=!!ctx;
    if(ctx){
      const hint=document.querySelector('#hint');if(hint)hint.textContent='❤️ Reprodução sexuada: escolha uma das peças aliadas com borda roxa.';
      const pass=document.querySelector('#passTurnBtn');if(pass)pass.disabled=true;
      const hiddenPass=document.querySelector('#passBtn');if(hiddenPass)hiddenPass.disabled=true;
    }
  };

  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&validPending()){
      e.preventDefault();e.stopImmediatePropagation();
      flashHint('A reprodução sexuada já foi iniciada. Escolha uma peça aliada marcada com ❤️.');
    }
  },true);

  window.xeReproduceFromMutation=reproduce;
  window.xeProfileHasMutation=has;
  window.xeNormalizeMutationProfile=normalizeProfile;
  applyBirthRuleText();
})();
