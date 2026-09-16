(function(){
  const obsoleteTraits=new Set(['Anfibismo','Criotolerância','Plasticidade Fenotípica','Xerotolerância','Toxirresistência','Metabolismo Econômico']);
  for(let i=traitCatalog.length-1;i>=0;i--)if(obsoleteTraits.has(traitCatalog[i].name))traitCatalog.splice(i,1);
  traitCatalog.forEach(t=>{
    if(t.name==='Predação'){
      t.desc='Cada captura gera 1 Biomassa. Uma reprodução predatória consome 1 Biomassa.';
      t.cost='Reprodução depende de uma captura acumulada.';
    }else if(['Vetor Alongado','Saltador','Gigantismo','Carapaça','Espinhos'].includes(t.name)){
      t.cost='Sem custo reprodutivo adicional.';
    }
  });
  if(!traitCatalog.some(t=>t.name==='Voar'))traitCatalog.push({
    name:'Voar',cat:'locomoção',
    desc:'Permite atravessar e ocupar casas Biohazard sem ser eliminado.',
    cost:'Sem custo reprodutivo adicional.'
  });

  eventDeck.splice(0,eventDeck.length,{
    id:'biohazard',name:'Expansão Biohazard',
    desc:'Casas anunciadas tornam-se Biohazard. Organismos terrestres que entrarem ou atravessarem essas casas são eliminados.',
    major:false
  });

  const hostileTerrains=new Set(['desert','ice','water','toxic','volcanic']);
  const baseNewState=newState;
  newState=function(){
    const s=baseNewState();
    for(const row of s.board)for(const ce of row){
      if(hostileTerrains.has(ce.terrain)){ce.terrain='biohazard';ce.resource=0;ce.age=0;}
    }
    s.pendingEvents=[];
    s.eventHistory=[];
    s.activeEffects={drought:0,solar:0,routes:0};
    s.organisms.forEach(o=>{o.stress=0;o.plasticity=null;});
    return s;
  };

  function sanitizeState(){
    for(const row of state.board)for(const ce of row){
      if(hostileTerrains.has(ce.terrain)){ce.terrain='biohazard';ce.resource=0;ce.age=0;}
    }
    state.pendingEvents=[];
    state.eventHistory=[];
    state.activeEffects={drought:0,solar:0,routes:0};
    state.organisms.forEach(o=>{o.stress=0;o.plasticity=null;});
    for(const owner of ['blue','amber'])for(const id of Object.keys(state.lineages[owner])){
      const l=state.lineages[owner][id];
      l.traits=l.traits.filter(t=>!obsoleteTraits.has(t));
    }
  }

  const baseDeserializeState=deserializeState;
  deserializeState=function(raw){
    baseDeserializeState(raw);
    sanitizeState();
    state.pendingMutation=null;
    announceEvent(true);
    render();
  };

  function flies(org){return hasTrait(org.owner,org.lineage,'Voar')}
  function isBiohazard(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}

  movementTargets=function(org){
    const traits=lineage(org.owner,org.lineage).traits;
    const dirs8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const dirs4=[[-1,0],[1,0],[0,-1],[0,1]];
    const targets=new Map();
    const add=(r,c,kind='step',dist=1,path=null)=>{
      if(!inBounds(r,c))return;
      const occ=organismAt(r,c);
      if(occ&&occ.owner===org.owner)return;
      const travel=path||[[r,c]];
      targets.set(key(r,c),{r,c,kind,dist,capture:!!occ,path:travel,biohazard:travel.some(([pr,pc])=>isBiohazard(pr,pc))});
    };
    if(!traits.includes('Superespecialização'))dirs8.forEach(([dr,dc])=>add(org.r+dr,org.c+dc));
    else dirs4.forEach(([dr,dc])=>add(org.r+dr,org.c+dc));
    const giant=traits.includes('Gigantismo');
    if(!giant&&traits.includes('Vetor Alongado'))rayTargets(org,dirs4,2,targets,'vetor');
    if(!giant&&traits.includes('Superespecialização'))rayTargets(org,dirs4,3,targets,'especial');
    if(!giant&&traits.includes('Saltador'))[[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]].forEach(([dr,dc])=>add(org.r+dr,org.c+dc,'salto',Math.max(Math.abs(dr),Math.abs(dc))));
    return [...targets.values()].filter(t=>captureAllowed(org,t));
  };

  rayTargets=function(org,dirs,max,targets,kind){
    dirs.forEach(([dr,dc])=>{
      const path=[];
      for(let d=1;d<=max;d++){
        const r=org.r+dr*d,c=org.c+dc*d;
        if(!inBounds(r,c))break;
        path.push([r,c]);
        const occ=organismAt(r,c);
        if(occ&&occ.owner===org.owner)break;
        targets.set(key(r,c),{r,c,kind,dist:d,capture:!!occ,path:[...path],biohazard:path.some(([pr,pc])=>isBiohazard(pr,pc))});
        if(occ)break;
      }
    });
  };

  captureAllowed=function(attacker,t){
    const defender=organismAt(t.r,t.c);if(!defender)return true;
    const dtraits=lineage(defender.owner,defender.lineage).traits;
    const dr=Math.abs(t.r-attacker.r),dc=Math.abs(t.c-attacker.c),dist=Math.max(dr,dc);
    if(dtraits.includes('Carapaça')&&dr>0&&dc>0)return false;
    if(dtraits.includes('Camuflagem')&&dist>1)return false;
    if(dtraits.includes('Gigantismo')&&!hasTrait(attacker.owner,attacker.lineage,'Gigantismo')){
      const support=state.organisms.some(o=>o.owner===attacker.owner&&o.id!==attacker.id&&Math.max(Math.abs(o.r-defender.r),Math.abs(o.c-defender.c))===1);
      if(!support)return false;
    }
    return true;
  };

  canUseTerrain=function(org,terrain){return terrain!=='biohazard'||flies(org)};

  reproductionTargets=function(org){
    const range=hasTrait(org.owner,org.lineage,'Propagação')?2:1,out=[];
    for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
      if(!dr&&!dc)continue;
      if(Math.max(Math.abs(dr),Math.abs(dc))>range)continue;
      const r=org.r+dr,c=org.c+dc;
      if(!inBounds(r,c)||organismAt(r,c))continue;
      if(isBiohazard(r,c)&&!flies(org))continue;
      out.push({r,c,capture:false,kind:'birth',dist:Math.max(Math.abs(dr),Math.abs(dc))});
    }
    return out;
  };

  reproCost=function(){return 1};

  canPayRepro=function(org){
    if(playerOrganisms(org.owner).length>=MAX_POP)return {ok:false,reason:`limite populacional de ${MAX_POP}`};
    if(reproductionTargets(org).length===0)return {ok:false,reason:'sem casa livre para descendente'};
    if(hasTrait(org.owner,org.lineage,'Predação')){
      return org.biomass>=1?{ok:true,biomass:true,cost:1}:{ok:false,reason:'predadores precisam capturar 1 peça antes de reproduzir',biomass:true,cost:1};
    }
    const have=accessibleResources(org);
    return have>=1?{ok:true,cost:1}:{ok:false,reason:'falta 1 recurso de bioma',cost:1};
  };

  executeReproduction=function(parent,t){
    const pay=canPayRepro(parent);if(!pay.ok){flashHint(pay.reason);return}
    if(pay.biomass)parent.biomass-=1;else spendResources(parent,1);
    state.firstRepro[parent.owner]=true;state.reproCount[parent.owner]++;
    const child={id:state.nextOrgId++,owner:parent.owner,lineage:parent.lineage,r:t.r,c:t.c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);log(`${owners[parent.owner].name} ${parent.lineage} reproduziu.`);
    const mutate=rollMutation(parent.owner);
    if(mutate)beginMutation(child,parent);else finishTurn();
  };

  executeMove=function(org,t){
    if(!flies(org)&&t.path&&t.path.some(([r,c])=>isBiohazard(r,c))){
      removeOrganism(org.id,`${owners[org.owner].name} ${org.lineage} atravessou Biohazard e foi eliminado.`,true);
      checkExtinction();
      if(state.gameOver){render();return}
      finishTurn();
      return;
    }
    const defender=organismAt(t.r,t.c);
    if(defender){
      const defenderSpines=hasTrait(defender.owner,defender.lineage,'Espinhos')&&Math.max(Math.abs(org.r-defender.r),Math.abs(org.c-defender.c))===1;
      removeOrganism(defender.id,`${owners[defender.owner].name} ${defender.lineage} foi capturado.`,true);
      if(hasTrait(org.owner,org.lineage,'Predação')){org.biomass++;log(`${owners[org.owner].name} ${org.lineage} armazenou 1 captura para reprodução predatória.`)}
      org.r=t.r;org.c=t.c;markHabitat(org);
      log(`${owners[org.owner].name} ${org.lineage} realizou uma captura.`);
      if(defenderSpines)removeOrganism(org.id,'Espinhos eliminaram também o atacante.',true);
      checkExtinction();if(state.gameOver){render();return}
    }else{
      org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} ${org.lineage} migrou.`);
    }
    finishTurn();
  };

  special=function(){flashHint('as interações especiais foram simplificadas; efeitos evolutivos agora atuam diretamente')};
  applyEpochHazards=function(){};
  regenerateResources=function(){
    for(const row of state.board)for(const ce of row){if(ce.terrain==='fertile')ce.resource=Math.min(3,ce.resource+1)}
  };

  announceEvent=function(initial){
    if(state.epoch>=MAX_EPOCHS)return;
    const data=prepareEventData();
    const event=eventDeck[0];
    state.pendingEvents.push({event,resolveEpoch:state.epoch+1,data});
    state.eventHistory.push(event.id);
    data.cells.forEach(([r,c])=>cell(r,c).warning='biohazard');
    log('Biohazard anunciado para a próxima Época.');
  };

  prepareEventData=function(){
    const existing=[];
    for(const row of state.board)for(const ce of row)if(ce.terrain==='biohazard')existing.push([ce.r,ce.c]);
    if(existing.length){
      const [r,c]=choice(existing),adj=[];
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&cell(rr,cc).terrain!=='biohazard')adj.push([rr,cc])});
      if(adj.length)return {cells:[choice(adj)]};
    }
    const candidates=[];
    for(let r=1;r<SIZE-1;r++)for(let c=1;c<SIZE-1;c++)if(cell(r,c).terrain!=='biohazard')candidates.push([r,c]);
    return {cells:[choice(candidates)]};
  };

  applyEvent=function(e,data){
    if(e.id!=='biohazard')return;
    data.cells.forEach(([r,c])=>{
      const ce=cell(r,c);ce.terrain='biohazard';ce.resource=0;ce.warning=null;
      const org=organismAt(r,c);
      if(org&&!flies(org))removeOrganism(org.id,'Uma expansão Biohazard eliminou um organismo terrestre.',true);
    });
    checkExtinction();
    log('Biohazard expandiu pelo tabuleiro.');
  };

  terrainName=function(t){return {neutral:'habitat neutro',fertile:'habitat fértil',biohazard:'Biohazard'}[t]||t};

  checkExtinction=function(){
    const white=playerOrganisms('blue').length,black=playerOrganisms('amber').length;if(state.gameOver)return;
    if(white===0&&black===0){endGame(null,'As duas populações sofreram extinção simultânea.');return}
    if(white===0){endGame('amber','As Brancas sofreram Extinção Total.');return}
    if(black===0){endGame('blue','As Pretas sofreram Extinção Total.');return}
  };

  const pieceLetters={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  const pieceNames={pawn:'Peão',knight:'Cavalo',bishop:'Bispo',rook:'Torre',queen:'Rainha',king:'Rei'};
  const commonsBase='https://commons.wikimedia.org/wiki/Special:Redirect/file/';
  function pieceTypeFor(org){
    const traits=lineage(org.owner,org.lineage).traits;
    if(traits.length===0)return 'pawn';
    const orthogonal=traits.includes('Vetor Alongado')||traits.includes('Superespecialização');
    const jumping=traits.includes('Saltador');
    const flying=traits.includes('Voar');
    if(traits.length>=3||(orthogonal&&jumping)||(orthogonal&&flying))return 'queen';
    if(jumping)return 'knight';
    if(orthogonal)return 'rook';
    if(flying)return 'bishop';
    if(traits.some(t=>['Gigantismo','Carapaça','Camuflagem','Espinhos','Predação','Propagação'].includes(t)))return 'king';
    return 'pawn';
  }
  function pieceAssetFor(org){const type=pieceTypeFor(org),tone=org.owner==='blue'?'lt':'dt';return {type,name:pieceNames[type],url:`${commonsBase}Chess_${pieceLetters[type]}${tone}45.svg`}}

  renderBoard=function(){
    boardEl.innerHTML='';const sel=currentSelected();let legal=[];
    if(sel)legal=state.mode==='reproduce'?reproductionTargets(sel):movementTargets(sel);
    const legalMap=new Map(legal.map(t=>[key(t.r,t.c),t]));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c),div=document.createElement('div'),org=organismAt(r,c),target=legalMap.get(key(r,c));
      const square=(r+c)%2===0?'square-light':'square-dark';
      const fertileActive=ce.terrain==='fertile'&&ce.resource>0?' fertile-active':'';
      const terrainClass=ce.terrain==='biohazard'?' terrain-biohazard':'';
      const lethal=target&&target.biohazard&&sel&&!flies(sel)?' lethal-move':'';
      div.className=`cell ${square}${fertileActive}${terrainClass}${ce.warning?' warn':''}${sel&&sel.r===r&&sel.c===c?' selected':''}${target?(target.capture?' capture':' legal'):''}${lethal}`;
      div.title=`${terrainName(ce.terrain)}${ce.resource?` — ${ce.resource} recurso(s)`:''}${lethal?' — este movimento elimina a peça':''}`;
      div.addEventListener('click',()=>handleCellClick(r,c));
      if(ce.terrain==='biohazard'){const mark=document.createElement('span');mark.className='biohazard-mark';mark.textContent='☣';div.appendChild(mark)}
      if(ce.resource>0){const res=document.createElement('span');res.className='resource';res.textContent=`🌿 ${ce.resource}`;div.appendChild(res)}
      if(org){
        const asset=pieceAssetFor(org),od=document.createElement('div'),img=document.createElement('img');od.className=`org ${org.owner}`;
        od.title=`${owners[org.owner].name} · Linhagem ${org.lineage} · forma ${asset.name}\n${lineage(org.owner,org.lineage).traits.length?lineage(org.owner,org.lineage).traits.join(', '):'Generalista ancestral'}\nReserva: ${org.stored} · Capturas: ${org.biomass}`;
        img.src=asset.url;img.alt=`${asset.name} ${org.owner==='blue'?'branco':'preto'}`;img.draggable=false;od.appendChild(img);
        const states=[];if(org.stored)states.push(`R${org.stored}`);if(org.biomass)states.push(`C${org.biomass}`);
        if(states.length){const badge=document.createElement('span');badge.className='org-state';badge.textContent=states.join(' ');od.appendChild(badge)}
        div.appendChild(od);
      }
      boardEl.appendChild(div);
    }
  };

  renderEvents=function(){
    const box=$('#events');let html='';
    state.pendingEvents.forEach(p=>{html+=`<div class="event-card biohazard-event"><strong>${p.event.name} · próxima Época</strong><p>${p.event.desc}</p></div>`});
    if(!html)html='<div class="rules">Biohazard estável nesta Época.</div>';box.innerHTML=html;
    $('#environmentSummary').innerHTML='<strong>Biohazard:</strong> casas vermelhas eliminam qualquer organismo terrestre que entre ou atravesse a casa. A mutação <strong>Voar</strong> concede imunidade.';
  };

  renderActions=function(){
    const sel=currentSelected();['moveBtn','reproBtn','feedBtn','specialBtn'].forEach(id=>$('#'+id).classList.remove('active'));
    $('#'+({move:'moveBtn',reproduce:'reproBtn'}[state.mode]||'moveBtn')).classList.add('active');
    $('#reproBtn').disabled=!sel;$('#feedBtn').disabled=!sel;$('#specialBtn').disabled=true;$('#moveBtn').disabled=!sel;$('#passBtn').disabled=state.gameOver;
    let hint=`Turno das ${owners[state.current].name}. `;
    if(!sel)hint+='Selecione um organismo para agir.';
    else if(state.mode==='move')hint+=`Linhagem ${sel.lineage} selecionada. Biohazard elimina movimentos terrestres que o cruzem.`;
    else{const p=canPayRepro(sel);hint+=p.ok?`Escolha a casa do descendente. Custo: ${p.biomass?'1 captura':'1 recurso de bioma'}.`:`Reprodução indisponível: ${p.reason}.`}
    $('#hint').textContent=hint;
  };

  const ruleParagraphs=document.querySelectorAll('#rulesModal p');
  if(ruleParagraphs[2])ruleParagraphs[2].innerHTML='<strong>Recursos e reprodução.</strong> Toda reprodução custa exatamente 1 recurso de bioma. Linhagens com Predação usam 1 captura acumulada no lugar desse recurso.';
  if(ruleParagraphs[4])ruleParagraphs[4].innerHTML='<strong>Ambiente.</strong> O único terreno hostil é o Biohazard, sempre vermelho. Qualquer organismo terrestre que entre ou atravesse uma casa Biohazard é eliminado na mesma jogada. A mutação Voar permite atravessar e ocupar essas casas com segurança.';
  const legend=document.querySelector('.legend');
  if(legend)legend.innerHTML='<span><i class="checker-swatch"></i> habitat neutro</span><span><i class="swatch" style="background:var(--fertile-live)"></i> bioma com recurso</span><span><i class="swatch biohazard-swatch"></i> Biohazard</span><div class="piece-credit">Peças SVG: <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces" target="_blank" rel="noopener">Cburnett / Wikimedia Commons</a></div>';

  init();
})();
