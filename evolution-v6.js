(function(){
  function isTerrain(r,c,terrain){
    return inBounds(r,c)&&cell(r,c).terrain===terrain;
  }

  function neighborCount(r,c,terrain){
    let count=0;
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
      if(!dr&&!dc)continue;
      const rr=r+dr,cc=c+dc;
      if(isTerrain(rr,cc,terrain))count++;
    }
    return count;
  }

  function nextGeneration(terrain){
    const next=Array.from({length:SIZE},()=>Array(SIZE).fill(false));
    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const alive=isTerrain(r,c,terrain),n=neighborCount(r,c,terrain);
      next[r][c]=alive?(n===2||n===3):(n===3);
    }
    return next;
  }

  function advanceDualConway(){
    const nextMortal=nextGeneration('biohazard');
    const nextFertile=nextGeneration('fertile');

    for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
      const ce=cell(r,c);
      if(nextFertile[r][c]){
        ce.terrain='fertile';
        ce.resource=1;
      }else if(nextMortal[r][c]){
        ce.terrain='biohazard';
        ce.resource=0;
      }else{
        ce.terrain='neutral';
        ce.resource=0;
      }
      ce.warning=null;
      ce.age=0;
    }

    const doomed=[];
    for(const o of [...state.organisms]){
      if(isTerrain(o.r,o.c,'biohazard')&&!hasTrait(o.owner,o.lineage,'Voo'))doomed.push(o.id);
    }
    doomed.forEach(id=>removeOrganism(id,'Uma casa mortal surgiu sob um organismo terrestre.',true));
    checkExtinction();
  }

  resolvePendingEvents=function(){advanceDualConway()};

  const rules=document.querySelectorAll('#rulesModal p');
  if(rules[2])rules[2].innerHTML='<strong>Casas férteis e reprodução.</strong> Ao avançar sobre uma casa fértil, ela é consumida e a reprodução acontece automaticamente. A cada Época, as casas férteis também evoluem pelas quatro regras de Conway e cada casa fértil ativa possui 1 uso.';
  if(rules[4])rules[4].innerHTML='<strong>Casas ambientais.</strong> Casas verdes e vermelhas evoluem simultaneamente a cada Época pelas quatro regras de Conway. Cada cor conta apenas vizinhas da própria cor. Se as duas tentarem nascer na mesma casa, a casa fértil tem prioridade. Casas vermelhas eliminam organismos terrestres; Voo oferece imunidade.';
})();
