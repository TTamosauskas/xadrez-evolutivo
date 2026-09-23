import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  createCampaignState,
  createState,
  clone,
  newPiece,
  round,
} from "../src/state.js";
import { fixture } from "./helpers.js";
import { TRAITS } from "../src/constants.js";
import { render, traitFrameSlots, establishedTraits } from "../src/view.js";
import { actionableTraitsForPiece } from "../src/actionable-traits.js";
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
test("pathogen agents render centered overlays with distinct symbols", () => {
  const dom = setup(),
    s = createState(23),
    virusHost = s.pieces[0],
    mixedHost = s.pieces[1];
  startDisease(s, "eco", virusHost, null, "virus");
  startDisease(s, "eco", mixedHost, null, "fungus");
  startDisease(s, "eco", mixedHost, null, "bacteria");

  render(dom.window.document, s);

  const virusCell = dom.window.document.querySelector(
      `[data-r="${virusHost.r}"][data-c="${virusHost.c}"]`,
    ),
    mixedCell = dom.window.document.querySelector(
      `[data-r="${mixedHost.r}"][data-c="${mixedHost.c}"]`,
    );
  assert.equal(virusCell.querySelector(".pathogen-virus")?.textContent, "☀︎");
  assert.equal(mixedCell.querySelector(".pathogen-bacteria")?.textContent, "🦠");
  assert.equal(mixedCell.querySelector(".pathogen-fungus")?.textContent, "🍄");
  assert.ok(virusCell.querySelector(".pathogen-overlay"));
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

test("ancestral gray King shows Vivificar only after selection", () => {
  const dom = setup(),
    s = createCampaignState(301);

  render(dom.window.document, s);
  const d = dom.window.document;
  let origin = d.querySelector(".origin-piece")?.parentElement,
    legend = d.getElementById("board-legend");

  assert.ok(!origin?.classList.contains("vivification-target"));
  assert.doesNotMatch(origin?.title ?? "", /Vivificar disponível/);
  assert.doesNotMatch(legend.textContent, /Vivificar/);

  s.origin.selected = true;
  render(d, s);
  origin = d.querySelector(".origin-piece")?.parentElement;
  legend = d.getElementById("board-legend");

  assert.ok(origin?.classList.contains("vivification-target"));
  assert.match(origin?.title ?? "", /Vivificar disponível/);
  assert.match(legend.textContent, /Vivificar/);
  assert.ok(legend.querySelector(".legend-action-ring.vivify"));
  dom.window.close();
});

test("mobile selected-piece summary stays below the board", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Predação", "Resistência"],
      },
      { owner: "amber", r: 3, c: 4, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    summary = d.getElementById("mobile-selected-summary"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");

  assert.equal(summary.hidden, false);
  assert.equal(d.getElementById("board").nextElementSibling?.id, "mobile-selected-summary");
  assert.match(summary.textContent, /Rei \(Branco\)/);
  assert.match(summary.textContent, /Predação/);
  assert.ok(summary.querySelector(".mobile-actionable-trait"));
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*header \{[\s\S]*padding: 11px 12px 9px/);
  assert.match(css, /#menu-button \.menu-label \{\s*display: none/);
  assert.match(css, /\.event:empty \{\s*display: none/);
  assert.equal(d.querySelector("#menu-button .menu-label")?.textContent, "Menu");
  dom.window.close();
});

test("mobile summary says no action is available when nothing is actionable", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    opponent = s.pieces[1];

  render(dom.window.document, s, { selected: opponent.id });
  const summary = dom.window.document.getElementById("mobile-selected-summary");

  assert.match(summary.textContent, /Nenhuma ação disponível\./);
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
test("board legend only shows terrain elements currently visible", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 6, c: 3 },
      { owner: "amber", r: 1, c: 4 },
    ]);
  s.board.fill("neutral");
  s.board[0] = "fertile";
  s.board[1] = "hostile";
  s.barriers = [2];
  s.deathSites = [{ cell: 3 }];

  render(dom.window.document, s);
  const legend = dom.window.document.getElementById("board-legend"),
    labels = [...legend.querySelectorAll(".legend-item")].map(
      (item) => item.textContent,
    );

  assert.deepEqual(labels, [
    "🟩Casa fértil",
    "🟥Casa hostil",
    "🟫Barreira",
    "☠️Decomposição",
  ]);
  assert.equal(legend.querySelector(".legend-action-ring"), null);

  s.board[0] = "neutral";
  s.board[1] = "neutral";
  s.barriers = [];
  s.deathSites = [];
  render(dom.window.document, s);
  assert.equal(legend.children.length, 0);
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
  assert.doesNotMatch(css, /\.cell\.barrier[\s\S]*inset 0 0 0 2px/);
  dom.window.close();
});

test("hostile terrain is red and terrain tones flatten from the Devonian", () => {
  const silurianDom = setup(),
    devonianDom = setup(),
    silurian = createState(1203, {
      geologicalStage: "silurian",
      canonicalPair: true,
    }),
    devonian = createState(1204, {
      geologicalStage: "devonian",
      canonicalPair: true,
    }),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");

  render(silurianDom.window.document, silurian);
  render(devonianDom.window.document, devonian);

  assert.equal(
    silurianDom.window.document.querySelectorAll(".terrain-single-tone").length,
    0,
  );
  assert.equal(
    devonianDom.window.document.querySelectorAll(".terrain-single-tone").length,
    64,
  );
  assert.match(css, /\.cell\.hostile\s*\{\s*background:\s*#b86155/);
  assert.match(css, /\.cell\.hostile\.dark\s*\{\s*background:\s*#87443d/);
  assert.match(
    css,
    /\.cell\.terrain-single-tone\.fertile,[\s\S]*background:\s*#789754/,
  );
  assert.match(
    css,
    /\.cell\.terrain-single-tone\.hostile,[\s\S]*background:\s*#a84f45/,
  );

  silurianDom.window.close();
  devonianDom.window.close();
});

test("diet and amniote traits use the intended compact icons", () => {
  assert.equal(TRAITS.Herbívoro[0], "🥬");
  assert.equal(TRAITS.Carnívoro[0], "🍖");
  assert.equal(TRAITS["Ovíparos Amniotas"][0], "🥚");
});

test("active mutations form an evenly spaced frame starting at bottom center", () => {
  assert.deepEqual(traitFrameSlots(1), [0]);
  assert.deepEqual(traitFrameSlots(4), [0, 3, 6, 9]);
  assert.deepEqual(traitFrameSlots(6), [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(traitFrameSlots(12), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

  const dom = setup(),
    s = createState(20),
    piece = s.pieces[0];
  piece.traits = [
    "Multicelularismo",
    "Predação",
    "Carapaça",
    "Veneno",
  ];
  for (const other of s.pieces)
    if (other.id !== piece.id) other.traits = ["Fotossíntese"];
  s.pieces.find((other) => other.id !== piece.id).traits = [
    "Respiração anaeróbia",
  ];
  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    frame = cell.querySelector(".trait-frame"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    classes = [...frame.querySelectorAll(".trait-badge")].map((icon) =>
      [...icon.classList].find((name) => name.startsWith("trait-slot-")),
    );
  assert.ok(frame);
  assert.deepEqual(classes, [
    "trait-slot-0",
    "trait-slot-3",
    "trait-slot-6",
    "trait-slot-9",
  ]);
  assert.equal(frame.querySelector(".trait-overflow"), null);
  assert.match(css, /\.trait-slot-0\s*\{\s*left:\s*50%;\s*top:\s*94%/);
  assert.match(css, /\.trait-slot-3\s*\{\s*left:\s*6%;\s*top:\s*50%/);
  assert.match(css, /\.trait-slot-6\s*\{\s*left:\s*50%;\s*top:\s*6%/);
  assert.match(css, /\.trait-slot-9\s*\{\s*left:\s*94%;\s*top:\s*50%/);
  dom.window.close();
});

test("mutation frame shows twelve phenotypes and an overflow counter", () => {
  const dom = setup(),
    s = createState(201),
    piece = s.pieces[0];
  piece.traits = [
    "Respiração anaeróbia",
    "Reparo Celular",
    "Multicelularismo",
    "Predação",
    "Simetria Bilateral",
    "Locomoção Primitiva",
    "Vertebrado",
    "Locomoção Articulada",
    "Percepção Espacial",
    "Carnívoro",
    "Ovíparo",
    "Carapaça",
    "Camuflagem",
    "Veneno",
    "Resistência",
  ];
  for (const other of s.pieces)
    if (other.id !== piece.id) other.traits = ["Fotossíntese"];
  s.pieces.find((other) => other.id !== piece.id).traits = [
    "Respiração anaeróbia",
  ];

  render(dom.window.document, s);
  const cell = dom.window.document.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    frame = cell.querySelector(".trait-frame");
  assert.equal(frame.querySelectorAll(".trait-badge").length, 12);
  assert.equal(frame.querySelector(".trait-overflow").textContent, "+3");
  assert.ok(cell.classList.contains("trait-dense"));
  dom.window.close();
});

test("globally established inherited traits move to genetic legacy and return when differential", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4 },
      { owner: "blue", r: 4, c: 5 },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    selectedPiece = s.pieces[0],
    ally = s.pieces[1],
    rival = s.pieces[2];

  selectedPiece.traits = [
    "Respiração anaeróbia",
    "Carapaça",
    "Resistência",
    "Deficiência Motora",
  ];
  ally.traits = ["Respiração anaeróbia", "Carapaça"];
  rival.traits = ["Respiração anaeróbia", "Carapaça"];
  selectedPiece.ancestry = [...selectedPiece.traits];
  ally.ancestry = [...ally.traits];
  rival.ancestry = [...rival.traits];

  assert.deepEqual(
    [...establishedTraits(s)].sort(),
    ["Carapaça", "Respiração anaeróbia"].sort(),
  );

  render(dom.window.document, s, { selected: selectedPiece.id });
  let d = dom.window.document,
    selected = d.getElementById("selected"),
    cell = d.querySelector(
      `[data-r="${selectedPiece.r}"][data-c="${selectedPiece.c}"]`,
    );
  assert.match(selected.textContent, /Vantagens Evolutivas/);
  assert.match(selected.textContent, /Resistência/);
  assert.match(selected.textContent, /Desvantagens Evolutivas/);
  assert.match(selected.textContent, /Deficiência Motora/);
  assert.match(selected.querySelector(".legacy-toggle").textContent, /Carapaça/);
  assert.doesNotMatch(
    [...cell.querySelectorAll(".trait-badge")]
      .map((badge) => badge.dataset.trait)
      .join("|"),
    /Carapaça|Respiração anaeróbia/,
  );

  rival.traits = ["Respiração anaeróbia"];
  rival.ancestry = [...rival.traits];
  render(dom.window.document, s, { selected: selectedPiece.id });
  d = dom.window.document;
  selected = d.getElementById("selected");
  cell = d.querySelector(
    `[data-r="${selectedPiece.r}"][data-c="${selectedPiece.c}"]`,
  );
  assert.match(selected.textContent, /Carapaça/);
  assert.ok(
    [...cell.querySelectorAll(".trait-badge")].some(
      (badge) => badge.dataset.trait === "Carapaça",
    ),
  );
  dom.window.close();
});

test("branch-specific traits remain differential unless every piece expresses them", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4 },
      { owner: "amber", r: 0, c: 0 },
      { owner: "blue", r: 2, c: 2, traits: ["Fotossíntese"] },
    ]),
    animalA = s.pieces[0],
    animalB = s.pieces[1],
    plant = s.pieces[2];

  animalA.traits = [
    "Respiração anaeróbia",
    "Predação",
    "Multicelularismo",
    "Simetria Bilateral",
  ];
  animalB.traits = [
    "Respiração anaeróbia",
    "Predação",
    "Multicelularismo",
    "Simetria Bilateral",
  ];
  plant.traits = ["Respiração anaeróbia", "Fotossíntese", "Embriófitas"];
  animalA.ancestry = [...animalA.traits];
  animalB.ancestry = [...animalB.traits];
  plant.ancestry = [...plant.traits];

  const established = establishedTraits(s);
  assert.ok(established.has("Respiração anaeróbia"));
  assert.ok(!established.has("Simetria Bilateral"));
  assert.ok(!established.has("Predação"));
  assert.ok(!established.has("Fotossíntese"));
  assert.ok(!established.has("Embriófitas"));

  render(dom.window.document, s, { selected: animalA.id });
  const d = dom.window.document,
    selected = d.getElementById("selected"),
    animalCell = d.querySelector(
      `[data-r="${animalA.r}"][data-c="${animalA.c}"]`,
    ),
    frameTraits = [...animalCell.querySelectorAll(".trait-badge")].map(
      (badge) => badge.dataset.trait,
    );
  assert.match(selected.textContent, /Simetria Bilateral/);
  assert.match(selected.textContent, /Predação/);
  assert.ok(frameTraits.includes("Simetria Bilateral"));
  assert.ok(frameTraits.includes("Predação"));

  render(dom.window.document, s, { selected: plant.id });
  const plantSelected = dom.window.document.getElementById("selected");
  assert.match(plantSelected.textContent, /Fotossíntese/);
  assert.match(plantSelected.textContent, /Embriófitas/);
  dom.window.close();
});

test("somatic disadvantages stay individual even when an inherited trait is established", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0],
    rival = s.pieces[1];
  piece.traits = ["Respiração anaeróbia"];
  rival.traits = ["Respiração anaeróbia"];
  piece.somaticMutations = ["Imunodeficiência"];

  render(dom.window.document, s, { selected: piece.id });
  const selected = dom.window.document.getElementById("selected");
  assert.match(selected.textContent, /Desvantagens Evolutivas/);
  assert.match(selected.textContent, /Imunodeficiência · somática/);
  assert.ok(
    dom.window.document.querySelector(".trait-badge.somatic-badge"),
  );
  dom.window.close();
});

test("somatic mutations are visually distinct in the mutation frame", () => {
  const dom = setup(),
    s = createState(202),
    piece = s.pieces[0];
  piece.traits = ["Respiração anaeróbia", "Multicelularismo"];
  piece.somaticMutations = ["Imunodeficiência"];

  render(dom.window.document, s);
  const cell = dom.window.document.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    somatic = cell.querySelector(".trait-badge.somatic-badge");
  assert.ok(somatic);
  assert.equal(somatic.dataset.trait, "Imunodeficiência");
  assert.equal(somatic.textContent, "🤢");
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
    /Impede infecção ecológica e reduz em 75% a mortalidade patogênica populacional/,
  );
  assert.match(selected.textContent, /❤️ Reprodução Sexuada/);
  assert.match(
    selected.textContent,
    /Pode cruzar com parceiro compatível e recombinar alelos/,
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
  piece.ancestry = ["Multicelularismo", "Predação", "Ovíparo", "Locomoção Primitiva"];
  piece.genome = genomeFromTraits(piece.traits, ["Ovíparo"]);
  syncGenomePhenotype(piece, "Predação");

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    selected = d.getElementById("selected"),
    recessive = selected.querySelector(".recessive-toggle"),
    ancestry = selected.querySelector(".legacy-toggle");

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
    "Locomoção Primitiva",
    "Locomoção Avançada",
  ];

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    selected = d.getElementById("selected"),
    toggle = selected.querySelector(".legacy-toggle"),
    summary = toggle.querySelector("summary");

  assert.match(selected.textContent, /Vantagens Evolutivas/);
  assert.match(selected.textContent, /Onívoro/);
  assert.match(selected.textContent, /Locomoção Avançada/);
  assert.ok(toggle);
  assert.equal(toggle.open, false);
  assert.match(summary.textContent, /Legado Genético \(2\)/);
  assert.match(toggle.textContent, /Carnívoro/);
  assert.match(toggle.textContent, /Locomoção/);
  assert.doesNotMatch(
    toggle.querySelector(".ancestry-list").textContent,
    /Onívoro|Locomoção Avançada/,
  );

  const cell = d.querySelector(
    `[data-r="${piece.r}"][data-c="${piece.c}"]`,
  );
  const boardIcons = cell.querySelector(".trait-frame").textContent;
  assert.match(boardIcons, /🐻/);
  assert.doesNotMatch(boardIcons, /🦁/);
  dom.window.close();
});

test("legacy toggle is omitted when there are no historical or established traits", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4 },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0],
    rival = s.pieces[1];
  piece.traits = ["Resistência"];
  piece.ancestry = [...piece.traits];
  rival.traits = ["Fotossíntese"];
  rival.ancestry = [...rival.traits];

  render(dom.window.document, s, { selected: piece.id });
  assert.equal(
    dom.window.document.querySelector("#selected .legacy-toggle"),
    null,
  );
  dom.window.close();
});

test("actionable mutations appear first, bold and with concise descriptions", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Resistência", "Predação"],
      },
      { owner: "amber", r: 3, c: 4, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];

  render(dom.window.document, s, { selected: piece.id });
  const selected = dom.window.document.getElementById("selected"),
    rows = [...selected.querySelectorAll(".selected-trait")],
    predation = rows.find((row) => row.textContent.includes("Predação")),
    resistance = rows.find((row) => row.textContent.includes("Resistência"));

  const firstPassiveIndex = rows.findIndex(
    (row) => !row.classList.contains("actionable-trait"),
  );
  assert.ok(predation.classList.contains("actionable-trait"));
  assert.ok(predation.querySelector("strong"));
  assert.match(predation.textContent, /Pode capturar peças/);
  assert.ok(!resistance.classList.contains("actionable-trait"));
  assert.equal(resistance.querySelector("strong"), null);
  assert.ok(rows.indexOf(predation) < rows.indexOf(resistance));
  assert.ok(
    rows
      .slice(0, firstPassiveIndex)
      .every((row) => row.classList.contains("actionable-trait")),
  );
  dom.window.close();
});

