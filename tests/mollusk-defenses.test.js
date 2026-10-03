import test from "node:test";
import assert from "node:assert/strict";
import { TRAITS, square } from "../src/constants.js";
import { TRAIT_STAGE, TRAIT_INCOMPATIBILITIES } from "../src/geology.js";
import { movesFor } from "../src/moves.js";
import { simulate } from "../src/engine.js";
import { fixture, move } from "./helpers.js";

const mol=(...traits)=>[
  "Predação","Multicelularismo","Ingestão","Simetria Bilateral",
  "Locomoção Primitiva","Cefalização","Molusco",...traits,
];

test("expanded Mollusk mutation metadata stays coherent",()=>{
  const expected={
    Rádula:["👅","cambrian"],Bisso:["🧵","ordovician"],
    "Concha Camerada":["🌀","ordovician"],
    "Ventosas Quimiotáteis":["🫳","carboniferous"],
    "Regeneração de Braços":["🦾","permian"],
    "Visão Polarizada":["🧿","jurassic"],
    "Tentáculo Preênsil":["〰️","jurassic"],
    "Cromatóforos Neurais":["🎨","cretaceous"],
  };
  for(const [trait,[icon,stage]] of Object.entries(expected)){
    assert.equal(TRAITS[trait][0],icon);
    assert.equal(TRAIT_STAGE[trait],stage);
  }
  assert.ok(TRAIT_INCOMPATIBILITIES.Rádula.includes("Bisso"));
  assert.ok(TRAIT_INCOMPATIBILITIES.Bisso.includes("Jatopropulsão"));
  assert.ok(TRAIT_INCOMPATIBILITIES["Concha Camerada"].includes("Corpo Gelatinoso"));
  assert.ok(TRAIT_INCOMPATIBILITIES["Visão Polarizada"].includes("Visão Binocular"));
});

test("Ventosas suppress Tinta during adjacent capture",()=>{
  let s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Jatopropulsão","Corpo Gelatinoso","Ventosas Quimiotáteis")},
    {owner:"amber",r:4,c:5,rank:2,traits:mol("Jatopropulsão","Corpo Gelatinoso","Tinta")},
  ],12003);
  s.geologicalStage="carboniferous";
  const a=s.pieces[0],id=s.pieces[1].id;
  s=simulate(s,move(a,4,5));
  assert.equal(s.pieces.some(x=>x.id===id),false);
  assert.ok(s.passiveEffects.some(e=>e.trait==="Ventosas Quimiotáteis"));
});

test("Regeneração de Braços restores the Mollusk form after three own turns",()=>{
  let s=fixture([
    {owner:"blue",r:4,c:3,rank:4},
    {owner:"amber",r:4,c:4,rank:3,traits:mol("Autotomia","Jatopropulsão","Corpo Gelatinoso","Ventosas Quimiotáteis","Regeneração de Braços")},
  ],12004);
  const a=s.pieces[0],id=s.pieces[1].id;
  s=simulate(s,move(a,4,4));
  let v=s.pieces.find(x=>x.id===id);
  assert.equal(v.rank,2);
  assert.equal(v.autotomyRecovery.regenerationTurnsRemaining,3);
  for(let i=0;i<5;i++) s=simulate(s,{type:"PASS"});
  v=s.pieces.find(x=>x.id===id);
  assert.equal(v.rank,3);
  assert.equal(v.autotomyRecovery,null);
});

test("Visão Polarizada detects Camuflagem at two cells through Tinta",()=>{
  const s=fixture([
    {owner:"blue",r:4,c:2,rank:3,traits:mol("Jatopropulsão","Corpo Gelatinoso","Percepção Espacial","Visão Polarizada")},
    {owner:"amber",r:4,c:4,rank:4,traits:mol("Camuflagem")},
  ],12005);
  s.geologicalStage="jurassic";
  const a=s.pieces[0],v=s.pieces[1],canSee=()=>movesFor(s,a).some(t=>t.capture&&t.r===4&&t.c===4);
  assert.ok(canSee());
  s.inkClouds=[{sourceId:v.id,owner:"amber",cells:[square(4,2),square(4,4)],expiresTurn:s.turn+2}];
  assert.ok(canSee());
});
