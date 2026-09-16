(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const PIECE_KEYS=['pawn','knight','bishop','rook','king','queen'];
  const PIECE_LETTERS={pawn:'p',knight:'n',bishop:'b',rook:'r',king:'k',queen:'q'};
  const COMMONS='https://commons.wikimedia.org/wiki/Special:Redirect/file/';
  const EFFECT_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Superespecialização','Carapaça'];
  const ICONS={Locomoção:'🐪',Voo:'🐦',Predação:'🦁',Ovos:'🦎',Fertilidade:'🐇',Superespecialização:'🦀',Carapaça:'🐢'};

  traitCatalog.splice(0,traitCatalog.length,
    {name:'Mutação de peça',cat:'forma',desc:'Altera a peça um degrau para cima ou para baixo: Peão, Cavalo, Bispo, Torre, Rei, Rainha.',cost:'A nova forma passa a determinar o movimento-base da linhagem.'},
    {name:'Locomoção',cat:'locomoção',desc:'Permite realizar uma segunda movimentação com o mesmo organismo no turno.',cost:'A segunda movimentação é opcional.'},
    {name:'Voo',cat:'locomoção',desc:'Permite entrar, permanecer e atravessar Biohazard com segurança.',cost:'Sem custo adicional.'},
    {name:'Predação',cat:'reprodução',desc:'Cada captura gera imediatamente uma reprodução gratuita.',cost:'A reprodução ocorre perto do predador e depende de espaço livre.'},
    {name:'Ovos',cat:'reprodução',desc:'Permite colocar descendentes a até 2 casas do progenitor.',cost:'Sem custo adicional.'},
    {name:'Fertilidade',cat:'reprodução',desc:'Cada reprodução gera até 2 descendentes em vez de 1.',cost:'Continua consumindo apenas 1 bioma na reprodução comum.'},
    {name:'Superespecialização',cat:'locomoção',desc:'Substitui o movimento-base por deslocamento exclusivamente ortogonal.',cost:'A forma da peça continua registrada, mas seu movimento é ortogonal.'},
    {name:'Carapaça',cat:'defesa',desc:'Impede ataques a distância; a linhagem só pode ser capturada por uma peça adjacente.',cost:'Sem custo adicional.'},
    {name:'Reversão',cat:'reversão',desc:'Remove a mutação anterior mais recente da linhagem.',cost:'A linhagem perde o efeito revertido.'}
  );

  function clampRank(n){return Math.max(0,Math.min(PIECES.length-1,n||0))}
  function normalizeLineage(l){
    l.pieceRank=clampRank(l.pieceRank||0);
    l.traits=(l.traits||[]).filter(t=>EFFECT_TRAITS.includes(t));
    if(!Array.isArray(l.mutationStack)){
      l.mutationStack=[];
      for(let i=0;i<l.pieceRank;i++)l.mutationStack.push({kind:'piece',delta:1});
      l.traits.forEach(name=>l.mutationStack.push({kind:'trait',name}));
    }
  }
  function normalizeState(){
    if(!state)return;
    for(const owner of ['blue','amber'])for(const id of Object.keys(state.lineages[owner]))normalizeLineage(state.lineages[owner][id]);
    state.moveChain=null;
    state.organisms.forEach(o=>{o.biomass=0});
  }
  function pieceRankOf(owner,id){const l=lineage(owner,id);normalizeLineage(l);return l.pieceRank}
  function pieceNameOf(owner,id){return PIECES[pieceRankOf(owner,id)]}
  function pieceAsset(org){
    const key=PIECE_KEYS[pieceRankOf(org.owner,org.lineage)],tone=org.owner==='blue'?'lt':'dt';
    return {name:PIECES[pieceRankOf(org.owner,org.lineage)],url:`${COMMONS}Chess_${PIECE_LETTERS[key]}${tone}45.svg`};
  }
  function flies(org){return hasTrait(org.owner,org.lineage,'Voo')}
  function isBiohazard(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}

  const priorNewState=newState;
  newState=function(){
    const s=priorNewState();
    for(const owner of ['blue','amber'])for(const id of Object.keys(s.lineages[owner]))normalizeLineage(s.lineages[owner][id]);
    s.moveChain=null;
    s.organisms.forEach(o=>o.biomass=0);
    return s;
  };
  const priorDeserialize=deserializeState;
  deserializeState=function(raw){priorDeserialize(raw);normalizeState();render();};

  function addTarget(targets,org,r,c,kind='step',path=null){
    if(!inBounds(r,c))return;
    const occ=organismAt(r,c);if(occ&&occ.owner===org.owner)return;
    const travel=path||[[r,c]];
    targets.set(key(r,c),{r,c,kind,dist:travel.length,capture:!!occ,path:travel,biohazard:travel.some(([pr,pc])=>isBiohazard(pr,pc))});
  }
  function ray(org,dirs,targets,max=SIZE){
    for(const [dr,dc] of dirs){
      const path=[];
      for(let d=1;d<=max;d++){
        const r=org.r+dr*d,c=org.c+dc*d;if(!inBounds(r,c))break;
        path.push([r,c]);const occ=organismAt(r,c);
        if(occ&&occ.owner===org.owner)break;
        addTarget(targets,org,r,c,'ray',[...path]);
        if(occ)break;
      }
    }
  }
  movementTargets=function(org){
    const targets=new Map(),rank=pieceRankOf(org.owner,org.lineage);
    const orth=[[-1,0],[1,0],[0,-1],[0,1]],diag=[[-1,-1],[-1,1],[1,-1],[1,1]],all=[...orth,...diag];
    if(hasTrait(org.owner,org.lineage,'Superespecialização')){
      ray(org,orth,targets,SIZE);
    }else if(rank===0){
      const dr=org.owner==='blue'?-1:1,fr=org.r+dr;
      if(inBounds(fr,org.c)&&!organismAt(fr,org.c))addTarget(targets,org,fr,org.c,'pawn',[[fr,org.c]]);
      for(const dc of [-1,1]){
        const r=org.r+dr,c=org.c+dc;if(!inBounds(r,c))continue;
        const occ=organismAt(r,c);if(occ&&occ.owner!==org.owner)addTarget(targets,org,r,c,'pawn-capture',[[r,c]]);
      }
    }else if(rank===1){
      for(const [dr,dc] of [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]])addTarget(targets,org,org.r+dr,org.c+dc,'knight',[[org.r+dr,org.c+dc]]);
    }else if(rank===2){ray(org,diag,targets,SIZE)}
    else if(rank===3){ray(org,orth,targets,SIZE)}
    else if(rank===4){for(const [dr,dc] of all)addTarget(targets,org,org.r+dr,org.c+dc,'king',[[org.r+dr,org.c+dc]])}
    else if(rank===5){ray(org,all,targets,SIZE)}
    return [...targets.values()].filter(t=>captureAllowed(org,t));
  };

  captureAllowed=function(attacker,t){
    const defender=organismAt(t.r,t.c);if(!defender)return true;
    const distance=Math.max(Math.abs(t.r-attacker.r),Math.abs(t.c-attacker.c));
    if(hasTrait(defender.owner,defender.lineage,'Carapaça')&&distance>1)return false;
    return true;
  };
  canUseTerrain=function(org,terrain){return terrain!=='biohazard'||flies(org)};

  reproductionTargets=function(org){
    const range=hasTrait(org.owner,org.lineage,'Ovos')?2:1,out=[];
    for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
      if(!dr&&!dc)continue;if(Math.max(Math.abs(dr),Math.abs(dc))>range)continue;
      const r=org.r+dr,c=org.c+dc;if(!inBounds(r,c)||organismAt(r,c))continue;
      if(isBiohazard(r,c)&&!flies(org))continue;
      out.push({r,c,capture:false,kind:'birth',dist:Math.max(Math.abs(dr),Math.abs(dc))});
    }
    return out;
  };

  canPayRepro=function(org){
    if(playerOrganisms(org.owner).length>=MAX_POP)return {ok:false,reason:`limite populacional de ${MAX_POP}`};
    if(reproductionTargets(org).length===0)return {ok:false,reason:'sem casa livre para descendente'};
    const have=accessibleResources(org);
    return have>=1?{ok:true,cost:1}:{ok:false,reason:'falta 1 bioma acessível',cost:1};
  };

  function makeChild(parent,r,c){
    const child={id:state.nextOrgId++,owner:parent.owner,lineage:parent.lineage,r,c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);return child;
  }
  function spawnReproduction(parent,preferred=null,free=false){
    const maxChildren=hasTrait(parent.owner,parent.lineage,'Fertilidade')?2:1;
    const born=[];
    if(preferred&&!organismAt(preferred.r,preferred.c)&&(!isBiohazard(preferred.r,preferred.c)||flies(parent)))born.push(makeChild(parent,preferred.r,preferred.c));
    let candidates=reproductionTargets(parent).filter(t=>!born.some(b=>b.r===t.r&&b.c===t.c));
    candidates=shuffle(candidates);
    while(born.length<maxChildren&&candidates.length&&playerOrganisms(parent.owner).length<MAX_POP){
      const t=candidates.shift();born.push(makeChild(parent,t.r,t.c));
      candidates=candidates.filter(x=>!organismAt(x.r,x.c));
    }
    if(born.length){
      state.reproCount[parent.owner]++;
      log(`${owners[parent.owner].name} ${parent.lineage} gerou ${born.length} descendente(s)${free?' por predação':''}.`);
    }
    return born;
  }

  executeReproduction=function(parent,t){
    const pay=canPayRepro(parent);if(!pay.ok){flashHint(pay.reason);return}
    spendResources(parent,1);state.firstRepro[parent.owner]=true;
    const born=spawnReproduction(parent,t,false);
    if(!born.length){finishTurn();return}
    if(rollMutation(parent.owner)){beginMutation(choice(born),parent)}else finishTurn();
  };

  function predationBirth(parent){
    if(playerOrganisms(parent.owner).length>=MAX_POP)return;
    const born=spawnReproduction(parent,null,true);
    if(!born.length)log('A reprodução predatória encontrou todas as casas próximas ocupadas.');
  }

  const baseFinishTurn=finishTurn;
  finishTurn=function(){if(state)state.moveChain=null;return baseFinishTurn()};

  executeMove=function(org,t){
    const hadLocomotion=hasTrait(org.owner,org.lineage,'Locomoção');
    const second=state.moveChain&&state.moveChain.orgId===org.id;
    if(!flies(org)&&t.path&&t.path.some(([r,c])=>isBiohazard(r,c))){
      removeOrganism(org.id,`${owners[org.owner].name} ${org.lineage} atravessou Biohazard e foi eliminado.`,true);
      checkExtinction();if(state.gameOver){render();return}finishTurn();return;
    }
    const defender=organismAt(t.r,t.c);
    if(defender){
      removeOrganism(defender.id,`${owners[defender.owner].name} ${defender.lineage} foi capturado.`,true);
      org.r=t.r;org.c=t.c;markHabitat(org);
      log(`${owners[org.owner].name} ${org.lineage} realizou uma captura.`);
      if(hasTrait(org.owner,org.lineage,'Predação'))predationBirth(org);
      checkExtinction();if(state.gameOver){render();return}
    }else{
      org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} ${org.lineage} migrou.`);
    }
    if(hadLocomotion&&!second&&state.organisms.some(o=>o.id===org.id)){
      state.moveChain={orgId:org.id};state.selected=org.id;state.mode='move';render();return;
    }
    finishTurn();
  };

  const priorHandleCellClick=handleCellClick;
  handleCellClick=function(r,c){
    if(state.moveChain){
      const org=state.organisms.find(o=>o.id===state.moveChain.orgId);if(!org){state.moveChain=null;render();return}
      state.selected=org.id;state.mode='move';
      const t=movementTargets(org).find(x=>x.r===r&&x.c===c);
      if(t)executeMove(org,t);else flashHint('a segunda movimentação deve ser feita com o mesmo organismo');
      return;
    }
    priorHandleCellClick(r,c);
  };

  function validMutationOptions(l){
    normalizeLineage(l);const options=[];
    if(l.pieceRank>0||l.pieceRank<PIECES.length-1)options.push(traitCatalog.find(t=>t.name==='Mutação de peça'));
    for(const name of EFFECT_TRAITS)if(!l.traits.includes(name))options.push(traitCatalog.find(t=>t.name===name));
    if(l.mutationStack.length)options.push(traitCatalog.find(t=>t.name==='Reversão'));
    return options.filter(Boolean);
  }
  beginMutation=function(child,parent){
    const l=lineage(parent.owner,parent.lineage),options=validMutationOptions(l);if(!options.length){finishTurn();return}
    const trait=choice(options);state.pendingMutation={childId:child.id,owner:parent.owner,parentLineage:parent.lineage,trait};
    if(trait.name==='Mutação de peça'){
      const dirs=[];if(l.pieceRank>0)dirs.push(-1);if(l.pieceRank<PIECES.length-1)dirs.push(1);
      state.pendingMutation.pieceDelta=choice(dirs);
    }
    if(trait.name==='Reversão')state.pendingMutation.reversal=l.mutationStack[l.mutationStack.length-1];
    renderMutationModal();
  };

  function mutationResultText(p){
    const l=lineage(p.owner,p.parentLineage);
    if(p.trait.name==='Mutação de peça')return `${PIECES[l.pieceRank]} → ${PIECES[clampRank(l.pieceRank+p.pieceDelta)]}`;
    if(p.trait.name==='Reversão'){
      const x=p.reversal;if(!x)return 'Sem mutação para reverter';
      return x.kind==='piece'?`Reverte uma alteração de peça`:`Perde ${x.name}`;
    }
    return p.trait.desc;
  }
  renderMutationModal=function(){
    const p=state.pendingMutation,parent=lineage(p.owner,p.parentLineage),lineCount=Object.keys(state.lineages[p.owner]).length;
    $('#mutationBody').innerHTML=`<div class="choice"><strong>${p.trait.name}</strong><small>${p.trait.cat}</small><p>${mutationResultText(p)}</p></div><p>O descendente nasceu na linhagem ${p.parentLineage}. Escolha se a alteração cria uma nova linhagem ou passa a integrar a linhagem atual.</p>`;
    let actions='';if(lineCount<MAX_LINEAGES)actions+='<button class="btn primary" data-mut="branch">Criar nova linhagem</button>';
    actions+='<button class="btn" data-mut="integrate">Integrar à linhagem</button><button class="btn" data-mut="discard">Descartar mutação</button>';
    $('#mutationActions').innerHTML=actions;$('#mutationModal').classList.add('open');
    $('#mutationActions').querySelectorAll('[data-mut]').forEach(b=>b.addEventListener('click',()=>resolveMutation(b.dataset.mut)));
  };

  function cloneEvolution(l){normalizeLineage(l);return {traits:[...l.traits],pieceRank:l.pieceRank,mutationStack:l.mutationStack.map(x=>({...x}))}}
  function removeStackEntry(stack,target){for(let i=stack.length-1;i>=0;i--){const x=stack[i];if(x.kind===target.kind&&x.name===target.name&&x.delta===target.delta){stack.splice(i,1);return}}}
  function applyMutation(evo,p){
    if(p.trait.name==='Mutação de peça'){
      evo.pieceRank=clampRank(evo.pieceRank+p.pieceDelta);evo.mutationStack.push({kind:'piece',delta:p.pieceDelta});return;
    }
    if(p.trait.name==='Reversão'){
      const x=p.reversal;if(!x)return;
      if(x.kind==='piece')evo.pieceRank=clampRank(evo.pieceRank-x.delta);
      else evo.traits=evo.traits.filter(t=>t!==x.name);
      removeStackEntry(evo.mutationStack,x);return;
    }
    if(evo.traits.length>=3){
      const old=evo.traits.shift();const oldEntry=[...evo.mutationStack].reverse().find(x=>x.kind==='trait'&&x.name===old);if(oldEntry)removeStackEntry(evo.mutationStack,oldEntry);
    }
    evo.traits.push(p.trait.name);evo.mutationStack.push({kind:'trait',name:p.trait.name});
  }
  resolveMutation=function(mode){
    const p=state.pendingMutation;if(!p)return;const child=state.organisms.find(o=>o.id===p.childId);if(!child){state.pendingMutation=null;finishTurn();return}
    const parent=lineage(p.owner,p.parentLineage);normalizeLineage(parent);
    if(mode==='branch'&&Object.keys(state.lineages[p.owner]).length<MAX_LINEAGES){
      const evo=cloneEvolution(parent);applyMutation(evo,p);const id=nextLineageId(p.owner,p.parentLineage);
      state.lineages[p.owner][id]={id,parent:p.parentLineage,traits:evo.traits,pieceRank:evo.pieceRank,mutationStack:evo.mutationStack,bornEpoch:state.epoch,mutations:[...(parent.mutations||[]),p.trait.name],nameCounter:0};
      child.lineage=id;log(`Especiação: surgiu ${id} com ${p.trait.name}.`);
    }else if(mode==='integrate'){
      const evo=cloneEvolution(parent);applyMutation(evo,p);parent.traits=evo.traits;parent.pieceRank=evo.pieceRank;parent.mutationStack=evo.mutationStack;(parent.mutations||(parent.mutations=[])).push(p.trait.name);
      log(`${p.parentLineage} integrou ${p.trait.name}.`);
    }else log(`A mutação ${p.trait.name} foi descartada.`);
    state.pendingMutation=null;$('#mutationModal').classList.remove('open');finishTurn();
  };

  function iconHtml(l){return l.traits.map(t=>ICONS[t]?`<span class="mutation-icon" title="${t}">${ICONS[t]}</span>`:'').join('')}
  renderBoard=function(){
    boardEl.innerHTML='';const sel=currentSelected();let legal=[];
    if(sel)legal=state.mode==='reproduce'?reproductionTargets(sel):movementTargets(sel);
    const legalMap=new Map(legal.map(t=>[key(t.r,t.c),t]));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c),div=document.createElement('div'),org=organismAt(r,c),target=legalMap.get(key(r,c));
      const square=(r+c)%2===0?'square-light':'square-dark',fertile=ce.terrain==='fertile'&&ce.resource>0?' fertile-active':'',hazard=ce.terrain==='biohazard'?' terrain-biohazard':'';
      const lethal=target&&target.biohazard&&sel&&!flies(sel)?' lethal-move':'';
      div.className=`cell ${square}${fertile}${hazard}${sel&&sel.r===r&&sel.c===c?' selected':''}${target?(target.capture?' capture':' legal'):''}${lethal}`;
      div.title=`${terrainName(ce.terrain)}${ce.resource?' — bioma disponível':''}${lethal?' — movimento letal':''}`;div.addEventListener('click',()=>handleCellClick(r,c));
      if(org){
        const asset=pieceAsset(org),l=lineage(org.owner,org.lineage),od=document.createElement('div'),img=document.createElement('img');normalizeLineage(l);
        od.className=`org ${org.owner}`;od.title=`${owners[org.owner].name} · ${org.lineage} · ${asset.name}\n${l.traits.length?l.traits.join(', '):'Sem adaptações adicionais'}\nReserva: ${org.stored}`;
        img.src=asset.url;img.alt=`${asset.name} ${org.owner==='blue'?'branco':'preto'}`;img.draggable=false;od.appendChild(img);
        if(l.traits.length){const icons=document.createElement('div');icons.className='mutation-icons';icons.innerHTML=iconHtml(l);od.appendChild(icons)}
        if(org.stored){const badge=document.createElement('span');badge.className='org-state';badge.textContent=`R${org.stored}`;od.appendChild(badge)}
        div.appendChild(od);
      }
      boardEl.appendChild(div);
    }
  };

  renderPlayer=function(owner,el){
    const ids=Object.keys(state.lineages[owner]);let html=`<div class="player-head"><div><div class="player-name ${owner}">${owners[owner].name}</div><div class="population">${playerOrganisms(owner).length}/${MAX_POP} organismos · ${state.reproCount[owner]} reproduções</div></div><div class="population">Colapso ${state.collapse[owner]}/2</div></div>`;
    ids.forEach(id=>{const l=lineage(owner,id);normalizeLineage(l);const pop=lineagePopulation(owner,id),ext=pop===0;
      html+=`<div class="lineage-card ${ext?'extinct':''} ${state.current===owner?'active-turn':''}"><div class="lineage-title"><span class="lineage-id">${id} · ${PIECES[l.pieceRank]}</span><span class="lineage-meta">${pop} vivo(s) · E${l.bornEpoch}</span></div><div class="traits">${l.traits.length?l.traits.map(t=>`<span class="trait" title="${traitInfo(t)}">${ICONS[t]||''} ${t}</span>`).join(''):'<span class="trait empty">sem adaptações adicionais</span>'}</div></div>`;
    });el.innerHTML=html;
  };
  renderPlayers=function(){renderPlayer('blue',$('#bluePanel'));renderPlayer('amber',$('#amberPanel'))};

  renderTrees=function(){
    const make=owner=>{const ids=Object.keys(state.lineages[owner]),children={};ids.forEach(id=>children[id]=[]);ids.forEach(id=>{const p=lineage(owner,id).parent;if(p&&children[p])children[p].push(id)});
      const node=id=>{const l=lineage(owner,id);normalizeLineage(l);return `<li class="${lineagePopulation(owner,id)===0?'extinct':''}"><strong>${id}</strong> · ${PIECES[l.pieceRank]} · ${lineagePopulation(owner,id)} vivo(s)${l.traits.length?` — ${l.traits.join(', ')}`:''}${children[id].length?`<ul>${children[id].map(node).join('')}</ul>`:''}</li>`};
      return `<div style="margin-bottom:10px"><strong style="color:${owners[owner].color}">${owners[owner].name}</strong><ul>${node('A')}</ul></div>`};
    $('#trees').innerHTML=make('blue')+make('amber');
  };

  const priorRenderActions=renderActions;
  renderActions=function(){
    priorRenderActions();const hint=$('#hint');
    if(state.moveChain){
      $('#reproBtn').disabled=true;$('#feedBtn').disabled=true;$('#moveBtn').disabled=false;
      hint.textContent='Locomoção: faça a segunda movimentação com o mesmo organismo ou passe o turno.';
    }else if(currentSelected()&&state.mode==='move')hint.textContent=`${pieceNameOf(currentSelected().owner,currentSelected().lineage)} selecionado. Escolha um destino permitido pela peça.`;
  };

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[1])rules[1].innerHTML='<strong>Turno.</strong> Cada organismo usa o movimento da peça de xadrez que representa. Peões avançam uma casa para frente e capturam uma casa na diagonal para frente. Locomoção permite uma segunda movimentação no mesmo turno.';
  if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> As mutações possíveis são Mutação de peça, Locomoção, Voo, Predação, Ovos, Fertilidade, Superespecialização, Carapaça e Reversão. Cada linhagem mantém até três adaptações adicionais, além de sua forma de peça.';

  normalizeState();init();
})();
