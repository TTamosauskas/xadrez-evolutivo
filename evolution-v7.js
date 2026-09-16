(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const CHESS=['♙','♘','♗','♖','♔','♕'];
  const PIECE_EFFECT=[
    'Avança 1 casa para frente e captura 1 casa na diagonal para frente.',
    'Move em L e pode saltar sobre outras peças.',
    'Move livremente pelas diagonais até encontrar um obstáculo.',
    'Move livremente em linhas ortogonais até encontrar um obstáculo.',
    'Move 1 casa em qualquer direção.',
    'Move livremente em linhas ortogonais ou diagonais até encontrar um obstáculo.'
  ];
  const MUTATIONS={
    'Locomoção':{icon:'🐪',text:'Permite uma segunda movimentação com o mesmo organismo no turno.'},
    'Voo':{icon:'🐦',text:'Permite entrar, permanecer e atravessar casas mortais com segurança.'},
    'Predação':{icon:'🦁',text:'Cada captura gera uma reprodução imediata e gratuita.'},
    'Ovos':{icon:'🦎',text:'Descendentes podem nascer a até 2 casas do progenitor.'},
    'Fertilidade':{icon:'🐇',text:'Cada reprodução gera até 2 descendentes.'},
    'Carapaça':{icon:'🐢',text:'Só pode ser capturada por uma peça em casa adjacente.'}
  };

  function terrainAt(r,c,terrain){return inBounds(r,c)&&cell(r,c).terrain===terrain}
  function neighborCount(r,c,terrain){
    let count=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      if(terrainAt(r+dr,c+dc,terrain))count++;
    }
    return count;
  }
  function nextGeneration(terrain){
    const next=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const alive=terrainAt(r,c,terrain),n=neighborCount(r,c,terrain);
      next[r][c]=alive?(n===2||n===3):(n===3);
    }
    return next;
  }
  function terrainCount(terrain){
    let n=0;
    for(const row of state.board)for(const ce of row)if(ce.terrain===terrain)n++;
    return n;
  }
  function candidateClusters(){
    const clusters=[];
    const templates=[
      [[0,0],[1,0],[0,1]],[[0,0],[1,0],[0,-1]],
      [[0,0],[-1,0],[0,1]],[[0,0],[-1,0],[0,-1]]
    ];
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++)for(const shape of templates){
      const coords=shape.map(([dr,dc])=>[r+dr,c+dc]);
      if(coords.every(([rr,cc])=>inBounds(rr,cc)&&!organismAt(rr,cc)))clusters.push(coords);
    }
    if(clusters.length)return clusters;
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      if(organismAt(r,c))continue;
      const neighbours=[];
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        if(!dr&&!dc)continue;
        const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&!organismAt(rr,cc))neighbours.push([rr,cc]);
      }
      for(let i=0;i<neighbours.length;i++)for(let j=i+1;j<neighbours.length;j++)clusters.push([[r,c],neighbours[i],neighbours[j]]);
    }
    return clusters;
  }
  function seedCluster(terrain){
    const opposite=terrain==='fertile'?'biohazard':'fertile';
    const clusters=candidateClusters();if(!clusters.length)return false;
    let bestScore=Infinity,best=[];
    for(const coords of clusters){
      let oppositeCount=0,nonNeutral=0;
      for(const [r,c] of coords){
        const t=cell(r,c).terrain;
        if(t===opposite)oppositeCount++;
        if(t!=='neutral')nonNeutral++;
      }
      const score=oppositeCount*100+nonNeutral*10;
      if(score<bestScore){bestScore=score;best=[coords]}
      else if(score===bestScore)best.push(coords);
    }
    const chosen=choice(best);
    for(const [r,c] of chosen){
      const ce=cell(r,c);ce.terrain=terrain;ce.resource=terrain==='fertile'?1:0;ce.warning=null;ce.age=0;
    }
    log(terrain==='fertile'?'Um núcleo de casas férteis reapareceu após a extinção local.':'Um núcleo de casas mortais reapareceu após a extinção local.');
    return true;
  }
  function guaranteeEnvironmentalTypes(){
    for(let i=0;i<3;i++){
      if(terrainCount('fertile')===0)seedCluster('fertile');
      if(terrainCount('biohazard')===0)seedCluster('biohazard');
      if(terrainCount('fertile')>0&&terrainCount('biohazard')>0)break;
    }
  }
  function advanceDualConway(){
    const nextMortal=nextGeneration('biohazard');
    const nextFertile=nextGeneration('fertile');
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c);
      if(nextFertile[r][c]){ce.terrain='fertile';ce.resource=1}
      else if(nextMortal[r][c]){ce.terrain='biohazard';ce.resource=0}
      else{ce.terrain='neutral';ce.resource=0}
      ce.warning=null;ce.age=0;
    }
    guaranteeEnvironmentalTypes();
    const doomed=[];
    for(const o of [...state.organisms])if(terrainAt(o.r,o.c,'biohazard')&&!hasTrait(o.owner,o.lineage,'Voo'))doomed.push(o.id);
    doomed.forEach(id=>removeOrganism(id,'Uma casa mortal surgiu sob um organismo terrestre.',true));
    checkExtinction();
  }
  resolvePendingEvents=function(){advanceDualConway()};

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function rankOf(org){return Math.max(0,Math.min(5,Number(profileOf(org)?.pieceRank)||0))}
  function ensureMutationLegend(){
    document.querySelector('#selectedEvolutionInfo')?.remove();
    let box=document.querySelector('#boardMutationLegend');
    if(box)return box;
    box=document.createElement('div');box.id='boardMutationLegend';box.className='board-mutation-legend';
    const legend=document.querySelector('.legend');if(legend)legend.insertAdjacentElement('afterend',box);
    return box;
  }
  function updateLegend(){
    const legend=document.querySelector('.legend');
    if(legend)legend.innerHTML=`
      <span><i class="legend-color biome"></i> casa fértil</span>
      <span><i class="legend-color biohazard"></i> casa mortal</span>`;
    const box=ensureMutationLegend();if(!box||!state)return;
    const ranks=new Set(),traits=new Set();
    for(const org of state.organisms){
      const rank=rankOf(org),p=profileOf(org);if(rank>0)ranks.add(rank);
      for(const trait of p?.traits||[])if(MUTATIONS[trait])traits.add(trait);
    }
    let html='';
    for(const rank of [...ranks].sort((a,b)=>a-b)){
      html+=`<div class="board-mutation-row"><span class="board-chess-icon">${CHESS[rank]}</span><div><strong>Mutação de peça — ${PIECES[rank]}</strong><small>${PIECE_EFFECT[rank]}</small></div></div>`;
    }
    for(const name of Object.keys(MUTATIONS))if(traits.has(name)){
      const m=MUTATIONS[name];
      html+=`<div class="board-mutation-row"><span class="board-circle-icon">${m.icon}</span><div><strong>${name}</strong><small>${m.text}</small></div></div>`;
    }
    box.innerHTML=html||'<div class="board-mutation-empty">Nenhuma mutação ativa no tabuleiro.</div>';
  }
  const previousRenderActions=renderActions;
  renderActions=function(){previousRenderActions();updateLegend()};

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao avançar sobre uma casa fértil, ela é consumida e a reprodução acontece automaticamente. Casas férteis evoluem por Conway e, se desaparecerem totalmente, um núcleo mínimo de três casas é reintroduzido.';
  if(rules[4])rules[4].innerHTML='<strong>Casas ambientais.</strong> Casas verdes e vermelhas evoluem simultaneamente a cada Época pelas quatro regras de Conway. Cada cor conta apenas vizinhas da própria cor e a casa fértil tem prioridade em conflitos. Se uma das duas cores desaparecer totalmente, um núcleo mínimo de três casas é reintroduzido. Casas vermelhas eliminam organismos terrestres; Voo oferece imunidade.';

  updateLegend();
})();
