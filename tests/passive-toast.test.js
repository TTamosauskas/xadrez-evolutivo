import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { createPassiveEffectToastPresenter } from "../src/passive-toast.js";
import { Controller } from "../src/controller.js";
import { fixture } from "./helpers.js";

test("passive toast waits until blocking dialogs close before starting its timer", () => {
  const dom = new JSDOM(
      '<div id="passive-toasts"></div><dialog id="notice-dialog" open></dialog>',
    ),
    timers = new Map();
  let nextTimer = 0;
  const presenter = createPassiveEffectToastPresenter(dom.window.document, {
      setTimer: (fn, delay) => {
        const id = ++nextTimer;
        timers.set(id, { fn, delay });
        return id;
      },
      clearTimer: (id) => timers.delete(id),
      duration: 2600,
      fadeDuration: 180,
    }),
    effect = {
      id: 1,
      trait: "Pele grossa",
      text: "🦏 Pele grossa bloqueou a captura.",
    },
    region = dom.window.document.getElementById("passive-toasts"),
    dialog = dom.window.document.getElementById("notice-dialog");

  presenter.show(effect);
  assert.equal(region.children.length, 0);
  assert.equal(presenter.pendingCount(), 1);
  assert.equal(timers.size, 0);

  dialog.removeAttribute("open");
  dialog.dispatchEvent(new dom.window.Event("close"));
  assert.equal(presenter.pendingCount(), 0);
  assert.equal(region.children.length, 1);
  assert.equal(region.firstElementChild.textContent, effect.text);
  assert.equal([...timers.values()][0].delay, 2600);

  const durationTimer = [...timers.entries()][0];
  timers.delete(durationTimer[0]);
  durationTimer[1].fn();
  assert.ok(region.firstElementChild.classList.contains("leaving"));
  const fadeTimer = [...timers.entries()][0];
  assert.equal(fadeTimer[1].delay, 180);

  timers.delete(fadeTimer[0]);
  fadeTimer[1].fn();
  assert.equal(region.children.length, 0);
  presenter.destroy();
  dom.window.close();
});

test("passive toast presenter shows at most two effects and queues the rest", () => {
  const dom = new JSDOM('<div id="passive-toasts"></div>'),
    timers = new Map();
  let nextTimer = 0;
  const presenter = createPassiveEffectToastPresenter(dom.window.document, {
      setTimer: (fn, delay) => {
        const id = ++nextTimer;
        timers.set(id, { fn, delay });
        return id;
      },
      clearTimer: (id) => timers.delete(id),
    }),
    region = dom.window.document.getElementById("passive-toasts");

  for (let id = 1; id <= 3; id++)
    presenter.show({
      id,
      trait: "Pele grossa",
      text: `efeito ${id}`,
    });

  assert.equal(region.children.length, 2);
  assert.equal(presenter.pendingCount(), 1);
  assert.deepEqual(
    [...region.children].map((toast) => toast.textContent),
    ["efeito 1", "efeito 2"],
  );

  presenter.destroy();
  dom.window.close();
});


test("passive toast is structurally anchored over the board", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    dom = new JSDOM(html),
    d = dom.window.document,
    stage = d.querySelector(".board-stage"),
    board = d.getElementById("board"),
    summary = d.getElementById("mobile-selected-summary"),
    region = d.getElementById("passive-toasts");

  assert.ok(stage);
  assert.equal(board.parentElement, stage);
  assert.equal(board.nextElementSibling, summary);
  assert.equal(region.parentElement, stage);
  assert.match(css, /\.board-stage\s*\{\s*position:\s*relative;/);
  assert.match(
    css,
    /\.passive-toasts\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*10px;[\s\S]*left:\s*50%;/,
  );
  assert.doesNotMatch(
    css,
    /\.passive-toasts\s*\{[\s\S]{0,180}position:\s*fixed;/,
  );
  dom.window.close();
});

test("realized passive effect reaches the toast DOM from engine through Controller", () => {
  const dom = new JSDOM(
      '<div class="board-stage"><div id="board"></div><div id="mobile-selected-summary"></div><div id="passive-toasts"></div></div>',
    ),
    presenterTimers = new Map();
  let nextPresenterTimer = 0;
  const presenter = createPassiveEffectToastPresenter(dom.window.document, {
      setTimer: (fn, delay) => {
        const id = ++nextPresenterTimer;
        presenterTimers.set(id, { fn, delay });
        return id;
      },
      clearTimer: (id) => presenterTimers.delete(id),
    }),
    state = fixture([
      { owner: "blue", r: 4, c: 3, rank: 4 },
      { owner: "amber", r: 4, c: 4, traits: ["Pele grossa"] },
      { owner: "amber", r: 0, c: 0 },
    ]);
  state.rng = 0;

  const controller = new Controller(state, {
      render: () => {},
      toast: (effect) => presenter.show(effect),
      workerFactory: () => ({
        postMessage() {},
        terminate() {},
      }),
      setTimer: () => 1,
      clearTimer: () => {},
    }),
    attacker = controller.state.pieces[0];

  assert.equal(
    controller.dispatch({
      type: "MOVE",
      id: attacker.id,
      r: 4,
      c: 4,
      revision: controller.state.revision,
    }),
    true,
  );

  const toast = dom.window.document.querySelector(".passive-toast");
  assert.ok(toast);
  assert.equal(toast.dataset.trait, "Pele grossa");
  assert.equal(toast.textContent, "🦏 Pele grossa bloqueou a captura.");
  assert.ok(presenterTimers.size > 0);

  presenter.destroy();
  dom.window.close();
});
