function handleCellClick(r,c){
 if(state.gameOver||state.pendingMutation)return;const occ=organismAt(r,c),sel=currentSelected();
 if(!sel){if(occ&&occ.owner===state.current){state.selected=occ.id;render()}return}
 if(occ&&occ.owner===state.current){state.selected=occ.id;render();return}
 if(state.mode==='move'){
  const t=movementTargets(sel).find(x=>x.r===r&&x.c===c);if(t)executeMove(sel,t);else flashHint('destino incompatível com a movimentação desta linhagem');
 }else if(state.mode==='reproduce'){
  const t=reproductionTargets(sel).find(x=>x.r===r&&x.c===c);if(t)executeReproduction(sel,t);else flashHint('escolha uma casa de nascimento destacada');
 }
}

function render(){
 if(!state)return;renderStatus();renderBoard();renderPlayers();renderEvents();renderTrees();renderLog();renderActions();
}
function renderStatus(){
 $('#turnValue').textContent=`${owners[state.current].name}`;$('#epochValue').textContent=`${Math.min(state.epoch,MAX_EPOCHS)} / ${MAX_EPOCHS}`;
 const within=state.turn%TURNS_PER_EPOCH;$('#roundValue').textContent=`${Math.floor(within/2)+1} / 5`;
 $('#populationValue').textContent=`${playerOrganisms('blue').length} Azul · ${playerOrganisms('amber').length} Âmbar`;
 const next=state.pendingEvents[0];$('#trendValue').textContent=next?`${next.event.name} → E${next.resolveEpoch}`:'Estável';
}
function renderBoard(){
 boardEl.innerHTML='';const sel=currentSelected();let legal=[];if(sel)legal=state.mode==='reproduce'?reproductionTargets(sel):movementTargets(sel);const legalMap=new Map(legal.map(t=>[key(t.r,t.c),t]));
 for(let r=0;r<SIZE;r++)for(let c=0;c<SIZE;c++){
  const ce=cell(r,c),div=document.createElement('div'),org=organismAt(r,c),target=legalMap.get(key(r,c));
  div.className=`cell ${ce.terrain}${ce.home?` home-${ce.home}`:''}${ce.warning?' warn':''}${sel&&sel.r===r&&sel.c===c?' selected':''}${target?(target.capture?' capture':' legal'):''}`;
  div.title=`${coord(r,c)} — ${terrainName(ce.terrain)}${ce.resource?` — ${ce.resource} recurso(s)`:''}`;div.addEventListener('click',()=>handleCellClick(r,c));
  if(ce.resource>0){const res=document.createElement('span');res.className='resource';res.textContent=`🌿 ${ce.resource}`;div.appendChild(res)}
  if(org){const od=document.createElement('div');od.className=`org ${org.owner}`;od.innerHTML=`${org.lineage}<small>${org.stored?`R${org.stored} `:''}${org.biomass?`B${org.biomass}`:''}${org.stress?`⚠${org.stress}`:''}</small>`;od.title=organismTitle(org);div.appendChild(od)}
  const co=document.createElement('span');co.className='coord';co.textContent=coord(r,c);div.appendChild(co);boardEl.appendChild(div);
 }
}
function terrainName(t){return {neutral:'habitat neutro',fertile:'habitat fértil',desert:'deserto',ice:'gelo',water:'água profunda',toxic:'habitat tóxico',volcanic:'terreno vulcânico'}[t]||t}
function organismTitle(o){const l=lineage(o.owner,o.lineage);return `${owners[o.owner].name} · ${o.lineage}\n${l.traits.length?l.traits.join(', '):'Generalista ancestral'}\nReserva: ${o.stored} · Biomassa: ${o.biomass}`}
function renderPlayers(){renderPlayer('blue',$('#bluePanel'));renderPlayer('amber',$('#amberPanel'))}
function renderPlayer(owner,el){
 const ids=Object.keys(state.lineages[owner]);let html=`<div class="player-head"><div><div class="player-name ${owner}">${owners[owner].name}</div><div class="population">${playerOrganisms(owner).length}/${MAX_POP} organismos · ${state.reproCount[owner]} reproduções</div></div><div class="population">Colapso ${state.collapse[owner]}/2</div></div>`;
 ids.forEach(id=>{const l=lineage(owner,id),pop=lineagePopulation(owner,id),ext=pop===0;html+=`<div class="lineage-card ${ext?'extinct':''} ${state.current===owner?'active-turn':''}"><div class="lineage-title"><span class="lineage-id">${id}</span><span class="lineage-meta">${pop} vivo(s) · E${l.bornEpoch}</span></div><div class="traits">${l.traits.length?l.traits.map(t=>`<span class="trait" title="${traitInfo(t)}">${t}</span>`).join(''):'<span class="trait empty">generalista ancestral</span>'}</div></div>`});el.innerHTML=html;
}
function traitInfo(name){const t=traitCatalog.find(x=>x.name===name);return t?`${t.desc} Custo: ${t.cost}`:name}
function renderEvents(){
 const box=$('#events');let html='';state.pendingEvents.forEach(p=>{html+=`<div class="event-card"><strong>${p.event.name} · E${p.resolveEpoch}</strong><p>${p.event.desc}</p></div>`});if(!html)html='<div class="rules">Nenhuma grande tendência anunciada.</div>';box.innerHTML=html;
 const fx=[];if(state.activeEffects.drought)fx.push(`Seca ativa: ${state.activeEffects.drought} Época(s)`);if(state.activeEffects.solar)fx.push(`Mutação elevada: ${state.activeEffects.solar} Época(s)`);if(state.activeEffects.routes)fx.push(`Rotas migratórias instáveis: ${state.activeEffects.routes} Época(s)`);
 $('#environmentSummary').innerHTML=fx.length?`<strong>Efeitos ativos:</strong> ${fx.join(' · ')}`:'Pressões globais ativas: estabilidade relativa.';
}
function renderTrees(){
 const make=owner=>{const ids=Object.keys(state.lineages[owner]);const children={};ids.forEach(id=>children[id]=[]);ids.forEach(id=>{const p=lineage(owner,id).parent;if(p&&children[p])children[p].push(id)});
 const node=id=>`<li class="${lineagePopulation(owner,id)===0?'extinct':''}"><strong>${id}</strong> ${lineagePopulation(owner,id)} vivo(s)${lineage(owner,id).traits.length?` — ${lineage(owner,id).traits.join(', ')}`:''}${children[id].length?`<ul>${children[id].map(node).join('')}</ul>`:''}</li>`;
 return `<div style="margin-bottom:10px"><strong style="color:${owners[owner].color}">${owners[owner].name}</strong><ul>${node('A')}</ul></div>`};$('#trees').innerHTML=make('blue')+make('amber');
}
function renderLog(){$('#log').innerHTML=state.logs.slice(0,80).map(x=>`<div class="log-entry"><strong>${x.t}</strong> · ${escapeHtml(x.msg)}</div>`).join('')}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function renderActions(){
 const sel=currentSelected();['moveBtn','reproBtn','feedBtn','specialBtn'].forEach(id=>$('#'+id).classList.remove('active'));$('#'+({move:'moveBtn',reproduce:'reproBtn'}[state.mode]||'moveBtn')).classList.add('active');
 $('#reproBtn').disabled=!sel;$('#feedBtn').disabled=!sel;$('#specialBtn').disabled=!sel;$('#moveBtn').disabled=!sel;$('#passBtn').disabled=state.gameOver;
 let hint=`Turno de ${owners[state.current].name}. `;
 if(!sel)hint+='Selecione um organismo para agir.';else if(state.mode==='move')hint+=`${sel.lineage} selecionado em ${coord(sel.r,sel.c)}. Escolha uma casa verde ou uma captura vermelha.`;else{const p=canPayRepro(sel);hint+=p.ok?`Escolha a casa do descendente. Custo: ${p.biomass?'2 Biomassas':p.cost+' recurso(s)'}.`:`Reprodução indisponível: ${p.reason}.`}
 $('#hint').textContent=hint;
}
function flashHint(msg){$('#hint').textContent=msg;setTimeout(()=>{if(state)renderActions()},1600)}

