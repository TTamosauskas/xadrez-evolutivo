'use strict';
const SIZE=8, MAX_POP=64, MAX_LINEAGES=4, TURNS_PER_EPOCH=10, MAX_EPOCHS=10;
const owners={blue:{name:'Azul',color:'#58a6ff'},amber:{name:'Âmbar',color:'#f2b84b'}};
const traitCatalog=[
 {name:'Vetor Alongado',cat:'locomoção',desc:'Alcance ortogonal de até 2 casas.',cost:'Reprodução custa +1 recurso.'},
 {name:'Saltador',cat:'locomoção',desc:'Adiciona saltos em L, ultrapassando obstáculos.',cost:'Em terreno hostil, reprodução custa +1.'},
 {name:'Gigantismo',cat:'defesa',desc:'Exige apoio local para ser capturado.',cost:'Movimentos longos ficam indisponíveis; reprodução custa +1.'},
 {name:'Carapaça',cat:'defesa',desc:'Só pode ser capturado por ataque ortogonal.',cost:'Reprodução custa +1 recurso.'},
 {name:'Camuflagem',cat:'defesa',desc:'Bloqueia capturas originadas a mais de 1 casa.',cost:'Perde efeito em deserto e áreas vulcânicas.'},
 {name:'Superespecialização',cat:'locomoção',desc:'Move em linhas ortogonais até 3 casas.',cost:'Perde o movimento diagonal ancestral.'},
 {name:'Metabolismo Econômico',cat:'metabolismo',desc:'Reduz em 1 o custo de reprodução.',cost:'Alimentar armazena no máximo 1 recurso.'},
 {name:'Predação',cat:'ecologia',desc:'Capturas geram Biomassa; 2 Biomassas podem pagar reprodução.',cost:'Reprodução por recursos custa +1.'},
 {name:'Anfibismo',cat:'ecologia',desc:'Permite entrar, reproduzir e sobreviver em água.',cost:'Reprodução em deserto custa +1.'},
 {name:'Criotolerância',cat:'ecologia',desc:'Ignora estresse de gelo.',cost:'Reprodução em deserto custa +1.'},
 {name:'Propagação',cat:'reprodução',desc:'Descendentes podem surgir a até 2 casas.',cost:'Descendentes recém-nascidos ficam mais expostos a captura.'},
 {name:'Plasticidade Fenotípica',cat:'ecologia',desc:'Interação especial alterna tolerância a gelo, água ou toxinas.',cost:'A especialização temporária dura apenas até a próxima Época.'},
 {name:'Xerotolerância',cat:'ecologia',desc:'Ignora custo extra de reprodução em deserto.',cost:'Reprodução em água custa +1.'},
 {name:'Toxirresistência',cat:'ecologia',desc:'Ignora estresse tóxico e reproduz em áreas tóxicas.',cost:'Movimento base continua curto.'},
 {name:'Espinhos',cat:'defesa',desc:'Ao ser capturado em adjacência, elimina também o atacante.',cost:'Reprodução custa +1 recurso.'}
];
const eventDeck=[
 {id:'drought',name:'Seca Severa',desc:'Habitats férteis reduzem produção por duas Épocas.',major:true},
 {id:'ice',name:'Era Glacial',desc:'O gelo avança a partir de uma borda do tabuleiro.',major:true},
 {id:'pathogen',name:'Patógeno Virulento',desc:'Populações locais densas e homogêneas sofrem maior perda.',major:true},
 {id:'solar',name:'Tempestade Solar',desc:'A taxa de mutação aumenta durante duas Épocas.',major:false},
 {id:'sea',name:'Elevação do Mar',desc:'Uma faixa costeira se transforma progressivamente em água.',major:true},
 {id:'volcano',name:'Erupção Vulcânica',desc:'Uma área 2×2 será devastada e ficará vulcânica.',major:true},
 {id:'desert',name:'Desertificação',desc:'Parte dos habitats férteis se torna deserto.',major:false},
 {id:'toxic',name:'Expansão Tóxica',desc:'Uma mancha tóxica cresce para casas adjacentes.',major:true},
 {id:'meteor',name:'Impacto de Meteoro',desc:'Uma zona 2×2 será atingida na próxima Época.',major:true},
 {id:'routes',name:'Colapso das Rotas Migratórias',desc:'Movimentos especializados de longo alcance ficam suprimidos por uma Época.',major:false},
 {id:'acid',name:'Acidificação do Solo',desc:'Habitats férteis selecionados se tornam tóxicos.',major:false}
];
let state=null;
const $=sel=>document.querySelector(sel);
const boardEl=$('#board');

