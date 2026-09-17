(function(){
  const DELETERIOUS='Mutação Deletéria';
  const DELETERIOUS_ROUNDS=3;

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function hasDeleterious(org){
    if(typeof window.xeProfileHasMutation==='function')return !!window.xeProfileHasMutation(org,DELETERIOUS);
    const p=profileOf(org);return !!p?.traits?.includes(DELETERIOUS);
  }
  function acquisitionRoundFromTurn(turn){
    const t=Math.max(0,Number(turn)||0);
    return Math.max(1,Math.ceil(t/2));
  }
  function ensureTimers(){
    if(!state?.organisms)return;
    for(const org of state.organisms){
      if(!hasDeleterious(org)){
        delete org.deleteriousRemaining;
        delete org.deleteriousStartRound;
        continue;
      }
      if(!Number.isInteger(org.deleteriousRemaining)||org.deleteriousRemaining<1||org.deleteriousRemaining>DELETERIOUS_ROUNDS){
        org.deleteriousRemaining=DELETERIOUS_ROUNDS;
      }
      if(!Number.isInteger(org.deleteriousStartRound)||org.deleteriousStartRound<1){
        org.deleteriousStartRound=acquisitionRoundFromTurn(state.turn);
      }
    }
  }
  function tickDeleterious(){
    ensureTimers();
    const completedRound=Math.floor((state?.turn||0)/2),doomed=[];
    for(const org of state?.organisms||[]){
      if(!hasDeleterious(org))continue;
      if(completedRound<=org.deleteriousStartRound)continue;
      org.deleteriousRemaining=Math.max(0,(org.deleteriousRemaining||DELETERIOUS_ROUNDS)-1);
      if(org.deleteriousRemaining<=0)doomed.push(org.id);
    }
    for(const id of doomed){
      if(!state.organisms.some(o=>o.id===id))continue;
      removeOrganism(id,'Uma peça sucumbiu à Mutação Deletéria 💀 após viver 3 rodadas.',true);
    }
    if(doomed.length)checkExtinction();
    return doomed.length;
  }

  function ensureMutationIcon(org){
    if(!hasDeleterious(org))return;
    const cellEl=boardEl?.children?.[org.r*SIZE+org.c],orgEl=cellEl?.querySelector?.('.org');
    if(!orgEl)return;
    let icons=orgEl.querySelector('.mutation-icons');
    if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}
    let icon=icons.querySelector('[data-deleterious-icon]');
    if(!icon){
      icon=document.createElement('span');icon.className='mutation-icon deleterious-mutation-icon';
      icon.dataset.deleteriousIcon='1';icon.textContent='💀';icons.appendChild(icon);
    }
    icon.title=`Mutação Deletéria — ${org.deleteriousRemaining||DELETERIOUS_ROUNDS} rodada(s) de vida restantes`;
  }
  function renderIcons(){ensureTimers();for(const org of state?.organisms||[])ensureMutationIcon(org)}

  function renderLegend(){
    const box=document.querySelector('#boardMutationLegend');if(!box)return;
    box.querySelector('[data-deleterious-row]')?.remove();
    const any=(state?.organisms||[]).some(hasDeleterious);if(!any)return;
    box.querySelector('.board-mutation-empty')?.remove();
    box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-deleterious-row><span class="board-circle-icon">💀</span><div><strong>Mutação Deletéria</strong><small>Mutação negativa hereditária. A peça vive apenas 3 rodadas completas após adquiri-la; o contador é individual de cada peça.</small></div></div>');
  }
  function ensureRule(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let row=modal.querySelector('.deleterious-mutation-rule');
    if(!row){row=document.createElement('p');row.className='deleterious-mutation-rule';modal.insertBefore(row,modal.querySelector('.modal-actions'))}
    const html='<strong>Mutação Deletéria 💀.</strong> É uma mutação negativa hereditária. A peça que a possui vive somente 3 rodadas completas e então morre. Peões voltam a poder receber mutações negativas, mas somente em 1/5 das mutações; nas demais peças a chance de mutação negativa continua em 1/3.';
    if(row.innerHTML!==html)row.innerHTML=html;
  }
  function patchMutationModal(){
    const modal=document.querySelector('#explanationModal');if(!modal?.classList.contains('open'))return;
    const title=modal.querySelector('#explanationModalTitle'),body=modal.querySelector('#explanationModalBody');if(!title||!body)return;
    if(!/Mutação Deletéria/i.test(title.textContent||'')&&!/Mutação Deletéria/i.test(body.textContent||''))return;
    const lost=/perdeu|efeito perdido/i.test(body.textContent||'');
    const desiredTitle='Mutação: Mutação Deletéria 💀';
    const desiredBody=lost
      ?'<p>A peça perdeu a Mutação Deletéria 💀 e não está mais limitada ao ciclo de vida de 3 rodadas.</p>'
      :'<p>Esta peça recebeu a Mutação Deletéria 💀.</p><p>Ela viverá somente 3 rodadas completas e morrerá ao final da terceira.</p>';
    if(title.textContent!==desiredTitle)title.textContent=desiredTitle;
    if(body.innerHTML!==desiredBody)body.innerHTML=desiredBody;
  }
  function patchDisplayedLogs(){
    const root=document.querySelector('#log');if(!root)return;
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let node;while((node=walker.nextNode())){
      if(node.nodeValue?.includes('Nova especialidade: Mutação Deletéria'))node.nodeValue=node.nodeValue.replaceAll('Nova especialidade: Mutação Deletéria','Mutação: Mutação Deletéria');
    }
  }

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const before=state?.turn||0;
    const result=previousFinishTurn.apply(this,arguments);
    if(!state||state.turn===before)return result;
    if(state.turn%2===0){
      const deaths=tickDeleterious();
      if(deaths&&!state.gameOver)render();
    }
    return result;
  };

  const previousRenderBoard=renderBoard;
  renderBoard=function(){const result=previousRenderBoard.apply(this,arguments);renderIcons();return result};
  const previousRenderActions=renderActions;
  renderActions=function(){const result=previousRenderActions.apply(this,arguments);renderLegend();ensureRule();patchMutationModal();patchDisplayedLogs();return result};
  const previousRender=render;
  render=function(){const result=previousRender.apply(this,arguments);renderIcons();renderLegend();ensureRule();patchMutationModal();patchDisplayedLogs();return result};

  const previousDeserializeState=deserializeState;
  deserializeState=function(){const result=previousDeserializeState.apply(this,arguments);ensureTimers();return result};

  const observer=new MutationObserver(()=>{patchMutationModal();patchDisplayedLogs()});
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  ensureTimers();renderIcons();renderLegend();ensureRule();patchMutationModal();patchDisplayedLogs();
})();