function renderMutationModal(){
 const p=state.pendingMutation,t=p.trait,parent=lineage(p.owner,p.parentLineage),lineCount=Object.keys(state.lineages[p.owner]).length;
 $('#mutationBody').innerHTML=`<div class="choice"><strong>${t.name}</strong><small>${t.cat}</small><p>${t.desc}</p><p><strong>Custo adaptativo:</strong> ${t.cost}</p></div><p>O descendente acabou de nascer na linhagem ${p.parentLineage}. Decida o destino hereditário desta variante.</p>`;
 let actions='';if(lineCount<MAX_LINEAGES)actions+=`<button class="btn primary" data-mut="branch">Criar nova linhagem</button>`;actions+=`<button class="btn" data-mut="integrate">${parent.traits.length<3?'Integrar à linhagem':'Substituir traço mais antigo'}</button><button class="btn" data-mut="discard">Descartar mutação</button>`;$('#mutationActions').innerHTML=actions;$('#mutationModal').classList.add('open');
 $('#mutationActions').querySelectorAll('[data-mut]').forEach(b=>b.addEventListener('click',()=>resolveMutation(b.dataset.mut)));
}
function showGameOver(winner,reason,a,b){
 $('#gameOverTitle').textContent=winner?`${owners[winner].name} vence`:'Empate evolutivo';
 $('#gameOverBody').innerHTML=`<p>${reason}</p><table class="score-table"><thead><tr><th>Critério</th><th>Azul</th><th>Âmbar</th></tr></thead><tbody><tr><td>População ×3</td><td>${a.pop*3}</td><td>${b.pop*3}</td></tr><tr><td>Linhagens vivas ×2</td><td>${a.live*2}</td><td>${b.live*2}</td></tr><tr><td>Habitats ocupados</td><td>${a.habitats}</td><td>${b.habitats}</td></tr><tr><td>Reproduções</td><td>${a.repro}</td><td>${b.repro}</td></tr><tr><th>Total</th><th>${a.total}</th><th>${b.total}</th></tr></tbody></table>`;$('#gameOverModal').classList.add('open');
}

