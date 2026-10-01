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
  deterministicDeathNextTurn,
} from "../src/state.js";
import { fixture } from "./helpers.js";
import { TRAITS, EVENTS } from "../src/constants.js";
import { render, traitFrameSlots, establishedTraits } from "../src/view.js";
import {
  actionableTraitsForPiece,
  contextualTraitsForBoard,
} from "../src/actionable-traits.js";
import { context, transition } from "../src/engine.js";
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
    s = createState(2, { geologicalStage: "quaternary" });
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
test("infection markers stay attached to pieces while environmental pathogens remain cell overlays", () => {
  const dom = setup(),
    s = createState(23, { geologicalStage: "quaternary" }),
    virusHost = s.pieces[0],
    mixedHost = s.pieces[1],
    virusDisease = startDisease(s, "eco", virusHost, null, "virus");
  s.cyclePathogenProfile = null;
  startDisease(s, "eco", mixedHost, null, "fungus");
  s.cyclePathogenProfile = null;
  startDisease(s, "eco", mixedHost, null, "bacteria");
  s.cyclePathogenProfile = null;
  const sporeDisease = startDisease(
    s,
    "eco",
    mixedHost,
    null,
    "fungus",
    "spore",
  );
  s.pathogenSpores.push({
    id: s.nextPathogenSpore++,
    diseaseId: sporeDisease.id,
    r: 6,
    c: 6,
    targetR: 7,
    targetC: 7,
    movesRemaining: 2,
  });

  render(dom.window.document, s, { selected: virusHost.id });

  const d = dom.window.document,
    virusCell = d.querySelector(
      `[data-r="${virusHost.r}"][data-c="${virusHost.c}"]`,
    ),
    mixedCell = d.querySelector(
      `[data-r="${mixedHost.r}"][data-c="${mixedHost.c}"]`,
    ),
    sporeCell = d.querySelector('[data-r="6"][data-c="6"]'),
    selected = d.getElementById("selected").textContent;

  assert.equal(
    virusCell.querySelector(".piece-pathogen-infection.pathogen-virus")
      ?.textContent,
    "☀︎",
  );
  assert.equal(virusCell.querySelector(".pathogen-overlay"), null);
  assert.equal(
    mixedCell.querySelector(".piece-pathogen-infection.pathogen-bacteria")
      ?.textContent,
    "🦠",
  );
  assert.equal(
    mixedCell.querySelector(".pathogen-overlay .pathogen-fungus")
      ?.textContent,
    "🍄",
  );
  assert.equal(
    mixedCell.querySelector(".pathogen-overlay .pathogen-bacteria"),
    null,
  );
  assert.equal(
    sporeCell.querySelector(".pathogen-spore-mark")?.textContent,
    "◌",
  );
  assert.match(sporeCell.getAttribute("aria-label"), /esporo fúngico/);
  assert.match(virusCell.title, /infectado por Vírus Patógenos/i);
  assert.doesNotMatch(virusCell.textContent, /🤢/);
  assert.match(selected, /Vírus Patógenos · infectado/i);
  assert.match(selected, /desfecho em \d+ rodada\(s\)/);
  assert.match(selected, new RegExp(`mortalidade-base ${virusDisease.mortality}%`));

  s.current = virusHost.owner;
  s.turn = Math.max(2, s.turn);
  virusHost.venom = {
    remaining: 1,
    infectedTurn: s.turn - 1,
    source: "Peçonha",
  };
  render(d, s, { selected: virusHost.id });
  const rerenderedVirusCell = d.querySelector(
    `[data-r="${virusHost.r}"][data-c="${virusHost.c}"]`,
  );
  assert.ok(rerenderedVirusCell.querySelector(".piece-pathogen-infection"));
  assert.equal(
    rerenderedVirusCell.querySelector(".terminal-death-mark")?.textContent,
    "🤢",
  );

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
    /Durante 10 rodadas, todo novo organismo nasce com uma mutação\./,
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
  assert.equal(d.getElementById("toast-test-phase"), null);
  assert.deepEqual(
    [...d.querySelectorAll("[data-discovery-tab]")].map((tab) =>
      tab.childNodes[0].textContent.trim(),
    ),
    ["Geologia", "Ecologia", "Biologia"],
  );
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

test("discoveries use a three-column square-card grid and replace the list with detail", () => {
  const dom = setup(),
    d = dom.window.document,
    app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");

  assert.equal(d.getElementById("discovery-list").parentElement.id, "discovery-content");
  assert.equal(d.getElementById("discovery-detail").parentElement.id, "discovery-content");
  assert.match(css, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /aspect-ratio:\s*1/);
  assert.match(css, /-webkit-line-clamp:\s*2/);
  assert.match(css, /max-height:\s*2\.4em/);
  assert.match(css, /\.discovery-item-icon/);
  assert.match(app, /icon\.className = "discovery-item-icon"/);
  assert.match(app, /title\.textContent = entry\.label \?\? entry\.title/);
  assert.match(app, /\$\("discovery-list"\)\.hidden = true/);
  assert.match(app, /\$\("discoveries-dialog"\)\.scrollTop = 0/);
  dom.window.close();
});

test("single-player defeat offers a retry of the same cycle", () => {
  const dom = setup(),
    s = createState(17),
    d = dom.window.document,
    retry = d.getElementById("game-over-retry");

  assert.equal(retry.textContent, "Tentar outra vez");
  s.result = { winner: "amber", reason: "As Brancas foram superadas." };
  render(d, s, { mode: "single" });
  assert.equal(retry.hidden, false);

  render(d, s, { mode: "multi" });
  assert.equal(retry.hidden, true);

  s.result = { winner: "blue", reason: "As Pretas foram superadas." };
  render(d, s, { mode: "single" });
  assert.equal(retry.hidden, true);
  dom.window.close();
});

test("Hadean common ancestor is a gray King that splits after the second click", () => {
  const dom = setup(),
    s = createCampaignState(301);

  render(dom.window.document, s);
  const d = dom.window.document;
  let origin = d.querySelector(".origin-piece")?.parentElement,
    legend = d.getElementById("board-legend");

  assert.ok(origin);
  assert.ok(!origin.classList.contains("vivification-target"));
  assert.doesNotMatch(origin.title ?? "", /Vivificar disponível/);
  assert.doesNotMatch(legend.textContent, /Vivificar/);
  assert.match(d.getElementById("turn").textContent, /Rei ancestral cinza/);
  assert.equal(d.querySelectorAll(".cell.fertile").length, 3);
  assert.ok(origin.classList.contains("fertile"));

  s.origin.selected = true;
  render(d, s);
  origin = d.querySelector(".origin-piece")?.parentElement;
  legend = d.getElementById("board-legend");

  assert.ok(origin.classList.contains("vivification-target"));
  assert.match(origin.title ?? "", /Vivificar disponível/);
  assert.match(d.getElementById("selected").textContent, /Último Ancestral Comum Universal/);
  assert.match(d.getElementById("selected").textContent, /Vantagens Evolutivas/);
  assert.match(d.getElementById("selected").textContent, /Respiração anaeróbia/);
  assert.match(
    d.getElementById("selected").textContent,
    /Clique em .*para realizar a primeira reprodução/,
  );
  assert.ok(
    d.querySelector(
      "#selected .selected-ancestral .legend-action-ring.vivify.inline-action-ring",
    ),
  );
  assert.equal(
    d.querySelectorAll("#board .piece.origin-piece").length,
    1,
  );
  assert.match(legend.textContent, /Vivificar/);
  assert.equal(d.querySelectorAll(".cell.lethal-hazard").length, 48);
  const css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    ringRule =
      css.match(/\.cell\.vivification-target::after,[\s\S]*?\{([^}]*)\}/)?.[1] ??
      "";
  assert.match(ringRule, /content:\s*""/);
  assert.match(ringRule, /position:\s*absolute/);
  assert.match(ringRule, /border:\s*4px solid #5bd66c/);
  dom.window.close();
});

test("Hadean founder vivification appears only after selecting the current player's King", () => {
  const dom = setup();
  let s = createCampaignState(303);
  s = transition(s, { type: "ORIGIN_CLICK" });
  s = transition(s, { type: "ORIGIN_CLICK" });
  const blue = s.pieces.find((piece) => piece.owner === "blue"),
    amber = s.pieces.find((piece) => piece.owner === "amber"),
    d = dom.window.document;

  render(d, s);
  let blueCell = d.querySelector(
      `[data-r="${blue.r}"][data-c="${blue.c}"]`,
    ),
    amberCell = d.querySelector(
      `[data-r="${amber.r}"][data-c="${amber.c}"]`,
    );
  assert.ok(!blueCell.classList.contains("vivification-target"));
  assert.ok(!amberCell.classList.contains("vivification-target"));

  render(d, s, { selected: blue.id });
  blueCell = d.querySelector(
    `[data-r="${blue.r}"][data-c="${blue.c}"]`,
  );
  amberCell = d.querySelector(
    `[data-r="${amber.r}"][data-c="${amber.c}"]`,
  );
  assert.ok(blueCell.classList.contains("vivification-target"));
  assert.ok(!amberCell.classList.contains("vivification-target"));

  s.current = "amber";
  render(d, s, { selected: amber.id });
  blueCell = d.querySelector(
    `[data-r="${blue.r}"][data-c="${blue.c}"]`,
  );
  amberCell = d.querySelector(
    `[data-r="${amber.r}"][data-c="${amber.c}"]`,
  );
  assert.ok(!blueCell.classList.contains("vivification-target"));
  assert.ok(amberCell.classList.contains("vivification-target"));
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

test("passive Hadean chemosynthesis stays opaque during untimed conversion", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 3,
        c: 3,
        traits: ["Respiração anaeróbia", "Quimiossíntese"],
      },
      { owner: "amber", r: 7, c: 7, traits: ["Respiração anaeróbia"] },
    ]),
    piece = s.pieces[0];
  s.geologicalStage = "hadean";
  s.board.fill("neutral");
  s.board[piece.r * 8 + piece.c] = "hostile";
  s.hadeanEnvironment = {
    hostileDeathExplained: false,
    fertileExplained: false,
    pendingFertility: [
      {
        pieceId: piece.id,
        cell: piece.r * 8 + piece.c,
        dueTurn: s.turn + 1,
      },
    ],
  };

  render(dom.window.document, s, { selected: piece.id });
  const cell = dom.window.document.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    boardPiece = cell.querySelector(".piece"),
    energyCore = cell.querySelector(".piece-energy-core");

  assert.match(cell.title, /Sem ação legal disponível/);
  assert.equal(boardPiece.classList.contains("waiting"), false);
  assert.equal(energyCore.classList.contains("waiting"), false);
  dom.window.close();
});

