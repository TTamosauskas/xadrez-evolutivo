import { legalActions } from "./moves.js";
import { simulate } from "./engine.js";
import { has, other, square } from "./constants.js";
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
  const p = state.pieces.find((p) => p.id === a.id),
    victim = state.pieces.find(
      (p) => p.r === a.r && p.c === a.c && p.owner !== state.current,
    );
  return (
    (state.board[square(a.r, a.c)] === "fertile" ? 8 : 0) +
    (victim ? 4 + victim.rank : 0) -
    (state.board[square(a.r, a.c)] === "hostile" && !has(p, "Voo") ? 8 : 0)
  );
}
function evaluate(state, owner) {
  if (state.result)
    return state.result.winner === owner
      ? 100000
      : state.result.winner
        ? -100000
        : 0;
  return state.pieces.reduce(
    (n, p) =>
      n +
      (p.owner === owner ? 1 : -1) *
        (12 +
          p.rank * 2 +
          p.traits.length +
          (p.infection ? -6 : 0) +
          Math.min(3, p.seeds)),
    0,
  );
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
  if (difficulty === "easy")
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
    if (difficulty === "hard" && !next.result) {
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