$('#moveBtn').addEventListener('click',()=>setMode('move'));
$('#reproBtn').addEventListener('click',()=>{const o=currentSelected();if(!o)return;const p=canPayRepro(o);if(!p.ok){flashHint(p.reason);return}setMode('reproduce')});
$('#feedBtn').addEventListener('click',()=>{const o=currentSelected();if(o)feed(o)});
$('#specialBtn').addEventListener('click',()=>{const o=currentSelected();if(o)special(o)});
$('#passBtn').addEventListener('click',()=>{if(!state.gameOver){log(`${owners[state.current].name} passou o turno.`);finishTurn()}});
$('#rulesBtn').addEventListener('click',()=>$('#rulesModal').classList.add('open'));
$('#resetBtn').addEventListener('click',()=>{if(confirm('Iniciar uma nova história evolutiva?'))init()});
$('#newAfterEnd').addEventListener('click',()=>{$('#gameOverModal').classList.remove('open');init()});
$('#saveBtn').addEventListener('click',()=>{localStorage.setItem('xadrez-evolutivo-save',serializeState());flashHint('partida salva neste navegador')});
$('#loadBtn').addEventListener('click',()=>{const raw=localStorage.getItem('xadrez-evolutivo-save');if(raw){try{deserializeState(raw);flashHint('partida carregada')}catch(e){flashHint('save incompatível')}}else flashHint('nenhuma partida salva neste navegador')});
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>$('#'+b.dataset.close).classList.remove('open')));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){state.selected=null;state.mode='move';render()}});

init();