test("mobile summary uses a bare hourglass for untimed waiting", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Fotossíntese"] },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    opponent = s.pieces[1];

  render(dom.window.document, s, { selected: opponent.id });
  const summary = dom.window.document.getElementById("mobile-selected-summary");

  assert.match(summary.textContent, /⏳/);
  assert.doesNotMatch(summary.textContent, /Nenhuma ação disponível|Sem ação legal disponível/);
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
    "Arqueano · Eoarqueana · 1º Ciclo · 22 Turnos · 14ª Geração",
  );
  assert.equal(d.getElementById("pass").disabled, true);
  dom.window.close();
});

test("renders one board occupant per piece and loads Toastify before the app", () => {
  const dom = setup(),
    s = createState(2);
  render(dom.window.document, s);
  const d = dom.window.document;
  assert.equal(d.querySelectorAll(".cell").length, 64);
  assert.equal(d.querySelectorAll(".piece").length, s.pieces.length);
  assert.deepEqual(
    [...d.querySelectorAll("script")].map((script) =>
      script.getAttribute("src"),
    ),
    ["toastify-1.12.0.js", "src/app.js"],
  );
  assert.deepEqual(
    [...d.querySelectorAll("link[rel=stylesheet]")].map((link) =>
      link.getAttribute("href"),
    ),
    ["toastify-1.12.0.css", "app.css"],
  );
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
  s.deathSites = [{ cell: 3, dueRound: 3, base: "neutral", kind: "fecal" }];
  s.carcasses = [{ cell: 4, dueRound: 3, base: "neutral" }];

  render(dom.window.document, s);
  const legend = dom.window.document.getElementById("board-legend"),
    labels = [...legend.querySelectorAll(".legend-item")].map(
      (item) => item.textContent,
    );

  assert.deepEqual(labels, [
    "🟩Casa fértil",
    "🟥Casa hostil",
    "🟫Barreira",
    "💩Fezes",
    "🦴Carcaça",
  ]);
  assert.equal(legend.querySelector(".legend-action-ring"), null);

  s.board[0] = "neutral";
  s.board[1] = "neutral";
  s.barriers = [];
  s.deathSites = [];
  s.carcasses = [];
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

test("contextual mutations form an evenly spaced frame while the energy branch stays central", () => {
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
    "Dormência",
    "Carapaça",
    "Veneno",
  ];
  s.board[piece.r * 8 + piece.c] = "hostile";
  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    frame = cell.querySelector(".trait-frame"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    badges = [...frame.querySelectorAll(".trait-badge")];
  assert.ok(frame);
  assert.deepEqual(badges.map((badge) => badge.dataset.trait), ["Dormência"]);
  assert.deepEqual(
    badges.map((icon) =>
      [...icon.classList].find((name) => name.startsWith("trait-slot-")),
    ),
    ["trait-slot-0"],
  );
  assert.equal(frame.querySelector(".trait-overflow"), null);
  assert.ok(!badges.some((badge) => badge.dataset.trait === "Predação"));
  assert.ok(!badges.some((badge) => badge.dataset.trait === "Carapaça"));
  assert.ok(!badges.some((badge) => badge.dataset.trait === "Veneno"));

  const core = cell.querySelector(".piece-energy-core");
  assert.equal(core?.dataset.trait, "Predação");
  assert.equal(core?.textContent, "👾");
  assert.ok(core?.classList.contains("blue"));
  assert.match(
    css,
    /\.piece-energy-core\.blue\s*\{[\s\S]*background:\s*#fff8df/,
  );
  assert.match(
    css,
    /\.piece-energy-core\.amber\s*\{[\s\S]*background:\s*#242623/,
  );
  assert.match(css, /\.trait-slot-0\s*\{\s*left:\s*50%;\s*top:\s*94%/);
  assert.match(
    css,
    /\.piece-energy-core\s*\{[\s\S]*left:\s*50%;[\s\S]*top:\s*50%;[\s\S]*transform:\s*translate\(-50%, -50%\)/,
  );

  s.board[piece.r * 8 + piece.c] = "neutral";
  render(dom.window.document, s, { selected: piece.id });
  const refreshed = d.querySelector(
    `[data-r="${piece.r}"][data-c="${piece.c}"]`,
  );
  assert.equal(
    [...refreshed.querySelectorAll(".trait-badge")].some(
      (badge) => badge.dataset.trait === "Dormência",
    ),
    false,
  );
  assert.equal(
    refreshed.querySelector(".piece-energy-core")?.dataset.trait,
    "Predação",
  );
  dom.window.close();
});

test("causal frame suppresses Voo when Escalador already explains the same barrier traversal", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 5,
        traits: ["Escalador", "Voo"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0];
  s.naturalBarriers.push(4 * 8 + 4);

  const contextual = contextualTraitsForBoard(s).get(piece.id);
  assert.ok(contextual.has("Escalador"));
  assert.equal(contextual.has("Voo"), false);
});

test("causal frame keeps Locomoção Terrestre and Voo when they explain different parts of the same route", () => {
  const s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 2,
        rank: 5,
        traits: ["Voo"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0];
  s.board[4 * 8 + 3] = "hostile";

  const contextual = contextualTraitsForBoard(s).get(piece.id);
  assert.ok(contextual.has("Locomoção Terrestre"));
  assert.ok(contextual.has("Voo"));
});

test("non-contextual phenotype inventory stays in the selected panel instead of the board frame", () => {
  const dom = setup(),
    s = createState(201),
    piece = s.pieces[0];
  piece.traits = [
    "Respiração anaeróbia",
    "Reparo Celular",
    "Multicelularismo",
    "Predação",
    "Simetria Bilateral",
    "Vertebrado",
    "Resistência",
  ];
  s.current = "amber";

  render(dom.window.document, s, { selected: piece.id });
  const cell = dom.window.document.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    frameTraits = [...cell.querySelectorAll(".trait-badge")].map(
      (badge) => badge.dataset.trait,
    ),
    selected = dom.window.document.getElementById("selected");
  assert.deepEqual(frameTraits, []);
  assert.match(selected.textContent, /Simetria Bilateral/);
  assert.match(selected.textContent, /Vertebrado/);
  assert.match(selected.textContent, /Resistência/);
  assert.equal(
    cell.querySelector(".piece-energy-core")?.dataset.trait,
    "Predação",
  );
  assert.ok(!cell.classList.contains("trait-dense"));
  dom.window.close();
});

test("Quimiossíntese occupies the central energy core and moves to genetic legacy under a modern branch", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Quimiossíntese"],
      },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0];

  piece.ancestry = ["Respiração anaeróbia", "Quimiossíntese"];
  render(dom.window.document, s, { selected: piece.id });
  let d = dom.window.document,
    cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    );
  assert.equal(
    cell.querySelector(".piece-energy-core")?.dataset.trait,
    "Quimiossíntese",
  );
  assert.equal(cell.querySelector(".piece-energy-core")?.textContent, "♨️");
  assert.equal(
    [...cell.querySelectorAll(".trait-badge")].some(
      (badge) => badge.dataset.trait === "Quimiossíntese",
    ),
    false,
  );

  piece.traits = ["Respiração anaeróbia", "Fotossíntese"];
  piece.ancestry = [
    "Respiração anaeróbia",
    "Quimiossíntese",
    "Fotossíntese",
  ];
  render(dom.window.document, s, { selected: piece.id });
  d = dom.window.document;
  cell = d.querySelector(
    `[data-r="${piece.r}"][data-c="${piece.c}"]`,
  );
  assert.equal(
    cell.querySelector(".piece-energy-core")?.dataset.trait,
    "Fotossíntese",
  );
  const legacy = d.querySelector("#selected .legacy-toggle");
  assert.ok(legacy);
  assert.match(legacy.textContent, /Quimiossíntese/);
  dom.window.close();
});

test("recessive gene UI stays absent before the Reprodução Sexuada milestone", () => {
  const dom = setup(),
    s = createState(2201),
    piece = s.pieces[0];
  s.historicalTraits = (s.historicalTraits ?? []).filter(
    (trait) => trait !== "Reprodução Sexuada",
  );
  piece.ancestry = ["Respiração anaeróbia", "Camuflagem"];
  piece.genome = genomeFromTraits(
    ["Respiração anaeróbia"],
    ["Camuflagem"],
  );
  syncGenomePhenotype(piece);

  render(dom.window.document, s, { selected: piece.id });
  assert.equal(
    dom.window.document.querySelector("#selected .recessive-toggle"),
    null,
  );
  dom.window.close();
});

test("energy branch stays central while Mixotrofia follows contextual activity", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Mixotrofia"],
      },
      {
        owner: "amber",
        r: 0,
        c: 0,
        traits: ["Fotossíntese", "Mixotrofia"],
      },
    ]),
    predator = s.pieces[0],
    plant = s.pieces[1];

  render(dom.window.document, s, { selected: predator.id });
  let cell = dom.window.document.querySelector(
      `[data-r="${predator.r}"][data-c="${predator.c}"]`,
    ),
    frameTraits = [...cell.querySelectorAll(".trait-badge")].map(
      (badge) => badge.dataset.trait,
    );
  assert.equal(
    cell.querySelector(".piece-energy-core")?.dataset.trait,
    "Predação",
  );
  assert.ok(frameTraits.includes("Mixotrofia"));
  assert.ok(!frameTraits.includes("Predação"));

  render(dom.window.document, s, { selected: plant.id });
  cell = dom.window.document.querySelector(
    `[data-r="${plant.r}"][data-c="${plant.c}"]`,
  );
  frameTraits = [...cell.querySelectorAll(".trait-badge")].map(
    (badge) => badge.dataset.trait,
  );
  assert.equal(
    cell.querySelector(".piece-energy-core")?.dataset.trait,
    "Fotossíntese",
  );
  assert.ok(cell.querySelector(".piece-energy-core")?.classList.contains("amber"));
  assert.ok(!frameTraits.includes("Mixotrofia"));
  assert.ok(!frameTraits.includes("Fotossíntese"));
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
  assert.equal(
    [...cell.querySelectorAll(".trait-badge")].some(
      (badge) => badge.dataset.trait === "Carapaça",
    ),
    false,
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
  assert.ok(!frameTraits.includes("Simetria Bilateral"));
  assert.ok(!frameTraits.includes("Predação"));
  assert.equal(
    animalCell.querySelector(".piece-energy-core")?.dataset.trait,
    "Predação",
  );

  render(dom.window.document, s, { selected: plant.id });
  const plantSelected = dom.window.document.getElementById("selected"),
    plantCell = dom.window.document.querySelector(
      `[data-r="${plant.r}"][data-c="${plant.c}"]`,
    ),
    plantFrameTraits = [...plantCell.querySelectorAll(".trait-badge")].map(
      (badge) => badge.dataset.trait,
    );
  assert.match(plantSelected.textContent, /Fotossíntese/);
  assert.match(plantSelected.textContent, /Embriófitas/);
  assert.ok(!plantFrameTraits.includes("Fotossíntese"));
  assert.equal(
    plantCell.querySelector(".piece-energy-core")?.dataset.trait,
    "Fotossíntese",
  );
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
  assert.equal(
    dom.window.document.querySelector(".trait-badge.somatic-badge"),
    null,
  );
  dom.window.close();
});

