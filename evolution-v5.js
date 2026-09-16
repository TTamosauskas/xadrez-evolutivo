(function(){
  const PIECES=['Peão','Cavalo','Bispo','Torre','Rei','Rainha'];
  const CHESS={
    blue:['♙','♘','♗','♖','♔','♕'],
    amber:['♟','♞','♝','♜','♚','♛']
  };
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

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function rankOf(org){const p=profileOf(org);return Math.max(0,Math.min(5,Number(p?.pieceRank)||0))}
  function activeTraits(org){return (profileOf(org)?.traits||[]).filter(t=>MUTATIONS[t])}
  function ensureInfoBox(){
    let box=document.querySelector('#selectedEvolutionInfo');
    if(box)return box;
    box=document.createElement('div');box.id='selectedEvolutionInfo';box.className='selected-evolution-info';
    const hint=document.querySelector('#hint');
    if(hint)hint.insertAdjacentElement('afterend',box);
    return box;
  }
  function updateSelectedEvolutionInfo(){
    const box=ensureInfoBox();if(!box)return;
    const org=currentSelected();
    if(!org){box.innerHTML='<div class="selection-empty">Selecione uma peça para ver suas mutações acumuladas.</div>';return}
    const rank=rankOf(org),traits=activeTraits(org),piece=PIECES[rank],symbol=CHESS[org.owner][rank];
    let html='<div class="selection-title">Evolução da peça selecionada</div>';
    html+=`<div class="piece-evolution-row"><span class="chess-evolution-icon">${symbol}</span><div><strong>${piece}</strong><small>${PIECE_EFFECT[rank]}</small></div></div>`;
    if(traits.length){
      for(const name of traits){const m=MUTATIONS[name];html+=`<div class="mutation-evolution-row"><span class="circle-evolution-icon">${m.icon}</span><div><strong>${name}</strong><small>${m.text}</small></div></div>`}
    }else html+='<div class="no-extra-mutations">Sem mutações funcionais acumuladas.</div>';
    box.innerHTML=html;
  }

  const previousRenderActions=renderActions;
  renderActions=function(){previousRenderActions();updateSelectedEvolutionInfo()};
  updateSelectedEvolutionInfo();
})();
