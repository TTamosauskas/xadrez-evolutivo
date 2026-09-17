(function(){
  let pendingMove=null;
  let flushing=false;

  function isSinglePlayer(){
    return localStorage.getItem('xe_game_mode')==='single';
  }

  function isAiTurn(){
    return isSinglePlayer()&&state&&!state.gameOver&&state.current==='amber';
  }

  function visibleModal(){
    return !!document.querySelector('.modal-backdrop.open');
  }

  function isBlocked(){
    return !!window.xeModalBlocking||visibleModal();
  }

  function remember(org,target){
    if(!org||!target)return;
    pendingMove={
      orgId:org.id,
      r:target.r,
      c:target.c,
      stay:!!target.stay,
      dysfunctionalRest:!!target.dysfunctionalRest,
      turn:Number(state?.turn)||0
    };
  }

  function sameTarget(target,pending){
    if(!target||!pending)return false;
    if(target.r!==pending.r||target.c!==pending.c)return false;
    if(pending.stay&&!target.stay)return false;
    if(pending.dysfunctionalRest&&!target.dysfunctionalRest)return false;
    return true;
  }

  function fallbackMove(){
    if(!isAiTurn())return null;
    for(const org of playerOrganisms('amber')){
      const targets=movementTargets(org)||[];
      if(targets.length)return {org,target:targets[0]};
    }
    return null;
  }

  const previousExecuteMove=executeMove;
  executeMove=function(org,target){
    if(!flushing&&isAiTurn()&&org?.owner==='amber'&&isBlocked()){
      remember(org,target);
      return;
    }
    return previousExecuteMove.apply(this,arguments);
  };

  function flushPendingMove(){
    if(flushing||!pendingMove)return;
    if(!isAiTurn()){
      pendingMove=null;
      return;
    }
    if(isBlocked())return;
    if((Number(state?.turn)||0)!==pendingMove.turn){
      pendingMove=null;
      return;
    }

    const pending=pendingMove;
    let org=state.organisms.find(o=>o.id===pending.orgId&&o.owner==='amber');
    let target=org?(movementTargets(org)||[]).find(t=>sameTarget(t,pending)):null;

    if(!org||!target){
      const fallback=fallbackMove();
      if(!fallback){
        pendingMove=null;
        return;
      }
      org=fallback.org;
      target=fallback.target;
    }

    pendingMove=null;
    flushing=true;
    try{
      state.selected=org.id;
      state.mode='move';
      previousExecuteMove.call(this,org,target);
    }finally{
      flushing=false;
    }
  }

  document.addEventListener('xe:explanations-complete',()=>setTimeout(flushPendingMove,0));

  const observer=new MutationObserver(()=>{
    if(pendingMove&&!isBlocked())queueMicrotask(flushPendingMove);
  });
  observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['class']});

  setInterval(flushPendingMove,100);

  window.xeAiRecoveryStatus=function(){
    return {
      pending:pendingMove?{...pendingMove}:null,
      blocked:isBlocked(),
      aiTurn:isAiTurn()
    };
  };
})();