test("active somatic effects remain visually distinct in the contextual frame", () => {
  const dom = setup(),
    s = createState(202),
    piece = s.pieces[0];
  piece.traits = ["Respiração anaeróbia", "Multicelularismo"];
  piece.somaticMutations = ["Mutação Disfuncional"];
  piece.lastMoveRound = 1;

  render(dom.window.document, s);
  const cell = dom.window.document.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    somatic = cell.querySelector(".trait-badge.somatic-badge");
  assert.ok(somatic);
  assert.equal(somatic.dataset.trait, "Mutação Disfuncional");
  assert.equal(somatic.textContent, "❌");
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
test("selected legend shows hidden recessive genes after sexual reproduction without duplication", () => {
  const dom = setup(),
    s = createState(220),
    piece = s.pieces[0];
  s.historicalTraits = [
    ...new Set([...(s.historicalTraits ?? []), "Reprodução Sexuada"]),
  ];
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
  piece.traits = ["Multicelularismo", "Predação", "Onívoro", "Locomoção Terrestre"];
  piece.ancestry = [
    "Multicelularismo",
    "Predação",
    "Carnívoro",
    "Onívoro",
    "Locomoção Primitiva",
    "Locomoção Terrestre",
  ];

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    selected = d.getElementById("selected"),
    toggle = selected.querySelector(".legacy-toggle"),
    summary = toggle.querySelector("summary");

  assert.match(selected.textContent, /Vantagens Evolutivas/);
  assert.match(selected.textContent, /Onívoro/);
  assert.match(selected.textContent, /Locomoção Terrestre/);
  assert.ok(toggle);
  assert.equal(toggle.open, false);
  assert.match(summary.textContent, /Legado Genético \(2\)/);
  assert.match(toggle.textContent, /Carnívoro/);
  assert.match(toggle.textContent, /Locomoção/);
  assert.doesNotMatch(
    toggle.querySelector(".ancestry-list").textContent,
    /Onívoro|Locomoção Terrestre/,
  );

  const cell = d.querySelector(
    `[data-r="${piece.r}"][data-c="${piece.c}"]`,
  );
  const boardIcons = cell.querySelector(".trait-frame").textContent;
  assert.doesNotMatch(boardIcons, /🐻|🦁/);
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
  assert.match(predation.textContent, /Se alimenta ao capturar organismos/);
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
    /Gera alimento em 3–6 rodadas/,
  );
  assert.ok(embryophytes?.classList.contains("actionable-trait"));
  dom.window.close();
});

test("Brotamento becomes actionable only when an explicit resource is available", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: ["Brotamento", "Herbívoro"],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];
  piece.stationarySinceRound = round(s);

  render(dom.window.document, s, { selected: piece.id });
  let selected = dom.window.document.getElementById("selected"),
    budding = [...selected.querySelectorAll(".selected-trait")].find(
      (row) => row.textContent.includes("Brotamento"),
    );
  assert.ok(!budding?.classList.contains("actionable-trait"));

  s.board[piece.r * 8 + piece.c] = "fertile";
  render(dom.window.document, s, { selected: piece.id });
  selected = dom.window.document.getElementById("selected");
  budding = [...selected.querySelectorAll(".selected-trait")].find(
    (row) => row.textContent.includes("Brotamento"),
  );
  assert.ok(budding?.classList.contains("actionable-trait"));
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

test("feces and carcasses use distinct Vivificar routes", () => {
  let dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Mixotrofia"] },
      { owner: "amber", r: 0, c: 0 },
    ]),
    piece = s.pieces[0];
  s.deathSites.push({
    cell: 36,
    dueRound: 3,
    base: "neutral",
    kind: "fecal",
  });
  s.captureDisturbances.push({
    cell: 36,
    dueRound: 3,
    base: "neutral",
    sourceId: null,
  });

  render(dom.window.document, s, { selected: piece.id });
  let target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
  assert.ok(target.classList.contains("vivification-target"));
  assert.ok(target.classList.contains("organic-residue"));
  assert.ok(target.classList.contains("capture-disturbance"));
  assert.match(target.title, /reciclar fezes/);
  assert.match(target.textContent, /💩/);
  const css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.cell\.organic-residue,[\s\S]*background:\s*#b86155/,
  );
  assert.match(
    css,
    /\.cell\.organic-residue\.dark,[\s\S]*background:\s*#87443d/,
  );
  dom.window.close();

  dom = setup();
  s = fixture([
    { owner: "blue", r: 4, c: 3, rank: 3, traits: ["Necrófago"] },
    { owner: "amber", r: 0, c: 0 },
  ]);
  piece = s.pieces[0];
  s.carcasses.push({ cell: 36, dueRound: 3, base: "neutral" });
  s.captureDisturbances.push({
    cell: 36,
    dueRound: 3,
    base: "neutral",
    sourceId: null,
  });
  render(dom.window.document, s, { selected: piece.id });
  target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
  assert.ok(target.classList.contains("vivification-target"));
  assert.match(target.title, /Necrofagia/);
  assert.match(target.textContent, /🦴/);
  dom.window.close();

  dom = setup();
  s = fixture([
    {
      owner: "blue",
      r: 4,
      c: 3,
      rank: 3,
      traits: ["Multicelularismo", "Locomoção Terrestre", "Coprofagia"],
    },
    { owner: "amber", r: 0, c: 0 },
  ]);
  piece = s.pieces[0];
  s.deathSites.push({
    cell: 36,
    dueRound: 3,
    base: "neutral",
    kind: "fecal",
  });
  render(dom.window.document, s, { selected: piece.id });
  target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
  assert.ok(target.classList.contains("vivification-target"));
  assert.match(target.title, /Coprofagia/);
  assert.match(target.textContent, /💩/);
  dom.window.close();
});

