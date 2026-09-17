(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const PIECE_SYMBOLS=['♟','♞','♝','♜','♚','♛'];
  const TRAIT_ICONS={
    'Locomoção':'🐪','Voo':'🐦','Predação':'🦁','Ovos':'🦎','Fertilidade':'🐇','Carapaça':'🐢',
    'Ooteca':'🕷','Veneno':'🐍','Mutação Deletéria':'💀','Mutação Disfuncional':'🦵','Camuflagem':'👀',
    'Resistência':'🧬','Reprodução Sexuada':'❤️','Esterilidade':'🚫'
  };

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}

  function activeTraitNames(profile){
    const active=new Set(Array.isArray(profile?.traits)?profile.traits:[]);
    for(const entry of Array.isArray(profile?.mutationStack)?profile.mutationStack:[]){
      if(!entry?.name)continue;
      if(entry.kind==='trait')active.add(entry.name);
      else if(entry.kind==='trait-loss')active.delete(entry.name);
    }
    return active;
  }

  function inheritedCharacteristics(profile){
    const active=activeTraitNames(profile);
    if(profile?.resistance)active.add('Resistência');
    if(profile?.sexual)active.add('Reprodução Sexuada');
    if(profile?.sterile)active.add('Esterilidade');
    return [...active];
  }

  function selectedLegendTitles(org){
    const titles=new Set();
    const profile=profileOf(org);
    const rank=Math.max(0,Math.min(5,Number(profile?.pieceRank)||0));
    if(rank>0)titles.add(`Mutação de peça — ${PIECES[rank]}`);

    for(const name of inheritedCharacteristics(profile))titles.add(name);
    if(org?.ecoSick||org?.overpopSick)titles.add('Patógeno Virulento');
    if(org?.venomPoison)titles.add('Condenado por Veneno');
    return titles;
  }

  function syncSelectedPieceUi(){
    const box=document.querySelector('#selectedPieceSummary');
    const legend=document.querySelector('#boardMutationLegend,.board-mutation-legend');
    const org=typeof currentSelected==='function'?currentSelected():null;

    if(box)box.style.display=org?'':'none';
    if(!legend)return;

    const rows=[...legend.querySelectorAll('.board-mutation-row')];
    const empty=legend.querySelector('.board-mutation-empty');

    if(!org){
      for(const row of rows)row.style.display='';
      if(empty)empty.style.display='';
      legend.style.display='';
      return;
    }

    const allowed=selectedLegendTitles(org);
    let visible=0;
    for(const row of rows){
      const title=(row.querySelector('strong')?.textContent||'').trim();
      const show=allowed.has(title);
      row.style.display=show?'':'none';
      if(show)visible++;
    }
    if(empty)empty.style.display='none';
    legend.style.display=visible?'':'none';
  }

  function ownerName(owner){return owner==='blue'?'Brancas':'Pretas'}

  function profileSignature(profile){
    if(!profile)return 'ancestral';
    const rank=Math.max(0,Math.min(5,Number(profile.pieceRank)||0));
    return [rank,...inheritedCharacteristics(profile).sort()].join('|');
  }

  function evolutionarySummary(owner){
    const organisms=(state?.organisms||[]).filter(o=>o.owner===owner);
    const pieceCounts=Array(6).fill(0);
    const traitCounts=new Map();
    const lineages=new Set();

    for(const org of organisms){
      const profile=profileOf(org);
      const rank=Math.max(0,Math.min(5,Number(profile?.pieceRank)||0));
      pieceCounts[rank]++;
      lineages.add(profileSignature(profile));
      for(const trait of inheritedCharacteristics(profile)){
        traitCounts.set(trait,(traitCounts.get(trait)||0)+1);
      }
    }

    let predominantRank=0;
    for(let rank=1;rank<pieceCounts.length;rank++){
      if(pieceCounts[rank]>pieceCounts[predominantRank])predominantRank=rank;
    }

    const predominantCount=pieceCounts[predominantRank]||0;
    const predominantPercent=organisms.length?Math.round(predominantCount/organisms.length*100):0;
    const traits=[...traitCounts.entries()]
      .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'pt-BR'))
      .slice(0,3)
      .map(([name,count])=>({name,count,icon:TRAIT_ICONS[name]||'●'}));

    return {
      population:organisms.length,
      lineages:lineages.size,
      pieceName:PIECES[predominantRank],
      pieceSymbol:PIECE_SYMBOLS[predominantRank],
      piecePercent:predominantPercent,
      traits
    };
  }

  showGameOver=function(winner,reason){
    if(!winner){
      $('#gameOverTitle').textContent='Empate';
      $('#gameOverBody').innerHTML=`<p>${reason||'A partida terminou empatada.'}</p>`;
      $('#gameOverModal').classList.add('open');
      return;
    }

    const loser=winner==='blue'?'amber':'blue';
    const summary=evolutionarySummary(winner);
    const loserExtinct=(state?.organisms||[]).every(o=>o.owner!==loser);
    const extinctionText=loserExtinct
      ?`As ${ownerName(loser)} sofreram <strong>Extinção Total</strong>.`
      :(reason||`As ${ownerName(loser)} foram superadas.`);
    const lineageText=`${summary.lineages} ${summary.lineages===1?'linhagem sobrevivente':'linhagens sobreviventes'}`;
    const traitsText=summary.traits.length
      ?summary.traits.map(t=>`${t.name} ${t.icon}`).join(' · ')
      :'Nenhuma característica hereditária predominante';

    $('#gameOverTitle').textContent=`Vitória das ${ownerName(winner)}`;
    $('#gameOverBody').innerHTML=`
      <div class="evolutionary-end-summary">
        <p class="evolutionary-end-extinction">${extinctionText}</p>
        <p class="evolutionary-end-lineages">${lineageText}</p>
        <div class="evolutionary-end-section">
          <strong class="evolutionary-end-heading">Seleção natural</strong>
          <div class="evolutionary-end-primary">${summary.pieceName} ${summary.pieceSymbol} <span>(${summary.piecePercent}% da população sobrevivente)</span></div>
        </div>
        <div class="evolutionary-end-section evolutionary-end-traits">
          <strong class="evolutionary-end-heading">Características predominantes:</strong>
          <div>${traitsText}</div>
        </div>
      </div>`;
    $('#gameOverModal').classList.add('open');
  };

  function ensureSpacing(){
    let style=document.querySelector('#selectionUiPolishStyles');
    if(!style){
      style=document.createElement('style');
      style.id='selectionUiPolishStyles';
      document.head.appendChild(style);
    }
    style.textContent=`
      .controls-panel .hint{margin-top:10px!important;margin-bottom:10px!important}
      .controls-panel #passTurnBtn{margin-top:0!important}
      .evolutionary-end-summary{padding:2px 0 4px}
      .evolutionary-end-summary p{margin:0}
      .evolutionary-end-extinction{font-size:15px;line-height:1.55}
      .evolutionary-end-lineages{margin-top:18px!important;font-size:15px;font-weight:700;color:var(--text)!important}
      .evolutionary-end-section{margin-top:26px}
      .evolutionary-end-heading{display:block;margin-bottom:7px;font-size:13px;color:var(--muted);text-transform:none}
      .evolutionary-end-primary{font-size:20px;font-weight:800;color:var(--text);line-height:1.35}
      .evolutionary-end-primary span{font-size:14px;font-weight:500;color:var(--muted)}
      .evolutionary-end-traits>div{font-size:15px;line-height:1.7;color:var(--text)}
    `;
  }

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    syncSelectedPieceUi();
    return result;
  };

  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    syncSelectedPieceUi();
    return result;
  };

  const legendObserver=new MutationObserver(()=>syncSelectedPieceUi());
  const legend=document.querySelector('#boardMutationLegend,.board-mutation-legend');
  if(legend)legendObserver.observe(legend,{childList:true,subtree:true});

  ensureSpacing();
  syncSelectedPieceUi();
})();
