import test from "node:test";
import assert from "node:assert/strict";
import { Controller } from "../src/controller.js";
import { createState, clone } from "../src/state.js";
import { fallbackAction, chooseAction } from "../src/ai.js";
function setup() {
  const workers = [],
    timers = new Map();
  let n = 0;
  const s = createState(2);
  s.turn = 1;
  s.current = "amber";
  const c = new Controller(s, {
    workerFactory: () => {
      const w = {
        terminate() {
          this.terminated = true;
        },
        postMessage(data) {
          this.request = data;
        },
      };
      workers.push(w);
      return w;
    },
    setTimer: (fn) => {
      timers.set(++n, fn);
      return n;
    },
    clearTimer: (id) => timers.delete(id),
  });
  return { c, workers, timers };
}
test("worker response after reset is ignored", () => {
  const { c, workers } = setup();
  c.configure("single");
  const w = workers[0],
    request = w.request;
  c.replace(createState(44));
  const before = clone(c.state);
  w.onmessage({
    data: {
      token: request.token,
      revision: request.state.revision,
      action: fallbackAction(request.state),
    },
  });
  assert.deepEqual(c.state, before);
  assert.ok(w.terminated);
  c.dispose();
});
test("watchdog terminates stuck worker and advances using a legal fallback", () => {
  const { c, workers, timers } = setup();
  c.configure("single");
  const timer = [...timers.values()][0];
  timer();
  assert.ok(workers[0].terminated);
  assert.ok(c.state.revision > 0);
  assert.equal(c.state.current, "blue");
  assert.equal(c.job, null);
  c.dispose();
});
test("duplicate and malformed replies cannot double-play", () => {
  const { c, workers } = setup();
  c.configure("single");
  const w = workers[0],
    data = {
      token: w.request.token,
      revision: w.request.state.revision,
      action: { type: "MOVE", id: 999, r: 0, c: 0 },
    };
  w.onmessage({ data });
  const revision = c.state.revision;
  w.onmessage({ data });
  assert.equal(c.state.revision, revision);
  assert.equal(c.state.current, "blue");
  c.dispose();
});
test("pausing cancels work; notices prevent automatic play until acknowledgment", () => {
  const { c, workers } = setup();
  c.configure("single");
  c.pause(true);
  assert.ok(workers[0].terminated);
  assert.equal(c.job, null);
  c.state.notices = [
    { id: c.state.nextNotice++, title: "Teste", lines: ["Teste"] },
  ];
  c.pause(false);
  assert.equal(c.job, null);
  c.dispatch({ type: "ACK_NOTICE", id: c.state.notices[0].id });
  assert.ok(c.job);
  c.dispose();
});
test("worker errors and unavailable workers recover", () => {
  const { c, workers } = setup();
  c.configure("single");
  workers[0].onerror();
  assert.equal(c.state.current, "blue");
  c.dispose();
  const x = setup();
  x.c.workerFactory = () => {
    throw Error("CSP");
  };
  x.c.configure("single");
  [...x.timers.values()][0]();
  assert.equal(x.c.state.current, "blue");
  x.c.dispose();
});
test("AI respects node/time budgets, never mutates live state, always returns legal action", () => {
  const s = createState(1),
    before = clone(s);
  let clock = 0;
  for (const difficulty of ["easy", "medium", "hard"]) {
    const a = chooseAction(s, difficulty, {
      maxNodes: 1,
      now: () => clock++,
      budget: 1,
    });
    assert.equal(a.type, "MOVE");
  }
  assert.deepEqual(s, before);
});

test("native browser timers are called without binding the controller as their receiver", () => {
  const originalSet = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout;
  let scheduled = 0,
    cleared = 0;
  globalThis.setTimeout = function () {
    assert.ok(!(this instanceof Controller), "Illegal invocation");
    scheduled++;
    return 1;
  };
  globalThis.clearTimeout = function () {
    assert.ok(!(this instanceof Controller), "Illegal invocation");
    cleared++;
  };
  try {
    const s = createState(2);
    s.current = "amber";
    s.turn = 1;
    const c = new Controller(s, {
      workerFactory: () => ({ postMessage() {}, terminate() {} }),
    });
    c.configure("single");
    assert.equal(scheduled, 1);
    c.dispose();
    assert.equal(cleared, 1);
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});