test("lethal hazards render a skull and distinct legend entry", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 6, c: 3 },
      { owner: "amber", r: 1, c: 4 },
    ]);
  s.event = {
    ...EVENTS.find((event) => event.id === "meteor"),
    startRound: 0,
    startTurn: 0,
    hazards: [27],
    lethalHazards: [27],
    snapshots: { 27: "neutral" },
  };
  s.board[27] = "hostile";
  render(dom.window.document, s);
  const cell = dom.window.document.querySelector('[data-r="3"][data-c="3"]'),
    legend = dom.window.document.getElementById("board-legend"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
  assert.ok(cell.classList.contains("lethal-hazard"));
  assert.match(cell.textContent, /☠️/);
  assert.match(legend.textContent, /☠️Letal/);
  assert.match(
    css,
    /\.cell\.lethal-hazard \{\s*background:\s*#8f332f/,
  );
  assert.match(
    css,
    /\.cell\.lethal-hazard\.dark \{\s*background:\s*#61211f/,
  );
  assert.doesNotMatch(
    css,
    /\.cell\.lethal-hazard[\s\S]{0,160}box-shadow:/,
  );
  dom.window.close();
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
  piece.rank = 4;
  piece.r = 4;
  piece.c = 4;
  enemy.r = 3;
  enemy.c = 4;
  s.pieces = [piece, enemy];
  s.board.fill("fertile");

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
  assert.match(legend.textContent, /Captura \+ Reprodução/);
  assert.equal(d.querySelector(".board-footer > #pass")?.id, "pass");
  dom.window.close();
});

test("predatory reproduction uses concentric red and green capture rings", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4 },
      { owner: "amber", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    predator = s.pieces[0],
    prey = s.pieces[1],
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8");

  render(dom.window.document, s, { selected: predator.id });
  let target = dom.window.document.querySelector(
    `[data-r="${prey.r}"][data-c="${prey.c}"]`,
  );
  assert.ok(target.classList.contains("attack-target"));
  assert.ok(target.classList.contains("capture-reproduction-target"));
  assert.match(target.title, /ataque com reprodução predatória/);
  assert.ok(
    dom.window.document.querySelector(
      ".legend-action-ring.capture-reproduction",
    ),
  );
  assert.match(
    css,
    /\.cell\.legal\.attack-target::after[\s\S]*width:\s*84%[\s\S]*border:\s*4px solid #d54242/,
  );
  assert.match(
    css,
    /\.cell\.legal\.capture-reproduction-target::before[\s\S]*width:\s*70%[\s\S]*border:\s*4px solid #5bd66c/,
  );

  predator.nextReproductionRound = round(s) + 2;
  render(dom.window.document, s, { selected: predator.id });
  target = dom.window.document.querySelector(
    `[data-r="${prey.r}"][data-c="${prey.c}"]`,
  );
  assert.ok(target.classList.contains("attack-target"));
  assert.ok(!target.classList.contains("capture-reproduction-target"));
  assert.match(target.title, /alvo de ataque/);
  dom.window.close();
});

test("Canibalismo usa ataque simples enquanto ovos mantêm marcador reprodutivo", () => {
  let dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Canibalismo"] },
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = s.pieces[0],
    ally = s.pieces[1];

  render(dom.window.document, s, { selected: actor.id });
  let target = dom.window.document.querySelector(
    `[data-r="${ally.r}"][data-c="${ally.c}"]`,
  );
  assert.ok(target.classList.contains("attack-target"));
  assert.ok(!target.classList.contains("capture-reproduction-target"));
  assert.match(target.title, /Canibalismo/);
  dom.window.close();

  for (const trait of ["Ovífagia", "Onívoro Oportunista"]) {
    dom = setup();
    s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4, traits: [trait] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]);
    actor = s.pieces[0];
    s.eggs.push({
      id: 900,
      owner: "amber",
      parentId: 999,
      r: 4,
      c: 4,
      laidRound: 0,
      hatchRound: round(s) + 2,
      expireRound: round(s) + 5,
      mode: "basal",
      brood: [{}],
      dispersal: "local",
    });

    render(dom.window.document, s, { selected: actor.id });
    target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
    assert.ok(target.classList.contains("attack-target"), trait);
    assert.ok(target.classList.contains("capture-reproduction-target"), trait);
    assert.match(
      target.title,
      trait === "Ovífagia"
        ? /Ovífagia com reprodução/
        : /Onívoro Oportunista com reprodução/,
    );

    actor.nextReproductionRound = round(s) + 2;
    render(dom.window.document, s, { selected: actor.id });
    target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
    assert.ok(target.classList.contains("attack-target"), trait);
    assert.ok(!target.classList.contains("capture-reproduction-target"), trait);
    dom.window.close();
  }
});

