function movementTargets(org){
 const l=lineage(org.owner,org.lineage), traits=l.traits, routesDown=state.activeEffects.routes>0;
 const dirs8=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
 const dirs4=[[-1,0],[1,0],[0,-1],[0,1]];
 const targets=new Map();
 const add=(r,c,kind='step',dist=1)=>{if(!inBounds(r,c))return;const occ=organismAt(r,c);if(occ&&occ.owner===org.owner)return;if(cell(r,c).terrain==='water'&&!canUseTerrain(org,'water'))return;targets.set(key(r,c),{r,c,kind,dist,capture:!!occ})};
 if(!traits.includes('Superespecialização')) dirs8.forEach(([dr,dc])=>add(org.r+dr,org.c+dc));
 else dirs4.forEach(([dr,dc])=>add(org.r+dr,org.c+dc));
 const giant=traits.includes('Gigantismo');
 if(!routesDown&&!giant&&traits.includes('Vetor Alongado')) rayTargets(org,dirs4,2,targets,'vetor');
 if(!routesDown&&!giant&&traits.includes('Superespecialização')) rayTargets(org,dirs4,3,targets,'especial');
 if(!routesDown&&!giant&&traits.includes('Plasticidade Fenotípica')) rayTargets(org,[[-1,-1],[-1,1],[1,-1],[1,1]],2,targets,'plástico');
 if(!routesDown&&!giant&&traits.includes('Saltador')) [[-2,-1],[-2,1],[2,-1],[2,1],[-1,-2],[-1,2],[1,-2],[1,2]].forEach(([dr,dc])=>add(org.r+dr,org.c+dc,'salto',Math.max(Math.abs(dr),Math.abs(dc))));
 return [...targets.values()].filter(t=>captureAllowed(org,t));
}
function rayTargets(org,dirs,max,targets,kind){
 dirs.forEach(([dr,dc])=>{for(let d=1;d<=max;d++){const r=org.r+dr*d,c=org.c+dc*d;if(!inBounds(r,c))break;const occ=organismAt(r,c);if(cell(r,c).terrain==='water'&&!canUseTerrain(org,'water'))break;if(occ&&occ.owner===org.owner)break;targets.set(key(r,c),{r,c,kind,dist:d,capture:!!occ});if(occ)break;}})
}
function captureAllowed(attacker,t){
 const defender=organismAt(t.r,t.c);if(!defender)return true;
 const dtraits=lineage(defender.owner,defender.lineage).traits;
 const dr=Math.abs(t.r-attacker.r),dc=Math.abs(t.c-attacker.c),dist=Math.max(dr,dc);
 if(dtraits.includes('Carapaça')&&dr>0&&dc>0)return false;
 if(dtraits.includes('Camuflagem')&&cell(defender.r,defender.c).terrain!=='desert'&&cell(defender.r,defender.c).terrain!=='volcanic'&&dist>1)return false;
 if(dtraits.includes('Gigantismo')&&!hasTrait(attacker.owner,attacker.lineage,'Gigantismo')){
   const support=state.organisms.some(o=>o.owner===attacker.owner&&o.id!==attacker.id&&Math.max(Math.abs(o.r-defender.r),Math.abs(o.c-defender.c))===1);
   if(!support)return false;
 }
 return true;
}
function canUseTerrain(org,terrain){
 if(terrain==='water')return hasTrait(org.owner,org.lineage,'Anfibismo')||(hasTrait(org.owner,org.lineage,'Plasticidade Fenotípica')&&org.plasticity==='water');
 if(terrain==='ice')return hasTrait(org.owner,org.lineage,'Criotolerância')||(hasTrait(org.owner,org.lineage,'Plasticidade Fenotípica')&&org.plasticity==='ice');
 if(terrain==='toxic')return hasTrait(org.owner,org.lineage,'Toxirresistência')||(hasTrait(org.owner,org.lineage,'Plasticidade Fenotípica')&&org.plasticity==='toxic');
 return true;
}
function reproductionTargets(org){
 const range=hasTrait(org.owner,org.lineage,'Propagação')?2:1, out=[];
 for(let dr=-range;dr<=range;dr++)for(let dc=-range;dc<=range;dc++){
  if(!dr&&!dc)continue;if(Math.max(Math.abs(dr),Math.abs(dc))>range)continue;
  const r=org.r+dr,c=org.c+dc;if(!inBounds(r,c)||organismAt(r,c))continue;
  if(cell(r,c).terrain==='water'&&!canUseTerrain(org,'water'))continue;
  out.push({r,c,capture:false,kind:'birth',dist:Math.max(Math.abs(dr),Math.abs(dc))});
 }
 return out;
}
function reproCost(org){
 let cost=state.firstRepro[org.owner]?2:1;
 const tr=lineage(org.owner,org.lineage).traits, terrain=cell(org.r,org.c).terrain;
 if(tr.includes('Metabolismo Econômico'))cost=Math.max(1,cost-1);
 if(tr.includes('Vetor Alongado')||tr.includes('Gigantismo')||tr.includes('Carapaça')||tr.includes('Espinhos'))cost++;
 if(tr.includes('Predação'))cost++;
 if(tr.includes('Saltador')&&['ice','toxic','volcanic','desert'].includes(terrain))cost++;
 if(terrain==='desert'&&!tr.includes('Xerotolerância'))cost++;
 if(terrain==='water'&&!tr.includes('Anfibismo'))cost++;
 if(terrain==='toxic'&&!canUseTerrain(org,'toxic'))return 99;
 if(terrain==='volcanic')return 99;
 return cost;
}
function accessibleResources(org){
 let total=org.stored;
 for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const r=org.r+dr,c=org.c+dc;if(inBounds(r,c))total+=cell(r,c).resource}
 return total;
}
function canPayRepro(org){
 if(playerOrganisms(org.owner).length>=MAX_POP)return {ok:false,reason:`limite populacional de ${MAX_POP}`};
 if(reproductionTargets(org).length===0)return {ok:false,reason:'sem casa livre para descendente'};
 if(hasTrait(org.owner,org.lineage,'Predação')&&org.biomass>=2)return {ok:true,biomass:true,cost:2};
 const cost=reproCost(org);if(cost>=99)return {ok:false,reason:'habitat incompatível com reprodução'};
 const have=accessibleResources(org);return have>=cost?{ok:true,cost}:{ok:false,reason:`faltam recursos (${have}/${cost})`,cost};
}
function spendResources(org,cost){
 let left=cost;const fromStored=Math.min(left,org.stored);org.stored-=fromStored;left-=fromStored;
 const coords=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const r=org.r+dr,c=org.c+dc;if(inBounds(r,c)&&cell(r,c).resource>0)coords.push([r,c])}
 coords.sort((a,b)=>Math.max(Math.abs(a[0]-org.r),Math.abs(a[1]-org.c))-Math.max(Math.abs(b[0]-org.r),Math.abs(b[1]-org.c)));
 for(const [r,c] of coords){while(left>0&&cell(r,c).resource>0){cell(r,c).resource--;left--;}if(left<=0)break}
}
function executeMove(org,t){
 const defender=organismAt(t.r,t.c);const from=coord(org.r,org.c),to=coord(t.r,t.c);
 if(defender){
  const defenderSpines=hasTrait(defender.owner,defender.lineage,'Espinhos')&&Math.max(Math.abs(org.r-defender.r),Math.abs(org.c-defender.c))===1;
  removeOrganism(defender.id,`${owners[defender.owner].name} ${defender.lineage} foi capturado em ${to}.`);
  if(hasTrait(org.owner,org.lineage,'Predação')){org.biomass++;log(`${owners[org.owner].name} ${org.lineage} obteve 1 Biomassa por predação.`)}
  org.r=t.r;org.c=t.c;markHabitat(org);
  log(`${owners[org.owner].name} ${org.lineage} capturou em ${to} a partir de ${from}.`);
  if(defenderSpines){removeOrganism(org.id,`Espinhos eliminaram também o atacante em ${to}.`)}
 }else{org.r=t.r;org.c=t.c;markHabitat(org);log(`${owners[org.owner].name} ${org.lineage} migrou de ${from} para ${to}.`)}
 finishTurn();
}
function removeOrganism(id,msg){const i=state.organisms.findIndex(o=>o.id===id);if(i>=0)state.organisms.splice(i,1);if(msg)log(msg);checkExtinction()}
function markHabitat(org){state.habitatsVisited[org.owner].add(cell(org.r,org.c).terrain)}

