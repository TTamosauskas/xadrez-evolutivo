import test from "node:test";
import assert from "node:assert/strict";
import { Controller } from "../src/controller.js";
import { createCampaignState, createState, clone, newPiece } from "../src/state.js";
import { fallbackAction, chooseAction } from "../src/ai.js";
function setup() {
  const workers = [],
    timers = new Map(),
    timerDelays = new Map();
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
    setTimer: (fn, delay) => {
      const id = ++n;
      timers.set(id, fn);
      timerDelays.set(id, delay);
      return id;
    },
    clearTimer: (id) => {
      timers.delete(id);
      timerDelays.delete(id);
    },
  });
  return { c, workers, timers, timerDelays };
}
test("automatic Conway waits between visible board updates", () => {
  const s = createState(302);
  s.board.fill("neutral");
  s.pieces = [];
  s.nextId = 1;
  s.pieces.push(
    newPiece(s, "blue", 4, 4, { rank: 4, traits: [] }),
    newPiece(s, "amber", 0, 0, { rank: 4, traits: [] }),
  );
  for (const cell of [27, 28, 29]) s.board[cell] = "fertile";
  s.turn = 80;
  s.current = "blue";
  s.notices = [];

  const timers = new Map(),
    delays = [],
    renders = [];
  let nextTimer = 0;
  const controller = new Controller(s, {
    conwayDelay: 700,
    render: (state, busy) =>
      renders.push({
        revision: state.revision,
        board: [...state.board],
        busy,
      }),
    setTimer: (fn, delay) => {
      const id = ++nextTimer;
      timers.set(id, fn);
      delays.push(delay);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });

  controller.refresh();
  assert.equal(delays[0], 700);
  assert.equal(renders.at(-1).busy, "conway");
  const before = [...controller.state.board];

  const first = [...timers.values()][0];
  timers.clear();
  first();

  assert.notDeepEqual(controller.state.board, before);
  assert.ok(controller.state.turn >= 81);
  assert.ok(renders.some((entry) => entry.revision === controller.state.revision));
  if (controller.conwayTimer !== null) {
    assert.equal(delays.at(-1), 700);
    assert.equal(renders.at(-1).busy, "conway");
  }
  controller.dispose();
});

test("AI waits for a visible human-paced delay before committing its move", () => {
  const { c, workers, timers, timerDelays } = setup();
  c.configure("single");
  const w = workers[0],
    action = fallbackAction(w.request.state);
  w.onmessage({
    data: {
      token: w.request.token,
      revision: w.request.state.revision,
      action,
    },
  });
  assert.equal(c.state.current, "amber");
  assert.equal(c.state.revision, w.request.state.revision);
  const delayEntry = [...timerDelays.entries()].find(([, delay]) => delay === 850);
  assert.ok(delayEntry);
  timers.get(delayEntry[0])();
  assert.equal(c.state.current, "blue");
  assert.ok(c.state.revision > w.request.state.revision);
  c.dispose();
});

test("computer versus computer mode schedules AI for both colors", () => {
  const { c, workers, timers, timerDelays } = setup();
  c.configure("auto");

  const playCurrentWorker = (index) => {
    const worker = workers[index],
      action = fallbackAction(worker.request.state);
    worker.onmessage({
      data: {
        token: worker.request.token,
        revision: worker.request.state.revision,
        action,
      },
    });
    const delayId = [...timerDelays.entries()].find(
      ([id, delay]) => delay === 850 && timers.has(id),
    )?.[0];
    assert.ok(delayId);
    timers.get(delayId)();
  };

  assert.equal(c.state.current, "amber");
  assert.equal(workers.length, 1);
  playCurrentWorker(0);
  assert.equal(c.state.current, "blue");
  assert.equal(workers.length, 2);

  playCurrentWorker(1);
  assert.equal(c.state.current, "amber");
  assert.equal(workers.length, 3);
  c.dispose();
});

test("computer versus computer mode advances origin and notices automatically", () => {
  const timers = new Map(),
    workers = [];
  let nextTimer = 0;
  const c = new Controller(createCampaignState(55), {
    workerFactory: () => {
      const worker = {
        terminate() {},
        postMessage(data) {
          this.request = data;
        },
      };
      workers.push(worker);
      return worker;
    },
    setTimer: (fn) => {
      const id = ++nextTimer;
      timers.set(id, fn);
      return id;
    },
    clearTimer: (id) => timers.delete(id),
  });
  const runNextTimer = () => {
    const [id, fn] = timers.entries().next().value;
    timers.delete(id);
    fn();
  };

  c.configure("auto");
  assert.equal(c.state.phase, "origin");
  runNextTimer();
  assert.equal(c.state.origin.selected, true);
  runNextTimer();
  assert.equal(c.state.phase, "move");
  assert.equal(workers.length, 1);

  c.cancel();
  c.state.notices.push({
    id: c.state.nextNotice++,
    title: "Teste",
    lines: ["Aviso"],
  });
  c.refresh();
  assert.equal(c.state.notices.length, 1);
  runNextTimer();
  assert.equal(c.state.notices.length, 0);
  c.dispose();
});

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
  const { c, workers, timers, timerDelays } = setup();
  c.configure("single");
  const w = workers[0],
    data = {
      token: w.request.token,
      revision: w.request.state.revision,
      action: { type: "MOVE", id: 999, r: 0, c: 0 },
    };
  w.onmessage({ data });
  assert.equal(c.state.current, "amber");
  const delayId = [...timerDelays.entries()].find(([, delay]) => delay === 850)[0];
  timers.get(delayId)();
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
  const first = setup(),
    { c, workers, timers, timerDelays } = first;
  c.configure("single");
  workers[0].onerror();
  assert.equal(c.state.current, "amber");
  const delayId = [...timerDelays.entries()].find(([, delay]) => delay === 850)[0];
  timers.get(delayId)();
  assert.equal(c.state.current, "blue");
  c.dispose();

  const x = setup();
  x.c.workerFactory = () => {
    throw Error("CSP");
  };
  x.c.configure("single");
  const fallbackId = [...x.timerDelays.entries()].find(([, delay]) => delay === 120)[0];
  x.timers.get(fallbackId)();
  assert.equal(x.c.state.current, "amber");
  const xDelayId = [...x.timerDelays.entries()].find(([, delay]) => delay === 850)[0];
  x.timers.get(xDelayId)();
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

test("Neocórtex rollback survives the opponent response and restores deterministic state", () => {
  const s = createState(31);
  s.pieces = [];
  s.nextId = 1;
  s.board.fill("neutral");
  s.pieces.push(
    newPiece(s, "blue", 4, 0, {
      rank: 3,
      traits: ["Locomoção", "Neocórtex Desenvolvido"],
    }),
    newPiece(s, "amber", 0, 7, { rank: 3, traits: ["Locomoção"] }),
  );
  const c = new Controller(s, { render: () => {} }),
    before = clone(c.state);

  assert.equal(
    c.dispatch({ type: "MOVE", id: c.state.pieces[0].id, r: 4, c: 1 }),
    true,
  );
  assert.equal(c.state.current, "amber");
  assert.equal(c.canUndoNeocortex(), true);

  const amber = c.state.pieces.find((p) => p.owner === "amber");
  assert.equal(
    c.dispatch({ type: "MOVE", id: amber.id, r: 0, c: 6 }),
    true,
  );
  assert.equal(c.state.current, "blue");
  assert.equal(c.canUndoNeocortex(), true);

  const revisionAfterScenario = c.state.revision;
  assert.equal(c.undoNeocortex(), true);
  assert.ok(c.state.revision > revisionAfterScenario);
  const restored = clone(c.state);
  restored.revision = before.revision;
  assert.deepEqual(restored, before);

  const blue = c.state.pieces.find((p) => p.owner === "blue");
  assert.equal(
    c.dispatch({ type: "MOVE", id: blue.id, r: 4, c: 2 }),
    true,
  );
  assert.equal(c.canUndoNeocortex(), false);
  const secondAmber = c.state.pieces.find((p) => p.owner === "amber");
  assert.equal(
    c.dispatch({ type: "MOVE", id: secondAmber.id, r: 0, c: 6 }),
    true,
  );
  assert.equal(c.canUndoNeocortex(), false);

  const nextBlue = c.state.pieces.find((p) => p.owner === "blue");
  assert.equal(
    c.dispatch({ type: "MOVE", id: nextBlue.id, r: 4, c: 3 }),
    true,
  );
  assert.equal(c.canUndoNeocortex(), true);
  c.dispose();
});

test("native browser timers are called without binding the controller as their receiver", () => {
  const originalSet = globalThis.setTimeout,
    originalClear = globalThis.clearTimeout;
  let scheduled = 0,
    cleared = 0;
  globalThis.setTimeout = function () {
    assert.ok(!(this instanceof Controller), "Illegal invocation");
    scheduled++;
    return scheduled;
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
    assert.equal(scheduled, 2);
    c.dispose();
    assert.equal(cleared, 2);
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
  }
});
