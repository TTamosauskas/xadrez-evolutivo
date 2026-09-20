import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createState, clone, newPiece, round } from "../src/state.js";
import { render } from "../src/view.js";
import { context } from "../src/engine.js";
import { startEvent } from "../src/environment.js";
import { startDisease } from "../src/disease.js";
import {
  cloneGenome,
  genomeFromTraits,
  syncGenomePhenotype,
} from "../src/genetics.js";
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

test("scenario preference is applied on reload and Arena opens its designer", () => {
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(
    app,
    /createCampaignState\(Date\.now\(\), selectedScenario\)/,
  );
  assert.match(app, /globalThis\.location\?\.reload\?\.\(\)/);
  assert.match(
    app,
    /if \(selectedScenario === "arena"\) openArenaSetup\(\);/,
  );
});

test("information dialog opens at the top so recent log entries are visible first", () => {
  const dom = setup(),
    d = dom.window.document,
    app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.equal(d.getElementById("info-dialog").getAttribute("tabindex"), "-1");
  assert.match(app, /dialog\.focus\(\{ preventScroll: true \}\)/);
  assert.match(app, /dialog\.scrollTop = 0/);
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
  assert.equal(d.getElementById("arena-mode"), null);
  assert.equal(
    d.querySelector('#scenario option[value="earth"]').textContent,
    "Vida na Terra",
  );
  assert.equal(
    d.querySelector('#scenario option[value="alternative"]').textContent,
    "Cenários Alternativos",
  );
  assert.equal(
    d.querySelector('#scenario option[value="arena"]').textContent,
    "Arena",
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
test("barriers render with a granite texture", () => {
  const dom = setup(),
    s = createState(19);
  s.barriers = [27];
  s.naturalBarriers = [28];
  render(dom.window.document, s);
  const d = dom.window.document,
    built = d.querySelector('[data-r="3"][data-c="3"]'),
    natural = d.querySelector('[data-r="3"][data-c="4"]'),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
  assert.ok(built.classList.contains("built-barrier"));
  assert.ok(natural.classList.contains("natural-barrier"));
  assert.ok(built.querySelector(".barrier-mark"));
  assert.match(css, /\.cell\.barrier[\s\S]*radial-gradient/);
  assert.match(css, /\.barrier-mark[\s\S]*radial-gradient/);
  assert.match(css, /rgba\(0,0,0,0\.22\)/);
  dom.window.close();
});

test("selected pieces keep the normal compact mutation icon layout", () => {
  const dom = setup(),
    s = createState(20),
    piece = s.pieces[0];
  piece.traits = [
    "Multicelularismo",
    "Predação",
    "Locomoção",
    "Carapaça",
    "Camuflagem",
    "Veneno",
  ];
  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    badges = cell.querySelector(".badges"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
  assert.ok(badges);
  assert.equal(badges.querySelectorAll(".badge-icon").length, 5);
  assert.equal(cell.querySelector(".selected-badges"), null);
  assert.doesNotMatch(css, /selected-badge-orbit/);
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
    /reduz em 75% a mortalidade individual causada por patógenos de pressão populacional/,
  );
  assert.match(selected.textContent, /❤️ Reprodução Sexuada/);
  assert.match(
    selected.textContent,
    /recebe um alelo de cada progenitor em cada locus/,
  );
  assert.equal(d.getElementById("traits"), null);
  assert.equal(d.querySelectorAll(".cell.legal").length, 0);
  dom.window.close();
});
test("selected legend shows hidden recessive genes before ancestry without duplication", () => {
  const dom = setup(),
    s = createState(220),
    piece = s.pieces[0];
  piece.traits = ["Respiração anaeróbia", "Multicelularismo", "Predação"];
  piece.ancestry = ["Multicelularismo", "Predação", "Ovíparo", "Locomoção"];
  piece.genome = genomeFromTraits(piece.traits, ["Ovíparo"]);
  syncGenomePhenotype(piece, "Predação");

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    selected = d.getElementById("selected"),
    recessive = selected.querySelector(".recessive-toggle"),
    ancestry = selected.querySelector(".ancestry-toggle");

  assert.ok(recessive);
  assert.equal(recessive.open, false);
  assert.match(
    recessive.querySelector("summary").textContent,
    /Genes Recessivos \(1\)/,
  );
  assert.match(recessive.textContent, /Ovíparo/);
  assert.match(
    recessive.querySelector(".recessive-chip").title,
    /Presente no genótipo, mas não expresso/,
  );
  assert.ok(ancestry);
  assert.match(ancestry.textContent, /Locomoção/);
  assert.doesNotMatch(ancestry.textContent, /Ovíparo/);
  assert.ok(
    recessive.compareDocumentPosition(ancestry) &
      dom.window.Node.DOCUMENT_POSITION_FOLLOWING,
  );
  dom.window.close();
});

test("recessive genes toggle is omitted when no recessive allele is hidden", () => {
  const dom = setup(),
    s = createState(221),
    piece = s.pieces[0];

  render(dom.window.document, s, { selected: piece.id });
  assert.equal(
    dom.window.document.querySelector("#selected .recessive-toggle"),
    null,
  );
  dom.window.close();
});

test("selected legend separates active traits from ancestry behind a closed toggle", () => {
  const dom = setup(),
    s = createState(22),
    piece = s.pieces[0];
  piece.traits = ["Multicelularismo", "Predação", "Onívoro", "Locomoção Avançada"];
  piece.ancestry = [
    "Multicelularismo",
    "Predação",
    "Carnívoro",
    "Onívoro",
    "Locomoção",
    "Locomoção Avançada",
  ];

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    selected = d.getElementById("selected"),
    toggle = selected.querySelector(".ancestry-toggle"),
    summary = toggle.querySelector("summary");

  assert.match(selected.textContent, /Fenótipo ativo/);
  assert.match(selected.textContent, /Onívoro/);
  assert.match(selected.textContent, /Locomoção Avançada/);
  assert.ok(toggle);
  assert.equal(toggle.open, false);
  assert.match(summary.textContent, /Ancestralidade da linhagem \(2\)/);
  assert.match(toggle.textContent, /Carnívoro/);
  assert.match(toggle.textContent, /Locomoção/);
  assert.doesNotMatch(
    toggle.querySelector(".ancestry-list").textContent,
    /Onívoro|Locomoção Avançada/,
  );

  const cell = d.querySelector(
    `[data-r="${piece.r}"][data-c="${piece.c}"]`,
  );
  const boardIcons = cell.querySelector(".badges").textContent;
  assert.match(boardIcons, /🐻/);
  assert.match(boardIcons, /🐪/);
  assert.doesNotMatch(boardIcons, /🦁/);
  dom.window.close();
});

test("ancestry toggle is omitted when the selected phenotype has no suppressed traits", () => {
  const dom = setup(),
    s = createState(23),
    piece = s.pieces[0];
  piece.traits = ["Multicelularismo", "Predação"];
  piece.ancestry = [...piece.traits];

  render(dom.window.document, s, { selected: piece.id });
  assert.equal(
    dom.window.document.querySelector("#selected .ancestry-toggle"),
    null,
  );
  dom.window.close();
});

test("selected self-actions appear immediately to the left of Passar vez", () => {
  const dom = setup(),
    s = createState(24),
    piece = s.pieces.find((candidate) => candidate.owner === s.current),
    enemy = s.pieces.find((candidate) => candidate.owner !== s.current);
  piece.traits = [
    "Respiração anaeróbia",
    "Multicelularismo",
    "Predação",
    "Parasitismo",
  ];
  piece.ancestry = [...piece.traits];
  s.board[piece.r * 8 + piece.c] = "fertile";
  enemy.r = piece.r - 1;
  enemy.c = piece.c;

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    actions = d.getElementById("piece-actions"),
    labels = [...actions.querySelectorAll("button")].map(
      (button) => button.textContent,
    );
  assert.deepEqual(labels, ["Reproduzir", "Parasitismo"]);
  assert.equal(actions.nextElementSibling?.id, "pass");
  dom.window.close();
});

test("juveniles render smaller and Lactação highlights eligible children", () => {
  const dom = setup(),
    s = createState(41),
    parent = s.pieces.find((piece) => piece.owner === "blue");
  parent.traits = [...new Set([...parent.traits, "Cuidado Parental", "Lactação"])];
  const child = newPiece(s, "blue", parent.r - 1, parent.c, {
    parentId: parent.id,
    traits: ["Multicelularismo"],
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

test("senescent pieces render italic lifecycle styling and age status", () => {
  const dom = setup(),
    s = createState(42),
    elder = s.pieces[0];
  elder.traits = ["Multicelularismo"];
  elder.bornRound = 0;
  elder.maturesRound = 2;
  s.turn = 50;

  render(dom.window.document, s, { selected: elder.id });
  const d = dom.window.document,
    piece = d.querySelector(
      `[data-r="${elder.r}"][data-c="${elder.c}"] .piece`,
    ),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
  assert.ok(piece.classList.contains("senescent"));
  assert.match(piece.parentElement.title, /senescente, idade 25/);
  assert.match(piece.parentElement.querySelector(".badges").textContent, /⌛/);
  assert.match(d.getElementById("selected").textContent, /Senescente · idade 25/);
  assert.match(css, /\.piece\.senescent[\s\S]*font-style:\s*italic/);
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
    laidRound: 0,
    hatchRound: 3,
    expireRound: 6,
    mode: "basal",
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
  assert.equal(d.querySelector(".egg-mark").textContent, "⚪");
  assert.match(d.querySelector(".egg-mark").parentElement.title, /ovo aquático/);
  assert.match(d.querySelector(".egg-mark").parentElement.title, /busca terreno fértil/);
  assert.match(d.querySelector(".egg-mark").parentElement.title, /2 descendente/);
  assert.match(
    d.querySelector(`[data-r="${parent.r}"][data-c="${parent.c}"] .badges`)
      .textContent,
    /\+3/,
  );
  assert.match(d.getElementById("selected").textContent, /🔴 \+3/);
  dom.window.close();
});

test("renders translucent targets for amniotic and ovoviviparous laying", () => {
  const dom = setup(),
    s = createState(71),
    parent = s.pieces.find((piece) => piece.owner === "blue");

  s.phase = "egg-placement";
  s.eggPlacement = {
    kind: "amniote",
    parentId: parent.id,
    owner: parent.owner,
    origin: { r: parent.r, c: parent.c },
    brood: [{}],
    dispersal: "local",
    continuation: null,
  };
  render(dom.window.document, s);
  let d = dom.window.document;
  assert.ok(d.querySelectorAll(".egg-placement-target").length > 0);
  assert.ok(
    [...d.querySelectorAll(".egg-preview")].every(
      (preview) => preview.textContent === "🥚",
    ),
  );

  s.phase = "move";
  s.eggPlacement = null;
  parent.pregnancies.push({
    kind: "ovoviviparous",
    dueRound: round(s),
    readyLogged: true,
    brood: [{}],
    dispersal: "local",
  });
  render(dom.window.document, s, { selected: parent.id });
  d = dom.window.document;
  assert.ok(d.querySelectorAll(".ovoviviparous-target").length > 0);
  assert.ok(
    [...d.querySelectorAll(".egg-preview")].every(
      (preview) => preview.textContent === "⚪",
    ),
  );
  assert.match(d.getElementById("selected").textContent, /pronto para postura/);
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
      genome: cloneGenome(parent.genome),
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

test("renders barriers, build targets and construction emoji icons", () => {
  const dom = setup(),
    s = createState(25),
    p = s.pieces[0];
  p.traits = ["Construtor de Nicho", "Antropização"];
  s.barriers = [18];
  s.phase = "build";
  s.building = { id: p.id, second: false, locomotion: false };

  render(dom.window.document, s, { selected: p.id });
  const d = dom.window.document;
  assert.ok(d.querySelector('[data-r="2"][data-c="2"]').classList.contains("barrier"));
  assert.ok(d.querySelectorAll(".cell.build-target").length > 0);
  assert.match(d.getElementById("selected").textContent, /🦫/);
  assert.match(d.getElementById("selected").textContent, /🧔/);
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
    assert.equal(d.querySelectorAll(".piece").length, 4);
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


test("renders domestic placement and Sociabilidade sacrifice targets", () => {
  const dom = setup(),
    s = createState(131),
    parent = s.pieces[0];
  s.phase = "domestic-placement";
  s.domesticPlacement = {
    parentId: parent.id,
    owner: parent.owner,
    origin: { r: parent.r, c: parent.c },
    brood: [{
      owner: parent.owner,
      rank: parent.rank,
      traits: ["Animais Domésticos"],
      ancestry: ["Animais Domésticos"],
      genome: cloneGenome(parent.genome),
      mutations: 1,
      generation: 1,
      parentId: parent.id,
    }],
    continuation: null,
  };
  s.maxGenerationReached = 1;
  render(dom.window.document, s);
  assert.ok(
    dom.window.document.querySelectorAll(".domestic-placement-target").length > 0,
  );

  s.domesticPlacement = null;
  s.phase = "move";
  const defenders = [
    newPiece(s, "amber", 3, 3, { traits: ["Sociabilidade"] }),
    newPiece(s, "amber", 3, 4, { traits: ["Sociabilidade"] }),
    newPiece(s, "amber", 4, 3, { traits: ["Sociabilidade"] }),
    newPiece(s, "amber", 4, 4, { traits: ["Sociabilidade"] }),
  ];
  s.pieces.push(...defenders);
  s.phase = "social-defense";
  s.socialDefense = {
    attackerId: parent.id,
    victimId: defenders[0].id,
    attackerOwner: parent.owner,
    memberIds: defenders.map((piece) => piece.id),
  };
  s.current = "amber";
  render(dom.window.document, s);
  assert.equal(
    dom.window.document.querySelectorAll(".social-sacrifice-target").length,
    4,
  );
  dom.window.close();
});