test("a mutation is not actionable when it has no legal action this turn", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Resistência", "Predação"],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0],
    actionable = actionableTraitsForPiece(s, piece);

  assert.ok(!actionable.has("Predação"));
});

test("stationary photosynthesis is actionable even without an explicit action target", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Fotossíntese", "Embriófitas"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0];

  render(dom.window.document, s, { selected: piece.id });
  const rows = [...dom.window.document.querySelectorAll(
      "#selected .selected-trait",
    )],
    photosynthesis = rows.find((row) =>
      row.textContent.includes("Fotossíntese"),
    ),
    embryophytes = rows.find((row) =>
      row.textContent.includes("Embriófitas"),
    );

  assert.ok(photosynthesis?.classList.contains("actionable-trait"));
  assert.ok(photosynthesis.querySelector("strong"));
  assert.match(
    photosynthesis.textContent,
    /3–6 rodadas imóvel/,
  );
  assert.ok(embryophytes?.classList.contains("actionable-trait"));
  dom.window.close();
});

test("stationary preparation makes Brotamento actionable before Vivificar is ready", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Brotamento"],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];
  piece.stationarySinceRound = round(s);

  render(dom.window.document, s, { selected: piece.id });
  const selected = dom.window.document.getElementById("selected"),
    budding = [...selected.querySelectorAll(".selected-trait")].find(
      (row) => row.textContent.includes("Brotamento"),
    ),
    cell = dom.window.document.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    );

  assert.ok(budding?.classList.contains("actionable-trait"));
  assert.ok(!cell.classList.contains("vivification-target"));
  dom.window.close();
});

