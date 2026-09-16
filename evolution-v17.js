(function(){
  const HUMAN_REPLY_MIN=900;
  const HUMAN_REPLY_MAX=1400;

  function isSinglePlayer(){
    return localStorage.getItem('xe_game_mode')==='single';
  }

  function humanReplyDelay(){
    return HUMAN_REPLY_MIN+Math.floor(Math.random()*(HUMAN_REPLY_MAX-HUMAN_REPLY_MIN+1));
  }

  const previousFinishTurn=finishTurn;
  finishTurn=function(){
    const leavingHumanTurn=isSinglePlayer()&&state&&!state.gameOver&&state.current==='blue';
    if(!leavingHumanTurn)return previousFinishTurn.apply(this,arguments);

    const nativeSetTimeout=window.setTimeout;
    const replyDelay=humanReplyDelay();

    // Durante a transição Brancas → Pretas, alonga apenas o timer normal
    // que agenda o início da resposta da IA. Timers imediatos de resolução
    // ambiental/bloqueio e a animação interna da jogada das Pretas permanecem intactos.
    window.setTimeout=function(callback,delay,...args){
      const ms=Number(delay)||0;
      if(ms>=250&&ms<=400)return nativeSetTimeout(callback,replyDelay,...args);
      return nativeSetTimeout(callback,ms,...args);
    };

    try{
      return previousFinishTurn.apply(this,arguments);
    }finally{
      window.setTimeout=nativeSetTimeout;
    }
  };
})();