test("Necrófago, Onívoro Oportunista and Coprofagia use a single green reproduction ring on resources", () => {
  for (const trait of ["Necrófago", "Onívoro Oportunista"]) {
    const dom = setup(),
      s = fixture([
        { owner: "blue", r: 4, c: 3, rank: 4, traits: [trait] },
        { owner: "amber", r: 0, c: 0, rank: 4 },
      ]),
      actor = s.pieces[0];
    s.carcasses.push({ cell: 36, dueRound: round(s) + 3, base: "neutral" });
    s.captureDisturbances.push({
      cell: 36,
      dueRound: round(s) + 3,
      base: "neutral",
      sourceId: null,
    });

    render(dom.window.document, s, { selected: actor.id });
    const target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
    assert.ok(target.classList.contains("vivification-target"), trait);
    assert.ok(!target.classList.contains("attack-target"), trait);
    assert.ok(!target.classList.contains("capture-reproduction-target"), trait);
    assert.match(
      target.title,
      trait === "Necrófago" ? /Necrofagia/ : /Onívoro Oportunista/,
    );
    dom.window.close();
  }

  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4, traits: ["Coprofagia"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    actor = s.pieces[0];
  s.deathSites.push({
    cell: 36,
    dueRound: round(s) + 3,
    base: "neutral",
    kind: "fecal",
  });
  render(dom.window.document, s, { selected: actor.id });
  const target = dom.window.document.querySelector('[data-r="4"][data-c="4"]');
  assert.ok(target.classList.contains("vivification-target"));
  assert.ok(!target.classList.contains("attack-target"));
  assert.ok(!target.classList.contains("capture-reproduction-target"));
  assert.match(target.title, /Coprofagia/);
  dom.window.close();
});

test("Parasitismo sem alvo adjacente deixa de expor Vivificar", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, traits: ["Parasitismo"] },
      { owner: "amber", r: 0, c: 0, traits: ["Fotossíntese"] },
    ]),
    piece = s.pieces[0];

  render(dom.window.document, s, { selected: piece.id });
  const cell = dom.window.document.querySelector(
    `[data-r="${piece.r}"][data-c="${piece.c}"]`,
  );

  assert.ok(!cell.classList.contains("vivification-target"));
  assert.doesNotMatch(cell.title, /vivificação disponível: Parasitismo/);
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
        traits: ["Reprodução Sexuada", "Herbívoro"],
      },
      {
        owner: "blue",
        r: 4,
        c: 5,
        traits: ["Reprodução Sexuada", "Herbívoro"],
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
  assert.match(legend.textContent, /Captura \+ Reprodução/);
  assert.ok(legend.querySelector(".legend-action-ring.vivify"));
  assert.ok(
    legend.querySelector(".legend-action-ring.capture-reproduction"),
  );
  assert.match(
    css,
    /\.legend-action-ring\.vivify[\s\S]*color:\s*#5bd66c/,
  );
  assert.match(
    css,
    /\.legend-action-ring\.capture-reproduction[\s\S]*color:\s*#d54242/,
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
  assert.equal(piece.parentElement.querySelector(".terminal-death-mark"), null);
  assert.match(rule, /font-style:\s*italic/);
  assert.doesNotMatch(rule, /transform|opacity|font-size/);
  dom.window.close();
});

test("imminent deterministic deaths render a centered top 🤢 marker", () => {
  const dom = setup(),
    s = createState(44),
    doomed = s.pieces[0],
    protectedPiece = s.pieces[1];

  s.turn = 1;
  s.current = "amber";
  doomed.traits = [...new Set([...doomed.traits, "Mutação Letal"])];
  doomed.deleteriousDue = 1;
  protectedPiece.traits = [
    ...new Set([
      ...protectedPiece.traits,
      "Mutação Letal",
    ]),
  ];
  protectedPiece.deleteriousDue = 1;

  assert.equal(
    deterministicDeathNextTurn(s, doomed),
    "Mutação Letal",
  );
  assert.equal(deterministicDeathNextTurn(s, protectedPiece), "Mutação Letal");

  render(dom.window.document, s);
  const doomedCell = dom.window.document.querySelector(
      `[data-r="${doomed.r}"][data-c="${doomed.c}"]`,
    ),
    protectedCell = dom.window.document.querySelector(
      `[data-r="${protectedPiece.r}"][data-c="${protectedPiece.c}"]`,
    ),
    marker = doomedCell.querySelector(".terminal-death-mark"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    deathRule =
      css.match(/\.terminal-death-mark\s*\{([^}]*)\}/)?.[1] ?? "",
    pathogenRule =
      css.match(/\.pathogen-overlay\s*\{([^}]*)\}/)?.[1] ?? "",
    deathZ = Number(deathRule.match(/z-index:\s*(\d+)/)?.[1] ?? 0),
    pathogenZ = Number(
      pathogenRule.match(/z-index:\s*(\d+)/)?.[1] ?? 0,
    );

  assert.equal(marker?.textContent, "🤢");
  assert.equal(marker?.getAttribute("aria-hidden"), "true");
  assert.match(
    doomedCell.getAttribute("aria-label"),
    /morte determinada no próximo turno: Mutação Letal/,
  );
  assert.equal(protectedCell.querySelector(".terminal-death-mark")?.textContent, "🤢");
  assert.match(deathRule, /top:\s*1%/);
  assert.match(deathRule, /left:\s*50%/);
  assert.match(deathRule, /translateX\(-50%\)/);
  assert.ok(deathZ > pathogenZ);
  dom.window.close();
});

test("one-turn hostile death shows the 🤢 terminal marker", () => {
  const dom = setup(),
    s = createState(441, {
      geologicalStage: "hadean",
      naturalBarriers: false,
    }),
    doomed = s.pieces[0];
  doomed.lethalDeathRound = round(s) + 1;
  doomed.lethalDeathReason = "casa hostil hadeana";
  doomed.hadeanHostileDeathPending = true;
  s.board[doomed.r * 8 + doomed.c] = "hostile";

  assert.equal(
    deterministicDeathNextTurn(s, doomed),
    "ambiente hostil",
  );

  render(dom.window.document, s, { selected: doomed.id });
  const cell = dom.window.document.querySelector(
      `[data-r="${doomed.r}"][data-c="${doomed.c}"]`,
    ),
    marker = cell.querySelector(".terminal-death-mark");

  assert.equal(marker?.textContent, "🤢");
  assert.match(cell.title, /Morte por ambiente hostil/);
  assert.match(cell.title, /morte determinada no próximo turno: ambiente hostil/);
  assert.match(
    dom.window.document.getElementById("selected").textContent,
    /⏳ 1 t morte por ambiente hostil/i,
  );
  dom.window.close();
});

test("death prediction covers natural maximum age, deferred Semelparidade and terminal Veneno", () => {
  const natural = createState(45),
    elder = natural.pieces[0];
  elder.traits = [
    "Multicelularismo",
    "Locomoção Primitiva",
    "Predação",
  ];
  elder.bornRound = 0;
  natural.turn = 47;
  natural.current = "amber";
  assert.equal(deterministicDeathNextTurn(natural, elder), "morte natural");

  const semelparous = createState(46),
    parent = semelparous.pieces[0];
  semelparous.turn = 1;
  semelparous.current = "amber";
  parent.semelparityDeathPending = true;
  parent.pregnancies = [
    {
      kind: "viviparous",
      dueRound: 1,
      brood: [{}],
      dispersal: "local",
    },
  ];
  assert.equal(
    deterministicDeathNextTurn(semelparous, parent),
    "Semelparidade",
  );

  const poisoned = createState(47),
    victim = poisoned.pieces.find((piece) => piece.owner === "blue");
  poisoned.turn = 2;
  poisoned.current = "blue";
  victim.venom = { remaining: 1, infectedTurn: 1 };
  assert.equal(deterministicDeathNextTurn(poisoned, victim), "Veneno");

});