function executeReproduction(parent,t){
 const pay=canPayRepro(parent);if(!pay.ok){flashHint(pay.reason);return}
 if(pay.biomass){parent.biomass-=2}else spendResources(parent,pay.cost);
 state.firstRepro[parent.owner]=true;state.reproCount[parent.owner]++;
 const child={id:state.nextOrgId++,owner:parent.owner,lineage:parent.lineage,r:t.r,c:t.c,stored:0,biomass:0,stress:0,plasticity:parent.plasticity,newborn:true};
 state.organisms.push(child);markHabitat(child);log(`${owners[parent.owner].name} ${parent.lineage} reproduziu em ${coord(t.r,t.c)}.`);
 const mutate=rollMutation(parent.owner);
 if(mutate){beginMutation(child,parent)}else finishTurn();
}
function rollMutation(owner){
 const n=state.reproCount[owner];if(n===1)return false;
 let p=n===2?.5:1/3;if(state.activeEffects.solar>0)p=.65;return Math.random()<p;
}
function beginMutation(child,parent){
 const currentTraits=lineage(parent.owner,parent.lineage).traits;
 const options=traitCatalog.filter(t=>!currentTraits.includes(t.name));
 const trait=choice(options.length?options:traitCatalog);
 state.pendingMutation={childId:child.id,owner:parent.owner,parentLineage:parent.lineage,trait};
 renderMutationModal();
}
function nextLineageId(owner,parentId){
 const l=lineage(owner,parentId);l.nameCounter=(l.nameCounter||0)+1;
 if(parentId==='A')return `A${l.nameCounter}`;
 const suffix=String.fromCharCode(96+l.nameCounter);return `${parentId}${suffix}`;
}
function resolveMutation(mode){
 const p=state.pendingMutation;if(!p)return;const child=state.organisms.find(o=>o.id===p.childId);if(!child){state.pendingMutation=null;finishTurn();return}
 const parent=lineage(p.owner,p.parentLineage), t=p.trait.name, lineCount=Object.keys(state.lineages[p.owner]).length;
 if(mode==='branch'&&lineCount<MAX_LINEAGES){
  const id=nextLineageId(p.owner,p.parentLineage);const traits=[...parent.traits,t].slice(-3);
  state.lineages[p.owner][id]={id,parent:p.parentLineage,traits,bornEpoch:state.epoch,mutations:[t],nameCounter:0};child.lineage=id;
  log(`Especiação: surgiu a linhagem ${id}, descendente de ${p.parentLineage}, com ${t}.`);
 }else if(mode==='integrate'){
  if(parent.traits.length<3)parent.traits.push(t);else{const old=parent.traits.shift();parent.traits.push(t);log(`${p.parentLineage} substituiu ${old} por ${t}.`)}
  parent.mutations.push(t);log(`${p.parentLineage} integrou a mutação ${t}.`);
 }else log(`A mutação ${t} surgiu, mas foi descartada.`);
 state.pendingMutation=null;$('#mutationModal').classList.remove('open');finishTurn();
}

