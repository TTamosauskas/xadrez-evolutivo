(function(){
  function profileOf(org){return org&&state?.lineages?.[org.owner]?.[org.lineage]}
  function syncEdgePawnDirections(){
    if(!state?.organisms)return;
    for(const org of state.organisms){
      const rank=Math.max(0,Math.min(5,Number(profileOf(org)?.pieceRank)||0));
      if(rank!==0)continue;
      if(org.r===0)org.pawnDir=1;
      else if(org.r===SIZE-1)org.pawnDir=-1;
      else if(org.pawnDir!==1&&org.pawnDir!==-1)org.pawnDir=org.owner==='blue'?-1:1;
    }
  }

  const previousFinishTurn=finishTurn;
  finishTurn=function(...args){
    syncEdgePawnDirections();
    return previousFinishTurn.apply(this,args);
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    syncEdgePawnDirections();
    return result;
  };

  syncEdgePawnDirections();
})();
