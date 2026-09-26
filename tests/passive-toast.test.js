import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createPassiveEffectToastPresenter } from "../src/passive-toast.js";

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
