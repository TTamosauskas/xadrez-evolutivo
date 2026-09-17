(function(){
  const KEY='firstReproductionProtected';

  function allowFirstReproductionMutations(target=state){
    if(!target)return;
    if(!target[KEY]||typeof target[KEY]!=='object')target[KEY]={};
    target[KEY].blue=true;
    target[KEY].amber=true;
  }

  const previousNewState=newState;
  newState=function(){
    const next=previousNewState.apply(this,arguments);
    allowFirstReproductionMutations(next);
    return next;
  };

  const previousDeserializeState=deserializeState;
  deserializeState=function(){
    const result=previousDeserializeState.apply(this,arguments);
    allowFirstReproductionMutations(state);
    return result;
  };

  allowFirstReproductionMutations(state);
})();
