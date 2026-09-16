(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const BASE_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça'];
  const EVENTS=[
    {id:'volcano',name:'Erupção Vulcânica',desc:'Uma área 2×2 adicional é marcada como perigosa.'},
    {id:'ice',name:'Era Glacial',desc:'Um canto congela e a zona perigosa avança uma linha ou coluna por rodada.'},
    {id:'pathogen',name:'Patógeno Virulento',desc:'A linhagem mais densa é infectada. Peças doentes morrem em 4 rodadas e podem contagiar adjacentes.'},
    {id:'solar',name:'Tempestade Solar',desc:'Todo nascimento sofre mutação enquanto o evento estiver ativo.'},
    {id:'drought',name:'Seca Severa',desc:'As casas férteis ficam limitadas à metade da quantidade existente no início do evento.'},
    {id:'sea',name:'Elevação do Mar',desc:'Toda a borda do tabuleiro é marcada como perigosa.'},
    {id:'meteor',name:'Meteoro',desc:'Um quadrante inteiro do tabuleiro é marcado como perigoso.'},
    {id:'desert',name:'Desertificação',desc:'As casas férteis desaparecem progressivamente até restar apenas uma.'},
    {id:'blockade',name:'Bloqueio Geográfico',desc:'Uma diagonal de casas perigosas corta o tabuleiro ao meio.'},
    {id:'abundance',name:'Superabundância de Recursos',desc:'O número de casas férteis é dobrado.'},
    {id:'fertilized',name:'Ambiente Fertilizado',desc:'Uma nova casa fértil surge a cada rodada, expandindo-se a partir das áreas férteis.'}
  ];

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
  function signature(p){normalizeProfile(p);return `${p.pieceRank}|${[...p.traits].sort().join(',')}|R${p.resistance?1:0}`}
  function activeEvent(){return state?.ecoCycle?.active||null}
  function completedRounds(){return Math.floor((state?.turn||0)/2)}
  function cellKey(r,c){return `${r},${c}`}
  function parseKey(k){return k.split(',').map(Number)}
  function isMortal(r,c){return inBounds(r,c)&&cell(r,c).terrain==='biohazard'}
  function shuffleCopy(a){return shuffle([...a])}

  function ensureCycle(s=state){
    if(!s)return;
    const rounds=Math.floor((s.turn||0)/2);
    if(!s.ecoCycle||typeof s.ecoCycle!=='object')s.ecoCycle={};
    if(!Number.isFinite(s.ecoCycle.nextEventRound))s.ecoCycle.nextEventRound=(Math.floor(rounds/10)+1)*10;
    if(s.ecoCycle.nextEventRound<rounds)s.ecoCycle.nextEventRound=(Math.floor(rounds/10)+1)*10;
    if(!('previousId' in s.ecoCycle))s.ecoCycle.previousId=null;
    if(!('active' in s.ecoCycle))s.ecoCycle.active=null;
    for(const o of s.organisms||[])if(o.ecoSick&&typeof o.ecoSick.remaining!=='number')delete o.ecoSick;
  }

  const priorNewState=newState;
  newState=function(){const s=priorNewState();s.ecoCycle={nextEventRound:10,previousId:null,active:null};return s};
  const priorDeserialize=deserializeState;
  deserializeState=function(raw){priorDeserialize(raw);ensureCycle();renderEventStatus();render()};

  function cloneProfile(parent,id){
    const src=profileOf(parent);normalizeProfile(src);
    const p={
      id,parent:parent.lineage,traits:[...src.traits],pieceRank:src.pieceRank,
      resistance:!!src.resistance,
      mutationStack:src.mutationStack.map(x=>({...x})),bornEpoch:state.epoch,
      mutations:[...src.mutations],nameCounter:0
    };
    state.lineages[parent.owner][id]=p;return p;
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
      const r=parent.r+dr,c=parent.c+dc;if(!inBounds(r,c)||organismAt(r,c))continue;
      if(isMortal(r,c)&&!has(parent,'Voo'))continue;out.push({r,c});
    }
    return shuffle(out);
  }
  function mutationChance(){return activeEvent()?.id==='solar'?1:(1/3)}
  function makeChild(parent,r,c){
    const id=state.nextOrgId++,lineageId=`O${id}`;cloneProfile(parent,lineageId);
    const child={id,owner:parent.owner,lineage:lineageId,r,c,stored:0,biomass:0,stress:0,plasticity:null,newborn:true};
    state.organisms.push(child);markHabitat(child);
    if(Math.random()<mutationChance()){
      const result=applyMutation(child);if(result)log(`${owners[child.owner].name}: ${result}.`);
    }else log(`${owners[child.owner].name}: descendente herdou as mutações sem nova alteração.`);
    return child;
  }
  function reproduce(parent,reason){
    if(playerOrganisms(parent.owner).length>=MAX_POP)return 0;
    const wanted=has(parent,'Fertilidade')?2:1,cells=birthCells(parent);let born=0;
    while(born<wanted&&cells.length&&playerOrganisms(parent.owner).length<MAX_POP){const t=cells.shift();makeChild(parent,t.r,t.c);born++}
    if(born){state.reproCount[parent.owner]++;log(`${owners[parent.owner].name} gerou ${born} descendente(s) por ${reason}.`)}return born;
  }
  rollMutation=function(){return Math.random()<mutationChance()};

  executeMove=function(org,t){
    const second=state.moveChain&&state.moveChain.orgId===org.id,locomotion=has(org,'Locomoção');
    if(!has(org,'Voo')&&t.path&&t.path.some(([r,c])=>isMortal(r,c))){
      removeOrganism(org.id,`${owners[org.owner].name} atravessou uma casa mortal e foi eliminado.`,true);
      checkExtinction();if(state.gameOver){render();return}finishTurn();return;
    }
    const destination=cell(t.r,t.c),fertile=destination.terrain==='fertile'&&destination.resource>0,defender=organismAt(t.r,t.c);
    if(defender){removeOrganism(defender.id,`${owners[defender.owner].name} perdeu uma peça em captura.`,true);org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} realizou uma captura.`)}
    else{org.r=t.r;org.c=t.c;markHabitat(org)}
    if(fertile){destination.resource=0;destination.terrain='neutral';reproduce(org,'casa fértil')}
    if(defender&&has(org,'Predação'))reproduce(org,'predação');
    checkExtinction();if(state.gameOver){render();return}
    if(locomotion&&!second&&state.organisms.some(o=>o.id===org.id)){
      const next=movementTargets(org);if(next.length){state.moveChain={orgId:org.id};state.selected=org.id;state.mode='move';render();return}
    }
    finishTurn();
  };

  function fertileCells(){
    const out=[];for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){const ce=cell(r,c);if(ce.terrain==='fertile'&&ce.resource>0)out.push([r,c])}return out;
  }
  function neutralEmptyCells(){
    const out=[];for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)if(cell(r,c).terrain==='neutral'&&!organismAt(r,c))out.push([r,c]);return out;
  }
  function makeFertile(r,c){const ce=cell(r,c);ce.terrain='fertile';ce.resource=1;ce.warning=null;ce.age=0}
  function trimFertileTo(target){
    target=Math.max(1,target);const f=shuffleCopy(fertileCells());
    while(f.length>target){const [r,c]=f.pop(),ce=cell(r,c);ce.terrain='neutral';ce.resource=0}
    if(fertileCells().length===0){const pick=choice(neutralEmptyCells());if(pick)makeFertile(pick[0],pick[1])}
  }
  function addFertileAdjacent(count){
    let added=0;
    while(added<count){
      const candidates=[],seen=new Set();
      for(const [r,c] of fertileCells())for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;const rr=r+dr,cc=c+dc,k=cellKey(rr,cc);
        if(inBounds(rr,cc)&&!seen.has(k)&&cell(rr,cc).terrain==='neutral'&&!organismAt(rr,cc)){seen.add(k);candidates.push([rr,cc])}
      }
      let pick=candidates.length?choice(candidates):choice(neutralEmptyCells());if(!pick)break;
      makeFertile(pick[0],pick[1]);added++;
    }
    return added;
  }

  function rememberHazardCell(ev,r,c){
    const k=cellKey(r,c);if(ev.hazardCells.includes(k))return;
    const ce=cell(r,c);ev.hazardCells.push(k);ev.snapshots.push({r,c,terrain:ce.terrain,resource:ce.resource||0});
  }
  function markDanger(ev,coords){
    for(const [r,c] of coords){if(!inBounds(r,c))continue;rememberHazardCell(ev,r,c);const ce=cell(r,c);ce.terrain='biohazard';ce.resource=0}
  }
  function reapplyHazards(ev){
    for(const k of ev.hazardCells||[]){const [r,c]=parseKey(k);if(inBounds(r,c)){const ce=cell(r,c);ce.terrain='biohazard';ce.resource=0}}
  }
  function restoreHazards(ev){
    for(const s of ev.snapshots||[]){if(!inBounds(s.r,s.c))continue;const ce=cell(s.r,s.c);ce.terrain=s.terrain;ce.resource=s.terrain==='fertile'?Math.max(1,s.resource||1):0}
  }
  function eliminateHazardVictims(){
    const doomed=[];for(const o of [...state.organisms])if(isMortal(o.r,o.c)&&!has(o,'Voo'))doomed.push(o.id);
    doomed.forEach(id=>removeOrganism(id,'Uma área perigosa do evento eliminou uma peça terrestre.',true));
    checkExtinction();
  }

  const priorResolvePendingEvents=resolvePendingEvents;
  resolvePendingEvents=function(){
    const ev=activeEvent();
    if(!ev||!ev.hazardCells?.length)return priorResolvePendingEvents();
    for(const s of ev.snapshots){const ce=cell(s.r,s.c);ce.terrain=s.terrain;ce.resource=s.terrain==='fertile'?Math.max(1,s.resource||1):0}
    priorResolvePendingEvents();
    for(const s of ev.snapshots){const ce=cell(s.r,s.c);s.terrain=ce.terrain;s.resource=ce.resource||0}
    reapplyHazards(ev);
  };

  function random2x2(){const r=randInt(SIZE-1),c=randInt(SIZE-1);return [[r,c],[r+1,c],[r,c+1],[r+1,c+1]]}
  function borderCells(){const out=[];for(let i=0;i<SIZE;i++){out.push([0,i],[SIZE-1,i]);if(i>0&&i<SIZE-1)out.push([i,0],[i,SIZE-1])}return out}
  function quadrantCells(q){const out=[],r0=q<2?0:4,c0=q%2===0?0:4;for(let r=r0;r<r0+4;r++)for(let c=c0;c<c0+4;c++)out.push([r,c]);return out}
  function diagonalCells(anti){const out=[];for(let r=0;r<SIZE;r++)out.push([r,anti?SIZE-1-r:r]);return out}
  function iceCoords(ev){const out=[];for(let i=0;i<ev.rowDepth;i++)for(let j=0;j<ev.colDepth;j++){const r=ev.corner.includes('bottom')?SIZE-1-i:i,c=ev.corner.includes('right')?SIZE-1-j:j;out.push([r,c])}return out}

  function densestSusceptibleGroup(){
    const groups=new Map();
    for(const o of state.organisms){const p=profileOf(o);normalizeProfile(p);if(p?.resistance)continue;const k=signature(p);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(o)}
    const sorted=[...groups.values()].sort((a,b)=>b.length-a.length);if(!sorted.length)return [];
    const top=sorted[0].length;return choice(sorted.filter(g=>g.length===top));
  }
  function infect(org){if(!org||has(org,'Resistência')||org.ecoSick)return false;org.ecoSick={remaining:4};return true}
  function applyPathogen(){const group=densestSusceptibleGroup();for(const o of group)infect(o)}
  function tickPathogen(){
    const existing=state.organisms.filter(o=>o.ecoSick);
    const newly=[];
    for(const o of existing){
      if(has(o,'Resistência')){delete o.ecoSick;continue}
      for(const target of state.organisms){
        if(target.id===o.id||target.ecoSick||has(target,'Resistência'))continue;
        if(Math.max(Math.abs(target.r-o.r),Math.abs(target.c-o.c))===1&&Math.random()<.5)newly.push(target);
      }
    }
    for(const o of newly)infect(o);
    const doomed=[];
    for(const o of existing){if(!o.ecoSick)continue;o.ecoSick.remaining--;if(o.ecoSick.remaining<=0)doomed.push(o.id)}
    doomed.forEach(id=>removeOrganism(id,'Uma peça sucumbiu ao Patógeno Virulento.',true));checkExtinction();
  }

  function applyEvent(def,round){
    const ev={id:def.id,name:def.name,desc:def.desc,startRound:round,age:0,hazardCells:[],snapshots:[]};state.ecoCycle.active=ev;
    if(def.id==='volcano')markDanger(ev,random2x2());
    else if(def.id==='ice'){ev.corner=choice(['top-left','top-right','bottom-left','bottom-right']);ev.rowDepth=1;ev.colDepth=1;markDanger(ev,iceCoords(ev))}
    else if(def.id==='pathogen')applyPathogen();
    else if(def.id==='drought'){ev.fertileCap=Math.max(1,Math.ceil(fertileCells().length/2));trimFertileTo(ev.fertileCap)}
    else if(def.id==='sea')markDanger(ev,borderCells());
    else if(def.id==='meteor'){ev.quadrant=randInt(4);markDanger(ev,quadrantCells(ev.quadrant))}
    else if(def.id==='desert'){ev.initialFertile=Math.max(1,fertileCells().length);trimFertileTo(ev.initialFertile)}
    else if(def.id==='blockade'){ev.anti=Math.random()<.5;markDanger(ev,diagonalCells(ev.anti))}
    else if(def.id==='abundance'){if(fertileCells().length===0)trimFertileTo(1);const n=fertileCells().length;addFertileAdjacent(n)}
    else if(def.id==='fertilized')addFertileAdjacent(1);
    if(ev.hazardCells.length)eliminateHazardVictims();
    log(`Evento ecológico: ${def.name}. ${def.desc}`);announceEventUI();renderEventStatus();render();
  }
  function tickEvent(ev){
    ev.age++;
    if(ev.id==='ice'){
      const canRow=ev.rowDepth<SIZE,canCol=ev.colDepth<SIZE;
      if(canRow||canCol){if(canRow&&canCol){if(Math.random()<.5)ev.rowDepth++;else ev.colDepth++}else if(canRow)ev.rowDepth++;else ev.colDepth++;markDanger(ev,iceCoords(ev))}
    }else if(ev.id==='pathogen')tickPathogen();
    else if(ev.id==='drought')trimFertileTo(ev.fertileCap);
    else if(ev.id==='desert'){
      const target=Math.max(1,Math.ceil(ev.initialFertile*(10-ev.age)/10));trimFertileTo(target);
    }else if(ev.id==='fertilized')addFertileAdjacent(1);
    if(ev.hazardCells.length){reapplyHazards(ev);eliminateHazardVictims()}
  }
  function endEvent(ev){
    if(!ev)return;
    if(ev.hazardCells?.length)restoreHazards(ev);
    if(ev.id==='pathogen')for(const o of state.organisms)delete o.ecoSick;
    log(`Fim do evento ecológico: ${ev.name}.`);state.ecoCycle.previousId=ev.id;state.ecoCycle.active=null;
  }
  function pickEvent(){let pool=EVENTS.filter(e=>e.id!==state.ecoCycle.previousId);if(!pool.length)pool=EVENTS;return choice(pool)}
  function processCompletedRound(round){
    ensureCycle();let ev=activeEvent();if(ev)tickEvent(ev);if(state.gameOver)return;
    if(round>=state.ecoCycle.nextEventRound){
      if(ev)endEvent(ev);const def=pickEvent();applyEvent(def,round);state.ecoCycle.nextEventRound=round+10;
    }
    renderEventStatus();render();
  }

  const priorFinishTurn=finishTurn;
  finishTurn=function(...args){
    const before=state?.turn||0;priorFinishTurn(...args);if(!state||state.gameOver)return;
    if(state.turn!==before&&state.turn%2===0)processCompletedRound(completedRounds());
  };

  function ensureEventBanner(){
    let el=document.querySelector('#ecoEventBanner');if(el)return el;
    el=document.createElement('div');el.id='ecoEventBanner';el.className='eco-event-banner';
    const strip=document.querySelector('.status-strip');if(strip)strip.insertAdjacentElement('afterend',el);return el;
  }
  function renderEventStatus(){
    ensureCycle();const el=ensureEventBanner();if(!el)return;const ev=activeEvent(),round=completedRounds();
    const trend=document.querySelector('#trendValue');
    if(!ev){const until=Math.max(0,state.ecoCycle.nextEventRound-round);el.innerHTML=`<strong>Próximo evento ecológico</strong><span>em ${until} rodada(s)</span>`;el.classList.remove('active');if(trend)trend.textContent='Estável';return}
    const left=Math.max(0,state.ecoCycle.nextEventRound-round);el.classList.add('active');
    el.innerHTML=`<strong>${ev.name}</strong><span>${ev.desc}</span><small>${left} rodada(s) até o próximo evento</small>`;if(trend)trend.textContent=ev.name;
  }
  function announceEventUI(){const el=ensureEventBanner();if(!el)return;el.classList.remove('announce');void el.offsetWidth;el.classList.add('announce')}

  const priorRenderBoard=renderBoard;
  renderBoard=function(){
    priorRenderBoard();
    for(const o of state.organisms){
      const cellEl=boardEl.children[o.r*SIZE+o.c],orgEl=cellEl?.querySelector('.org');if(!orgEl)continue;
      const p=profileOf(o);normalizeProfile(p);
      if(p?.resistance){let icons=orgEl.querySelector('.mutation-icons');if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}const r=document.createElement('span');r.className='mutation-icon resistance-icon';r.title='Resistência';r.textContent='🧬';icons.appendChild(r)}
      if(o.ecoSick){const badge=document.createElement('span');badge.className='pathogen-badge';badge.textContent='🤢';badge.title=`Patógeno: ${o.ecoSick.remaining} rodada(s) até a morte`;orgEl.appendChild(badge)}
    }
  };

  const priorRenderPlayer=renderPlayer;
  renderPlayer=function(owner,el){
    priorRenderPlayer(owner,el);const orgs=playerOrganisms(owner),profiles=new Map();
    for(const o of orgs){const p=profileOf(o);if(!p)continue;const k=signature(p);if(!profiles.has(k))profiles.set(k,p)}
    let mutations=0;for(const p of profiles.values())mutations+=p.mutationStack.length;
    const stats=el.querySelectorAll('.player-summary-stat strong');if(stats[2])stats[2].textContent=mutations;if(stats[3])stats[3].textContent=profiles.size;
  };

  const priorRenderActions=renderActions;
  renderActions=function(){priorRenderActions();renderEventStatus();const box=document.querySelector('#boardMutationLegend');if(box){box.querySelector('[data-resistance-row]')?.remove();const any=state.organisms.some(o=>profileOf(o)?.resistance);if(any)box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-resistance-row><span class="board-circle-icon">🧬</span><div><strong>Resistência</strong><small>Impede novas infecções pelo Patógeno Virulento.</small></div></div>')}};

  const priorShowGameOver=showGameOver;
  showGameOver=function(winner,reason){priorShowGameOver(winner,reason)};

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[3])rules[3].innerHTML='<strong>Evolução.</strong> Cada descendente herda as mutações do progenitor. Em condições normais, 1/3 dos nascimentos sofre mutação; durante Tempestade Solar, 100%. Entre as mutações, 1/3 são downgrades e 2/3 ganhos. Resistência 🧬 torna a peça imune a novas infecções pelo Patógeno Virulento.';
  const modal=document.querySelector('#rulesModal .modal');
  if(modal&&!modal.querySelector('.eco-events-rule')){
    const p=document.createElement('p');p.className='eco-events-rule';p.innerHTML='<strong>Eventos ecológicos.</strong> A cada 10 rodadas completas um evento é sorteado, anunciado e aplicado. O evento anterior termina quando o próximo começa. Áreas perigosas temporárias funcionam como casas mortais; Voo continua oferecendo imunidade.';const actions=modal.querySelector('.modal-actions');modal.insertBefore(p,actions);
  }

  ensureCycle();renderEventStatus();render();
})();
