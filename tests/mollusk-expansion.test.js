import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS, square } from "../src/constants.js";
import { TRAIT_STAGE, TRAIT_INCOMPATIBILITIES } from "../src/geology.js";
import { actionsForPiece, movesFor, radulaTargets, tentacleTargets } from "../src/moves.js";
import { simulate } from "../src/engine.js";
import { energyValue } from "../src/energy.js";
import { fixture, move } from "./helpers.js";

const mol = (...traits) => [
  "Predação","Multicelularismo","Ingestão","Simetria Bilateral",
  "Locomoção Primitiva","Cefalização","Molusco",...traits,
];

test("expanded Mollusk mutations expose their intended icons, periods and exclusions", () => {
  const expected = {
    Rádula:["👅","cambrian"], Bisso:["🧵","ordovician"],
    "Concha Camerada":["🌀","ordovician"],
    "Ventosas Quimiotáteis":["🫳","carboniferous"],
    "Regeneração de Braços":["🦾","permian"],
    "Visão Polarizada":["🧿","jurassic"],
    "Tentáculo Preênsil":["〰️","jurassic"],
    "Cromatóforos Neurais":["🎨","cretaceous"],
  };
  for (const [trait,[icon,stage]] of Object.entries(expected)) {
    assert.equal(TRAITS[trait][0], icon);
    assert.equal(TRAIT_STAGE[trait], stage);
  }
  assert.ok(TRAIT_INCOMPATIBILITIES.Rádula.includes("Bisso"));
  assert.ok(TRAIT_INCOMPATIBILITIES.Bisso.includes("Jatopropulsão"));
  assert.ok(TRAIT_INCOMPATIBILITIES["Concha Camerada"].includes("Corpo Gelatinoso"));
  assert.ok(TRAIT_INCOMPATIBILITIES["Visão Polarizada"].includes("Visão Binocular"));
});

test("Rádula turns adjacent fertility into energy without offspring", () => {
  let s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Rádula"),energy:0,energyCapacitySnapshot:4},
    {owner:"amber",r:0,c:0,rank:4},
  ],12001);
  s.geologicalStage="cambrian";
  s.board[square(4,5)]="fertile";
  const p=s.pieces[0], count=s.pieces.length;
  assert.ok(radulaTargets(s,p).some(t=>t.r===4&&t.c===5));
  s=simulate(s,{type:"RADULA",id:p.id,r:4,c:5});
  assert.equal(s.board[square(4,5)],"neutral");
  assert.equal(energyValue(s.pieces.find(x=>x.id===p.id)),2);
  assert.equal(s.pieces.length,count);
});

test("Bisso occupies a natural barrier without destroying it", () => {
  let s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Carapaça","Bisso")},
    {owner:"amber",r:0,c:0,rank:4},
  ],12002);
  s.geologicalStage="ordovician";
  s.naturalBarriers=[square(4,5)];
  const p=s.pieces[0], t=movesFor(s,p).find(x=>x.r===4&&x.c===5);
  assert.ok(t?.byssus);
  s=simulate(s,move(p,4,5));
  const moved=s.pieces.find(x=>x.id===p.id);
  assert.deepEqual([moved.r,moved.c],[4,5]);
  assert.ok(s.naturalBarriers.includes(square(4,5)));
});

test("Ventosas suppress Tinta during adjacent capture", () => {
  let s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Jatopropulsão","Corpo Gelatinoso","Ventosas Quimiotáteis")},
    {owner:"amber",r:4,c:5,rank:2,traits:mol("Jatopropulsão","Corpo Gelatinoso","Tinta")},
  ],12003);
  s.geologicalStage="carboniferous";
  const a=s.pieces[0], victim=s.pieces[1].id;
  s=simulate(s,move(a,4,5));
  assert.equal(s.pieces.some(x=>x.id===victim),false);
  assert.ok(s.passiveEffects.some(e=>e.trait==="Ventosas Quimiotáteis"));
});

