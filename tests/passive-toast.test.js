import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import Toastify from "toastify-js";
import { createPassiveEffectToastPresenter } from "../src/passive-toast.js";
import { Controller } from "../src/controller.js";
import { fixture } from "./helpers.js";

function createToastifyMock(doc) {
  const calls = [];
  const toastify = (options) => {
    const instance = {
      options,
      toastElement: null,
      showToast() {
        const element = doc.createElement("div");
        element.className = `toastify on ${options.className ?? ""}`;
        element.textContent = options.text;
        element.setAttribute("aria-live", options.ariaLive);
        doc.body.append(element);
        this.toastElement = element;
        calls.push(this);
        return this;
      },
      hideToast() {
        this.toastElement?.remove();
        options.callback?.();
      },
    };
    return instance;
  };

  return {
    toastify,
    calls,
    dismiss(index = 0) {
      const instance = calls[index];
      instance.toastElement?.remove();
      instance.options.callback?.();
    },
  };
}

test("Toastify waits until blocking dialogs close before showing an effect", () => {
  const dom = new JSDOM('<dialog id="notice-dialog" open></dialog>'),
    mock = createToastifyMock(dom.window.document),
    presenter = createPassiveEffectToastPresenter(dom.window.document, {
      toastify: mock.toastify,
    }),
    effect = {
      id: 1,
      trait: "Pele grossa",
      text: "🦏 Pele grossa bloqueou a captura.",
    },
    dialog = dom.window.document.getElementById("notice-dialog");

  presenter.show(effect);
  assert.equal(mock.calls.length, 0);
  assert.equal(presenter.pendingCount(), 1);
  assert.equal(presenter.visibleCount(), 0);

  dialog.removeAttribute("open");
  dialog.dispatchEvent(new dom.window.Event("close"));

  assert.equal(mock.calls.length, 1);
  assert.equal(presenter.pendingCount(), 0);
  assert.equal(presenter.visibleCount(), 1);
  assert.deepEqual(
    {
      text: mock.calls[0].options.text,
      duration: mock.calls[0].options.duration,
      close: mock.calls[0].options.close,
      gravity: mock.calls[0].options.gravity,
      position: mock.calls[0].options.position,
      stopOnFocus: mock.calls[0].options.stopOnFocus,
      className: mock.calls[0].options.className,
      ariaLive: mock.calls[0].options.ariaLive,
    },
    {
      text: effect.text,
      duration: 6000,
      close: true,
      gravity: "top",
      position: "center",
      stopOnFocus: true,
      className: "xe-passive-toast",
      ariaLive: "polite",
    },
  );
  assert.equal(mock.calls[0].toastElement.dataset.effectId, "1");
  assert.equal(mock.calls[0].toastElement.dataset.trait, "Pele grossa");
  assert.equal(mock.calls[0].toastElement.getAttribute("role"), "status");

  presenter.destroy();
  dom.window.close();
});

test("Toastify presenter limits visible effects and releases its queue on dismiss", () => {
  const dom = new JSDOM(),
    mock = createToastifyMock(dom.window.document),
    presenter = createPassiveEffectToastPresenter(dom.window.document, {
      toastify: mock.toastify,
      maxVisible: 2,
    });

  for (let id = 1; id <= 3; id++)
    presenter.show({
      id,
      trait: "Pele grossa",
      text: `efeito ${id}`,
    });

  assert.equal(mock.calls.length, 2);
  assert.equal(presenter.visibleCount(), 2);
  assert.equal(presenter.pendingCount(), 1);
  assert.deepEqual(
    mock.calls.map((toast) => toast.options.text),
    ["efeito 1", "efeito 2"],
  );

  mock.dismiss(0);
  assert.equal(mock.calls.length, 3);
  assert.equal(presenter.visibleCount(), 2);
  assert.equal(presenter.pendingCount(), 0);
  assert.equal(mock.calls[2].options.text, "efeito 3");

  presenter.destroy();
  dom.window.close();
});

