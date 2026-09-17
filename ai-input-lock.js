(function(){
  function isSinglePlayer(){return localStorage.getItem('xe_game_mode')==='single'}
  function isAiTurn(){return isSinglePlayer()&&state&&!state.gameOver&&state.current==='amber'}
  function modalOpen(){return !!document.querySelector('.modal-backdrop.open')}

  const previousHandleCellClick=handleCellClick;
  handleCellClick=function(r,c){
    if(isAiTurn())return;
    return previousHandleCellClick.apply(this,arguments);
  };

  function blockBoardEvent(e){
    if(!isAiTurn())return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  const board=document.querySelector('#board');
  if(board){
    for(const type of ['pointerdown','pointerup','click','touchstart','touchend']){
      board.addEventListener(type,blockBoardEvent,{capture:true,passive:false});
    }
  }

  document.addEventListener('keydown',e=>{
    if(!isAiTurn()||modalOpen())return;
    if(e.key==='Escape'||e.key==='Enter'||e.key===' '){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  },true);

  function syncControls(){
    const locked=isAiTurn();
    for(const id of ['modeBtn','difficultyBtn','rulesBtn','passTurnBtn']){
      const el=document.getElementById(id);if(el)el.disabled=locked;
    }
    document.body.classList.toggle('ai-input-locked',locked);
  }

  const previousRenderActions=renderActions;
  renderActions=function(){
    const result=previousRenderActions.apply(this,arguments);
    syncControls();
    return result;
  };

  const previousRender=render;
  render=function(){
    const result=previousRender.apply(this,arguments);
    syncControls();
    return result;
  };

  syncControls();
})();
