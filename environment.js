function announceEvent(initial){
 if(state.epoch>=MAX_EPOCHS)return;
 const early=state.epoch<=2;let pool=eventDeck.filter(e=>early?!e.major:true);
 if(state.eventHistory.length){const used=new Set(state.eventHistory.slice(-4));pool=pool.filter(e=>!used.has(e.id));if(!pool.length)pool=eventDeck}
 const e=choice(pool),data=prepareEventData(e);state.pendingEvents.push({event:e,resolveEpoch:state.epoch+1,data});state.eventHistory.push(e.id);
 if(data.cells)data.cells.forEach(([r,c])=>cell(r,c).warning=e.id);
 log(`Tendência anunciada: ${e.name}. Impacto previsto para a Época ${state.epoch+1}.`);
}
function prepareEventData(e){
 if(['volcano','meteor'].includes(e.id)){const r=1+randInt(5),c=1+randInt(5);return {cells:[[r,c],[r+1,c],[r,c+1],[r+1,c+1]]}}
 if(e.id==='ice')return {edge:choice(['top','bottom','left','right'])};
 if(e.id==='sea')return {edge:choice(['top','bottom','left','right'])};
 if(['desert','acid'].includes(e.id)){const f=[];for(const row of state.board)for(const c of row)if(c.terrain==='fertile'&&!c.home)f.push([c.r,c.c]);return {cells:shuffle(f).slice(0,2)}}
 if(e.id==='toxic'){const candidates=[];for(let r=1;r<7;r++)for(let c=1;c<7;c++)candidates.push([r,c]);return {cells:[choice(candidates)]}}
 return {};
}
function resolvePendingEvents(){
 const due=state.pendingEvents.filter(p=>p.resolveEpoch<=state.epoch);state.pendingEvents=state.pendingEvents.filter(p=>p.resolveEpoch>state.epoch);
 due.forEach(p=>{if(p.data.cells)p.data.cells.forEach(([r,c])=>{if(inBounds(r,c))cell(r,c).warning=null});applyEvent(p.event,p.data)});
}
function applyEvent(e,data){
 log(`Impacto ambiental: ${e.name}.`);
 switch(e.id){
  case'drought':state.activeEffects.drought=2;break;
  case'solar':state.activeEffects.solar=2;break;
  case'routes':state.activeEffects.routes=1;break;
  case'ice':applyEdgeTerrain(data.edge,'ice',1);break;
  case'sea':applyEdgeTerrain(data.edge,'water',1);break;
  case'desert':data.cells.forEach(([r,c])=>{cell(r,c).terrain='desert';cell(r,c).resource=0});break;
  case'acid':data.cells.forEach(([r,c])=>{cell(r,c).terrain='toxic';cell(r,c).resource=0});break;
  case'toxic':expandToxic(data.cells[0]);break;
  case'volcano':impactArea(data.cells,'volcanic',false);break;
  case'meteor':impactArea(data.cells,'neutral',true);break;
  case'pathogen':applyPathogen();break;
 }
}
function applyEdgeTerrain(edge,terrain,depth){
 const cells=[];if(edge==='top')for(let c=0;c<SIZE;c++)cells.push([depth-1,c]);if(edge==='bottom')for(let c=0;c<SIZE;c++)cells.push([SIZE-depth,c]);if(edge==='left')for(let r=0;r<SIZE;r++)cells.push([r,depth-1]);if(edge==='right')for(let r=0;r<SIZE;r++)cells.push([r,SIZE-depth]);
 cells.forEach(([r,c])=>{cell(r,c).terrain=terrain;cell(r,c).resource=0});
}
function expandToxic(start){
 const [r,c]=start;[[0,0],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr,dc])=>{const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)){cell(rr,cc).terrain='toxic';cell(rr,cc).resource=0}})
}
function impactArea(cells,terrain,meteor){
 const ids=[];cells.forEach(([r,c])=>{const o=organismAt(r,c);if(o)ids.push(o.id);cell(r,c).terrain=terrain;cell(r,c).resource=0;if(terrain==='volcanic')cell(r,c).age=0});ids.forEach(id=>removeOrganism(id,meteor?'Um organismo foi eliminado pelo impacto do meteoro.':'Um organismo foi eliminado pela erupção vulcânica.'));
 if(meteor){const fertile=choice(cells);cell(fertile[0],fertile[1]).terrain='fertile';cell(fertile[0],fertile[1]).resource=2}
}
function applyPathogen(){
 for(const owner of ['blue','amber']){
  const groups={};playerOrganisms(owner).forEach(o=>groups[o.lineage]=(groups[o.lineage]||[]).concat(o));
  const dense=Object.values(groups).sort((a,b)=>b.length-a.length)[0];if(dense&&dense.length>=3){const victim=choice(dense);removeOrganism(victim.id,`Patógeno reduziu a linhagem ${victim.lineage} de ${owners[owner].name}.`)}
 }
}
