(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const PIECE_KEYS=['pawn','knight','bishop','rook','king','queen'];
  const PIECE_LETTERS={pawn:'p',knight:'n',bishop:'b',rook:'r',king:'k',queen:'q'};
  const COMMONS='https://commons.wikimedia.org/wiki/Special:Redirect/file/';
  const EFFECT_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Superespecialização','Carapaça'];
  const ICONS={Locomoção:'🐪',Voo:'🐦',Predação:'🦁',Ovos:'🦎',Fertilidade:'🐇',Superespecialização:'🦀',Carapaça:'🐢'};

  function clampRank(n){return Math.max(0,Math.min(PIECES.length-1,Number(n)||0))}
  function profile(owner,id){return state.lineages[owner][id]}
  function cloneStack(stack){return (stack||[]).map(x=>({...x}))}
  function normalizeProfile(p){
    if(!p)return;
    p.pieceRank=clampRank(p.pieceRank);
    p.traits=(p.traits||[]).filter(t=>EFFECT_TRAITS.includes(t));
    p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack:[];
  }
  function makeProfile(owner,id,source,parentId=null){
    const p={id,parent:parentId,traits:[...(source?.traits||[])],pieceRank:clampRank(source?.pieceRank||0),mutationStack:cloneStack(source?.mutationStack),bornEpoch:state?.epoch||1,mutations:[...(source?.mutations||[])],nameCounter:0};
    state.lineages[owner][id]=p;return p;
  }
  function ensureIndividualProfiles(){
    if(!state)return;
    for(const owner of ['blue','amber']){
      const orgs=state.organisms.filter(o=>o.owner===owner);
      for(const o of orgs){
        const old=state.lineages[owner][o.lineage]||{traits:[],pieceRank:0,mutationStack:[],mutations:[]};normalizeProfile(old);
        const id=`O${o.id}`;
        if(!state.lineages[owner][id])makeProfile(owner,id,old,o.lineage||null);
        o.lineage=id;o.stored=0;o.biomass=0;
      }
    }
    state.pendingMutation=null;state.mode='move';state.moveChain=null;
  }
  function pieceRank(org){const p=profile(org.owner,org.lineage);normalizeProfile(p);return p.pieceRank}
  function pieceAsset(org){const rank=pieceRank(org),key=PIECE_KEYS[rank],tone=org.owner==='blue'?'lt':'dt';return {name:PIECES[rank],url:`${COMMONS}Chess_${PIECE_LETTERS[key]}${tone}45.svg`}}
  function flies(org){return !!profile(org.owner,org.lineage)?.traits?.includes('Voo')}
  function has(org,name){return !!profile(org.owner,org.lineage)?.traits?.includes(name)}
  function isBiohazard(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}
  function basePawnDirection(org){return org?.pawnDir===1||org?.pawnDir===-1?org.pawnDir:(org?.owner==='blue'?-1:1)}
  function pawnDirection(org){
    let dr=basePawnDirection(org);
    if(org?.r===0&&dr<0)dr=1;
    else if(org?.r===SIZE-1&&dr>0)dr=-1;
    return dr;
  }
  function syncPawnDirections(){
    if(!state?.organisms)return;
    for(const org of state.organisms){
      if(pieceRank(org)!==0)continue;
      const dr=pawnDirection(org);
      if(org.pawnDir!==dr)org.pawnDir=dr;
    }
  }

  const previousNewState=newState;
  newState=function(){const s=previousNewState();return s};
  const previousInit=init;
  init=function(){previousInit();ensureIndividualProfiles();state.logs=[];log('A partida começa com dois organismos de cada lado.');render();};
  const previousDeserialize=deserializeState;
  deserializeState=function(raw){previousDeserialize(raw);ensureIndividualProfiles();render();};

  function addTarget(targets,org,r,c,kind='step',path=null){
    if(!inBounds(r,c))return;const occ=organismAt(r,c);if(occ&&occ.owner===org.owner)return;
    const travel=path||[[r,c]];targets.set(key(r,c),{r,c,kind,capture:!!occ,path:travel,biohazard:travel.some(([rr,cc])=>isBiohazard(rr,cc))});
  }
  function ray(org,dirs,targets,max=SIZE){
    for(const [dr,dc] of dirs){const path=[];for(let d=1;d<=max;d++){
      const r=org.r+dr*d,c=org.c+dc*d;if(!inBounds(r,c))break;path.push([r,c]);const occ=organismAt(r,c);
      if(occ&&occ.owner===org.owner)break;addTarget(targets,org,r,c,'ray',[...path]);if(occ)break;
    }}
  }
  movementTargets=function(org){
    const targets=new Map(),rank=pieceRank(org),orth=[[-1,0],[1,0],[0,-1],[0,1]],diag=[[-1,-1],[-1,1],[1,-1],[1,1]],all=[...orth,...diag];
    if(has(org,'Superespecialização'))ray(org,orth,targets,SIZE);
    else if(rank===0){
      const dr=pawnDirection(org),r=org.r+dr;
      if(inBounds(r,org.c)&&!organismAt(r,org.c))addTarget(targets,org,r,org.c,'pawn',[[r,org.c]]);
      for(const dc of [-1,1]){const rr=org.r+dr,cc=org.c+dc;if(!inBounds(rr,cc))continue;const occ=organismAt(rr,cc);if(occ&&occ.owner!==org.owner)addTarget(targets,org,rr,cc,'pawn-capture',[[rr,cc]])}
    }else if(rank===1){for(const [dr,dc] of [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]])addTarget(targets,org,org.r+dr,org.c+dc,'knight',[[org.r+dr,org.c+dc]])}
    else if(rank===2)ray(org,diag,targets,SIZE);
    else if(rank===3)ray(org,orth,targets,SIZE);
    else if(rank===4)for(const [dr,dc] of all)addTarget(targets,org,org.r+dr,org.c+dc,'king',[[org.r+dr,org.c+dc]]);
    else if(rank===5)ray(org,all,targets,SIZE);
    return [...targets.values()].filter(t=>captureAllowed(org,t));
  };
  captureAllowed=function(attacker,t){const defender=organismAt(t.r,t.c);if(!defender)return true;const d=Math.max(Math.abs(t.r-attacker.r),Math.abs(t.c-attacker.c));return !(has(defender,'Carapaça')&&d>1)};
  canUseTerrain=function(org,terrain){return terrain!=='biohazard'||flies(org)};

  function birthCells(parent){
    const range=has(parent,'Ovos')?2:1,out=[];
    for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
      if(!dr&&!dc)continue;if(Math.max(Math.abs(dr),Math.abs(dc))>range)continue;
      const r=parent.r+dr,c=parent.c+dc;if(!inBounds(r,c)||organismAt(r,c))continue;if(isBiohazard(r,c)&&!flies(parent))continue;out.push({r,c});
    }
    return shuffle(out);
  }
  function mutationOptions(p){
    normalizeProfile(p);const opts=[];
    if(p.pieceRank>0||p.pieceRank<PIECES.length-1)opts.push({kind:'piece'});
    for(const name of EFFECT_TRAITS)if(!p.traits.includes(name))opts.push({kind:'trait',name});
    if(p.mutationStack.length)opts.push({kind:'reversal'});
    return opts;
  }
  function removeLastMatching(stack,target){for(let i=stack.length-1;i>=0;i--){const x=stack[i];if(x.kind===target.kind&&x.name===target.name&&x.delta===target.delta){stack.splice(i,1);return}}}
  function applyMutation(child){
    const p=profile(child.owner,child.lineage);normalizeProfile(p);const options=mutationOptions(p);if(!options.length)return null;
    const m=choice(options);
    if(m.kind==='piece'){
      const dirs=[];if(p.pieceRank>0)dirs.push(-1);if(p.pieceRank<PIECES.length-1)dirs.push(1);const delta=choice(dirs),from=PIECES[p.pieceRank];p.pieceRank=clampRank(p.pieceRank+delta);p.mutationStack.push({kind:'piece',delta});p.mutations.push('Mutação de peça');return `Mutação de peça: ${from} → ${PIECES[p.pieceRank]}`;
    }
    if(m.kind==='reversal'){
      const x=p.mutationStack[p.mutationStack.length-1];if(!x)return null;
      if(x.kind==='piece')p.pieceRank=clampRank(p.pieceRank-x.delta);else p.traits=p.traits.filter(t=>t!==x.name);
      removeLastMatching(p.mutationStack,x);p.mutations.push('Reversão');return x.kind==='piece'?'Reversão removeu a última mudança de peça':`Reversão removeu ${x.name}`;
    }
    p.traits.push(m.name);p.mutationStack.push({kind:'trait',name:m.name});p.mutations.push(m.name);return `Nova mutação: ${m.name}`;
  }
  function makeChild(parent,r,c){
    const id=state.nextOrgId++,lineageId=`O${id}`,src=profile(parent.owner,parent.lineage);normalizeProfile(src);makeProfile(parent.owner,lineageId,src,parent.lineage);
    const child={id,owner:parent.owner,lineage:lineageId,r,c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};state.organisms.push(child);markHabitat(child);
    if(Math.random()<0.75){const result=applyMutation(child);if(result)log(`${owners[child.owner].name}: ${result}.`)}else log(`${owners[child.owner].name}: descendente herdou as mutações sem nova alteração.`);
    return child;
  }
  function reproduce(parent,reason){
    if(playerOrganisms(parent.owner).length>=MAX_POP)return 0;const wanted=has(parent,'Fertilidade')?2:1,cells=birthCells(parent);let born=0;
    while(born<wanted&&cells.length&&playerOrganisms(parent.owner).length<MAX_POP){const t=cells.shift();makeChild(parent,t.r,t.c);born++}
    if(born){state.reproCount[parent.owner]++;log(`${owners[parent.owner].name} gerou ${born} descendente(s) por ${reason}.`)}return born;
  }
  reproductionTargets=function(){return []};
  canPayRepro=function(){return {ok:false,reason:'a reprodução ocorre automaticamente ao entrar em um bioma'}};
  executeReproduction=function(){};
  feed=function(){};
  special=function(){};
  rollMutation=function(){return Math.random()<0.75};
  beginMutation=function(){};
  resolveMutation=function(){state.pendingMutation=null;$('#mutationModal')?.classList.remove('open')};

  const oldFinishTurn=finishTurn;
  finishTurn=function(){if(state)state.moveChain=null;return oldFinishTurn()};
  executeMove=function(org,t){
    const second=state.moveChain&&state.moveChain.orgId===org.id,locomotion=has(org,'Locomoção');
    if(!flies(org)&&t.path&&t.path.some(([r,c])=>isBiohazard(r,c))){removeOrganism(org.id,`${owners[org.owner].name} atravessou Biohazard e foi eliminado.`,true);checkExtinction();if(state.gameOver){render();return}finishTurn();return}
    const destination=cell(t.r,t.c),biome=destination.terrain==='fertile'&&destination.resource>0,defender=organismAt(t.r,t.c);
    if(defender){removeOrganism(defender.id,`${owners[defender.owner].name} perdeu uma peça em captura.`,true);org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} realizou uma captura.`)}
    else{org.r=t.r;org.c=t.c;markHabitat(org)}
    if(biome){destination.resource=0;destination.terrain='neutral';reproduce(org,'bioma')}
    if(defender&&has(org,'Predação'))reproduce(org,'predação');
    checkExtinction();if(state.gameOver){render();return}
    if(locomotion&&!second&&state.organisms.some(o=>o.id===org.id)){
      const next=movementTargets(org);if(next.length){state.moveChain={orgId:org.id};state.selected=org.id;state.mode='move';render();return}
    }
    finishTurn();
  };
  handleCellClick=function(r,c){
    if(state.gameOver||state.pendingMutation)return;let sel=currentSelected(),occ=organismAt(r,c);
    if(state.moveChain){sel=state.organisms.find(o=>o.id===state.moveChain.orgId);if(!sel){state.moveChain=null;render();return}state.selected=sel.id}
    if(!sel){if(occ&&occ.owner===state.current){state.selected=occ.id;state.mode='move';render()}return}
    if(!state.moveChain&&occ&&occ.owner===state.current){state.selected=occ.id;state.mode='move';render();return}
    const t=movementTargets(sel).find(x=>x.r===r&&x.c===c);if(t)executeMove(sel,t);else flashHint(state.moveChain?'Faça a segunda movimentação com o mesmo organismo.':'Escolha uma casa com borda azul.')
  };

  function iconHtml(p){return p.traits.map(t=>ICONS[t]?`<span class="mutation-icon" title="${t}">${ICONS[t]}</span>`:'').join('')}
  renderBoard=function(){
    syncPawnDirections();
    boardEl.innerHTML='';const sel=currentSelected(),legal=sel?movementTargets(sel):[],legalMap=new Map(legal.map(t=>[key(t.r,t.c),t]));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c),org=organismAt(r,c),target=legalMap.get(key(r,c)),div=document.createElement('div');
      const square=(r+c)%2===0?'square-light':'square-dark',fertile=ce.terrain==='fertile'&&ce.resource>0?' fertile-active':'',hazard=ce.terrain==='biohazard'?' terrain-biohazard':'';
      div.className=`cell ${square}${fertile}${hazard}${sel&&sel.r===r&&sel.c===c?' selected':''}${target?' legal':''}`;div.title=terrainName(ce.terrain);div.addEventListener('click',()=>handleCellClick(r,c));
      if(org){const p=profile(org.owner,org.lineage),asset=pieceAsset(org),od=document.createElement('div'),img=document.createElement('img');normalizeProfile(p);od.className=`org ${org.owner}`;od.title=`${owners[org.owner].name} · ${asset.name}${p.traits.length?' · '+p.traits.join(', '):''}`;img.src=asset.url;img.alt=`${asset.name} ${org.owner==='blue'?'branco':'preto'}`;img.draggable=false;od.appendChild(img);if(p.traits.length){const icons=document.createElement('div');icons.className='mutation-icons';icons.innerHTML=iconHtml(p);od.appendChild(icons)}div.appendChild(od)}
      boardEl.appendChild(div);
    }
  };
  renderPlayer=function(owner,el){
    const orgs=playerOrganisms(owner);let html=`<div class="player-head"><div><div class="player-name ${owner}">${owners[owner].name}</div><div class="population">${orgs.length}/${MAX_POP} organismos · ${state.reproCount[owner]} reproduções</div></div></div>`;
    for(const o of orgs){const p=profile(owner,o.lineage);normalizeProfile(p);html+=`<div class="lineage-card ${state.current===owner?'active-turn':''}"><div class="lineage-title"><span class="lineage-id">${PIECES[p.pieceRank]}</span></div><div class="traits">${p.traits.length?p.traits.map(t=>`<span class="trait">${ICONS[t]||''} ${t}</span>`).join(''):'<span class="trait empty">sem mutações funcionais</span>'}</div></div>`}
    el.innerHTML=html;
  };
  renderPlayers=function(){renderPlayer('blue',$('#bluePanel'));renderPlayer('amber',$('#amberPanel'))};
  renderTrees=function(){const el=$('#trees');if(el)el.innerHTML=''};
  renderActions=function(){
    const hint=$('#hint'),sel=currentSelected();
    if(state.moveChain)hint.textContent='Locomoção: faça a segunda movimentação com a mesma peça.';
    else if(sel)hint.textContent=`${PIECES[pieceRank(sel)]} selecionado. Destinos possíveis têm borda azul.`;
    else hint.textContent=`Turno das ${owners[state.current].name}. Selecione uma peça.`;
  };

  scoreFor=function(owner){
    const orgs=playerOrganisms(owner),pop=orgs.length,profiles=new Set(orgs.map(o=>{const p=profile(owner,o.lineage);normalizeProfile(p);return `${p.pieceRank}|${[...p.traits].sort().join(',')}`})).size,habitats=new Set(orgs.map(o=>cell(o.r,o.c).terrain)).size,repro=state.reproCount[owner];
    return {pop,live:profiles,habitats,repro,total:pop*3+profiles*2+habitats+repro};
  };
  showGameOver=function(winner,reason,a,b){
    $('#gameOverTitle').textContent=winner?`${owners[winner].name} vence`:'Empate evolutivo';
    $('#gameOverBody').innerHTML=`<p>${reason}</p><table class="score-table"><thead><tr><th>Critério</th><th>Brancas</th><th>Pretas</th></tr></thead><tbody><tr><td>População ×3</td><td>${a.pop*3}</td><td>${b.pop*3}</td></tr><tr><td>Perfis evolutivos ×2</td><td>${a.live*2}</td><td>${b.live*2}</td></tr><tr><td>Habitats ocupados</td><td>${a.habitats}</td><td>${b.habitats}</td></tr><tr><td>Reproduções</td><td>${a.repro}</td><td>${b.repro}</td></tr><tr><th>Total</th><th>${a.total}</th><th>${b.total}</th></tr></tbody></table>`;$('#gameOverModal').classList.add('open');
  };

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[1])rules[1].innerHTML='<strong>Turno.</strong> Selecione uma peça e mova para uma casa com borda azul. Peões avançam uma casa e capturam na diagonal para a frente; ao alcançar a última fileira, invertem a direção e passam a avançar de volta para o outro lado do tabuleiro. Capturas acontecem automaticamente ao entrar numa casa adversária. Locomoção concede uma segunda movimentação com a mesma peça.';
  if(rules[2])rules[2].innerHTML='<strong>Reprodução.</strong> Entrar em uma casa verde consome esse bioma e gera reprodução automaticamente. Predação também gera reprodução imediata após uma captura. Fertilidade produz dois descendentes; Ovos amplia a distância de nascimento.';
  if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> Cada descendente herda todas as mutações do progenitor. Em 25% dos nascimentos ocorre apenas herança; nos outros 75% uma nova mutação é aplicada automaticamente. O jogo usa organismos individuais, sem linhagens.';

  ensureIndividualProfiles();
  init();
})();
