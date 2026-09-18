import { legalActions } from "./moves.js";
import { simulate } from "./engine.js";
import { has, other, square } from "./constants.js";
import { eggAt } from "./state.js";
export function fallbackAction(state) {
  const actions = legalActions(state);
  return (
    actions.sort((a, b) => priority(state, b) - priority(state, a))[0] ?? {
      type: "PASS",
    }
  );
}
function priority(state, a) {
  if (a.type === "PARTNER")
    return state.pieces.find((p) => p.id === a.id).rank * 2;
  if (a.type === "BUILD") return 3;
  if (a.type === "SKIP_BUILD") return 0;
  const p = state.pieces.find((p) => p.id === a.id),
    victim = state.pieces.find(
      (p) => p.r === a.r && p.c === a.c && p.owner !== state.current,
    ),
    egg = eggAt(state, a.r, a.c);
  return (
    (state.board[square(a.r, a.c)] === "fertile" &&
    (!has(p, "Carnívoro") || has(p, "Onívoro"))
      ? 8
      : 0) +
    (victim ? 4 + victim.rank : 0) +
    (egg && egg.owner !== state.current ? 4 + egg.brood.length : 0) -
    (state.board[square(a.r, a.c)] === "hostile" && !has(p, "Dormência")
      ? 8
      : 0)
  );
}
function evaluate(state, owner) {
  if (state.result)
    return state.result.winner === owner
      ? 100000
      : state.result.winner
        ? -100000
        : 0;
  const pieces = state.pieces.reduce(
      (n, p) =>
        n +
        (p.owner === owner ? 1 : -1) *
          (12 +
            p.rank * 2 +
            p.traits.length +
            (p.infection ? -6 : 0) +
            Math.min(3, p.seeds) +
            Math.min(
              4,
              (p.pregnancies ?? []).reduce(
                (sum, pregnancy) => sum + pregnancy.brood.length,
                0,
              ),
            )),
      0,
    ),
    eggs = state.eggs.reduce(
      (n, egg) =>
        n +
        (egg.owner === owner ? 1 : -1) * (4 + Math.min(4, egg.brood.length)),
      0,
    );
  return pieces + eggs;
}
/** Bounded search runs only inside a worker. The UI has its own independent timeout. */
export function chooseAction(
  state,
  difficulty = "medium",
  { now = () => performance.now(), budget = 180, maxNodes = 300 } = {},
) {
  const actions = legalActions(state).sort(
    (a, b) => priority(state, b) - priority(state, a),
  );
  if (!actions.length) return { type: "PASS" };
  const cortexAvailable = actions.some(
    (action) =>
      action.type === "MOVE" &&
      has(
        state.pieces.find((piece) => piece.id === action.id),
        "Neocórtex Desenvolvido",
      ),
  );
  if (difficulty === "easy" && !cortexAvailable)
    return actions[(state.rng >>> 0) % Math.min(actions.length, 3)];
  const deadline = now() + budget,
    owner = state.current;
  let best = actions[0],
    score = -Infinity,
    nodes = 0;
  for (const action of actions) {
    if (nodes >= maxNodes || now() > deadline) break;
    const next = simulate(state, action);
    nodes++;
    let value = evaluate(next, owner);
    const actor =
      action.type === "MOVE"
        ? state.pieces.find((piece) => piece.id === action.id)
        : null;
    if (
      (difficulty === "hard" || has(actor, "Neocórtex Desenvolvido")) &&
      !next.result
    ) {
      const replies = legalActions(next)
        .sort((a, b) => priority(next, b) - priority(next, a))
        .slice(0, 8);
      let replyScore = next.current === other(owner) ? Infinity : -Infinity;
      for (const reply of replies) {
        if (nodes >= maxNodes || now() > deadline) break;
        const v = evaluate(simulate(next, reply), owner);
        nodes++;
        replyScore =
          next.current === other(owner)
            ? Math.min(replyScore, v)
            : Math.max(replyScore, v);
      }
      if (Number.isFinite(replyScore)) value = replyScore;
    }
    value += priority(state, action) * 0.1;
    if (value > score) {
      score = value;
      best = action;
    }
  }
  return best;
}