test("stationary environmental effects remain actionable while active", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Fotossíntese",
          "Multicelularismo",
          "Embriófitas",
          "Dormência",
          "Extremófitas",
        ],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];
  s.board[piece.r * 8 + piece.c] = "hostile";

  const actionable = actionableTraitsForPiece(s, piece);
  assert.ok(actionable.has("Dormência"));
  assert.ok(actionable.has("Extremófitas"));
});

test("Vivificar and targeted Parasitismo use green and red board rings", () => {
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
    selfCell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    enemyCell = d.querySelector(
      `[data-r="${enemy.r}"][data-c="${enemy.c}"]`,
    ),
    legend = d.getElementById("board-legend");
  assert.equal(d.getElementById("piece-actions"), null);
  assert.ok(selfCell.classList.contains("vivification-target"));
  assert.ok(enemyCell.classList.contains("attack-target"));
  assert.match(enemyCell.title, /ataque por Parasitismo/);
  assert.match(legend.textContent, /Vivificar/);
  assert.match(legend.textContent, /Ataque/);
  assert.equal(d.querySelector(".board-footer > #pass")?.id, "pass");
  dom.window.close();
});

test("self-only Parasitismo uses Vivificar when there is no attack target", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Parasitismo"] },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    legend = d.getElementById("board-legend");

  assert.ok(cell.classList.contains("vivification-target"));
  assert.match(cell.title, /vivificação disponível: Parasitismo/);
  assert.match(legend.textContent, /Vivificar/);
  assert.doesNotMatch(legend.textContent, /Ataque/);
  dom.window.close();
});

