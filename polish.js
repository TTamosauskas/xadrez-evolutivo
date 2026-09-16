(function(){
  const TOTAL_BIOMES=12;
  const BIOMES_PER_SIDE=6;
  const TOTAL_BIOHAZARD=14;
  const BIOHAZARD_PER_SIDE=7;

  function k(r,c){return `${r},${c}`}
  function uniqueCells(items){return [...new Map(items.map(x=>[k(x[0],x[1]),x])).values()]}
  function sample(items,count){return shuffle(items).slice(0,Math.min(count,items.length))}

  function rebalanceInitialEnvironment(s){
    const occupied=new Set(s.organisms.map(o=>k(o.r,o.c)));
    for(const row of s.board)for(const ce of row){
      ce.terrain='neutral';ce.resource=0;ce.home=null;ce.warning=null;ce.age=0;
    }

    const fertile=new Set();
    for(const owner of ['blue','amber']){
      const founders=s.organisms.filter(o=>o.owner===owner);
      const adjacent=[];
      for(const f of founders){
        for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
          if(!dr&&!dc)continue;
          const r=f.r+dr,c=f.c+dc;
          if(inBounds(r,c)&&!occupied.has(k(r,c)))adjacent.push([r,c]);
        }
      }
      for(const [r,c] of sample(uniqueCells(adjacent),2))fertile.add(k(r,c));
    }

    const halves={amber:[0,1,2,3],blue:[4,5,6,7]};
    for(const owner of ['amber','blue']){
      const rows=halves[owner];
      const already=[...fertile].filter(key=>rows.includes(Number(key.split(',')[0]))).length;
      const candidates=[];
      for(const r of rows)for(let c=0;c<SIZE;c++){
        const key=k(r,c);
        if(!occupied.has(key)&&!fertile.has(key))candidates.push([r,c]);
      }
      for(const [r,c] of sample(candidates,BIOMES_PER_SIDE-already))fertile.add(k(r,c));
    }

    for(const key of fertile){
      const [r,c]=key.split(',').map(Number);
      s.board[r][c].terrain='fertile';s.board[r][c].resource=1;
    }

    const protectedHazard=new Set();
    for(const o of s.organisms){
      for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
        const r=o.r+dr,c=o.c+dc;if(inBounds(r,c))protectedHazard.add(k(r,c));
      }
    }

    const hazards=[];
    for(const owner of ['amber','blue']){
      const candidates=[];
      for(const r of halves[owner])for(let c=0;c<SIZE;c++){
        const key=k(r,c);
        if(!occupied.has(key)&&!fertile.has(key)&&!protectedHazard.has(key))candidates.push([r,c]);
      }
      hazards.push(...sample(candidates,BIOHAZARD_PER_SIDE));
    }
    for(const [r,c] of hazards){s.board[r][c].terrain='biohazard';s.board[r][c].resource=0}

    s.pendingEvents=[];s.eventHistory=[];s.activeEffects={drought:0,solar:0,routes:0};
    s.habitatsVisited={blue:new Set(['neutral']),amber:new Set(['neutral'])};
  }

  const previousNewState=newState;
  newState=function(){
    const s=previousNewState();
    rebalanceInitialEnvironment(s);
    return s;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    previousRenderActions();
    const hint=$('#hint');
    if(hint)hint.textContent=hint.textContent
      .replace(/Vermelho vivo é Biohazard; vermelho claro indica o nascimento previsto para a próxima Época\./g,'Casas ☣ são Biohazard letal para organismos terrestres.')
      .replace(/vermelho claro indica o nascimento previsto para a próxima Época/gi,'casas ☣ são Biohazard letal');
  };

  const previousRender=render;
  render=function(){
    previousRender();
    document.querySelectorAll('.biohazard-preview').forEach(el=>{
      el.classList.remove('biohazard-preview');
      el.title=el.title.replace(' — torna-se Biohazard na próxima Época','');
    });
  };

  const legend=document.querySelector('.legend');
  if(legend)legend.innerHTML=`
    <span><i class="checker-swatch"></i> habitat neutro</span>
    <span><i class="swatch" style="background:var(--fertile-live)"></i> 🌿 bioma de uso único</span>
    <span><i class="biohazard-swatch"></i> ☣ Biohazard</span>`;

  document.querySelectorAll('.piece-credit').forEach(el=>el.remove());
  const rulesParagraphs=document.querySelectorAll('#rulesModal p');
  if(rulesParagraphs[4])rulesParagraphs[4].innerHTML='<strong>Biohazard.</strong> ☣ é letal para organismos terrestres ao entrar ou atravessar. Voar oferece imunidade. A cada Época, o Biohazard muda pelas quatro regras de Conway.';

  init();
})();