function emptyBoard(){
 return Array.from({length:SIZE},(_,r)=>Array.from({length:SIZE},(_,c)=>({r,c,terrain:'neutral',resource:0,home:null,warning:null,age:0})));
}
function key(r,c){return `${r},${c}`}
function inBounds(r,c){return r>=0&&r<SIZE&&c>=0&&c<SIZE}
function cell(r,c){return state.board[r][c]}
function organismAt(r,c){return state.organisms.find(o=>o.r===r&&o.c===c)}
function lineage(owner,id){return state.lineages[owner][id]}
function hasTrait(owner,id,name){const l=lineage(owner,id);return !!l&&l.traits.includes(name)}
function playerOrganisms(owner){return state.organisms.filter(o=>o.owner===owner)}
function lineagePopulation(owner,id){return state.organisms.filter(o=>o.owner===owner&&o.lineage===id).length}
function opposing(owner){return owner==='blue'?'amber':'blue'}
function randInt(n){return Math.floor(Math.random()*n)}
function choice(a){return a[randInt(a.length)]}
function shuffle(a){const x=[...a];for(let i=x.length-1;i>0;i--){const j=randInt(i+1);[x[i],x[j]]=[x[j],x[i]]}return x}
function coord(r,c){return `${String.fromCharCode(65+c)}${SIZE-r}`}

function newState(){
 const b=emptyBoard();
 const fertile=[[7,3],[7,4],[0,3],[0,4],[3,3],[3,4],[4,3],[4,4],[2,1],[5,6],[2,6],[5,1]];
 fertile.forEach(([r,c])=>{b[r][c].terrain='fertile';b[r][c].resource=(r===0||r===7)?2:1});
 [[7,3],[7,4]].forEach(([r,c])=>b[r][c].home='blue');
 [[0,3],[0,4]].forEach(([r,c])=>b[r][c].home='amber');
 [[1,1],[1,6],[6,1],[6,6]].forEach(([r,c])=>b[r][c].terrain='desert');
 return {
  board:b, organisms:[
   {id:1,owner:'blue',lineage:'A',r:7,c:3,stored:0,biomass:0,stress:0,plasticity:null,newborn:false},
   {id:2,owner:'blue',lineage:'A',r:7,c:4,stored:0,biomass:0,stress:0,plasticity:null,newborn:false},
   {id:3,owner:'amber',lineage:'A',r:0,c:3,stored:0,biomass:0,stress:0,plasticity:null,newborn:false},
   {id:4,owner:'amber',lineage:'A',r:0,c:4,stored:0,biomass:0,stress:0,plasticity:null,newborn:false}
  ], nextOrgId:5,current:'blue',turn:0,epoch:1,selected:null,mode:'move',gameOver:false,
  lineages:{
   blue:{A:{id:'A',parent:null,traits:[],bornEpoch:1,mutations:[],nameCounter:0}},
   amber:{A:{id:'A',parent:null,traits:[],bornEpoch:1,mutations:[],nameCounter:0}}
  },
  reproCount:{blue:0,amber:0}, firstRepro:{blue:false,amber:false}, collapse:{blue:0,amber:0},
  pendingMutation:null, pendingEvents:[], activeEffects:{drought:0,solar:0,routes:0},
  eventHistory:[], logs:[], habitatsVisited:{blue:new Set(['fertile']),amber:new Set(['fertile'])}
 };
}

function init(){
 state=newState();
 log('A partida começa com dois fundadores de cada Linhagem A.');
 log('Os Habitats de Origem contêm recursos para a expansão inicial.');
 announceEvent(true);
 render();
}

function serializeState(){
 const s=JSON.parse(JSON.stringify(state,(k,v)=>v instanceof Set?{__set:[...v]}:v));
 return JSON.stringify(s);
}
function deserializeState(raw){
 const parsed=JSON.parse(raw);
 function revive(obj){if(!obj||typeof obj!=='object')return obj;if(obj.__set)return new Set(obj.__set);Object.keys(obj).forEach(k=>obj[k]=revive(obj[k]));return obj}
 state=revive(parsed);state.selected=null;state.pendingMutation=null;render();
}

function log(msg){
 const prefix=`E${state?.epoch||1}`;
 if(state)state.logs.unshift({t:prefix,msg});
}

function currentSelected(){return state.selected?state.organisms.find(o=>o.id===state.selected):null}
function setMode(mode){state.mode=mode;render()}