test("Toastify assets load before the app and mobile styling stays viewport-wide", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8"),
    css = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    dom = new JSDOM(html),
    d = dom.window.document,
    styles = [...d.querySelectorAll('link[rel="stylesheet"]')].map((link) =>
      link.getAttribute("href"),
    ),
    scripts = [...d.querySelectorAll("script")].map((script) =>
      script.getAttribute("src"),
    );

  assert.deepEqual(styles.slice(0, 2), ["assets/toastify.css", "app.css"]);
  assert.deepEqual(scripts.slice(-2), ["assets/toastify.js", "src/app.js"]);
  assert.equal(d.getElementById("passive-toasts"), null);
  assert.match(css, /\.toastify\.xe-passive-toast\s*\{/);
  assert.match(css, /max-width:\s*min\(calc\(100vw - 24px\), 680px\)/);
  assert.match(
    css,
    /@media \(max-width: 600px\)[\s\S]*width:\s*calc\(100vw - 24px\)/,
  );
  dom.window.close();
});

test("realized passive effect reaches Toastify from engine through Controller", () => {
  const dom = new JSDOM(),
    mock = createToastifyMock(dom.window.document),
    presenter = createPassiveEffectToastPresenter(dom.window.document, {
      toastify: mock.toastify,
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

  assert.equal(mock.calls.length, 1);
  const toast = mock.calls[0].toastElement;
  assert.ok(toast);
  assert.equal(toast.dataset.trait, "Pele grossa");
  assert.equal(toast.textContent, "🦏 Pele grossa bloqueou a captura.");

  presenter.destroy();
  dom.window.close();
});

test("presenter fails early when the Toastify bundle is absent", () => {
  const dom = new JSDOM();
  assert.throws(
    () =>
      createPassiveEffectToastPresenter(dom.window.document, {
        toastify: undefined,
      }),
    /Toastify precisa estar carregado/,
  );
  dom.window.close();
});

test("the real Toastify bundle mounts an accessible fixed toast in the document body", async () => {
  const toastifyCss = readFileSync(
      new URL("../node_modules/toastify-js/src/toastify.css", import.meta.url),
      "utf8",
    ),
    appCss = readFileSync(new URL("../app.css", import.meta.url), "utf8"),
    dom = new JSDOM(
      `<style>${toastifyCss}${appCss}</style><main><div id="board"></div></main>`,
      { pretendToBeVisual: true },
    ),
    prior = {
      document: globalThis.document,
      window: globalThis.window,
      Node: globalThis.Node,
      HTMLElement: globalThis.HTMLElement,
      ShadowRoot: globalThis.ShadowRoot,
      screen: globalThis.screen,
    };

  globalThis.document = dom.window.document;
  globalThis.window = dom.window;
  globalThis.Node = dom.window.Node;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.ShadowRoot = dom.window.ShadowRoot;
  globalThis.screen = dom.window.screen;

  try {
    const presenter = createPassiveEffectToastPresenter(dom.window.document, {
      toastify: Toastify,
    });
    presenter.show({
      id: 7,
      trait: "Visão Binocular",
      text: "👀 Visão Binocular detectou Camuflagem.",
    });

    const toast = dom.window.document.querySelector(
      "body > .toastify.xe-passive-toast.toastify-center.toastify-top",
    );
    assert.ok(toast);
    assert.equal(toast.innerText.includes("Visão Binocular"), true);
    assert.equal(toast.getAttribute("role"), "status");
    assert.equal(toast.getAttribute("aria-live"), "polite");
    assert.equal(toast.dataset.effectId, "7");
    assert.equal(toast.dataset.trait, "Visão Binocular");
    assert.equal(toast.style.top, "15px");
    assert.ok(toast.querySelector('button[aria-label="Fechar notificação"]'));
    assert.equal(dom.window.getComputedStyle(toast).position, "fixed");
    assert.equal(dom.window.getComputedStyle(toast).backgroundColor, "rgb(32, 38, 31)");
    assert.equal(presenter.visibleCount(), 1);

    presenter.destroy();
    await new Promise((resolve) => dom.window.setTimeout(resolve, 450));
    assert.equal(dom.window.document.querySelector(".toastify"), null);
  } finally {
    globalThis.document = prior.document;
    globalThis.window = prior.window;
    globalThis.Node = prior.Node;
    globalThis.HTMLElement = prior.HTMLElement;
    globalThis.ShadowRoot = prior.ShadowRoot;
    globalThis.screen = prior.screen;
    dom.window.close();
  }
});
