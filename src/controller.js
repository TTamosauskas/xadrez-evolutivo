import {
  transition,
  mutuallyBlocked,
  lethalDeathsDue,
} from "./engine.js";
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
      onTransition = () => {},
      report = () => {},
      toast = () => {},
      workerFactory = () =>
        new Worker(new URL("./ai-worker.js", import.meta.url), {
          type: "module",
        }),
      setTimer = (...args) => setTimeout(...args),
      clearTimer = (id) => clearTimeout(id),
      timeout = 2000,
      aiDelay = 850,
      domainDelay = 700,
      lethalDelay = 700,
      collapseDelay = 250,
      resultDelay = 1000,
      autoAdvanceDelay = 1400,
      onAutoAdvanceResult = null,
    } = {},
  ) {
    this.state = assertState(state);
    this.render = render;
    this.onTransition = onTransition;
    this.report = report;
    this.toast = toast;
    this.workerFactory = workerFactory;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.timeout = timeout;
    this.aiDelay = aiDelay;
    this.domainDelay = domainDelay;
    this.lethalDelay = lethalDelay;
    this.collapseDelay = collapseDelay;
    this.resultDelay = resultDelay;
    this.autoAdvanceDelay = autoAdvanceDelay;
    this.onAutoAdvanceResult = onAutoAdvanceResult;
    this.mode = "multi";
    this.difficulty = "medium";
    this.paused = false;
    this.generation = 0;
    this.job = null;
    this.domainTimer = null;
    this.lethalTimer = null;
    this.resultTimer = null;
    this.resultAdvanceTimer = null;
    this.resultReady = false;
    this.neocortexPending = null;
    this.neocortexWindow = null;
    this.neocortexLock = null;
    this.pendingMovementTrace = null;
  }
  cancel() {
    this.generation++;
    if (this.job) {
      this.clearTimer(this.job.timer);
      if (this.job.delayTimer !== null) this.clearTimer(this.job.delayTimer);
      this.job.worker?.terminate();
      this.job = null;
    }
    if (this.domainTimer !== null) {
      this.clearTimer(this.domainTimer);
      this.domainTimer = null;
    }
    if (this.lethalTimer !== null) {
      this.clearTimer(this.lethalTimer);
      this.lethalTimer = null;
    }
    if (this.resultTimer !== null) {
      this.clearTimer(this.resultTimer);
      this.resultTimer = null;
    }
    if (this.resultAdvanceTimer !== null) {
      this.clearTimer(this.resultAdvanceTimer);
      this.resultAdvanceTimer = null;
    }
  }

  scheduleResultAutoAdvance() {
    if (
      this.resultAdvanceTimer !== null ||
      !this.resultReady ||
      !this.state.result ||
      this.mode !== "auto" ||
      this.paused ||
      typeof this.onAutoAdvanceResult !== "function"
    )
      return;
    const token = this.generation,
      revision = this.state.revision;
    this.resultAdvanceTimer = this.setTimer(() => {
      this.resultAdvanceTimer = null;
      if (
        this.paused ||
        this.mode !== "auto" ||
        this.generation !== token ||
        !this.state.result ||
        this.state.revision !== revision
      )
        return;
      this.onAutoAdvanceResult(this.state);
    }, this.autoAdvanceDelay);
  }

  refresh() {
    const movementTrace = this.pendingMovementTrace;
    this.pendingMovementTrace = null;
    if (this.state.result) {
      if (!this.resultReady && this.resultTimer === null) {
        const revision = this.state.revision;
        this.resultTimer = this.setTimer(() => {
          this.resultTimer = null;
          if (!this.state.result || this.state.revision !== revision) return;
          this.resultReady = true;
          this.render(this.state, false, true);
          this.scheduleResultAutoAdvance();
        }, this.resultDelay);
      }
      const busy =
        this.lethalTimer !== null
          ? "lethal"
          : this.domainTimer !== null
            ? "blocked"
            : !!this.job;
      this.render(this.state, busy, this.resultReady, movementTrace);
      this.scheduleResultAutoAdvance();
      return;
    }
    this.resultReady = false;
    if (!this.scheduleLethalDeaths() && !this.scheduleDomainResolution()) this.schedule();
    const busy =
      this.lethalTimer !== null
        ? "lethal"
        : this.domainTimer !== null
          ? "blocked"
          : !!this.job;
    this.render(this.state, busy, true, movementTrace);
  }

  scheduleLethalDeaths() {
    if (
      this.lethalTimer !== null ||
      this.job ||
      this.domainTimer !== null ||
      this.paused ||
      this.state.result ||
      this.state.notices.length ||
      !lethalDeathsDue(this.state)
    )
      return this.lethalTimer !== null;

    const token = this.generation,
      revision = this.state.revision;
    this.lethalTimer = this.setTimer(() => {
      if (
        this.paused ||
        this.generation !== token ||
        this.state.revision !== revision
      )
        return;
      this.lethalTimer = null;
      this.dispatch({ type: "RESOLVE_LETHAL", revision }, { ai: true });
    }, this.lethalDelay);
    return true;
  }

  scheduleDomainResolution() {
    if (
      this.domainTimer !== null ||
      this.job ||
      this.paused ||
      this.state.result ||
      this.state.notices.length ||
      !mutuallyBlocked(this.state)
    )
      return this.domainTimer !== null;

    const token = this.generation,
      revision = this.state.revision;
    this.domainTimer = this.setTimer(() => {
      if (
        this.paused ||
        this.generation !== token ||
        this.state.revision !== revision
      )
        return;
      this.domainTimer = null;
      this.dispatch({ type: "RESOLVE_BLOCKED", revision }, { ai: true });
    }, this.domainDelay);
    return true;
  }
  replace(state) {
    assertState(state);
    this.cancel();
    this.neocortexPending = null;
    this.neocortexWindow = null;
    this.neocortexLock = null;
    this.pendingMovementTrace = null;
    this.state = state;
    this.resultReady = false;
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
        (this.domainTimer !== null || this.lethalTimer !== null)) ||
      (!ai &&
        ((this.mode === "single" && this.state.current === "amber") ||
          this.mode === "auto") &&
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
          (actor.r !== action.r || actor.c !== action.c) &&
          has(actor, "Neocórtex Desenvolvido")
        )
          this.neocortexPending = {
            snapshot: clone(this.state),
            actorId: actor.id,
            owner: actor.owner,
            originTurn: this.state.turn,
          };
      }

      const ownersBeforeTransition = new Map(
          this.state.pieces.map((piece) => [piece.id, piece.owner]),
        ),
        activeOwner = this.state.current,
        seenMutationsBefore = new Set([
          ...(this.state.discoveries?.mutations ?? []),
          ...(this.state.historicalTraits ?? []),
        ]),
        passiveEffectFloor = this.state.nextPassiveEffect ?? 1,
        next = transition(this.state, action);
      if (next === this.state) return false;
      const newPassiveEffects = (next.passiveEffects ?? [])
          .filter((effect) => effect.id >= passiveEffectFloor)
          .map((effect) => ({
            ...effect,
            owner:
              ownersBeforeTransition.get(effect.pieceId) ??
              next.pieces.find((piece) => piece.id === effect.pieceId)?.owner ??
              activeOwner,
            repeatedMutation:
              !!effect.trait && seenMutationsBefore.has(effect.trait),
          })),
        pendingConway = this.domainTimer;
      this.domainTimer = null;
      this.cancel();
      if (pendingConway !== null) this.clearTimer(pendingConway);
      this.pendingMovementTrace = next.movementTrace ?? null;
      next.movementTrace = null;
      const previous = this.state;
      this.state = next;
      this.onTransition(previous, next, action);

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
      if (this.mode !== "auto")
        for (const effect of newPassiveEffects) this.toast(effect);
      return true;
    } catch (error) {
      this.report(error.message);
      return false;
    }
  }
  scheduleAutomaticAction(action, delay = this.aiDelay) {
    const state = this.state,
      token = ++this.generation,
      revision = state.revision;
    this.job = {
      token,
      worker: null,
      timer: null,
      delayTimer: null,
      ready: true,
      action,
    };
    this.job.timer = this.setTimer(() => {
      if (
        this.job?.token !== token ||
        this.generation !== token ||
        this.state.revision !== revision
      )
        return;
      this.cancel();
      this.dispatch({ ...action, revision }, { ai: true });
    }, delay);
  }
  schedule() {
    const state = this.state;
    if (
      this.job ||
      this.domainTimer !== null ||
      this.paused ||
      state.result
    )
      return;
    if (this.mode === "auto" && state.notices.length) {
      this.scheduleAutomaticAction({
        type: "ACK_NOTICE",
        id: state.notices[0].id,
      });
      return;
    }
    if (state.notices.length) return;
    if (this.mode === "auto" && state.phase === "origin") {
      this.scheduleAutomaticAction({ type: "ORIGIN_CLICK" });
      return;
    }
    const aiTurn =
      this.mode === "auto" ||
      (this.mode === "single" && state.current === "amber");
    if (!aiTurn) return;
    const token = ++this.generation,
      revision = state.revision;
    const commit = (action) => {
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
    const finish = (action, force = false) => {
      if (
        this.job?.token !== token ||
        this.generation !== token ||
        this.state.revision !== revision
      )
        return;
      this.job.action = action;
      if (force || this.job.ready) commit(action);
    };
    this.job = {
      token,
      worker: null,
      timer: null,
      delayTimer: null,
      ready: false,
      action: undefined,
    };
    this.job.timer = this.setTimer(() => finish(null, true), this.timeout);
    this.job.delayTimer = this.setTimer(() => {
      if (
        this.job?.token !== token ||
        this.generation !== token ||
        this.state.revision !== revision
      )
        return;
      this.job.ready = true;
      if (this.job.action !== undefined) commit(this.job.action);
    }, this.aiDelay);
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
  }
  dispose() {
    this.cancel();
    this.paused = true;
  }
}
