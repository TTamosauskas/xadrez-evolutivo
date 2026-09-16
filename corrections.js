(function(){
  owners.blue.name='Brancas';
  owners.amber.name='Pretas';
  owners.blue.color='#f5f5f2';
  owners.amber.color='#b8b8b5';

  const pieceLetters={pawn:'p',knight:'n',bishop:'b',rook:'r',queen:'q',king:'k'};
  const pieceNames={pawn:'Peão',knight:'Cavalo',bishop:'Bispo',rook:'Torre',queen:'Rainha',king:'Rei'};
  const commonsBase='https://commons.wikimedia.org/wiki/Special:Redirect/file/';
  const defensiveTraits=['Gigantismo','Carapaça','Camuflagem','Espinhos'];
  const ecologicalTraits=['Anfibismo','Criotolerância','Xerotolerância','Toxirresistência'];
  const systemicTraits=['Metabolismo Econômico','Predação','Propagação'];

  function pieceTypeFor(org){
    const traits=lineage(org.owner,org.lineage).traits;
    if(traits.length===0)return 'pawn';
    const orthogonal=traits.includes('Vetor Alongado')||traits.includes('Superespecialização');
    const diagonal=traits.includes('Plasticidade Fenotípica');
    const jumping=traits.includes('Saltador');
    if(traits.length>=3||(orthogonal&&diagonal)||(orthogonal&&jumping))return 'queen';
    if(jumping)return 'knight';
    if(orthogonal)return 'rook';
    if(diagonal||traits.some(t=>ecologicalTraits.includes(t)))return 'bishop';
    if(traits.some(t=>defensiveTraits.includes(t))||traits.some(t=>systemicTraits.includes(t)))return 'king';
    return 'pawn';
  }

  function pieceAssetFor(org){
    const type=pieceTypeFor(org);
    const tone=org.owner==='blue'?'lt':'dt';
    return {
      type,
      name:pieceNames[type],
      url:`${commonsBase}Chess_${pieceLetters[type]}${tone}45.svg`
    };
  }

  function terrainMarkFor(terrain){
    return {desert:'☀',ice:'❄',water:'≈',toxic:'☣',volcanic:'▲'}[terrain]||'';
  }

  renderBoard=function(){
    boardEl.innerHTML='';
    const sel=currentSelected();
    let legal=[];
    if(sel)legal=state.mode==='reproduce'?reproductionTargets(sel):movementTargets(sel);
    const legalMap=new Map(legal.map(t=>[key(t.r,t.c),t]));

    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c),div=document.createElement('div'),org=organismAt(r,c),target=legalMap.get(key(r,c));
      const square=(r+c)%2===0?'square-light':'square-dark';
      const fertileActive=ce.terrain==='fertile'&&ce.resource>0?' fertile-active':'';
      const terrainClass=ce.terrain!=='neutral'&&ce.terrain!=='fertile'?` terrain-${ce.terrain}`:'';
      div.className=`cell ${square}${fertileActive}${terrainClass}${ce.warning?' warn':''}${sel&&sel.r===r&&sel.c===c?' selected':''}${target?(target.capture?' capture':' legal'):''}`;
      div.title=`${terrainName(ce.terrain)}${ce.resource?` — ${ce.resource} recurso(s)`:''}`;
      div.addEventListener('click',()=>handleCellClick(r,c));

      const mark=terrainMarkFor(ce.terrain);
      if(mark){const tm=document.createElement('span');tm.className='terrain-mark';tm.textContent=mark;tm.setAttribute('aria-hidden','true');div.appendChild(tm)}

      if(ce.resource>0){
        const res=document.createElement('span');
        res.className='resource';
        res.textContent=`🌿 ${ce.resource}`;
        div.appendChild(res);
      }

      if(org){
        const asset=pieceAssetFor(org),od=document.createElement('div'),img=document.createElement('img');
        od.className=`org ${org.owner}`;
        od.title=`${owners[org.owner].name} · Linhagem ${org.lineage} · forma ${asset.name}\n${lineage(org.owner,org.lineage).traits.length?lineage(org.owner,org.lineage).traits.join(', '):'Generalista ancestral'}\nReserva: ${org.stored} · Biomassa: ${org.biomass}`;
        img.src=asset.url;
        img.alt=`${asset.name} ${org.owner==='blue'?'branco':'preto'}`;
        img.draggable=false;
        od.appendChild(img);
        const states=[];
        if(org.stored)states.push(`R${org.stored}`);
        if(org.biomass)states.push(`B${org.biomass}`);
        if(org.stress)states.push(`⚠${org.stress}`);
        if(states.length){const badge=document.createElement('span');badge.className='org-state';badge.textContent=states.join(' ');od.appendChild(badge)}
        div.appendChild(od);
      }
      boardEl.appendChild(div);
    }
  };

  renderActions=function(){
    const sel=currentSelected();
    ['moveBtn','reproBtn','feedBtn','specialBtn'].forEach(id=>$('#'+id).classList.remove('active'));
    $('#'+({move:'moveBtn',reproduce:'reproBtn'}[state.mode]||'moveBtn')).classList.add('active');
    $('#reproBtn').disabled=!sel;$('#feedBtn').disabled=!sel;$('#specialBtn').disabled=!sel;$('#moveBtn').disabled=!sel;$('#passBtn').disabled=state.gameOver;
    let hint=`Turno das ${owners[state.current].name}. `;
    if(!sel)hint+='Selecione um organismo para agir.';
    else if(state.mode==='move')hint+=`Linhagem ${sel.lineage} selecionada. Escolha uma casa com contorno verde ou uma captura com contorno vermelho.`;
    else{const p=canPayRepro(sel);hint+=p.ok?`Escolha a casa do descendente. Custo: ${p.biomass?'2 Biomassas':p.cost+' recurso(s)'}.`:`Reprodução indisponível: ${p.reason}.`}
    $('#hint').textContent=hint;
  };

  showGameOver=function(winner,reason,a,b){
    $('#gameOverTitle').textContent=winner?`${owners[winner].name} vencem`:'Empate evolutivo';
    $('#gameOverBody').innerHTML=`<p>${reason}</p><table class="score-table"><thead><tr><th>Critério</th><th>Brancas</th><th>Pretas</th></tr></thead><tbody><tr><td>População ×3</td><td>${a.pop*3}</td><td>${b.pop*3}</td></tr><tr><td>Linhagens vivas ×2</td><td>${a.live*2}</td><td>${b.live*2}</td></tr><tr><td>Habitats ocupados</td><td>${a.habitats}</td><td>${b.habitats}</td></tr><tr><td>Reproduções</td><td>${a.repro}</td><td>${b.repro}</td></tr><tr><th>Total</th><th>${a.total}</th><th>${b.total}</th></tr></tbody></table>`;
    $('#gameOverModal').classList.add('open');
  };

  const legend=document.querySelector('.legend');
  if(legend){
    legend.innerHTML=`
      <span><i class="checker-swatch"></i> habitat neutro</span>
      <span><i class="swatch" style="background:var(--fertile-live)"></i> fértil com recurso</span>
      <span><i class="swatch" style="background:var(--desert)"></i> deserto</span>
      <span><i class="swatch" style="background:var(--ice)"></i> gelo</span>
      <span><i class="swatch" style="background:var(--water)"></i> água</span>
      <span><i class="swatch" style="background:var(--toxic)"></i> tóxico</span>
      <span><i class="swatch" style="background:var(--volcanic)"></i> vulcânico</span>
      <div class="piece-credit">Peças SVG: <a href="https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces" target="_blank" rel="noopener">Cburnett / Wikimedia Commons</a> · CC BY-SA 3.0 e licenças indicadas nos arquivos.</div>`;
  }

  render();
})();