test("pieces with no available action fade on board without a duplicate wait badge", () => {
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
    mobileSummary = d.getElementById("mobile-selected-summary"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    waitRule = css.match(/\.cell \.piece\.waiting\s*\{([^}]*)\}/)?.[1] ?? "";

  assert.ok(boardPiece.classList.contains("waiting"));
  assert.doesNotMatch(cell.textContent, /⏳/);
  assert.match(cell.title, /aguardando: Metamorfose/);
  assert.equal(selected.querySelector(".selected-wait-badge"), null);
  assert.match(selected.textContent, /⏳ 2 t metamorfose\./);
  assert.match(mobileSummary.textContent, /⏳ 2 t/);
  assert.doesNotMatch(mobileSummary.textContent, /metamorfose/i);
  assert.match(waitRule, /opacity:\s*0\.48/);
  dom.window.close();
});

test("board only counts metabolic recovery while selected details keep cellular counters", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 4,
        c: 4,
        traits: [
          "Respiração aeróbia",
          "Eucarionte",
          "Endossimbiose",
          "Feromônios",
          "Bioluminescência Predatória",
        ],
      },
      { owner: "amber", r: 0, c: 0, traits: ["Respiração anaeróbia"] },
    ]),
    piece = s.pieces[0],
    currentRound = round(s);

  piece.eukaryoteBufferUses = 1;
  piece.nextReproductionRound = currentRound + 2;
  piece.endosymbiosisDebtUntilRound = currentRound + 2;
  piece.pheromoneReadyRound = currentRound + 3;
  piece.bioluminescentLureReadyRound = currentRound + 4;
  piece.parasitoidism = { remaining: 3 };
  piece.venom = { remaining: 2, infectedTurn: s.turn, source: "Peçonha" };

  render(dom.window.document, s, { selected: piece.id });
  const d = dom.window.document,
    cell = d.querySelector(`[data-r="${piece.r}"][data-c="${piece.c}"]`),
    boardStatus = cell.querySelector(".piece-status")?.textContent ?? "",
    selected = d.getElementById("selected").textContent;

  assert.match(boardStatus, /⏳2/);
  assert.match(boardStatus, /👃⏳/);
  assert.match(boardStatus, /🎣⏳/);
  assert.doesNotMatch(boardStatus, /🔋⏳/);
  assert.match(boardStatus, /🌀/);
  assert.match(boardStatus, /🦂/);
  assert.doesNotMatch(boardStatus, /🔘1/);
  assert.doesNotMatch(boardStatus, /👃⏳3/);
  assert.doesNotMatch(boardStatus, /🎣⏳4/);
  assert.doesNotMatch(boardStatus, /🌀3/);
  assert.doesNotMatch(boardStatus, /🦂2/);

  assert.match(selected, /🔘 Eucarionte · 1 amortecimento restante\./);
  assert.match(
    selected,
    /⏳ 2 t recuperação metabólica por Endossimbiose\./,
  );
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
  const selected = dom.window.document.getElementById("selected"),
    mobileSummary = dom.window.document.getElementById("mobile-selected-summary");

  assert.match(selected.textContent, /⏳ 1 t maturidade sexual\./);
  assert.match(selected.textContent, /⏳ 5 t recuperação metabólica\./);
  assert.match(mobileSummary.textContent, /⏳ 5 t/);
  assert.doesNotMatch(
    mobileSummary.textContent,
    /maturidade sexual|recuperação metabólica/i,
  );
  assert.doesNotMatch(selected.textContent, /rodada\(s\) restante/);
  dom.window.close();
});

test("renders eggs and carried brood without numeric counter on the piece", () => {
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
  assert.equal(
    d.querySelector(`[data-r="${parent.r}"][data-c="${parent.c}"] .piece-status`)
      .textContent,
    "🔴",
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
    age: 1,
    movesRemaining: 2,
    sprouting: false,
    sproutReadyRound: null,
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
  assert.match(cell.title, /idade 1 de 3/);
  dom.window.close();
});

test("Construtor de Nicho highlights only orthogonal corner cells as Vivify targets", () => {
  const dom = setup(),
    s = createState(2501),
    p = s.pieces[0];
  p.r = 0;
  p.c = 0;
  p.traits = ["Construtor de Nicho"];
  s.pieces[1].r = 7;
  s.pieces[1].c = 7;

  render(dom.window.document, s, { selected: p.id });
  const d = dom.window.document,
    east = d.querySelector('[data-r="0"][data-c="1"]'),
    south = d.querySelector('[data-r="1"][data-c="0"]'),
    diagonal = d.querySelector('[data-r="1"][data-c="1"]');
  assert.ok(east.classList.contains("vivification-target"));
  assert.ok(south.classList.contains("vivification-target"));
  assert.equal(diagonal.classList.contains("vivification-target"), false);
  assert.match(east.title, /Construtor de Nicho/);
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
  assert.match(d.getElementById("selected").textContent, /🧱/);
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
  assert.equal(selected.querySelector(".selected-wait-badge"), null);
  assert.match(selected.textContent, /⏳ mutação disfuncional\./);
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

test("Neurodivergência legend distinguishes Hiperfoco and Sobrecarga", () => {
  const dom = setup(),
    s = createState(2404),
    p = s.pieces[0];
  p.traits = ["Neurodivergência"];
  p.ancestry = ["Respiração anaeróbia", "Neurodivergência"];
  s.neurofocus = p.id;

  render(dom.window.document, s, { selected: p.id });
  let legend = dom.window.document.getElementById("board-legend").textContent;
  assert.match(legend, /Hiperfoco · 2ª ação/);
  assert.match(dom.window.document.getElementById("turn").textContent, /Hiperfoco/);

  s.neurofocus = null;
  p.neurodivergenceRestThroughRound = 2;
  render(dom.window.document, s, { selected: p.id });
  legend = dom.window.document.getElementById("board-legend").textContent;
  assert.match(legend, /Sobrecarga · sem ação/);
  assert.match(
    dom.window.document.getElementById("selected").textContent,
    /Sobrecarga|sobrecarga/,
  );
  dom.window.close();
});

test("Hierarquia highlights a recommended social sacrifice without choosing it", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 0, traits: ["Sociabilidade", "Hierarquia"] },
      { owner: "blue", r: 4, c: 5, rank: 5, traits: ["Sociabilidade"] },
      { owner: "blue", r: 5, c: 4, rank: 3, traits: ["Sociabilidade"] },
      { owner: "blue", r: 5, c: 5, rank: 1, traits: ["Sociabilidade"] },
      { owner: "amber", r: 0, c: 0, rank: 4 },
    ]),
    unavailable = s.pieces[1];
  unavailable.nextReproductionRound = round(s) + 4;
  s.phase = "social-defense";
  s.current = "blue";
  s.socialDefense = {
    attackerId: s.pieces[4].id,
    victimId: s.pieces[0].id,
    attackerOwner: "amber",
    memberIds: s.pieces.slice(0, 4).map((piece) => piece.id),
  };

  render(dom.window.document, s);
  const cell = dom.window.document.querySelector(
    `[data-r="${unavailable.r}"][data-c="${unavailable.c}"]`,
  );
  assert.ok(cell.classList.contains("hierarchy-recommended-sacrifice"));
  assert.match(cell.title, /Hierarquia/);
  assert.match(
    dom.window.document.getElementById("board-legend").textContent,
    /Sacrifício recomendado pela Hierarquia/,
  );
  dom.window.close();
});

test("Superorganismo pulses allied members and marks the recommended member and move", () => {
  const dom = setup(),
    s = fixture([
      {
        owner: "blue",
        r: 7,
        c: 7,
        rank: 0,
        traits: ["Artrópode", "Eusocialidade", "Percepção Espacial", "Superorganismo"],
      },
      {
        owner: "blue",
        r: 4,
        c: 3,
        rank: 2,
        traits: ["Artrópode", "Eusocialidade", "Percepção Espacial", "Superorganismo"],
      },
      { owner: "amber", r: 1, c: 6, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 0 },
    ]),
    selected = s.pieces[0],
    recommended = s.pieces[1];

  render(dom.window.document, s, { selected: selected.id });
  const recommendedCell = dom.window.document.querySelector(
    `[data-r="${recommended.r}"][data-c="${recommended.c}"]`,
  );
  assert.ok(recommendedCell.classList.contains("superorganism-member-pulse"));
  assert.ok(recommendedCell.classList.contains("superorganism-best-member"));
  assert.match(
    dom.window.document.getElementById("board-legend").textContent,
    /Membro recomendado pelo Superorganismo/,
  );

  render(dom.window.document, s, { selected: recommended.id });
  const target = dom.window.document.querySelector('[data-r="1"][data-c="6"]');
  assert.ok(target.classList.contains("superorganism-suggested-target"));
  assert.match(target.title, /movimento sugerido pelo Superorganismo/);
  dom.window.close();
});

