(function(){
  const previousCell=cell;

  // A casa hostil continua hostil para movimento, permanência e mortalidade.
  // Ela só deixa de ser filtrada enquanto o motor monta a lista de casas
  // candidatas ao nascimento. Depois que o descendente é criado, markHabitat
  // volta a enxergar o terreno real e aplica normalmente a pressão ambiental.
  cell=function(r,c){
    const real=previousCell(r,c);
    if(!real||real.terrain!=='biohazard')return real;

    const stack=(new Error()).stack||'';
    if(!/\b(?:birthCells|sexualBirthCells)\b/.test(stack))return real;

    return new Proxy(real,{
      get(target,prop,receiver){
        if(prop==='terrain')return 'neutral';
        return Reflect.get(target,prop,receiver);
      },
      set(target,prop,value,receiver){return Reflect.set(target,prop,value,receiver)}
    });
  };
})();
