import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { square } from "../src/constants.js";
import { render } from "../src/view.js";
import { fixture } from "./helpers.js";

function setup() {
  const dom = new JSDOM(
    readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    { url: "https://example.test" },
  );
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  return dom;
}
const mol=(...traits)=>[
  "Predação","Multicelularismo","Ingestão","Simetria Bilateral",
  "Locomoção Primitiva","Cefalização","Molusco",...traits,
];
const cell=(doc,r,c)=>doc.querySelector(`[data-r="${r}"][data-c="${c}"]`);

test("Rádula and Bisso reuse vivification circles",()=>{
  let dom=setup(),s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Rádula")},
    {owner:"amber",r:0,c:0,rank:4},
  ],12101);
  s.geologicalStage="cambrian";
  s.pieces[0].energy=0;
  s.board[square(4,5)]="fertile";
  render(dom.window.document,s,{selected:s.pieces[0].id});
  let target=cell(dom.window.document,4,5);
  assert.ok(target.classList.contains("vivification-target"));
  assert.match(target.textContent,/👅/);

  dom=setup();
  s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Carapaça","Bisso")},
    {owner:"amber",r:0,c:0,rank:4},
  ],12102);
  s.geologicalStage="ordovician";
  s.naturalBarriers=[square(4,5)];
  render(dom.window.document,s,{selected:s.pieces[0].id});
  target=cell(dom.window.document,4,5);
  assert.ok(target.classList.contains("vivification-target"));
  assert.match(target.textContent,/🧵/);
});

test("Tentáculo uses an attack circle instead of a new control",()=>{
  const dom=setup(),s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Jatopropulsão","Corpo Gelatinoso","Ventosas Quimiotáteis","Tentáculo Preênsil")},
    {owner:"amber",r:4,c:7,rank:4,traits:mol()},
  ],12103);
  s.geologicalStage="jurassic";
  render(dom.window.document,s,{selected:s.pieces[0].id});
  const target=cell(dom.window.document,4,7);
  assert.ok(target.classList.contains("attack-target"));
  assert.match(target.textContent,/〰️/);
});

test("Cromatóforos use the self vivification circle and disguise the piece visually",()=>{
  let dom=setup(),s=fixture([
    {owner:"blue",r:4,c:4,rank:4,traits:mol("Jatopropulsão","Corpo Gelatinoso","Camuflagem","Percepção Espacial","Cromatóforos Neurais")},
    {owner:"amber",r:0,c:0,rank:4},
  ],12104);
  s.geologicalStage="cretaceous";
  render(dom.window.document,s,{selected:s.pieces[0].id});
  assert.ok(cell(dom.window.document,4,4).classList.contains("vivification-target"));

  dom=setup();
  s.pieces[0].chromatophoreDisguise=true;
  s.current="amber";
  render(dom.window.document,s);
  const piece=cell(dom.window.document,4,4).querySelector(".piece");
  assert.ok(piece.classList.contains("amber"));
  assert.ok(piece.classList.contains("chromatophore-disguise"));
  assert.ok(cell(dom.window.document,4,4).querySelector(".chromatophore-owner-ring.blue"));
});