test("Ataxia exposes a contextual movement-risk legend when alternatives exist", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4, traits: ["Ataxia"] },
      { owner: "amber", r: 0, c: 0, rank: 0 },
    ]);
  render(dom.window.document, s, { selected: s.pieces[0].id });
  assert.match(
    dom.window.document.getElementById("board-legend").textContent,
    /Movimento sujeito a desvio por Ataxia/,
  );
  dom.window.close();
});

test("application UI starts with the Hadean common ancestor, then plays division, saves and resets", async () => {
  const dom = setup(),
    w = dom.window;
  const prior = {
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    Toastify: globalThis.Toastify,
  };
  globalThis.document = w.document;
  globalThis.localStorage = w.localStorage;
  globalThis.Toastify = (options) => ({
    toastElement: null,
    showToast() {
      const toast = w.document.createElement("div");
      toast.className = `toastify on ${options.className ?? ""}`;
      toast.textContent = options.text;
      if (typeof options.onClick === "function")
        toast.addEventListener("click", options.onClick);
      w.document.body.append(toast);
      this.toastElement = toast;
      return this;
    },
    hideToast() {
      this.toastElement?.remove();
      options.callback?.();
    },
  });
  try {
    await import("../src/app.js");
    const d = w.document;
    const click = (id) => d.getElementById(id).click();

    assert.match(d.getElementById("round").textContent, /Hadeano · 1º Ciclo/);
    assert.equal(d.querySelectorAll(".origin-piece").length, 1);
    assert.equal(d.querySelectorAll(".piece.blue, .piece.amber").length, 0);

    let originCell = d.querySelector(".origin-piece").parentElement;
    originCell.click();
    const ancestralCopy = d.querySelector("#selected .selected-ancestral");
    assert.match(
      ancestralCopy.textContent,
      /O Último Ancestral Comum Universal já possuía metabolismo anaeróbio/,
    );
    assert.match(
      ancestralCopy.textContent,
      /para realizar a primeira reprodução/,
    );
    assert.ok(
      ancestralCopy.querySelector(
        ".legend-action-ring.vivify.inline-action-ring",
      ),
    );
    assert.equal(d.querySelector(".toastify.xe-passive-toast"), null);

    originCell = d.querySelector(".origin-piece").parentElement;
    originCell.click();

    const reproductionToast = d.querySelector(".toastify.xe-passive-toast");
    assert.ok(reproductionToast);
    assert.match(reproductionToast.textContent, /Primeira Reprodução feita\./);
    const reproductionMore = reproductionToast.querySelector(".toast-more");
    assert.ok(reproductionMore);
    assert.equal(reproductionMore.textContent, "SAIBA MAIS");
    reproductionMore.click();

    const reproductionDialog = d.querySelector("#mutation-dialog[open]");
    assert.ok(reproductionDialog);
    assert.equal(
      d.getElementById("mutation-dialog-title").textContent,
      "Reprodução",
    );
    assert.match(
      d.getElementById("mutation-dialog-real").textContent,
      /^Na vida: A hipótese do Mundo de RNA diz que a evolução começou/,
    );
    const reproductionGameCopy = d.getElementById("mutation-dialog-game");
    assert.match(
      reproductionGameCopy.textContent,
      /^No jogo: Clique no círculo verde .* que aparece quando a reprodução estiver disponível\.$/,
    );
    assert.ok(
      reproductionGameCopy.querySelector(
        ".legend-action-ring.vivify.inline-action-ring",
      ),
    );
    click("mutation-dialog-close");
    reproductionDialog.dispatchEvent(new w.Event("close"));

    assert.equal(d.querySelectorAll(".origin-piece").length, 0);
    assert.equal(d.querySelectorAll(".piece.blue").length, 1);
    assert.equal(d.querySelectorAll(".piece.amber").length, 1);
    assert.equal(d.querySelectorAll("#board .piece.blue, #board .piece.amber").length, 2);
    assert.equal(d.querySelectorAll(".piece.hadean-protocell").length, 0);
    assert.match(d.getElementById("round").textContent, /Tutorial 1\/3/);
    assert.equal(d.querySelectorAll(".cell.fertile").length, 2);
    let blueFounder = d.querySelector(".piece.blue").parentElement,
      amberFounder = d.querySelector(".piece.amber").parentElement;
    assert.ok(!blueFounder.classList.contains("vivification-target"));
    assert.ok(!amberFounder.classList.contains("vivification-target"));

    blueFounder.click();
    blueFounder = d.querySelector(".piece.blue").parentElement;
    amberFounder = d.querySelector(".piece.amber").parentElement;
    assert.equal(d.querySelectorAll("#board .piece.blue, #board .piece.amber").length, 2);
    assert.ok(blueFounder.classList.contains("vivification-target"));
    assert.ok(!amberFounder.classList.contains("vivification-target"));

    blueFounder.click();
    assert.equal(d.querySelectorAll("#board .piece.blue, #board .piece.amber").length, 3);
    const firstChild = [...d.querySelectorAll(".piece.blue")]
      .find((piece) => piece.parentElement !== blueFounder);
    assert.ok(firstChild);
    const childCell = firstChild.parentElement;
    assert.ok([3, 4].includes(Number(childCell.dataset.r)));
    assert.ok([3, 4].includes(Number(childCell.dataset.c)));
    assert.equal(d.querySelectorAll(".cell.hostile").length, 1);

    const emptyCell = [...d.querySelectorAll(".cell")].find(
      (cell) => !cell.classList.contains("occupied"),
    );
    assert.ok(emptyCell);
    emptyCell.click();
    assert.equal(d.getElementById("selected-title").textContent, "Casa selecionada");
    assert.ok(d.querySelector(".cell.cell-selected-info"));
    assert.match(d.getElementById("selected").textContent, /Casa (Fértil|Hostil|Neutra)/);

    click("menu-button");
    click("save");
    assert.match(d.getElementById("message").textContent, /salva/);

    click("menu-button");
    click("new");
    click("info-ok");
    assert.match(d.getElementById("round").textContent, /Hadeano · 1º Ciclo/);
    assert.equal(d.querySelectorAll(".origin-piece").length, 1);
    assert.equal(d.querySelectorAll(".piece.blue, .piece.amber").length, 0);
  } finally {
    globalThis.document = prior.document;
    globalThis.localStorage = prior.localStorage;
    globalThis.Toastify = prior.Toastify;
    dom.window.close();
  }
});


