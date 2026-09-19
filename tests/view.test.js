import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createState, clone, newPiece, round } from "../src/state.js";
import { render } from "../src/view.js";
import { context } from "../src/engine.js";
import { startEvent } from "../src/environment.js";
import { startDisease } from "../src/disease.js";
function setup() {
  const dom = new JSDOM(
    readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    { url: "https://example.test" },
  );
  const { window: w } = dom;
  w.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  w.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  return dom;
}
test("rendering a pathogen notice settles and never mutates game state", async () => {
  const dom = setup(),
    s = createState(2);
  startDisease(s);
  const before = clone(s);
  let mutations = 0;
  const observer = new dom.window.MutationObserver((records) => {
    mutations += records.length;
  });
  observer.observe(dom.window.document.body, {
    attributes: true,
    childList: true,
    subtree: true,
  });
  render(dom.window.document, s);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const first = mutations;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(mutations, first);
  assert.ok(first > 0);
  assert.deepEqual(s, before);
  assert.equal(dom.window.document.querySelectorAll("dialog[open]").length, 1);
  observer.disconnect();
  dom.window.close();
});
test("ecological event modal uses icon title, italic subtitle and integrated duration", () => {
  const dom = setup(),
    s = createState(7);
  startEvent(context(s), "solar");
  render(dom.window.document, s);

  const d = dom.window.document,
    title = d.getElementById("notice-title"),
    content = d.getElementById("notice-content");

  assert.equal(title.textContent, "🌄 Tempestade Solar");
  assert.equal(content.querySelector("em")?.textContent, "Evento ecológico");
  assert.match(
    content.textContent,
    /Todo nascimento sofre mutação durante 10 rodadas\./,
  );
  assert.doesNotMatch(content.textContent, /Duração:/);
  dom.window.close();
});

test("menu exposes match log and evolutionary history for consultation", () => {
  const dom = setup(),
    d = dom.window.document;
  assert.equal(d.getElementById("game-log").textContent, "Log da partida");
  assert.equal(
    d.getElementById("evolution-history").textContent,
    "História evolutiva",
  );
  assert.equal(
    d.querySelector('#mode option[value="auto"]').textContent,
    "Computador × computador",
  );
  dom.window.close();
});

test("status counter includes turns and historical generation", () => {
  const dom = setup(),
    s = createState(32);
  s.turn = 22;
  s.maxGenerationReached = 13;

  render(dom.window.document, s, { mode: "auto" });
  const d = dom.window.document;
  assert.equal(
    d.getElementById("round").textContent,
    "Pré-Cambriano · Arqueano · 1º Ciclo · 22 Turnos · 14ª Geração",
  );
  assert.equal(d.getElementById("pass").disabled, true);
  dom.window.close();
});

