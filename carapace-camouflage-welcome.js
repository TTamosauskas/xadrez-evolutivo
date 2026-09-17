(function(){
  const CAMOUFLAGE='Camuflagem';
  const CARAPACE='Carapaça';
  const POSITIVE_KINDS=new Set(['piece-up','trait-gain','resistance-gain','sexual-gain']);
  const NEGATIVE_KINDS=new Set(['piece-down','trait-loss','resistance-loss','sexual-loss','sterility','deleterious']);
  const HOW_TO_PLAY_HTML='<p><strong>Xadrez Evolutivo</strong> mistura regras do xadrez com darwinismo:</p><ul><li>Peças que se reproduzem</li><li>Mutações aleatórias</li><li>Filhos que herdam características</li><li>Tabuleiro que exige adaptação</li><li>Eventos ecológicos afetam o jogo</li></ul><p>Ganhe o jogo ao tornar-se a linhagem dominante.</p>';

  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function profileHasMutation(profile,name){
    if(!profile)return false;
    let active=Array.isArray(profile.traits)&&profile.traits.includes(name);
    for(const entry of Array.isArray(profile.mutationStack)?profile.mutationStack:[]){
      if(entry?.name!==name)continue;
      if(entry.kind==='trait')active=true;
      else if(entry.kind==='trait-loss')active=false;
    }
    return active;
  }
  function hasMutation(org,name){
    if(name!==CAMOUFLAGE&&typeof window.xeProfileHasMutation==='function')return !!window.xeProfileHasMutation(org,name);
    return profileHasMutation(profileOf(org),name);
  }
  function newestNewborn(){
    const orgs=state?.organisms||[];
    for(let i=orgs.length-1;i>=0;i--)if(orgs[i]?.newborn)return orgs[i];
    return null;
  }
  function isPool(a,kinds){return Array.isArray(a)&&a.length>0&&a.every(x=>x&&typeof x.kind==='string'&&kinds.has(x.kind))}

  const previousChoice=choice;
  choice=function(a){
    if(isPool(a,POSITIVE_KINDS)){
      const options=[...a],child=newestNewborn();
      if(child&&!hasMutation(child,CAMOUFLAGE))options.push({kind:'trait-gain',name:CAMOUFLAGE,camouflageInjected:true});
      return previousChoice(options);
    }
    if(isPool(a,NEGATIVE_KINDS)){
      const options=[...a],child=newestNewborn();
      if(child&&hasMutation(child,CAMOUFLAGE)&&!options.some(x=>x.kind==='trait-loss'&&x.name===CAMOUFLAGE))options.push({kind:'trait-loss',name:CAMOUFLAGE,camouflageLoss:true});
      return previousChoice(options);
    }
    return previousChoice(a);
  };

  function resolveSexualInheritance(){
    if(!state?.lineages)return;
    for(const owner of ['blue','amber'])for(const p of Object.values(state.lineages[owner]||{})){
      if(!p?.mate||p.camouflageSexualResolved)continue;
      if(profileHasMutation(p,CAMOUFLAGE)){p.camouflageSexualResolved=true;continue}
      const parent=state.lineages[owner]?.[p.parent],mate=state.lineages[owner]?.[p.mate];
      const a=profileHasMutation(parent,CAMOUFLAGE),b=profileHasMutation(mate,CAMOUFLAGE);
      const inherit=a&&b?true:(a||b?Math.random()<.5:false);
      if(inherit){
        p.traits=Array.isArray(p.traits)?p.traits:[];
        if(!p.traits.includes(CAMOUFLAGE))p.traits.push(CAMOUFLAGE);
        p.mutationStack=Array.isArray(p.mutationStack)?p.mutationStack:[];
        p.mutationStack.push({kind:'trait',name:CAMOUFLAGE,direction:'up',inherited:true});
        p.mutations=Array.isArray(p.mutations)?p.mutations:[];
        if(!p.mutations.includes(CAMOUFLAGE))p.mutations.push(CAMOUFLAGE);
      }
      p.camouflageSexualResolved=true;
    }
  }

  captureAllowed=function(attacker,t){
    const defender=organismAt(t.r,t.c);if(!defender)return true;
    const distance=Math.max(Math.abs(t.r-attacker.r),Math.abs(t.c-attacker.c));
    return !(hasMutation(defender,CAMOUFLAGE)&&distance>1);
  };

  function renderCamouflageIcons(){
    resolveSexualInheritance();
    for(const org of state?.organisms||[]){
      if(!hasMutation(org,CAMOUFLAGE))continue;
      const orgEl=boardEl?.children?.[org.r*SIZE+org.c]?.querySelector?.('.org');if(!orgEl)continue;
      let icons=orgEl.querySelector('.mutation-icons');
      if(!icons){icons=document.createElement('div');icons.className='mutation-icons';orgEl.appendChild(icons)}
      if(!icons.querySelector('[data-camouflage-icon]')){
        const icon=document.createElement('span');icon.className='mutation-icon';icon.dataset.camouflageIcon='1';icon.title=CAMOUFLAGE;icon.textContent='👀';icons.appendChild(icon);
      }
      if(!orgEl.title.includes(CAMOUFLAGE))orgEl.title+=`${orgEl.title?' · ':''}${CAMOUFLAGE}`;
    }
  }

  function renderMutationLegend(){
    const box=document.querySelector('#boardMutationLegend');if(!box)return;
    const orgs=state?.organisms||[];
    const anyCarapace=orgs.some(o=>hasMutation(o,CARAPACE));
    const anyCamouflage=orgs.some(o=>hasMutation(o,CAMOUFLAGE));
    for(const row of box.querySelectorAll('.board-mutation-row')){
      const strong=row.querySelector('strong');if(strong?.textContent.trim()!==CARAPACE)continue;
      const small=row.querySelector('small');if(small)small.textContent='Aumenta a segurança em casa hostil: 66% de chance de sobrevivência em cada rodada.';
    }
    const carapaceRow=[...box.querySelectorAll('.board-mutation-row')].find(row=>row.querySelector('strong')?.textContent.trim()===CARAPACE);
    if(anyCarapace&&!carapaceRow){
      box.querySelector('.board-mutation-empty')?.remove();
      box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-carapace-safety-row><span class="board-circle-icon">🐢</span><div><strong>Carapaça</strong><small>Aumenta a segurança em casa hostil: 66% de chance de sobrevivência em cada rodada.</small></div></div>');
    }
    box.querySelector('[data-camouflage-row]')?.remove();
    if(anyCamouflage){
      box.querySelector('.board-mutation-empty')?.remove();
      box.insertAdjacentHTML('beforeend','<div class="board-mutation-row" data-camouflage-row><span class="board-circle-icon">👀</span><div><strong>Camuflagem</strong><small>Só pode ser capturada por uma peça em casa adjacente.</small></div></div>');
    }
  }

  function patchMutationModal(){
    const modal=document.querySelector('#explanationModal');if(!modal?.classList.contains('open'))return;
    const title=modal.querySelector('#explanationModalTitle'),body=modal.querySelector('#explanationModalBody');if(!title||!body)return;
    const combined=`${title.textContent||''} ${body.textContent||''}`;
    const lost=/perdeu|efeito perdido/i.test(body.textContent||'');
    if(/Carapaça/i.test(combined)){
      const desiredTitle='Mutação: Carapaça 🐢';
      const desiredBody=lost?'<p>A peça perdeu Carapaça 🐢.</p><p><strong>Efeito perdido:</strong> deixa de ter 66% de chance de sobrevivência em casas hostis.</p>':'<p>Esta peça recebeu Carapaça 🐢.</p><p>Em cada rodada passada numa casa hostil, sua chance de sobrevivência aumenta para 66%.</p>';
      if(title.textContent!==desiredTitle)title.textContent=desiredTitle;
      if(body.innerHTML!==desiredBody)body.innerHTML=desiredBody;
    }else if(/Camuflagem/i.test(combined)){
      const desiredTitle='Mutação: Camuflagem 👀';
      const desiredBody=lost?'<p>A peça perdeu Camuflagem 👀.</p><p><strong>Efeito perdido:</strong> volta a poder ser capturada à distância.</p>':'<p>Esta peça recebeu Camuflagem 👀.</p><p>Só pode ser capturada por uma peça em casa adjacente.</p>';
      if(title.textContent!==desiredTitle)title.textContent=desiredTitle;
      if(body.innerHTML!==desiredBody)body.innerHTML=desiredBody;
    }
  }

  function rewriteHostileLegend(){
    const legend=[...document.querySelectorAll('.legend span')].find(el=>/casa mortal|casa hostil/i.test(el.textContent||''));
    if(!legend)return;
    const desired='casa hostil · 50% de risco · Carapaça 🐢: 66% de sobrevivência';
    if((legend.textContent||'').trim()===desired)return;
    const icon=legend.querySelector('i');legend.textContent=` ${desired}`;if(icon)legend.prepend(icon);
  }

  function syncHowToPlay(){
    const modal=document.querySelector('#rulesModal .modal');if(!modal)return;
    let title=modal.querySelector(':scope > h2');
    const actions=modal.querySelector(':scope > .modal-actions');if(!actions)return;
    if(!title){title=document.createElement('h2');modal.prepend(title)}
    if(title.textContent!=='Como jogar')title.textContent='Como jogar';
    let content=modal.querySelector(':scope > .how-to-play-summary');
    for(const child of [...modal.children]){
      if(child===title||child===actions||child===content)continue;
      child.remove();
    }
    if(!content){content=document.createElement('div');content.className='how-to-play-summary';modal.insertBefore(content,actions)}
    if(content.innerHTML!==HOW_TO_PLAY_HTML)content.innerHTML=HOW_TO_PLAY_HTML;
  }

  const previousRenderBoard=renderBoard;
  renderBoard=function(){const result=previousRenderBoard.apply(this,arguments);renderCamouflageIcons();return result};
  const previousRenderActions=renderActions;
  renderActions=function(){const result=previousRenderActions.apply(this,arguments);renderMutationLegend();rewriteHostileLegend();syncHowToPlay();patchMutationModal();return result};
  const previousRender=render;
  render=function(){resolveSexualInheritance();const result=previousRender.apply(this,arguments);renderCamouflageIcons();renderMutationLegend();rewriteHostileLegend();syncHowToPlay();patchMutationModal();return result};

  const observer=new MutationObserver(()=>patchMutationModal());
  observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});

  resolveSexualInheritance();renderCamouflageIcons();renderMutationLegend();rewriteHostileLegend();syncHowToPlay();patchMutationModal();
  document.querySelector('#rulesModal')?.classList.add('open');
})();
