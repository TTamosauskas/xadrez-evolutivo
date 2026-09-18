import { transition } from "./engine.js";
import { assertState, clone } from "./state.js";
import { has } from "./constants.js";
import { fallbackAction } from "./ai.js";
import { legalActions } from "./moves.js";
/** The sole owner of live state, worker lifecycle and timers. */
export class Controller {
  constructor(
    state,
    {
      render = () => {},
      report = () => {},
      workerFactory = () =>
        new Worker(new URL("./ai-worker.js", import.meta.url), {
          type: "module",
        }),
      setTimer = (...args) => setTimeout(...args),
      clearTimer = (id) => clearTimeout(id),
      timeout = 2000,
    } = {},
  ) {
    this.state = assertState(state);
    this.render = render;
    this.report = report;
    this.workerFactory = workerFactory;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timeout = timeout;
    this.mode = "multi";
    this.difficulty = "medium";
    this.paused = false;
    this.generation = 0;
    this.job = null;
    this.neocortexPending = null;
    this.neocortexWindow = null;
    this.neocortexLock = null;
  }
  cancel() {
    this.generation++;
    if (this.job) {
      this.clearTimer(this.job.timer);
      this.job.worker?.terminate();
      this.job = null;
    }
  }
  refresh() {
    this.render(this.state, !!this.job);
    this.schedule();
  }
  replace(state) {
    assertState(state);
    this.cancel();
    this.neocortexPending = null;
    this.neocortexWindow = null;
    this.neocortexLock = null;
    this.state = state;
    this.refresh();
  }
  canUndoNeocortex() {
    return !!this.neocortexWindow;
  }
  undoNeocortex() {
    const window = this.neocortexWindow;
    if (!window) return false;
    const restored = clone(window.snapshot);
    restored.revision = this.state.revision + 1;
    assertState(restored);
    this.cancel();
    this.neocortexPending = null;
    this.neocortexWindow = null;
    this.neocortexLock = {
      releaseTurn: window.originTurn + 2,
    };
    this.state = restored;
    this.refresh();
    return true;
  }
  configure(mode, difficulty = this.difficulty) {
    this.cancel();
    this.mode = mode;
    this.difficulty = difficulty;
    this.refresh();
  }
  pause(value) {
    this.paused = value;
    if (value) this.cancel();
    this.refresh();
  }
  dispatch(action, { ai = false } = {}) {
    if (
      this.paused ||
      (!ai &&
        this.mode === "single" &&
        this.state.current === "amber" &&
        action.type !== "ACK_NOTICE")
    )
      return false;
    try {
      const isAck = action.type === "ACK_NOTICE";
      if (
        this.neocortexLock &&
        this.state.turn >= this.neocortexLock.releaseTurn
      )
        this.neocortexLock = null;

      if (this.neocortexWindow?.responseComplete && !isAck)
        this.neocortexWindow = null;

      if (
        !ai &&
        !isAck &&
        !this.neocortexPending &&
        !this.neocortexWindow &&
        !this.neocortexLock &&
        action.type === "MOVE" &&
        this.state.phase === "move"
      ) {
        const actor = this.state.pieces.find((p) => p.id === action.id);
        if (
          actor?.owner === this.state.current &&
          has(actor, "Neocórtex Desenvolvido")
        )
          this.neocortexPending = {
            snapshot: clone(this.state),
            actorId: actor.id,
            owner: actor.owner,
            originTurn: this.state.turn,
          };
      }

      const next = transition(this.state, action);
      if (next === this.state) return false;
      this.cancel();
      this.state = next;

      if (this.neocortexPending) {
        const pending = this.neocortexPending;
        if (this.state.turn > pending.originTurn) {
          const survived = this.state.pieces.some(
            (piece) => piece.id === pending.actorId,
          );
          if (survived)
            this.neocortexWindow = {
              ...pending,
              responseComplete:
                this.state.current === pending.owner &&
                this.state.turn >= pending.originTurn + 2,
            };
          this.neocortexPending = null;
        }
      }

      if (
        this.neocortexWindow &&
        !this.neocortexWindow.responseComplete &&
        ((this.state.current === this.neocortexWindow.owner &&
          this.state.turn >= this.neocortexWindow.originTurn + 2) ||
          (this.state.result &&
            this.state.turn > this.neocortexWindow.originTurn + 1))
      )
        this.neocortexWindow.responseComplete = true;

      if (
        this.neocortexLock &&
        this.state.turn >= this.neocortexLock.releaseTurn
      )
        this.neocortexLock = null;

      this.refresh();
      return true;
    } catch (error) {
      this.report(error.message);
      return false;
    }
  }
  schedule() {
    const state = this.state;
    if (
      this.job ||
      this.paused ||
      this.mode !== "single" ||
      state.current !== "amber" ||
      state.result ||
      state.notices.length
    )
      return;
    const token = ++this.generation,
      revision = state.revision;
    const finish = (action) => {
      if (
        this.job?.token !== token ||
        this.generation !== token ||
        this.state.revision !== revision
      )
        return;
      this.cancel();
      const legal = legalActions(this.state);
      const valid =
        action &&
        legal.some(
          (a) =>
            a.type === action.type &&
            a.id === action.id &&
            a.r === action.r &&
            a.c === action.c,
        );
      const chosen = valid ? action : fallbackAction(this.state);
      this.dispatch({ ...chosen, revision }, { ai: true });
    };
    this.job = { token, worker: null, timer: null };
    this.job.timer = this.setTimer(() => finish(null), this.timeout);
    try {
      const worker = this.workerFactory();
      this.job.worker = worker;
      worker.onmessage = ({ data }) => {
        if (data.token === token && data.revision === revision)
          finish(data.action);
      };
      worker.onerror = () => finish(null);
      worker.postMessage({ token, state, difficulty: this.difficulty });
    } catch {
      this.clearTimer(this.job.timer);
      this.job.timer = this.setTimer(() => finish(null), 120);
    }
    this.render(this.state, true);
  }
  dispose() {
    this.cancel();
    this.paused = true;
  }
}
