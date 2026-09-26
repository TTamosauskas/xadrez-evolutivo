import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import {
  animateMovementTrace,
  movementAnimationPlan,
} from "../src/movement-animation.js";

test("movement overlay is anchored to viewport coordinates", () => {
  const css = readFileSync(new URL("../app.css", import.meta.url), "utf8");
  assert.match(
    css,
    /\.movement-trace-piece\s*\{[^}]*position:\s*fixed;[^}]*top:\s*0;[^}]*left:\s*0;/s,
  );
});

test("a four-cell movement remains visible for about 1.2 seconds", () => {
  const point = (x) => ({ x, y: 0, size: 64 }),
    plan = movementAnimationPlan([
      point(0),
      point(64),
      point(128),
      point(192),
      point(256),
    ]);
  assert.equal(plan.duration, 1200);
});

test("destination creature visuals stay hidden until movement animation finishes", () => {
  const dom = new JSDOM(
      `<!doctype html><body>
        <div id="board">
          <button data-r="4" data-c="0"></button>
          <button data-r="4" data-c="1"></button>
          <button data-r="4" data-c="2"></button>
          <button data-r="4" data-c="3"></button>
          <button data-r="4" data-c="4">
            <span class="piece blue">♜</span>
            <span class="piece-energy-core blue"></span>
            <span class="trait-frame"></span>
            <span class="piece-status"></span>
            <span class="pathogen-overlay"></span>
          </button>
        </div>
      </body>`,
      { pretendToBeVisual: true },
    ),
    { window } = dom,
    d = window.document,
    listeners = new Map();

  window.matchMedia = () => ({ matches: false });
  for (const cell of d.querySelectorAll("[data-r][data-c]")) {
    cell.getBoundingClientRect = () => {
      const c = Number(cell.dataset.c);
      return {
        left: c * 64,
        top: 256,
        width: 64,
        height: 64,
        right: c * 64 + 64,
        bottom: 320,
      };
    };
  }

  window.HTMLElement.prototype.animate = function (frames, options) {
    this.__frames = frames;
    this.__options = options;
    return {
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
    };
  };

  const trace = {
      pieceId: 1,
      owner: "blue",
      rank: 3,
      origin: { r: 4, c: 0 },
      path: [
        { r: 4, c: 1 },
        { r: 4, c: 2 },
        { r: 4, c: 3 },
        { r: 4, c: 4 },
      ],
      stop: { r: 4, c: 4 },
      outcome: "moved",
      kind: "move",
      jumpedCell: null,
      knightCorrection: false,
    },
    destination = d.querySelector('[data-r="4"][data-c="4"]'),
    board = d.getElementById("board");

  assert.equal(animateMovementTrace(d, trace), true);
  const overlay = d.querySelector(".movement-trace-piece");
  assert.ok(overlay);
  assert.ok(overlay.classList.contains("piece"));
  assert.ok(overlay.classList.contains("blue"));
  assert.equal(overlay.__options.duration, 1200);
  assert.ok(board.classList.contains("movement-animating"));
  assert.ok(
    destination.classList.contains("movement-trace-destination-hidden"),
  );

  listeners.get("finish")?.();
  assert.equal(d.querySelector(".movement-trace-piece"), null);
  assert.equal(board.classList.contains("movement-animating"), false);
  assert.equal(
    destination.classList.contains("movement-trace-destination-hidden"),
    false,
  );
  dom.window.close();
});


test("reduced-motion preference keeps a discrete visible trajectory instead of teleporting", () => {
  const dom = new JSDOM(
      `<!doctype html><body>
        <div id="board">
          <button data-r="4" data-c="0"></button>
          <button data-r="4" data-c="1"></button>
          <button data-r="4" data-c="2"></button>
          <button data-r="4" data-c="3"></button>
          <button data-r="4" data-c="4"><span class="piece blue">♜</span></button>
        </div>
      </body>`,
      { pretendToBeVisual: true },
    ),
    { window } = dom,
    d = window.document;

  window.matchMedia = () => ({ matches: true });
  for (const cell of d.querySelectorAll("[data-r][data-c]")) {
    cell.getBoundingClientRect = () => {
      const c = Number(cell.dataset.c);
      return {
        left: c * 64,
        top: 256,
        width: 64,
        height: 64,
        right: c * 64 + 64,
        bottom: 320,
      };
    };
  }

  let captured = null;
  window.HTMLElement.prototype.animate = function (frames, options) {
    captured = { frames, options };
    return { addEventListener() {} };
  };

  const trace = {
    pieceId: 1,
    owner: "blue",
    rank: 3,
    origin: { r: 4, c: 0 },
    path: [
      { r: 4, c: 1 },
      { r: 4, c: 2 },
      { r: 4, c: 3 },
      { r: 4, c: 4 },
    ],
    stop: { r: 4, c: 4 },
    outcome: "moved",
    kind: "move",
    jumpedCell: null,
    knightCorrection: false,
  };

  assert.equal(animateMovementTrace(d, trace), true);
  assert.ok(captured);
  assert.equal(captured.frames.length, 9);
  assert.equal(captured.options.duration, 724);
  dom.window.close();
});
