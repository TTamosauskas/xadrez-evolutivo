(function(){
  const obsoleteTraits=new Set(['Anfibismo','Criotolerância','Plasticidade Fenotípica','Xerotolerância','Toxirresistência','Metabolismo Econômico']);
  for(let i=traitCatalog.length-1;i>=0;i--)if(obsoleteTraits.has(traitCatalog[i].name))traitCatalog.splice(i,1);
  traitCatalog.forEach(t=>{
    if(t.name==='Predação'){
      t.desc='Cada captura gera 1 Biomassa. Uma reprodução predatória consome 1 Biomassa.';
      t.cost='Reprodução depende de uma captura acumulada.';
    }else if(['Vetor Alongado','Saltador','Gigantismo','Carapaça','Espinhos','Propagação'].includes(t.name)){
      t.cost='Sem custo reprodutivo adicional.';
    }
  });
  if(!traitCatalog.some(t=>t.name==='Voar'))traitCatalog.push({
    name:'Voar',cat:'locomoção',
    desc:'Permite atravessar e ocupar casas Biohazard sem ser eliminado.',
    cost:'Sem custo reprodutivo adicional.'
  });

  eventDeck.splice(0,eventDeck.length);
  const hostileTerrains=new Set(['desert','ice','water','toxic','volcanic']);
  const INITIAL_BIOMES=10;
  const INITIAL_BIOHAZARD=14;

  function cellKey(r,c){return `${r},${c}`}
  function pickMany(items,count){return shuffle(items).slice(0,Math.min(count,items.length))}
  function occupiedSetFor(s){return new Set(s.organisms.map(o=>cellKey(o.r,o.c)))}

  function randomizeEnvironment(s){
    const occupied=occupiedSetFor(s);
    for(const row of s.board)for(const ce of row){
      ce.terrain='neutral';ce.resource=0;ce.home=null;ce.warning=null;ce.age=0;
    }

    const fertileUsed=new Set();
    const ownersList=['blue','amber'];
    for(const owner of ownersList){
      const founders=s.organisms.filter(o=>o.owner===owner);
      const candidates=[];
      for(const f of founders){
        for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
          const r=f.r+dr,c=f.c+dc,k=cellKey(r,c);
          if((dr||dc)&&inBounds(r,c)&&!occupied.has(k)&&!fertileUsed.has(k))candidates.push([r,c]);
        }
      }
      if(candidates.length){
        const [r,c]=choice(candidates);s.board[r][c].terrain='fertile';s.board[r][c].resource=1;fertileUsed.add(cellKey(r,c));
      }
    }

    const remainingFertile=[];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const k=cellKey(r,c);if(!occupied.has(k)&&!fertileUsed.has(k))remainingFertile.push([r,c]);
    }
    pickMany(remainingFertile,INITIAL_BIOMES-fertileUsed.size).forEach(([r,c])=>{
      s.board[r][c].terrain='fertile';s.board[r][c].resource=1;fertileUsed.add(cellKey(r,c));
    });

    const protectedHazard=new Set();
    for(const o of s.organisms){
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        const r=o.r+dr,c=o.c+dc;if(inBounds(r,c))protectedHazard.add(cellKey(r,c));
      }
    }
    const hazardCandidates=[];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const k=cellKey(r,c);
      if(!occupied.has(k)&&!fertileUsed.has(k)&&!protectedHazard.has(k))hazardCandidates.push([r,c]);
    }
    pickMany(hazardCandidates,INITIAL_BIOHAZARD).forEach(([r,c])=>{s.board[r][c].terrain='biohazard';s.board[r][c].resource=0});

    s.pendingEvents=[];s.eventHistory=[];s.activeEffects={drought:0,solar:0,routes:0};
    s.organisms.forEach(o=>{o.stress=0;o.plasticity=null;});
  }

  const baseNewState=newState;
  newState=function(){
    const s=baseNewState();randomizeEnvironment(s);return s;
  };

  function sanitizeState(){
    for(const row of state.board)for(const ce of row){
      if(hostileTerrains.has(ce.terrain)){ce.terrain='biohazard';ce.resource=0;}
      if(ce.terrain==='fertile'){
        if(ce.resource>0)ce.resource=1;else ce.terrain='neutral';
      }
      ce.warning=null;ce.age=0;
    }
    state.pendingEvents=[];state.eventHistory=[];state.activeEffects={drought:0,solar:0,routes:0};
    state.organisms.forEach(o=>{o.stress=0;o.plasticity=null;});
    for(const owner of ['blue','amber'])for(const id of Object.keys(state.lineages[owner])){
      state.lineages[owner][id].traits=state.lineages[owner][id].traits.filter(t=>!obsoleteTraits.has(t));
    }
  }

  const baseDeserializeState=deserializeState;
  deserializeState=function(raw){baseDeserializeState(raw);sanitizeState();state.pendingMutation=null;render();};

  function flies(org){return hasTrait(org.owner,org.lineage,'Voar')}
  function isBiohazard(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}

  function biohazardNeighborCount(r,c){
    let count=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&isBiohazard(rr,cc))count++;
    }
    return count;
  }

  function computeNextBiohazard(){
    const next=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const alive=isBiohazard(r,c),n=biohazardNeighborCount(r,c);
      next[r][c]=alive?(n===2||n===3):(n===3);
    }
    return next;
  }

  function conwayStats(){
    const next=computeNextBiohazard();let births=0,deaths=0,survivors=0;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const alive=isBiohazard(r,c);
      if(!alive&&next[r][c])births++;
      else if(alive&&!next[r][c])deaths++;
      else if(alive&&next[r][c])survivors++;
    }
    return {next,births,deaths,survivors};
  }

  function advanceConway(){
    const {next,births,deaths}=conwayStats();
    const doomed=[];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c),willLive=next[r][c];
      if(willLive){ce.terrain='biohazard';ce.resource=0;}
      else if(ce.terrain==='biohazard'){ce.terrain='neutral';ce.resource=0;}
      ce.warning=null;
    }
    for(const o of [...state.organisms])if(isBiohazard(o.r,o.c)&&!flies(o))doomed.push(o.id);
    doomed.forEach(id=>removeOrganism(id,'A nova geração de Biohazard eliminou um organismo terrestre.',true));
    checkExtinction();
    log(`Conway atualizou o Biohazard: ${births} nascimento(s), ${deaths} desaparecimento(s).`);
  }

  movementTargets=function(org){
    const traits=lineage(org.owner,org.lineage).traits;
    const dirs8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    const dirs4=[[-1,0],[1,0],[0,-1],[0,1]];
    const targets=new Map();
    const add=(r,c,kind='step',dist=1,path=null)=>{
      if(!inBounds(r,c))return;
      const occ=organismAt(r,c);if(occ&&occ.owner===org.owner)return;
      const travel=path||[[r,c]];
      targets.set(key(r,c),{r,c,kind,dist,capture:!!occ,path:travel,biohazard:travel.some(([pr,pc])=>isBiohazard(pr,pc))});
    };
    if(!traits.includes('Superespecialização'))dirs8.forEach(([dr,dc])=>add(org.r+dr,org.c+dc));
    else dirs4.forEach(([dr,dc])=>add(org.r+dr,org.c+dc));
    const giant=traits.includes('Gigantismo');
    if(!giant&&traits.includes('Vetor Alongado'))rayTargets(org,dirs4,2,targets,'vetor');
    if(!giant&&traits.includes('Superespecialização'))rayTargets(org,dirs4,3,targets,'especial');
    if(!giant&&traits.includes('Saltador'))[[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]].forEach(([dr,dc])=>add(org.r+dr,org.c+dc,'salto',2));
    return [...targets.values()].filter(t=>captureAllowed(org,t));
  };

  rayTargets=function(org,dirs,max,targets,kind){
    dirs.forEach(([dr,dc])=>{
      const path=[];
      for(let d=1;d<=max;d++){
        const r=org.r+dr*d,c=org.c+dc*d;if(!inBounds(r,c))break;
        path.push([r,c]);const occ=organismAt(r,c);if(occ&&occ.owner===org.owner)break;
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
      if(!dr&&!dc)continue;if(Math.max(Math.abs(dr),Math.abs(dc))>range)continue;
      const r=org.r+dr,c=org.c+dc;if(!inBounds(r,c)||organismAt(r,c))continue;
      if(isBiohazard(r,c)&&!flies(org))continue;
      out.push({r,c,capture:false,kind:'birth',dist:Math.max(Math.abs(dr),Math.abs(dc))});
    }
    return out;
  };

  reproCost=function(){return 1};
  canPayRepro=function(org){
    if(playerOrganisms(org.owner).length>=MAX_POP)return {ok:false,reason:`limite populacional de ${MAX_POP}`};
    if(reproductionTargets(org).length===0)return {ok:false,reason:'sem casa livre para descendente'};
    if(hasTrait(org.owner,org.lineage,'Predação'))return org.biomass>=1?{ok:true,biomass:true,cost:1}:{ok:false,reason:'predadores precisam capturar 1 peça antes de reproduzir',biomass:true,cost:1};
    const have=accessibleResources(org);return have>=1?{ok:true,cost:1}:{ok:false,reason:'falta 1 bioma 🌿 acessível',cost:1};
  };

  spendResources=function(org){
    if(org.stored>0){org.stored--;return;}
    const sources=[];
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      const r=org.r+dr,c=org.c+dc;if(inBounds(r,c)&&cell(r,c).resource>0)sources.push(cell(r,c));
    }
    if(sources.length){const source=sources[0];source.resource=0;if(source.terrain==='fertile')source.terrain='neutral';}
  };

  executeReproduction=function(parent,t){
    const pay=canPayRepro(parent);if(!pay.ok){flashHint(pay.reason);return}
    if(pay.biomass)parent.biomass-=1;else spendResources(parent,1);
    state.firstRepro[parent.owner]=true;state.reproCount[parent.owner]++;
    const child={id:state.nextOrgId++,owner:parent.owner,lineage:parent.lineage,r:t.r,c:t.c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);log(`${owners[parent.owner].name} ${parent.lineage} reproduziu.`);
    const mutate=rollMutation(parent.owner);if(mutate)beginMutation(child,parent);else finishTurn();
  };

  executeMove=function(org,t){
    if(!flies(org)&&t.path&&t.path.some(([r,c])=>isBiohazard(r,c))){
      removeOrganism(org.id,`${owners[org.owner].name} ${org.lineage} atravessou Biohazard e foi eliminado.`,true);
      checkExtinction();if(state.gameOver){render();return}finishTurn();return;
    }
    const defender=organismAt(t.r,t.c);
    if(defender){
      const defenderSpines=hasTrait(defender.owner,defender.lineage,'Espinhos')&&Math.max(Math.abs(org.r-defender.r),Math.abs(org.c-defender.c))===1;
      removeOrganism(defender.id,`${owners[defender.owner].name} ${defender.lineage} foi capturado.`,true);
      if(hasTrait(org.owner,org.lineage,'Predação')){org.biomass++;log(`${owners[org.owner].name} ${org.lineage} armazenou 1 captura para reprodução predatória.`)}
      org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} ${org.lineage} realizou uma captura.`);
      if(defenderSpines)removeOrganism(org.id,'Espinhos eliminaram também o atacante.',true);
      checkExtinction();if(state.gameOver){render();return}
    }else{org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} ${org.lineage} migrou.`)}
    finishTurn();
  };

  feed=function(org){
    if(org.stored>=2){flashHint('este organismo já carrega dois biomas consumidos');return}
    let source=null;
    if(cell(org.r,org.c).resource>0)source=cell(org.r,org.c);
    else{
      for(let dr=-1;dr<=1&&!source;dr++)for(let dc=-1;dc<=1;dc++){
        const r=org.r+dr,c=org.c+dc;if(inBounds(r,c)&&cell(r,c).resource>0){source=cell(r,c);break;}
      }
    }
    if(!source){flashHint('nenhum bioma 🌿 disponível nesta casa ou na vizinhança');return}
    source.resource=0;if(source.terrain==='fertile')source.terrain='neutral';org.stored++;
    log(`${owners[org.owner].name} ${org.lineage} consumiu um bioma e armazenou seu recurso.`);finishTurn();
  };

  special=function(){flashHint('os efeitos evolutivos atuam diretamente')};
  applyEpochHazards=function(){};
  regenerateResources=function(){};
  announceEvent=function(){};
  prepareEventData=function(){return {cells:[]}};
  applyEvent=function(){};
  resolvePendingEvents=function(){advanceConway()};

  terrainName=function(t){return {neutral:'habitat neutro',fertile:'bioma fértil',biohazard:'Biohazard'}[t]||t};

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
    const traits=lineage(org.owner,org.lineage).traits;if(traits.length===0)return 'pawn';
    const orthogonal=traits.includes('Vetor Alongado')||traits.includes('Superespecialização');
    const jumping=traits.includes('Saltador'),flying=traits.includes('Voar');
    if(traits.length>=3||(orthogonal&&jumping)||(orthogonal&&flying))return 'queen';
    if(jumping)return 'knight';if(orthogonal)return 'rook';if(flying)return 'bishop';
    if(traits.some(t=>['Gigantismo','Carapaça','Camuflagem','Espinhos','Predação','Propagação'].includes(t)))return 'king';
    return 'pawn';
  }
  function pieceAssetFor(org){const type=pieceTypeFor(org),tone=org.owner==='blue'?'lt':'dt';return {type,name:pieceNames[type],url:`${commonsBase}Chess_${pieceLetters[type]}${tone}45.svg`}}

  renderBoard=function(){
    boardEl.innerHTML='';const sel=currentSelected();let legal=[];
    if(sel)legal=state.mode==='reproduce'?reproductionTargets(sel):movementTargets(sel);
    const legalMap=new Map(legal.map(t=>[key(t.r,t.c),t]));
    const next=computeNextBiohazard();
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c),div=document.createElement('div'),org=organismAt(r,c),target=legalMap.get(key(r,c));
      const square=(r+c)%2===0?'square-light':'square-dark';
      const fertileActive=ce.terrain==='fertile'&&ce.resource>0?' fertile-active':'';
      const currentHazard=ce.terrain==='biohazard';
      const preview=!currentHazard&&next[r][c];
      const lethal=target&&target.biohazard&&sel&&!flies(sel)?' lethal-move':'';
      div.className=`cell ${square}${fertileActive}${currentHazard?' terrain-biohazard':''}${preview?' biohazard-preview':''}${sel&&sel.r===r&&sel.c===c?' selected':''}${target?(target.capture?' capture':' legal'):''}${lethal}`;
      div.title=`${terrainName(ce.terrain)}${ce.resource?' — 1 bioma disponível':''}${preview?' — torna-se Biohazard na próxima Época':''}${lethal?' — este movimento elimina a peça':''}`;
      div.addEventListener('click',()=>handleCellClick(r,c));
      if(currentHazard){const mark=document.createElement('span');mark.className='environment-mark biohazard-mark';mark.textContent='☣';div.appendChild(mark)}
      if(ce.resource>0){const mark=document.createElement('span');mark.className='environment-mark biome-mark';mark.textContent='🌿';div.appendChild(mark)}
      if(org){
        const asset=pieceAssetFor(org),od=document.createElement('div'),img=document.createElement('img');od.className=`org ${org.owner}`;
        od.title=`${owners[org.owner].name} · Linhagem ${org.lineage} · forma ${asset.name}\n${lineage(org.owner,org.lineage).traits.length?lineage(org.owner,org.lineage).traits.join(', '):'Generalista ancestral'}\nReserva: ${org.stored} · Biomassa: ${org.biomass}`;
        img.src=asset.url;img.alt=`${asset.name} ${org.owner==='blue'?'branco':'preto'}`;img.draggable=false;od.appendChild(img);
        const states=[];if(org.stored)states.push(`R${org.stored}`);if(org.biomass)states.push(`B${org.biomass}`);
        if(states.length){const badge=document.createElement('span');badge.className='org-state';badge.textContent=states.join(' ');od.appendChild(badge)}
        div.appendChild(od);
      }
      boardEl.appendChild(div);
    }
  };

  renderActions=function(){
    const sel=currentSelected();['moveBtn','reproBtn','feedBtn','specialBtn'].forEach(id=>$('#'+id).classList.remove('active'));
    $('#'+({move:'moveBtn',reproduce:'reproBtn'}[state.mode]||'moveBtn')).classList.add('active');
    $('#reproBtn').disabled=!sel;$('#feedBtn').disabled=!sel;$('#specialBtn').disabled=!sel;$('#moveBtn').disabled=!sel;$('#passBtn').disabled=state.gameOver;
    let hint=`Turno das ${owners[state.current].name}. `;
    if(!sel)hint+='Selecione um organismo para agir.';
    else if(state.mode==='move')hint+=`Linhagem ${sel.lineage} selecionada. Vermelho vivo é Biohazard; vermelho claro indica o nascimento previsto para a próxima Época.`;
    else{const p=canPayRepro(sel);hint+=p.ok?`Escolha a casa do descendente. Custo: ${p.biomass?'1 captura acumulada':'1 bioma 🌿'}.`:`Reprodução indisponível: ${p.reason}.`}
    $('#hint').textContent=hint;
  };

  renderEvents=function(){
    const box=$('#events'),stats=conwayStats();
    const current=state.board.flat().filter(c=>c.terrain==='biohazard').length;
    box.innerHTML=`<div class="event-card biohazard-event"><strong>Biohazard · dinâmica Conway</strong><p>${current} casa(s) ativas. Próxima Época: ${stats.births} nascimento(s), ${stats.deaths} desaparecimento(s).</p></div>`;
    $('#environmentSummary').innerHTML='<strong>Regras:</strong> &lt;2 vizinhos: desaparece · 2–3: sobrevive · &gt;3: desaparece · exatamente 3 em casa vazia: nasce. O vermelho claro mostra os próximos nascimentos.';
  };

  const legend=document.querySelector('.legend');
  if(legend)legend.innerHTML=`
    <span><i class="checker-swatch"></i> habitat neutro</span>
    <span><i class="swatch" style="background:var(--fertile-live)"></i> 🌿 bioma de uso único</span>
    <span><i class="biohazard-swatch"></i> ☣ Biohazard atual</span>
    <span><i class="biohazard-preview-swatch"></i> próximo Biohazard</span>
    <div class="piece-credit">Peças SVG: <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces" target="_blank" rel="noopener">Cburnett / Wikimedia Commons</a>.</div>`;

  const rulesParagraphs=document.querySelectorAll('#rulesModal p');
  if(rulesParagraphs[2])rulesParagraphs[2].innerHTML='<strong>Biomas e reprodução.</strong> Cada 🌿 pode ser consumido uma única vez. Uma reprodução comum custa exatamente 1 bioma disponível ou previamente armazenado. Predadores usam 1 captura acumulada.';
  if(rulesParagraphs[4])rulesParagraphs[4].innerHTML='<strong>Biohazard.</strong> ☣ é letal para organismos terrestres ao entrar ou atravessar. Voar oferece imunidade. A cada Época o Biohazard muda pelas quatro regras de Conway; vermelho claro indica casas que nascerão na próxima geração.';

  init();
})();