test("selected sexual pieces mark partners green and attack targets red", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        rank: 4,
        traits: ["Reprodução Sexuada"],
      },
      {
        owner: "blue",
        r: 4,
        c: 5,
        traits: ["Reprodução Sexuada"],
      },
      { owner: "amber", r: 3, c: 4 },
    ]),
    parent = s.pieces[0],
    mate = s.pieces[1],
    enemy = s.pieces[2];
  s.board[parent.r * 8 + parent.c] = "fertile";

  render(dom.window.document, s, { selected: parent.id });
  const d = dom.window.document,
    parentCell = d.querySelector(
      `[data-r="${parent.r}"][data-c="${parent.c}"]`,
    ),
    mateCell = d.querySelector(
      `[data-r="${mate.r}"][data-c="${mate.c}"]`,
    ),
    enemyCell = d.querySelector(
      `[data-r="${enemy.r}"][data-c="${enemy.c}"]`,
    ),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");

  assert.ok(parentCell.classList.contains("vivification-target"));
  assert.ok(mateCell.classList.contains("partner"));
  assert.ok(enemyCell.classList.contains("attack-target"));
  assert.equal(d.getElementById("piece-actions"), null);
  assert.match(parentCell.title, /vivificação disponível: Reprodução/);
  assert.match(mateCell.title, /parceiro disponível/);
  assert.match(enemyCell.title, /alvo de ataque/);
  assert.match(
    css,
    /\.cell\.legal\.vivification-target::after[\s\S]*border:\s*4px solid #5bd66c/,
  );
  assert.match(
    css,
    /\.cell\.attack-target::after[\s\S]*border:\s*4px solid #d54242/,
  );

  const legend = d.getElementById("board-legend");
  assert.match(legend.textContent, /Vivificar/);
  assert.match(legend.textContent, /Ataque/);
  assert.ok(legend.querySelector(".legend-action-ring.vivify"));
  assert.ok(legend.querySelector(".legend-action-ring.attack"));
  assert.match(
    css,
    /\.legend-action-ring\.vivify[\s\S]*color:\s*#5bd66c/,
  );
  assert.match(
    css,
    /\.legend-action-ring\.attack[\s\S]*color:\s*#d54242/,
  );
  dom.window.close();
});

