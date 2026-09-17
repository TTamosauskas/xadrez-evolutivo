(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];

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

  function selectedLegendTitles(org){
    const titles=new Set();
    const profile=profileOf(org);
    const rank=Math.max(0,Math.min(5,Number(profile?.pieceRank)||0));
    if(rank>0)titles.add(`Mutação de peça — ${PIECES[rank]}`);

    for(const name of activeTraitNames(profile))titles.add(name);
    if(profile?.resistance)titles.add('Resistência');
    if(profile?.sexual)titles.add('Reprodução Sexuada');
    if(profile?.sterile)titles.add('Esterilidade');
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
