import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { createState, clone } from "../src/state.js";
import { render } from "../src/view.js";
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
  assert.match(d.getElementById("selected").textContent, /🎈 \+3/);
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

test("application UI can play, acknowledge reproduction, save, load and reset", async () => {
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
      if (d.getElementById("instruction").textContent.includes("parceiro"))
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
    assert.match(d.getElementById("round").textContent, /Rodada 1 ·/);
    click("menu-button");
    click("load");
    assert.equal(d.getElementById("round").textContent, saved);
  } finally {
    globalThis.document = prior.document;
    globalThis.localStorage = prior.localStorage;
    dom.window.close();
  }
});