test("selected empty cells expose terrain and relevant board facts", () => {
  const dom = setup(),
    s = createState(530, { geologicalStage: "quaternary" }),
    r = 3,
    c = 3,
    cellIndex = r * 8 + c,
    now = round(s);
  s.pieces = s.pieces.filter((piece) => piece.r !== r || piece.c !== c);
  s.board[cellIndex] = "hostile";
  s.carcasses.push({
    cell: cellIndex,
    dueRound: now + 2,
    base: "neutral",
  });
  s.mineralRemnants.push({
    cell: cellIndex,
    expiresRound: now + 1,
  });

  render(dom.window.document, s, { selectedCell: { r, c } });

  const d = dom.window.document,
    panel = d.getElementById("selected"),
    cell = d.querySelector(`[data-r="${r}"][data-c="${c}"]`),
    mobile = d.getElementById("mobile-selected-summary");
  assert.equal(d.getElementById("selected-title").textContent, "Casa selecionada");
  assert.ok(cell.classList.contains("cell-selected-info"));
  assert.match(panel.textContent, /Casa Hostil/);
  assert.match(panel.textContent, /50%/);
  assert.match(panel.textContent, /Carcaça/);
  assert.match(panel.textContent, /2 rodadas restantes/);
  assert.match(panel.textContent, /Biomineralização/);
  assert.match(panel.textContent, /Bloqueia a primeira captura de contato/);
  assert.match(cell.getAttribute("aria-label"), /Biomineralização/);
  assert.equal(mobile.hidden, false);
  assert.match(mobile.textContent, /Casa Hostil/);
  assert.match(mobile.textContent, /Carcaça/);

  s.board[cellIndex] = "fertile";
  s.carcasses = [];
  s.mineralRemnants = [];
  s.plantSeeds.push({
    id: s.nextPlantSeed++,
    owner: "blue",
    r,
    c,
    parentId: s.pieces[0]?.id ?? 1,
    age: 2,
    movesRemaining: 1,
    sprouting: false,
    sproutReadyRound: null,
    profile: {
      owner: "blue",
      rank: 0,
      traits: ["Fotossíntese", "Gimnospermas"],
      mutations: 2,
      generation: 1,
    },
  });

  render(dom.window.document, s, { selectedCell: { r, c } });
  assert.match(panel.textContent, /Casa Fértil/);
  assert.match(panel.textContent, /Semente das Brancas/);
  assert.match(panel.textContent, /Idade 2\/3/);
  assert.match(panel.textContent, /em dispersão/);

  s.plantSeeds = [];
  s.board[cellIndex] = "neutral";
  render(dom.window.document, s, { selectedCell: { r, c } });
  assert.doesNotMatch(
    panel.textContent,
    /Nenhum recurso, estrutura, perigo ou modificador adicional ativo nesta casa\./,
  );
  assert.doesNotMatch(mobile.textContent, /Sem conteúdo adicional\./);
  dom.window.close();
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


test("legacy quadrant-domain data no longer affects board rendering", () => {
  const dom = setup(),
    s = createState(153);
  s.ecologicalDomain.active = true;
  Object.assign(s.ecologicalDomain.quadrants[0], {
    owner: "blue",
    progress: 3,
    consolidated: true,
  });

  render(dom.window.document, s);
  const d = dom.window.document,
    topLeft = d.querySelector('[data-r="0"][data-c="0"]');

  assert.equal(topLeft.classList.contains("domain-blue"), false);
  assert.equal(topLeft.classList.contains("domain-consolidated"), false);
  assert.equal(topLeft.querySelector(".domain-progress"), null);
  assert.doesNotMatch(d.getElementById("event").textContent, /Domínio Ecológico/);
  dom.window.close();
});

test("Hadean extinction offers the formal transition to Archean", () => {
  const dom = setup(),
    s = createCampaignState(404);
  s.origin = null;
  s.historicalTraits = [
    "Respiração anaeróbia",
    "Quimiossíntese",
  ];
  s.hadeanTutorial = {
    moved: true,
    divided: true,
    captured: true,
    fertile: true,
    dividedAtTurn: 0,
  };
  s.phase = "over";
  s.result = { winner: "amber", reason: "Extinção total." };
  s.pieces = [
    newPiece(s, "amber", 3, 3, { rank: 4 }),
  ];

  render(dom.window.document, s, { showResult: true });
  assert.equal(
    dom.window.document.getElementById("game-over-new").textContent,
    "Avançar para o Arqueano",
  );
  assert.match(
    dom.window.document.getElementById("round").textContent,
    /Hadeano · 1º Ciclo/,
  );
  dom.window.close();
});

test("victory dialog uses the concise extinction model", () => {
  const dom = setup(),
    s = createState(1601),
    d = dom.window.document;
  s.pieces = [];
  s.nextId = 1;
  s.pieces.push(
    newPiece(s, "blue", 6, 3, { rank: 4, traits: ["Chifre"] }),
    newPiece(s, "blue", 6, 4, { rank: 4, traits: ["Chifre"] }),
  );
  s.phase = "over";
  s.result = {
    winner: "blue",
    reason: "Extinção total.",
    victoryType: "extinction",
  };

  render(d, s, { showResult: true });

  assert.equal(d.getElementById("game-over-title").textContent, "Brancas venceram");
  const body = d.getElementById("game-over-body").textContent;
  assert.match(body, /Vitória por Extinção das Pretas/);
  assert.match(body, /Seleção natural/);
  assert.match(body, /Rei ♔ \(100% da população sobrevivente\)/);
  assert.match(body, /Características predominantes:/);
  assert.match(body, /Chifre/);
  assert.doesNotMatch(body, /linhagem sobrevivente/);
  assert.equal(d.getElementById("game-over-new").textContent, "Próximo Ciclo");
  dom.window.close();
});

test("black victory uses the same concise victory pattern as white victory", () => {
  const dom = setup(),
    s = createState(1603),
    d = dom.window.document;
  s.pieces = [];
  s.nextId = 1;
  s.pieces.push(
    newPiece(s, "amber", 1, 3, { rank: 4, traits: ["Chifre"] }),
    newPiece(s, "amber", 1, 4, { rank: 4, traits: ["Chifre"] }),
  );
  s.phase = "over";
  s.result = {
    winner: "amber",
    reason: "Extinção total.",
    victoryType: "extinction",
  };

  render(d, s, { showResult: true });

  assert.equal(d.getElementById("game-over-title").textContent, "Pretas venceram");
  const body = d.getElementById("game-over-body").textContent;
  assert.match(body, /Vitória por Extinção das Brancas/);
  assert.match(body, /Seleção natural/);
  assert.match(body, /Rei ♚ \(100% da população sobrevivente\)/);
  assert.match(body, /Características predominantes:/);
  assert.match(body, /Chifre/);
  dom.window.close();
});

test("victory dialog uses total surviving population for ecological-domain selection share", () => {
  const dom = setup(),
    s = createState(1602),
    d = dom.window.document;
  s.pieces = [];
  s.nextId = 1;
  s.pieces.push(
    newPiece(s, "blue", 6, 3, { rank: 4, traits: ["Chifre"] }),
    newPiece(s, "blue", 6, 4, { rank: 4, traits: ["Chifre"] }),
    newPiece(s, "amber", 1, 4, { rank: 4 }),
  );
  s.phase = "over";
  s.result = {
    winner: "blue",
    reason: "Domínio Ecológico: Brancas venceram por maior população (2 × 1).",
    victoryType: "ecological-domain",
  };

  render(d, s, { showResult: true });

  assert.equal(d.getElementById("game-over-title").textContent, "Brancas venceram");
  const body = d.getElementById("game-over-body").textContent;
  assert.match(body, /Vitória por Domínio Ecológico/);
  assert.match(body, /Rei ♔ \(67% da população sobrevivente\)/);
  assert.match(body, /Características predominantes:/);
  assert.match(body, /Chifre/);
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


test("piece badges use numeric counters only for metabolic recovery", () => {
  const dom = setup(),
    s = fixture([
      { owner: "blue", r: 4, c: 4, rank: 4 },
      { owner: "amber", r: 0, c: 0, rank: 0 },
    ]),
    piece = s.pieces[0],
    d = dom.window.document;

  s.turn = 4;
  s.current = "blue";
  piece.nextReproductionRound = round(s) + 3;
  piece.hibernationUntilTurn = s.turn + 7;
  piece.adaptiveImmuneMemory = ["virus:contact", "bacteria:trail"];
  piece.seeds = 4;
  piece.pregnancies = [
    { kind: "viviparous", dueRound: round(s) + 1, brood: [{}, {}] },
  ];
  s.neurofocus = piece.id;

  render(d, s, { selected: piece.id });

  const cell = d.querySelector(
      `[data-r="${piece.r}"][data-c="${piece.c}"]`,
    ),
    badges = [...cell.querySelectorAll(".status-badge")].map(
      (node) => node.textContent,
    );

  assert.ok(badges.includes("⏳3"));
  assert.ok(badges.includes("🧸"));
  assert.ok(badges.includes("🎯"));
  assert.ok(badges.includes("🌰"));
  assert.ok(badges.includes("🔴"));
  assert.ok(badges.includes("♾️"));
  assert.equal(
    badges.filter((badge) => /\d/.test(badge)).join(" "),
    "⏳3",
  );
  dom.window.close();
});
