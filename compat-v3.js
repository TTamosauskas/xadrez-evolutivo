(function(){
  hasTrait=function(owner,id,name){
    if(name==='Voar')name='Voo';
    const p=state?.lineages?.[owner]?.[id];
    return !!p&&Array.isArray(p.traits)&&p.traits.includes(name);
  };
})();