test("Regeneração de Braços restores the Mollusk form after three own turns", () => {
  let s=fixture([
    {owner:"blue",r:4,c:3,rank:4},
    {owner:"amber",r:4,c:4,rank:3,traits:mol("Autotomia","Jatopropulsão","Corpo Gelatinoso","Ventosas Quimiotáteis","Regeneração de Braços")},
  ],12004);
  const a=s.pieces[0], id=s.pieces[1].id;
  s=simulate(s,move(a,4,4));
  let v=s.pieces.find(x=>x.id===id);
  assert.equal(v.rank,2);
  assert.equal(v.autotomyRecovery.regenerationTurnsRemaining,3);
  for(let i=0;i<5;i++) s=simulate(s,{type:"PASS"});
  v=s.pieces.find(x=>x.id===id);
  assert.equal(v.rank,3);
  assert.equal(v.autotomyRecovery,null);
});

test("Visão Polarizada sees Camuflagem at two cells even through Tinta", () => {
  const s=fixture([
    {owner:"blue",r:4,c:2,rank:3,traits:mol("Jatopropulsão","Corpo Gelatinoso","Percepção Espacial","Visão Polarizada")},
    {owner:"amber",r:4,c:4,rank:4,traits:mol("Camuflagem")},
  ],12005);
  s.geologicalStage="jurassic";
  const a=s.pieces[0], victim=s.pieces[1];
  const canSee=()=>movesFor(s,a).some(t=>t.capture&&t.r===4&&t.c===4);
  assert.ok(canSee());
  s.inkClouds=[{sourceId:victim.id,owner:"amber",cells:[square(4,2),square(4,4)],expiresTurn:s.turn+2}];
  assert.ok(canSee());
});

test("Tentáculo pulls prey and blocks its immediate counterattack", () => {
  let s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Jatopropulsão","Corpo Gelatinoso","Ventosas Quimiotáteis","Tentáculo Preênsil"),energy:4,energyCapacitySnapshot:4},
    {owner:"amber",r:4,c:7,rank:3,traits:mol()},
  ],12006);
  s.geologicalStage="jurassic";
  const a=s.pieces[0], id=s.pieces[1].id, before=energyValue(a);
  const option=tentacleTargets(s,a).find(t=>t.targetId===id);
  assert.deepEqual([option.r,option.c],[4,5]);
  s=simulate(s,{type:"TENTACLE_PULL",id:a.id,targetId:id});
  const guarded=s.pieces.find(x=>x.id===a.id), prey=s.pieces.find(x=>x.id===id);
  assert.deepEqual([prey.r,prey.c],[4,5]);
  assert.equal(energyValue(guarded),before-1);
  assert.equal(movesFor(s,prey).some(t=>t.capture&&t.r===guarded.r&&t.c===guarded.c),false);
});

test("Cromatóforos create an untargetable turn followed by movement-only reveal", () => {
  let s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Jatopropulsão","Corpo Gelatinoso","Camuflagem","Percepção Espacial","Cromatóforos Neurais")},
    {owner:"amber",r:4,c:6,rank:3,traits:mol("Percepção Espacial")},
  ],12007);
  s.geologicalStage="cretaceous";
  const id=s.pieces[0].id, enemyId=s.pieces[1].id;
  s=simulate(s,{type:"CHROMATOPHORES",id});
  let hidden=s.pieces.find(x=>x.id===id), enemy=s.pieces.find(x=>x.id===enemyId);
  assert.equal(hidden.chromatophoreDisguise,true);
  assert.equal(movesFor(s,enemy).some(t=>t.capture&&t.r===hidden.r&&t.c===hidden.c),false);
  s=simulate(s,{type:"PASS"});
  hidden=s.pieces.find(x=>x.id===id);
  const actions=actionsForPiece(s,hidden);
  assert.ok(actions.some(a=>a.type==="CHROMATOPHORES"));
  assert.ok(actions.every(a=>["MOVE","CHROMATOPHORES"].includes(a.type)));
  s=simulate(s,{type:"CHROMATOPHORES",id});
  assert.equal(s.pieces.find(x=>x.id===id).chromatophoreDisguise,false);
});
