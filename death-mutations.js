(function(){
  const OOTHECA='Ooteca';
  const VENOM='Veneno';
  const VENOM_TURNS=3;
  let captureContext=null;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function normalizeProfile(p){
    if(typeof window.xeNormalizeMutationProfile==='function')window.xeNormalizeMutationProfile(p);
    return p;
  }
  function hasMutation(org,name){
    if(typeof window.xeProfileHasMutation==='function')return !!window.xeProfileHasMutation(org,name);
    const p=normalizeProfile(profileOf(org));return !!p?.traits?.includes(name);
  }
  function ensureIcons(org){
    const cellEl=boardEl?.children?.[org.r*SIZE+org.c],orgEl=cellEl?.querySelector?.('.org');
    if(!orgEl)return;
    let icons=orgEl.querySelector('.mutation-icons');
    if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}
    if(hasMutation(org,OOTHECA)&&!icons.querySelector('[data-ootheca-icon]')){
      const el=document.createElement('span');el.className='mutation-icon';el.dataset.oothecaIcon='1';el.textContent='🕷';el.title='Ooteca — ao morrer, realiza uma reprodução';icons.appendChild(el);
    }
    if(hasMutation(org,VENOM)&&!icons.querySelector('[data-venom-icon]')){
      const el=document.createElement('span');el.className='mutation-icon';el.dataset.venomIcon='1';el.textContent='🐍';el.title='Veneno — ao ser morta por uma peça, intoxica o agressor';icons.appendChild(el);
    }
    if(org.venomPoison){
      let sick=icons.querySelector('[data-venom-sick-icon]');
      if(!sick){sick=document.createElement('span');sick.className='mutation-icon';sick.dataset.venomSickIcon='1';sick.textContent='🤮';icons.appendChild(sick)}
      sick.title=`Envenenado: morre em ${org.venomPoison.remaining} turno(s)`;
    }
  }
  function renderMutationIcons(){for(const org of state?.organisms||[])ensureIcons(org)}

  function applyVenom(attacker,source){
    if(!attacker||!state?.organisms?.some(o=>o.id===attacker.id))return;
    attacker.venomPoison={remaining:VENOM_TURNS,infectedAtTurn:state.turn,sourceOwner:source?.owner,sourceLineage:source?.lineage};
    log(`${owners[attacker.owner].name}: 🤮 uma peça foi envenenada por Veneno 🐍 e morrerá em ${VENOM_TURNS} turnos.`);
  }
  function triggerOotheca(dead){
    if(!dead||typeof window.xeReproduceFromMutation!=='function')return 0;
    const born=window.xeReproduceFromMutation(dead,'Ooteca 🕷 após a morte')||0;
    if(born)log(`${owners[dead.owner].name}: 🕷 Ooteca realizou uma reprodução após a morte.`);
    else log(`${owners[dead.owner].name}: 🕷 Ooteca foi ativada após a morte, mas não houve espaço/população disponível para descendentes.`);
    return born;
  }

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    const defender=org&&t?organismAt(t.r,t.c):null;
    const isCapture=!!defender&&defender.id!==org?.id&&defender.owner!==org?.owner;
    const previousContext=captureContext;
    captureContext=isCapture?{attackerId:org.id,defenderId:defender.id}:null;
    try{return previousExecuteMove.apply(this,arguments)}finally{captureContext=previousContext}
  };

  const previousRemoveOrganism=removeOrganism;
  removeOrganism=function(id,msg){
    const dead=state?.organisms?.find(o=>o.id===id);
    if(!dead)return previousRemoveOrganism.apply(this,arguments);
    const snapshot={...dead};
    const ootheca=hasMutation(dead,OOTHECA);
    const venom=hasMutation(dead,VENOM);
    const attackerId=captureContext?.defenderId===id?captureContext.attackerId:null;
    const result=previousRemoveOrganism.apply(this,arguments);
    const removed=!state?.organisms?.some(o=>o.id===id);
    if(!removed)return result;
    if(venom&&attackerId){
      const attacker=state.organisms.find(o=>o.id===attackerId);
      if(attacker)applyVenom(attacker,snapshot);
    }
    if(ootheca)triggerOotheca(snapshot);
    return result;
  };

  function tickVenom(beforeTurn){
    const doomed=[];
    for(const org of state?.organisms||[]){
      const poison=org.venomPoison;if(!poison)continue;
      if(!Number.isInteger(poison.remaining)||poison.remaining<1)poison.remaining=VENOM_TURNS;
      if(!Number.isInteger(poison.infectedAtTurn))poison.infectedAtTurn=beforeTurn;
      if(poison.infectedAtTurn>=beforeTurn)continue;
      poison.remaining=Math.max(0,poison.remaining-1);
      if(poison.remaining<=0)doomed.push(org.id);
    }
    for(const id of doomed){
      if(!state.organisms.some(o=>o.id===id))continue;
      removeOrganism(id,'Uma peça sucumbiu ao Veneno 🐍 após 3 turnos de intoxicação.',true);
    }
    if(doomed.length)checkExtinction();
    return doomed.length;
  }

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const before=state?.turn||0;
    const result=previousFinishTurn.apply(this,arguments);
    if(!state||state.turn===before||state.gameOver)return result;
    const deaths=tickVenom(before);
    if(deaths)render();else renderMutationIcons();
    return result;
  };

  function renderLegend(){
    const box=document.querySelector('#boardMutationLegend');if(!box)return;
    box.querySelector('[data-ootheca-row]')?.remove();
    box.querySelector('[data-venom-row]')?.remove();
    box.querySelector('[data-venom-sick-row]')?.remove();
    const orgs=state?.organisms||[];
    const anyOotheca=orgs.some(o=>hasMutation(o,OOTHECA));
    const anyVenom=orgs.some(o=>hasMutation(o,VENOM));
    const anySick=orgs.some(o=>o.venomPoison);
    if(!anyOotheca&&!anyVenom&&!anySick)return;
    box.querySelector('.board-mutation-empty')?.remove();
    if(anyOotheca)box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-ootheca-row><span class="board-circle-icon">🕷</span><div><strong>Ooteca</strong><small>Quando a peça morre, ativa uma reprodução normal a partir de sua última posição. Esterilidade 🚫 ainda impede a reprodução.</small></div></div>');
    if(anyVenom)box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-venom-row><span class="board-circle-icon">🐍</span><div><strong>Veneno</strong><small>Quando esta peça é morta por outra peça, o agressor fica intoxicado.</small></div></div>');
    if(anySick)box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-venom-sick-row><span class="board-circle-icon">🤮</span><div><strong>Intoxicação</strong><small>O agressor envenenado morre após 3 turnos. Uma nova exposição reinicia o contador.</small></div></div>');
  }
  function ensureRules(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let row=modal.querySelector('.death-mutations-rule');
    if(!row){row=document.createElement('p');row.className='death-mutations-rule';modal.insertBefore(row,modal.querySelector('.modal-actions'))}
    const html='<strong>Mutações de morte.</strong> Ooteca 🕷 ativa uma reprodução normal quando a peça morre; Esterilidade 🚫 ainda bloqueia esse nascimento. Veneno 🐍 é acionado quando a peça é morta por outra peça: o agressor recebe 🤮 e morre após 3 turnos. Uma nova exposição ao Veneno reinicia o contador em 3.';
    if(row.innerHTML!==html)row.innerHTML=html;
  }
  function patchMutationModal(){
    const modal=document.querySelector('#explanationModal');if(!modal?.classList.contains('open'))return;
    const title=modal.querySelector('#explanationModalTitle'),body=modal.querySelector('#explanationModalBody');if(!title||!body)return;
    const text=title.textContent||'',lost=/perdeu|efeito perdido/i.test(body.textContent||'');
    if(/^Mutação:\s*Ooteca\b/i.test(text)){
      const newTitle='Mutação: Ooteca 🕷';if(title.textContent!==newTitle)title.textContent=newTitle;
      const html=lost?'<p>A peça perdeu Ooteca 🕷.</p><p><strong>Efeito perdido:</strong> ao morrer, ela não ativará mais uma reprodução.</p>':'<p>Ao morrer, esta peça ativa uma reprodução normal a partir de sua última posição.</p><p>Esterilidade 🚫 continua impedindo esse nascimento.</p>';
      if(body.innerHTML!==html)body.innerHTML=html;
    }else if(/^Mutação:\s*Veneno\b/i.test(text)){
      const newTitle='Mutação: Veneno 🐍';if(title.textContent!==newTitle)title.textContent=newTitle;
      const html=lost?'<p>A peça perdeu Veneno 🐍.</p><p><strong>Efeito perdido:</strong> ela não intoxica mais a peça que a matar.</p>':'<p>Quando esta peça é morta por outra peça, o agressor recebe 🤮.</p><p>O agressor intoxicado morre após 3 turnos; uma nova exposição reinicia o contador.</p>';
      if(body.innerHTML!==html)body.innerHTML=html;
    }
  }

  const previousRenderBoard=renderBoard;
  renderBoard=function(){const result=previousRenderBoard.apply(this,arguments);renderMutationIcons();return result};
  const previousRenderActions=renderActions;
  renderActions=function(){const result=previousRenderActions.apply(this,arguments);renderLegend();ensureRules();patchMutationModal();return result};
  const previousRender=render;
  render=function(){const result=previousRender.apply(this,arguments);renderMutationIcons();renderLegend();ensureRules();patchMutationModal();return result};

  const observer=new MutationObserver(()=>patchMutationModal());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  renderMutationIcons();renderLegend();ensureRules();patchMutationModal();
})();