test("juveniles render smaller and Lactação highlights eligible children", () => {
  const dom = setup(),
    s = createState(41),
    parent = s.pieces.find((piece) => piece.owner === "blue");
  parent.traits = [...new Set([...parent.traits, "Incubação", "Lactação"])];
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

test("senescent pieces use only italic lifecycle styling and age status", () => {
  const dom = setup(),
    s = createState(42),
    elder = s.pieces[0];
  elder.traits = [
    "Multicelularismo",
    "Locomoção Primitiva",
    "Predação",
  ];
  elder.bornRound = 0;
  elder.maturesRound = 2;
  s.turn = 50;

  render(dom.window.document, s, { selected: elder.id });
  const d = dom.window.document,
    piece = d.querySelector(
      `[data-r="${elder.r}"][data-c="${elder.c}"] .piece`,
    ),
    status = piece.parentElement.querySelector(".piece-status"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    rule = css.match(/\.piece\.senescent\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.ok(piece.classList.contains("senescent"));
  assert.match(piece.parentElement.title, /senescente, idade 25/);
  assert.doesNotMatch(status?.textContent ?? "", /⌛|⏳/);
  assert.match(d.getElementById("selected").textContent, /Senescente · idade 25/);
  assert.match(rule, /font-style:\s*italic/);
  assert.doesNotMatch(rule, /transform|opacity|font-size/);
  dom.window.close();
});

test("pieces with no available action fade on board and show wait badge when selected", () => {
  const dom = setup(),
    s = createState(43),
    piece = s.pieces.find((candidate) => candidate.owner === "blue");
  piece.traits = [
    ...new Set([...piece.traits, "Multicelularismo", "Metamorfose"]),
  ];
  piece.pupaUntilRound = round(s) + 2;

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    boardPiece = cell.querySelector(".piece"),
    selected = d.getElementById("selected"),
    waitBadge = selected.querySelector(".selected-wait-badge"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    waitRule = css.match(/\.cell \.piece\.waiting\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.ok(boardPiece.classList.contains("waiting"));
  assert.doesNotMatch(cell.textContent, /⏳/);
  assert.match(cell.title, /aguardando: Metamorfose/);
  assert.equal(waitBadge?.textContent, "⏳");
  assert.equal(waitBadge?.title, "Metamorfose");
  assert.match(selected.textContent, /⏳ 2 t metamorfose\./);
  assert.match(waitRule, /opacity:\s*0\.48/);
  dom.window.close();
});

test("selected-piece lifecycle countdowns use compact wait copy", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Multicelularismo", "Locomoção Primitiva", "Respiração anaeróbia"],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0],
    currentRound = round(s);

  piece.maturesRound = currentRound + 1;
  piece.nextReproductionRound = currentRound + 5;
  s.board[piece.r * 8 + piece.c] = "fertile";

  render(dom.window.document, s, { selected: piece.id });
  const selected = dom.window.document.getElementById("selected");

  assert.match(selected.textContent, /⏳ 1 t maturidade sexual\./);
  assert.match(selected.textContent, /⏳ 5 t descanso reprodutivo\./);
  assert.doesNotMatch(selected.textContent, /rodada\(s\) restante/);
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
    d.querySelector(`[data-r="${parent.r}"][data-c="${parent.c}"] .piece-status`)
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

test("dysfunctional rest uses the shared waiting fade and selected badge", () => {
  const dom = setup(),
    s = createState(23),
    p = s.pieces[0];
  p.traits = ["Mutação Disfuncional", "Respiração anaeróbia"];
  p.lastMoveRound = 1;

  render(dom.window.document, s, { selected: p.id });
  const d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${p.r}"][data-c="${p.c}"]`,
    ),
    piece = cell.querySelector(".piece"),
    badges = cell.querySelector(".trait-frame"),
    selected = d.getElementById("selected");
  assert.ok(piece.classList.contains("waiting"));
  assert.doesNotMatch(cell.textContent, /⏳|💤/);
  assert.ok(badges.textContent.includes("❌"));
  assert.equal(
    selected.querySelector(".selected-wait-badge")?.textContent,
    "⏳",
  );
  assert.match(selected.textContent, /Descanso por Mutação Disfuncional/);
  assert.match(selected.textContent, /❌ Mutação Disfuncional/);
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


test("Domínio Ecológico mostra borda do quadrante e três marcadores de estabilidade", () => {
  const dom = setup(),
    s = createState(153);
  s.ecologicalDomain.active = true;
  Object.assign(s.ecologicalDomain.quadrants[0], {
    owner: "blue",
    progress: 2,
    consolidated: false,
  });

  render(dom.window.document, s);
  const d = dom.window.document,
    topLeft = d.querySelector('[data-r="0"][data-c="0"]'),
    bottomRight = d.querySelector('[data-r="3"][data-c="3"]');

  assert.ok(topLeft.classList.contains("domain-blue"));
  assert.ok(topLeft.classList.contains("domain-edge-top"));
  assert.ok(topLeft.classList.contains("domain-edge-left"));
  assert.ok(bottomRight.classList.contains("domain-edge-bottom"));
  assert.ok(bottomRight.classList.contains("domain-edge-right"));
  assert.equal(topLeft.querySelector(".domain-progress")?.textContent, "●●○");
  assert.match(d.getElementById("event").textContent, /Domínio Ecológico/);

  Object.assign(s.ecologicalDomain.quadrants[0], {
    owner: "blue",
    progress: 3,
    consolidated: true,
  });
  render(dom.window.document, s);
  assert.ok(
    d.querySelector('[data-r="0"][data-c="0"]').classList.contains(
      "domain-consolidated",
    ),
  );
  assert.equal(
    d.querySelector('[data-r="0"][data-c="0"] .domain-progress')?.textContent,
    "●●●",
  );
  dom.window.close();
});


test("game-over dialog can be held closed until the result delay expires", () => {
  const dom = setup(),
    s = createState(403);
  s.result = { winner: "blue", reason: "Extinção total." };
  s.phase = "over";

  render(dom.window.document, s, { showResult: false });
  assert.equal(dom.window.document.getElementById("game-over-dialog").open, false);

  render(dom.window.document, s, { showResult: true });
  assert.equal(dom.window.document.getElementById("game-over-dialog").open, true);
  dom.window.close();
});