function feed(org){
 const cap=hasTrait(org.owner,org.lineage,'Metabolismo Econômico')?1:2;if(org.stored>=cap){flashHint('este organismo já atingiu sua reserva individual');return}
 let source=null;if(cell(org.r,org.c).resource>0)source=cell(org.r,org.c);else{
  const neigh=[];for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){const r=org.r+dr,c=org.c+dc;if(inBounds(r,c)&&cell(r,c).resource>0)neigh.push(cell(r,c))}source=neigh[0]
 }
 if(!source){flashHint('nenhum recurso disponível nesta casa ou na vizinhança');return}
 source.resource--;org.stored++;log(`${owners[org.owner].name} ${org.lineage} armazenou 1 recurso.`);finishTurn();
}
function special(org){
 if(hasTrait(org.owner,org.lineage,'Plasticidade Fenotípica')){
  const modes=['ice','water','toxic'];const next=modes[(modes.indexOf(org.plasticity)+1)%modes.length];org.plasticity=next;log(`${owners[org.owner].name} ${org.lineage} ajustou plasticidade para ${terrainName(next)} até a próxima Época.`);finishTurn();return;
 }
 if(hasTrait(org.owner,org.lineage,'Predação')&&org.biomass>0){org.stored=Math.min(2,org.stored+1);org.biomass--;log(`${owners[org.owner].name} ${org.lineage} converteu 1 Biomassa em reserva metabólica.`);finishTurn();return}
 flashHint('esta linhagem ainda carece de uma interação especial ativa');
}