test("renders one board occupant per piece and exactly one stylesheet and module entry", () => {
  const dom = setup(),
    s = createState(2);
  render(dom.window.document, s);
  const d = dom.window.document;
  assert.equal(d.querySelectorAll(".cell").length, 64);
  assert.equal(d.querySelectorAll(".piece").length, s.pieces.length);
  assert.equal(d.querySelectorAll("script").length, 1);
  assert.equal(d.querySelectorAll("link[rel=stylesheet]").length, 1);
  dom.window.close();
});
test("selected panel inspects either side and explains only that piece traits", () => {
  const dom = setup(),
    s = createState(21),
    opponent = s.pieces.find((p) => p.owner === "amber");
  opponent.traits = ["Resistência", "Reprodução Sexuada"];

  render(dom.window.document, s, { selected: opponent.id });
  const d = dom.window.document,
    selected = d.getElementById("selected");

  assert.match(selected.textContent, /♟ Peão \(Preto\)/);
  assert.match(selected.textContent, /🧬 Resistência/);
  assert.match(
    selected.textContent,
    /Impede novas infecções pelo Patógeno Virulento/,
  );
  assert.match(selected.textContent, /❤️ Reprodução Sexuada/);
  assert.match(
    selected.textContent,
    /Combina características de dois progenitores/,
  );
  assert.equal(d.getElementById("traits"), null);
  assert.equal(d.querySelectorAll(".cell.legal").length, 0);
  dom.window.close();
});
test("juveniles render smaller and Lactação highlights eligible children", () => {
  const dom = setup(),
    s = createState(41),
    parent = s.pieces.find((piece) => piece.owner === "blue");
  parent.traits = [...new Set([...parent.traits, "Cuidado Parental", "Lactação"])];
  const child = newPiece(s, "blue", parent.r - 1, parent.c, {
    parentId: parent.id,
  });
  child.maturesRound = round(s) + 2;
  s.pieces.push(child);

  render(dom.window.document, s, { selected: parent.id });
  const d = dom.window.document,
    childCell = d.querySelector(
      `[data-r="${child.r}"][data-c="${child.c}"]`,
    );
  assert.ok(childCell.classList.contains("nurse-target"));
  assert.ok(childCell.querySelector(".piece").classList.contains("juvenile"));
  assert.match(childCell.title, /juvenil/);
  assert.match(childCell.title, /cria disponível para Lactação/);
  dom.window.close();
});

test("renders eggs and carried brood count", () => {
  const dom = setup(),
    s = createState(22),
    parent = s.pieces[0];
  s.eggs.push({
    id: 1,
    owner: "amber",
    r: 3,
    c: 3,
    hatchRound: 3,
    brood: [{}, {}],
    dispersal: "local",
  });
  parent.pregnancies.push({
    dueRound: 3,
    brood: [{}, {}, {}],
    dispersal: "local",
  });

  render(dom.window.document, s, { selected: parent.id });
  const d = dom.window.document;
  assert.equal(d.querySelectorAll(".egg-mark").length, 1);
  assert.match(d.querySelector(".egg-mark").parentElement.title, /2 descendente/);
  assert.match(
    d.querySelector(`[data-r="${parent.r}"][data-c="${parent.c}"] .badges`)
      .textContent,
    /\+3/,
  );
  assert.match(d.getElementById("selected").textContent, /🔴 \+3/);
  dom.window.close();
});

test("renders dispersing Gymnosperm seeds on the board", () => {
  const dom = setup(),
    s = createState(29),
    parent = s.pieces[0];
  s.plantSeeds.push({
    id: s.nextPlantSeed++,
    owner: parent.owner,
    r: 3,
    c: 3,
    parentId: parent.id,
    movesRemaining: 2,
    profile: {
      owner: parent.owner,
      rank: parent.rank,
      traits: ["Fotossíntese", "Embriófitas", "Traqueófitas", "Gimnospermas"],
      reproGenes: structuredClone(parent.reproGenes),
      mutations: 4,
      generation: 1,
      parentId: parent.id,
    },
  });

  render(dom.window.document, s);
  const cell = dom.window.document.querySelector('[data-r="3"][data-c="3"]');
  assert.ok(cell.classList.contains("plant-seed"));
  assert.match(cell.textContent, /🌰/);
  assert.match(cell.title, /semente das Brancas/);
  assert.match(cell.title, /2 rodada/);
  dom.window.close();
});

test("renders barriers, build targets and yellow niche-construction icon", () => {
  const dom = setup(),
    s = createState(25),
    p = s.pieces[0];
  p.traits = ["Construção de Nicho", "Construtor Avançado"];
  s.barriers = [18];
  s.phase = "build";
  s.building = { id: p.id, second: false, locomotion: false };

  render(dom.window.document, s, { selected: p.id });
  const d = dom.window.document;
  assert.ok(d.querySelector('[data-r="2"][data-c="2"]').classList.contains("barrier"));
  assert.ok(d.querySelectorAll(".cell.build-target").length > 0);
  assert.ok(d.querySelector("#selected .niche-icon"));
  assert.equal(d.getElementById("pass").textContent, "Não construir");
  dom.window.close();
});

