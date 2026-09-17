(function(){
  const DESCRIPTIONS={
    'Locomoção':'Permite uma segunda movimentação no mesmo turno.',
    'Voo':'Permite atravessar e permanecer em casas hostis.',
    'Predação':'Capturas podem gerar descendentes.',
    'Ovos':'Descendentes podem nascer a até 2 casas do progenitor.',
    'Fertilidade':'Dobra a quantidade de descendentes.',
    'Carapaça':'Aumenta para 66% a sobrevivência em casas hostis.',
    'Camuflagem':'Só pode ser capturada por uma peça adjacente.',
    'Resistência':'Impede novas infecções pelo Patógeno Virulento.',
    'Reprodução Sexuada':'Combina características de dois progenitores.',
    'Esterilidade':'Impede a reprodução.',
    'Ooteca':'Quando a peça morre uma prole é liberada.',
    'Veneno':'Quando esta peça é morta o agressor é envenenado.',
    'Condenado por Veneno':'Morre após 2 turnos próprios.',
    'Mutação Deletéria':'A peça morre após 3 rodadas completas.',
    'Mutação Disfuncional':'Depois de se mover, precisa descansar na rodada seguinte.'
  };

  function rewriteDescriptions(){
    const box=document.querySelector('#boardMutationLegend');
    if(!box)return;
    for(const row of box.querySelectorAll('.board-mutation-row')){
      const label=row.querySelector('strong')?.textContent?.trim();
      const small=row.querySelector('small');
      const text=DESCRIPTIONS[label];
      if(small&&text&&small.textContent!==text)small.textContent=text;
    }
  }

  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    rewriteDescriptions();
    return result;
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    rewriteDescriptions();
    return result;
  };

  const observer=new MutationObserver(()=>queueMicrotask(rewriteDescriptions));
  observer.observe(document.body,{subtree:true,childList:true});

  rewriteDescriptions();

  if(!document.querySelector('script[data-ai-input-lock]')){
    const script=document.createElement('script');
    script.src='ai-input-lock.js';
    script.dataset.aiInputLock='1';
    document.body.appendChild(script);
  }

  if(!document.querySelector('script[data-first-reproduction-mutations]')){
    const script=document.createElement('script');
    script.src='first-reproduction-mutations.js';
    script.dataset.firstReproductionMutations='1';
    document.body.appendChild(script);
  }
})();
