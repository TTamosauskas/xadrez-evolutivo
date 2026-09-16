(function(){
  const EFFECT_TRAITS=['Locomoção','Voo','Predação','Ovos','Fertilidade','Carapaça'];
  const DIFFICULTIES=['easy','medium','hard'];
  const DIFFICULTY_LABELS={easy:'Fácil',medium:'Médio',hard:'Difícil'};
  const BIRTH_RATES=[4,3,2,2,1,1];
  let singlePlayer=localStorage.getItem('xe_game_mode')==='single';
  let aiDifficulty=localStorage.getItem('xe_ai_difficulty')||'easy';
  if(!DIFFICULTIES.includes(aiDifficulty))aiDifficulty='easy';
  let aiTimer=null;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function normalizeProfile(p){
    if(!p)return;
    p.pieceRank=Math.max(0,Math.min(5,Number(p.pieceRank)||0));
    p.traits=(p.traits||[]).filter(t=>EFFECT_TRAITS.includes(t));
    p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack.filter(x=>!(x.kind==='trait'&&x.name==='Superespecialização')):[];
  }
  function has(org,name){const p=profileOf(org);normalizeProfile(p);return !!p&&p.traits.includes(name)}
  function profileSignature(p){normalizeProfile(p);return `${p.pieceRank}|${[...p.traits].sort().join(',')}`}
  function livingSummary(owner){
    const orgs=playerOrganisms(owner),profiles=new Map();
    for(const o of orgs){
      const p=profileOf(o);if(!p)continue;
      const signature=profileSignature(p);if(!profiles.has(signature))profiles.set(signature,p);
    }
    let mutations=0;
    for(const p of profiles.values())mutations+=p.mutationStack.length;
    return {pieces:orgs.length,generations:state.reproCount[owner]||0,mutations,lineages:profiles.size};
  }

  renderPlayer=function(owner,el){
    const s=livingSummary(owner),systemTag=singlePlayer&&owner==='amber'?`<span class="system-player-tag">Sistema · ${DIFFICULTY_LABELS[aiDifficulty]}</span>`:'';
    el.innerHTML=`
      <div class="player-head compact-player-head"><div class="player-name ${owner}">${owners[owner].name}${systemTag}</div></div>
      <div class="player-summary-grid">
        <div class="player-summary-stat"><strong>${s.pieces}</strong><span>peças</span></div>
        <div class="player-summary-stat"><strong>${s.generations}</strong><span>gerações</span></div>
        <div class="player-summary-stat"><strong>${s.mutations}</strong><span>mutações</span></div>
        <div class="player-summary-stat"><strong>${s.lineages}</strong><span>linhagens vivas</span></div>
      </div>`;
  };
  renderPlayers=function(){renderPlayer('blue',$('#bluePanel'));renderPlayer('amber',$('#amberPanel'))};

  showGameOver=function(winner,reason){
    const a=livingSummary('blue'),b=livingSummary('amber');
    $('#gameOverTitle').textContent=winner?`${owners[winner].name} vence`:'Empate';
    $('#gameOverBody').innerHTML=`
      <p>${reason}</p>
      <table class="score-table"><thead><tr><th>Critério</th><th>Brancas</th><th>Pretas</th></tr></thead><tbody>
        <tr><td>Peças</td><td>${a.pieces}</td><td>${b.pieces}</td></tr>
        <tr><td>Gerações</td><td>${a.generations}</td><td>${b.generations}</td></tr>
        <tr><td>Mutações</td><td>${a.mutations}</td><td>${b.mutations}</td></tr>
        <tr><td>Linhagens vivas</td><td>${a.lineages}</td><td>${b.lineages}</td></tr>
      </tbody></table>`;
    $('#gameOverModal').classList.add('open');
  };

  function hasLegalMove(owner){return playerOrganisms(owner).some(o=>movementTargets(o).length>0)}
  function compareTechnical(a,b){
    for(const key of ['pieces','generations','mutations','lineages']){
      if(a[key]!==b[key])return {winner:a[key]>b[key]?'blue':'amber',criterion:key};
    }
    return {winner:null,criterion:null};
  }
  function technicalEnd(){
    const a=livingSummary('blue'),b=livingSummary('amber'),result=compareTechnical(a,b);
    const labels={pieces:'número de peças',generations:'gerações',mutations:'mutações',lineages:'linhagens vivas'};
    state.gameOver=true;state.selected=null;state.moveChain=null;
    clearAiTimer();render();
    $('#gameOverTitle').textContent=result.winner?`${owners[result.winner].name} vence por desempate técnico`:'Empate técnico';
    $('#gameOverBody').innerHTML=`
      <p>Os dois lados ficaram sem movimentos legais em sequência.${result.winner?` O primeiro critério de desempate diferente foi <strong>${labels[result.criterion]}</strong>.`:' Os quatro critérios permaneceram iguais.'}</p>
      <table class="score-table"><thead><tr><th>Critério</th><th>Brancas</th><th>Pretas</th></tr></thead><tbody>
        <tr><td>Peças</td><td>${a.pieces}</td><td>${b.pieces}</td></tr>
        <tr><td>Gerações</td><td>${a.generations}</td><td>${b.generations}</td></tr>
        <tr><td>Mutações</td><td>${a.mutations}</td><td>${b.mutations}</td></tr>
        <tr><td>Linhagens vivas</td><td>${a.lineages}</td><td>${b.lineages}</td></tr>
      </tbody></table>`;
    $('#gameOverModal').classList.add('open');
  }

  function ensureDifficultyButton(){
    let btn=document.querySelector('#difficultyBtn');
    if(btn)return btn;
    const mode=document.querySelector('#modeBtn');if(!mode)return null;
    btn=document.createElement('button');
    btn.className='btn';btn.id='difficultyBtn';btn.type='button';
    mode.insertAdjacentElement('afterend',btn);
    btn.addEventListener('click',()=>{
      const i=DIFFICULTIES.indexOf(aiDifficulty);
      aiDifficulty=DIFFICULTIES[(i+1)%DIFFICULTIES.length];
      localStorage.setItem('xe_ai_difficulty',aiDifficulty);
      clearAiTimer();updateModeUI();render();
      if(singlePlayer&&state?.current==='amber'&&!state.gameOver)scheduleSystemTurn(180);
    });
    return btn;
  }
  function updateModeUI(){
    const btn=document.querySelector('#modeBtn');
    if(btn){
      btn.textContent=singlePlayer?'Modo: 1 jogador':'Modo: 2 jogadores';
      btn.classList.toggle('single-player-active',singlePlayer);
      btn.setAttribute('aria-pressed',singlePlayer?'true':'false');
    }
    const difficultyBtn=ensureDifficultyButton();
    if(difficultyBtn){
      difficultyBtn.hidden=!singlePlayer;
      difficultyBtn.textContent=`Dificuldade: ${DIFFICULTY_LABELS[aiDifficulty]}`;
      difficultyBtn.dataset.difficulty=aiDifficulty;
      difficultyBtn.setAttribute('aria-label',`Dificuldade do sistema: ${DIFFICULTY_LABELS[aiDifficulty]}. Clique para alterar.`);
    }
    const aiTurn=singlePlayer&&state&&!state.gameOver&&state.current==='amber';
    document.body.classList.toggle('single-player-ai-turn',!!aiTurn);
    const pass=document.querySelector('#passTurnBtn');if(pass)pass.disabled=!!state?.gameOver||!!aiTurn;
    renderPlayers();
  }

  const previousRenderActions=renderActions;
  renderActions=function(){
    previousRenderActions();
    const hint=$('#hint');
    if(singlePlayer&&state?.current==='amber'&&!state.gameOver)hint.textContent=`Turno das Pretas · Sistema (${DIFFICULTY_LABELS[aiDifficulty]}).`;
    const pass=document.querySelector('#passTurnBtn');
    if(pass)pass.disabled=!!state?.gameOver||(singlePlayer&&state?.current==='amber');
    updateModeUI();
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(r,c){
    if(singlePlayer&&state?.current==='amber')return;
    return previousHandleCellClick(r,c);
  };

  function nearestEnemyDistance(owner,r,c){
    const enemies=state.organisms.filter(o=>o.owner!==owner);
    if(!enemies.length)return 0;
    return Math.min(...enemies.map(o=>Math.max(Math.abs(o.r-r),Math.abs(o.c-c))));
  }
  function organismValue(org){
    const p=profileOf(org);normalizeProfile(p);
    const rankValues=[12,30,34,48,62,78];
    const reproductive=(BIRTH_RATES[p?.pieceRank||0]||1)*(has(org,'Fertilidade')?2:1);
    return rankValues[p?.pieceRank||0]+(p?.traits?.length||0)*14+reproductive*3;
  }
  function moveWouldBeLethal(org,t){
    return !has(org,'Voo')&&Array.isArray(t.path)&&t.path.some(([r,c])=>cell(r,c).terrain==='biohazard');
  }

  function withTemporaryMove(org,t,fn){
    const fromR=org.r,fromC=org.c;
    const defender=organismAt(t.r,t.c);
    const defenderIndex=defender?state.organisms.indexOf(defender):-1;
    if(defenderIndex>=0)state.organisms.splice(defenderIndex,1);
    org.r=t.r;org.c=t.c;
    try{return fn(defender)}finally{
      org.r=fromR;org.c=fromC;
      if(defenderIndex>=0)state.organisms.splice(defenderIndex,0,defender);
    }
  }

  function birthCapacity(org){
    const p=profileOf(org);normalizeProfile(p);
    return (BIRTH_RATES[p?.pieceRank||0]||1)*(has(org,'Fertilidade')?2:1);
  }
  function projectedBirthsForMove(org,t){
    if(moveWouldBeLethal(org,t))return 0;
    const dest=cell(t.r,t.c),defender=organismAt(t.r,t.c);
    const fertile=dest.terrain==='fertile'&&dest.resource>0;
    const predation=!!defender&&defender.owner!==org.owner&&has(org,'Predação');
    if(!fertile&&!predation)return 0;
    const room=Math.max(0,MAX_POP-playerOrganisms(org.owner).length);
    if(!room)return 0;
    return withTemporaryMove(org,t,()=>{
      const range=has(org,'Ovos')?2:1;
      let spaces=0;
      for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
        if(!dr&&!dc)continue;
        const r=org.r+dr,c=org.c+dc;
        if(!inBounds(r,c)||organismAt(r,c))continue;
        if(cell(r,c).terrain==='biohazard'&&!has(org,'Voo'))continue;
        spaces++;
      }
      return Math.min(birthCapacity(org),room,spaces);
    });
  }
  function reproductionValue(org,t){
    const births=projectedBirthsForMove(org,t);
    if(!births)return 0;
    const p=profileOf(org);normalizeProfile(p);
    const childBase=[12,30,34,48,62,78][p?.pieceRank||0]||12;
    return births*(42+childBase*.8)+(has(org,'Fertilidade')?births*10:0);
  }
  function tacticalMoveValue(org,t,randomness=0){
    const defender=organismAt(t.r,t.c),dest=cell(t.r,t.c);
    let score=Math.random()*randomness;
    if(moveWouldBeLethal(org,t))return score-5000;
    if(defender&&defender.owner!==org.owner)score+=650+organismValue(defender)*11;
    score+=reproductionValue(org,t);
    const before=nearestEnemyDistance(org.owner,org.r,org.c),after=nearestEnemyDistance(org.owner,t.r,t.c);
    score+=(before-after)*8;
    if(dest.terrain!=='biohazard')score+=12;
    return score;
  }
  function coreMoveScore(org,t,randomness){return tacticalMoveValue(org,t,randomness)}

  function immediateThreatToMovedPiece(org,t){
    return withTemporaryMove(org,t,()=>{
      let attackers=0,worst=0,mobility=movementTargets(org).length;
      for(const enemy of playerOrganisms('blue')){
        for(const reply of movementTargets(enemy)){
          if(moveWouldBeLethal(enemy,reply))continue;
          if(reply.r===org.r&&reply.c===org.c){
            attackers++;
            worst=Math.max(worst,tacticalMoveValue(enemy,reply));
          }
        }
      }
      return {attackers,worst,mobility};
    });
  }

  // Fácil: boa no lance imediato, reprodução e segurança básica, mas mantém pequena variedade entre equivalentes.
  function easyMoveScore(org,t){
    let score=coreMoveScore(org,t,1.4);
    if(moveWouldBeLethal(org,t))return score;
    const safety=immediateThreatToMovedPiece(org,t),value=organismValue(org);
    if(safety.attackers)score-=value*5+safety.worst*.22+safety.attackers*18;
    else score+=value*.35;
    score+=Math.min(14,safety.mobility)*2.5;
    return score;
  }

  function bestOpponentReplyPenalty(org,t){
    return withTemporaryMove(org,t,()=>{
      let best=0;
      for(const enemy of playerOrganisms('blue')){
        for(const reply of movementTargets(enemy)){
          if(moveWouldBeLethal(enemy,reply))continue;
          let score=tacticalMoveValue(enemy,reply);
          const victim=organismAt(reply.r,reply.c);
          if(victim&&victim.owner==='amber'&&playerOrganisms('amber').length===1)score+=20000;
          best=Math.max(best,score);
        }
      }
      return best;
    });
  }
  function ownFollowupValue(org,t){
    return withTemporaryMove(org,t,()=>{
      let best=0;
      for(const ally of playerOrganisms('amber')){
        for(const next of movementTargets(ally)){
          if(moveWouldBeLethal(ally,next))continue;
          best=Math.max(best,tacticalMoveValue(ally,next));
        }
      }
      return best;
    });
  }

  // Médio: antigo difícil, agora com o valor real dos lotes nas respostas das Brancas.
  function mediumMoveScore(org,t){
    let score=coreMoveScore(org,t,.25);
    if(moveWouldBeLethal(org,t))return score;
    const safety=immediateThreatToMovedPiece(org,t),value=organismValue(org);
    if(safety.attackers)score-=value*8+safety.worst*.32+safety.attackers*32;
    else score+=value*.8;
    score+=Math.min(20,safety.mobility)*4;
    score-=bestOpponentReplyPenalty(org,t)*1.04;
    score+=ownFollowupValue(org,t)*.25;
    const defender=organismAt(t.r,t.c);
    if(defender&&defender.owner==='blue'&&playerOrganisms('blue').length===1)score+=25000;
    return score;
  }

  function nearestFertileDistance(r,c){
    let best=Infinity;
    for(let rr=0;rr<SIZE;rr++)for(let cc=0;cc<SIZE;cc++){
      const ce=cell(rr,cc);
      if(ce.terrain!=='fertile'||ce.resource<=0)continue;
      best=Math.min(best,Math.max(Math.abs(rr-r),Math.abs(cc-c)));
    }
    return best;
  }
  function mobilityTotal(owner){
    let total=0;
    for(const o of playerOrganisms(owner))total+=movementTargets(o).length;
    return total;
  }
  function positionalValueAfterMove(org,t){
    return withTemporaryMove(org,t,()=>{
      const own=mobilityTotal('amber'),opp=mobilityTotal('blue');
      let value=own*5-opp*2.5;
      if(own===0)value-=1800;
      if(opp===0)value+=900;
      const populationGap=playerOrganisms('amber').length-playerOrganisms('blue').length;
      value+=populationGap*18;
      return value;
    });
  }
  function fertileGrowthValue(org,t){
    const room=Math.max(0,MAX_POP-playerOrganisms(org.owner).length);
    if(!room)return 0;
    const before=nearestFertileDistance(org.r,org.c);
    const after=nearestFertileDistance(t.r,t.c);
    let score=0;
    if(Number.isFinite(before)&&Number.isFinite(after))score+=(before-after)*14;
    const births=projectedBirthsForMove(org,t);
    if(births>0)score+=births*75;
    else if(cell(t.r,t.c).terrain==='fertile'&&cell(t.r,t.c).resource>0)score-=180;
    else if(after===1)score+=24;
    return score;
  }
  function bestCounterAfterReply(){
    let best=0;
    for(const ally of playerOrganisms('amber')){
      for(const next of movementTargets(ally)){
        if(moveWouldBeLethal(ally,next))continue;
        best=Math.max(best,tacticalMoveValue(ally,next)+reproductionValue(ally,next)*.25);
      }
    }
    return best;
  }
  function worstReplyWithCounter(org,t){
    return withTemporaryMove(org,t,()=>{
      let worst=0;
      for(const enemy of playerOrganisms('blue')){
        for(const reply of movementTargets(enemy)){
          if(moveWouldBeLethal(enemy,reply))continue;
          const replyValue=tacticalMoveValue(enemy,reply);
          const net=withTemporaryMove(enemy,reply,()=>{
            const amberMobility=mobilityTotal('amber');
            const counter=amberMobility?bestCounterAfterReply():0;
            return replyValue-counter*.34+(amberMobility?0:1800);
          });
          worst=Math.max(worst,net);
        }
      }
      return worst;
    });
  }

  // Difícil: Médio + crescimento sustentável + mobilidade + capacidade de contra-atacar após a melhor resposta branca.
  function hardMoveScore(org,t){
    let score=mediumMoveScore(org,t);
    if(moveWouldBeLethal(org,t))return score;
    score+=fertileGrowthValue(org,t);
    score+=positionalValueAfterMove(org,t)*.75;
    score-=worstReplyWithCounter(org,t)*.48;
    return score;
  }
  function scoreSystemMove(org,target){
    if(aiDifficulty==='hard')return hardMoveScore(org,target);
    if(aiDifficulty==='medium')return mediumMoveScore(org,target);
    return easyMoveScore(org,target);
  }
  function bestSystemMove(){
    const moves=[];
    if(state.moveChain){
      const org=state.organisms.find(o=>o.id===state.moveChain.orgId&&o.owner==='amber');
      if(org)for(const target of movementTargets(org))moves.push({org,target,score:scoreSystemMove(org,target)});
    }else{
      for(const org of playerOrganisms('amber'))for(const target of movementTargets(org))moves.push({org,target,score:scoreSystemMove(org,target)});
    }
    if(!moves.length)return null;
    moves.sort((a,b)=>b.score-a.score);
    if(aiDifficulty==='hard'||aiDifficulty==='medium')return moves[0];
    const tolerance=1.75;
    const topScore=moves[0].score,top=moves.filter(m=>m.score>=topScore-tolerance);
    return choice(top);
  }
  function clearAiTimer(){if(aiTimer!==null){clearTimeout(aiTimer);aiTimer=null}}
  function scheduleSystemTurn(delay=320){
    clearAiTimer();
    if(!singlePlayer||!state||state.gameOver||state.current!=='amber')return;
    updateModeUI();
    aiTimer=setTimeout(systemStep,delay);
  }
  function systemStep(){
    aiTimer=null;
    if(!singlePlayer||!state||state.gameOver||state.current!=='amber')return;
    const move=bestSystemMove();
    if(!move){
      log(`${owners.amber.name} não possui movimentos legais e passa automaticamente.`);
      finishTurn(true);
      return;
    }
    state.selected=move.org.id;state.mode='move';render();
    setTimeout(()=>{
      if(!singlePlayer||!state||state.gameOver||state.current!=='amber')return;
      const liveOrg=state.organisms.find(o=>o.id===move.org.id);
      if(!liveOrg){scheduleSystemTurn();return}
      const legal=movementTargets(liveOrg).find(t=>t.r===move.target.r&&t.c===move.target.c);
      if(!legal){scheduleSystemTurn();return}
      executeMove(liveOrg,legal);
      if(singlePlayer&&!state.gameOver&&state.current==='amber')scheduleSystemTurn(260);
    },180);
  }

  function deferBlockedResolution(blocked,secondBlock){
    setTimeout(()=>{
      if(!state||state.gameOver||state.current!==blocked)return;
      if(hasLegalMove(blocked)){
        render();
        if(singlePlayer&&blocked==='amber')scheduleSystemTurn(180);
        return;
      }
      if(secondBlock){technicalEnd();return}
      log(`${owners[blocked].name} não possui movimentos legais e passa automaticamente.`);
      finishTurn(true);
    },0);
  }

  finishTurn=function(forcedNoMove=false){
    if(state.gameOver)return;
    state.moveChain=null;state.selected=null;state.mode='move';state.organisms.forEach(o=>o.newborn=false);
    checkExtinction();if(state.gameOver){render();return}
    state.turn++;state.current=opposing(state.current);
    if(state.turn%TURNS_PER_EPOCH===0)endEpoch();
    if(state.gameOver){render();return}
    if(!hasLegalMove(state.current)){
      const blocked=state.current;
      render();
      deferBlockedResolution(blocked,forcedNoMove);
      return;
    }
    render();
    if(singlePlayer&&state.current==='amber')scheduleSystemTurn();
  };

  const modeBtn=document.querySelector('#modeBtn');
  if(modeBtn)modeBtn.addEventListener('click',()=>{
    singlePlayer=!singlePlayer;
    localStorage.setItem('xe_game_mode',singlePlayer?'single':'multi');
    clearAiTimer();state.selected=null;state.moveChain=null;render();updateModeUI();
    if(singlePlayer&&state.current==='amber'&&!state.gameOver)scheduleSystemTurn(200);
  });

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[0])rules[0].innerHTML='<strong>Objetivo.</strong> A partida termina por extinção total ou por desempate técnico somente quando os dois lados ficam sem movimentos legais em sequência. O desempate compara, nesta ordem: peças, gerações, mutações e linhagens vivas.';
  if(rules[5])rules[5].innerHTML='<strong>Controles.</strong> Use o botão de modo no topo para alternar entre 2 jogadores e 1 jogador. No modo de 1 jogador, você controla as Brancas e o sistema controla as Pretas. Há três dificuldades: Fácil considera valor imediato, reprodução e segurança básica, mantendo alguma variedade entre lances equivalentes; Médio também calcula a melhor resposta imediata das Brancas e o valor reprodutivo dessa resposta; Difícil acrescenta crescimento sustentável, mobilidade global e uma camada adicional de contra-jogo após a resposta branca. Se um lado não tiver movimentos legais, sua vez passa automaticamente; o desempate técnico só ocorre se o adversário também estiver bloqueado na sequência. Clique numa peça sua e depois numa casa com borda azul; “Passar a vez” encerra seu turno sem movimento.';

  updateModeUI();
  if(singlePlayer&&state?.current==='amber'&&!state.gameOver)scheduleSystemTurn();
})();