test("dysfunctional rest fades the piece without adding a sleep badge", () => {
  const dom = setup(),
    s = createState(23),
    p = s.pieces[0];
  p.traits = ["Mutação Disfuncional", "Fertilidade"];
  p.lastMoveRound = 1;

  render(dom.window.document, s, { selected: p.id });
  const d = dom.window.document,
    piece = d.querySelector(
      `[data-r="${p.r}"][data-c="${p.c}"] .piece`,
    ),
    badges = piece.parentElement.querySelector(".badges");
  assert.ok(piece.classList.contains("dysfunctional-resting"));
  assert.ok(!badges.textContent.includes("💤"));
  assert.ok(badges.textContent.includes("🧫"));
  assert.match(d.getElementById("selected").textContent, /🧫 Fertilidade/);
  dom.window.close();
});

test("Polegar Opositor renders colored adjacent transfer choices", () => {
  const dom = setup(),
    s = createState(24),
    p = s.pieces.find((piece) => piece.owner === "blue");
  s.board.fill("neutral");
  p.r = 4;
  p.c = 4;
  s.phase = "manipulate";
  s.manipulation = {
    id: p.id,
    origin: 36,
    terrain: "fertile",
    second: false,
    locomotion: false,
  };

  render(dom.window.document, s, { selected: p.id });
  const d = dom.window.document;
  assert.equal(d.querySelectorAll(".manipulate-fertile").length, 8);
  assert.equal(d.getElementById("pass").textContent, "Não transferir");
  assert.equal(d.getElementById("pass").disabled, false);
  assert.ok(d.getElementById("undo-neocortex").hidden);
  dom.window.close();
});

test("application UI can play, acknowledge reproduction, save and reset", async () => {
  const dom = setup(),
    w = dom.window;
  const prior = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
  };
  globalThis.document = w.document;
  globalThis.localStorage = w.localStorage;
  try {
    await import("../src/app.js");
    const d = w.document;
    const click = (id) => d.getElementById(id).click();
    d.querySelector(".origin-piece").parentElement.click();
    assert.match(d.getElementById("turn").textContent, /Toque novamente/);
    d.querySelector(".origin-piece").parentElement.click();
    assert.equal(d.querySelectorAll(".piece").length, 2);
    d.querySelector(".piece.amber").parentElement.click();
    assert.match(d.getElementById("selected").textContent, /\(Preto\)/);
    assert.equal(d.querySelectorAll(".cell.legal").length, 0);
    let turns = 0;
    while (
      turns < 40 &&
      !d.getElementById("turn").textContent.includes("venceram")
    ) {
      if (d.querySelector("#notice-dialog[open]")) {
        click("notice-ok");
        continue;
      }
      const name = d.getElementById("turn").textContent.includes("Brancas")
        ? "blue"
        : "amber";
      let targets = [];
      for (const p of d.querySelectorAll(`.piece.${name}`)) {
        p.parentElement.click();
        targets = [...d.querySelectorAll(".cell.legal")];
        if (targets.length) break;
      }
      if (targets.length)
        (
          targets.find((t) => t.classList.contains("fertile")) ?? targets[0]
        ).click();
      else click("pass");
      d.querySelector(".cell.partner")?.click();
      turns++;
    }
    while (d.querySelector("#notice-dialog[open]")) click("notice-ok");
    click("menu-button");
    click("save");
    assert.match(d.getElementById("message").textContent, /salva/);
    const saved = d.getElementById("round").textContent;
    click("menu-button");
    click("new");
    click("info-ok");
    assert.match(
      d.getElementById("round").textContent,
      /Origem da campanha · antes do 1º Ciclo/,
    );
    assert.equal(d.querySelectorAll(".origin-piece").length, 1);
    assert.notEqual(d.getElementById("round").textContent, saved);
  } finally {
    globalThis.document = prior.document;
    globalThis.localStorage = prior.localStorage;
    dom.window.close();
  }
});
