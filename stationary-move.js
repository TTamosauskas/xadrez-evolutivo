(function(){
  const previousMovementTargets=movementTargets;
  movementTargets=function(org){
    const targets=previousMovementTargets.apply(this,arguments)||[];
    if(!org||!state?.organisms?.some(o=>o.id===org.id))return targets;
    if(!targets.some(t=>t.r===org.r&&t.c===org.c)){
      targets.push({r:org.r,c:org.c,kind:'stay',dist:0,capture:false,stay:true,path:[]});
    }
    return targets;
  };

  const previousExecuteMove=executeMove;
  executeMove=function(org,t){
    const staying=!!org&&!!t&&t.stay===true&&t.r===org.r&&t.c===org.c;
    if(!staying)return previousExecuteMove.apply(this,arguments);

    const originalOrganismAt=organismAt;
    const ownR=org.r,ownC=org.c,ownId=org.id;
    organismAt=function(r,c){
      const found=originalOrganismAt(r,c);
      if(r===ownR&&c===ownC&&found?.id===ownId)return null;
      return found;
    };

    let result;
    try{
      result=previousExecuteMove.call(this,org,{...t,capture:false,stay:true,path:[]});
    }finally{
      organismAt=originalOrganismAt;
      if(state)render();
    }
    return result;
  };

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(r,c){
    const sel=typeof currentSelected==='function'?currentSelected():null;
    const occ=typeof organismAt==='function'?organismAt(r,c):null;
    const choosingSexualPartner=!!document.querySelector('.sexual-partner');
    if(sel&&occ?.id===sel.id&&state?.mode==='move'&&!window.xeModalBlocking&&!choosingSexualPartner){
      const stay=movementTargets(sel).find(t=>t.stay===true&&t.r===r&&t.c===c);
      if(stay)return executeMove(sel,stay);
    }
    return previousHandleCellClick.apply(this,arguments);
  };

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    const rules=document.querySelectorAll('#rulesModal p');
    if(rules[1]&&!rules[1].textContent.includes('permanecer na própria casa')){
      rules[1].innerHTML+=' Uma peça também pode permanecer na própria casa como sua ação de movimento; se estiver sobre uma casa fértil, isso consome a casa e ativa a reprodução normalmente.';
    }
    const sel=typeof currentSelected==='function'?currentSelected():null;
    const hint=document.querySelector('#hint');
    if(sel&&state?.mode==='move'&&hint&&!window.xeModalBlocking&&!document.querySelector('.sexual-partner')){
      hint.textContent+=' Você também pode clicar novamente na própria peça para permanecer na casa.';
    }
    return result;
  };
})();
