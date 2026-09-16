(function(){
  function stripEnvironmentSymbols(root=document){
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    const nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{n.nodeValue=n.nodeValue.replace(/[☣🌿]/g,'').replace(/\s{2,}/g,' ')});
    document.querySelectorAll('.environment-mark').forEach(el=>el.remove());
  }

  const previousRender=render;
  render=function(){previousRender();stripEnvironmentSymbols(document)};

  const previousFlashHint=flashHint;
  flashHint=function(msg){previousFlashHint(String(msg).replace(/[☣🌿]/g,''));stripEnvironmentSymbols(document)};

  const legend=document.querySelector('.legend');
  if(legend)legend.innerHTML=`
    <span><i class="checker-swatch"></i> habitat neutro</span>
    <span><i class="legend-color biome"></i> bioma de uso único</span>
    <span><i class="legend-color biohazard"></i> Biohazard</span>`;

  const rulesParagraphs=document.querySelectorAll('#rulesModal p');
  if(rulesParagraphs[2])rulesParagraphs[2].innerHTML='<strong>Biomas e reprodução.</strong> Cada casa verde pode ser consumida uma única vez. Uma reprodução comum custa exatamente 1 bioma disponível ou previamente armazenado. Predadores usam 1 captura acumulada.';
  if(rulesParagraphs[4])rulesParagraphs[4].innerHTML='<strong>Biohazard.</strong> Casas vermelhas são letais para organismos terrestres ao entrar ou atravessar. Voar oferece imunidade. A cada Época, o Biohazard muda pelas quatro regras de Conway.';

  stripEnvironmentSymbols(document);
})();