function finishTurn(){
 if(state.gameOver)return;state.selected=null;state.mode='move';state.organisms.forEach(o=>o.newborn=false);checkExtinction();if(state.gameOver){render();return}
 state.turn++;state.current=opposing(state.current);
 if(state.turn%TURNS_PER_EPOCH===0)endEpoch();
 render();
}
function endEpoch(){
 applyEpochHazards();if(state.gameOver)return;
 regenerateResources();
 state.epoch++;
 Object.values(state.organisms).forEach(o=>{o.plasticity=null});
 Object.keys(state.activeEffects).forEach(k=>{if(state.activeEffects[k]>0)state.activeEffects[k]--});
 resolvePendingEvents();if(state.gameOver)return;
 checkCollapse();if(state.gameOver)return;
 if(state.epoch>MAX_EPOCHS){endByScore();return}
 announceEvent(false);
 log(`Início da Época ${state.epoch}. Recursos renovados e pressões ambientais atualizadas.`);
}
function regenerateResources(){
 const drought=state.activeEffects.drought>0;
 for(const row of state.board)for(const c of row){
  if(c.terrain==='fertile'){
   let add=drought?0:1;if(c.home&&state.epoch===1)add=2;else if(c.home&&state.epoch===2)add=drought?0:1;c.resource=Math.min(3,c.resource+add);
  }
  if(c.terrain==='volcanic'){c.age++;if(c.age>=2){c.terrain='fertile';c.resource=2;c.age=0;log(`${coord(c.r,c.c)} entrou em sucessão ecológica e tornou-se fértil.`)}}
 }
}
function applyEpochHazards(){
 const doomed=[];
 for(const o of [...state.organisms]){
  const terr=cell(o.r,o.c).terrain;let hazardous=false;
  if(terr==='ice'&&!canUseTerrain(o,'ice'))hazardous=true;
  if(terr==='toxic'&&!canUseTerrain(o,'toxic'))hazardous=true;
  if(terr==='volcanic')hazardous=true;
  if(hazardous){o.stress=(o.stress||0)+1;if(o.stress>=2||terr==='volcanic'&&Math.random()<.5)doomed.push(o.id)}else o.stress=0;
 }
 doomed.forEach(id=>removeOrganism(id,'Um organismo sucumbiu à pressão do habitat hostil.'));
}
function checkExtinction(){
 for(const owner of ['blue','amber'])if(playerOrganisms(owner).length===0&&!state.gameOver){endGame(opposing(owner),`${owners[owner].name} sofreu Extinção Total.`);return}
}
function checkCollapse(){
 for(const owner of ['blue','amber']){
  const pop=playerOrganisms(owner);let collapse=false;
  if(pop.length===1){const o=pop[0],pay=canPayRepro(o);collapse=!pay.ok&&nearestResourceDistance(o)>2}
  state.collapse[owner]=collapse?state.collapse[owner]+1:0;
  if(state.collapse[owner]>=2){endGame(opposing(owner),`${owners[owner].name} permaneceu ecologicamente inviável por duas Épocas.`);return}
 }
}
function nearestResourceDistance(org){let best=99;for(const row of state.board)for(const c of row)if(c.resource>0)best=Math.min(best,Math.max(Math.abs(c.r-org.r),Math.abs(c.c-org.c)));return best}
function endByScore(){
 const a=scoreFor('blue'),b=scoreFor('amber');const winner=a.total===b.total?null:(a.total>b.total?'blue':'amber');
 state.gameOver=true;render();showGameOver(winner,winner?`Fim da 10ª Época: ${owners[winner].name} obteve maior Sucesso Evolutivo.`:'Fim da 10ª Época: empate em Sucesso Evolutivo.',a,b);
}
function scoreFor(owner){
 const pop=playerOrganisms(owner).length, live=Object.keys(state.lineages[owner]).filter(id=>lineagePopulation(owner,id)>0).length, habitats=new Set(playerOrganisms(owner).map(o=>cell(o.r,o.c).terrain)).size, repro=state.reproCount[owner];
 return {pop,live,habitats,repro,total:pop*3+live*2+habitats+repro};
}
function endGame(winner,reason){state.gameOver=true;render();showGameOver(winner,reason,scoreFor('blue'),scoreFor('amber'))}
