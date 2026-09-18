import { EVENTS, inside, square, has, distance } from "./constants.js";
import { at, pick, random, shuffle, round, log, notice } from "./state.js";
import { startDisease } from "./disease.js";
const allCells = () => Array.from({ length: 64 }, (_, i) => i);
const fertile = (state) =>
  allCells().filter((i) => state.board[i] === "fertile");
function seedCluster(state, type) {
  const candidates = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      for (const [dr, dc] of [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]) {
        const cells = [
          [r, c],
          [r + dr, c],
          [r, c + dc],
        ];
        if (cells.every(([rr, cc]) => inside(rr, cc) && !at(state, rr, cc)))
          candidates.push(cells.map(([rr, cc]) => square(rr, cc)));
      }
  const score = (cells) =>
    cells.reduce(
      (n, i) =>
        n +
        (state.board[i] === "neutral" ? 0 : state.board[i] === type ? 1 : 10),
      0,
    );
  const min = Math.min(...candidates.map(score)),
    chosen = pick(
      state,
      candidates.filter((c) => score(c) === min),
    );
  for (const i of chosen ?? []) state.board[i] = type;
}
export function advanceConway(ctx) {
  const state = ctx.state,
    event = state.event;
  // Evolve the underlying habitat, then reapply the temporary event overlay.
  if (event)
    for (const [i, base] of Object.entries(event.snapshots))
      state.board[Number(i)] = base;
  const before = [...state.board];
  const alive = (i, type) => {
    const r = Math.floor(i / 8),
      c = i % 8;
    let n = 0;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++)
        if (
          (dr || dc) &&
          inside(r + dr, c + dc) &&
          before[square(r + dr, c + dc)] === type
        )
          n++;
    return n === 3 || (before[i] === type && n === 2);
  };
  state.board = before.map((_, i) =>
    alive(i, "fertile")
      ? "fertile"
      : alive(i, "hostile")
        ? "hostile"
        : "neutral",
  );
  for (const type of ["fertile", "hostile"]) {
    if (!state.board.includes(type)) seedCluster(state, type);
    const unchanged =
      before.some((t) => t === type) &&
      before.every((t, i) => (t === type) === (state.board[i] === type));
    if (unchanged) {
      const options = [];
      for (const i of allCells().filter((i) => state.board[i] === type))
        for (let dr = -1; dr <= 1; dr++)
          for (let dc = -1; dc <= 1; dc++) {
            const r = Math.floor(i / 8) + dr,
              c = (i % 8) + dc;
            if (
              (dr || dc) &&
              inside(r, c) &&
              state.board[square(r, c)] === "neutral" &&
              !at(state, r, c)
            )
              options.push([i, square(r, c)]);
          }
      const move = pick(state, options);
      if (move) {
        state.board[move[0]] = "neutral";
        state.board[move[1]] = type;
      }
    }
  }
  if (event)
    for (const key of Object.keys(event.snapshots)) {
      const i = Number(key);
      event.snapshots[i] = state.board[i];
      state.board[i] = "hostile";
    }
  // Retain legacy Conway mortality; other hostile risk is resolved once per round.
  const doomed = state.pieces
    .filter(
      (p) =>
        state.board[square(p.r, p.c)] === "hostile" &&
        !has(p, "Voo") &&
        !event?.hazards.includes(square(p.r, p.c)),
    )
    .map((p) => p.id);
  for (const id of doomed) ctx.kill(id, "mudança do habitat por Conway");
}
function markHazard(state, event, indices) {
  for (const i of indices) {
    if (!Object.hasOwn(event.snapshots, i)) event.snapshots[i] = state.board[i];
    if (!event.hazards.includes(i)) event.hazards.push(i);
    state.board[i] = "hostile";
  }
}
function quadrant(q) {
  return allCells().filter(
    (i) => (Math.floor(i / 8) < 4 ? 0 : 2) + (i % 8 < 4 ? 0 : 1) === q,
  );
}
function trim(state, count) {
  for (const i of shuffle(state, fertile(state)).slice(Math.max(1, count)))
    state.board[i] = "neutral";
  if (!fertile(state).length) addFertile(state, 1);
}
function addFertile(state, count) {
  for (let n = 0; n < count; n++) {
    const empty = allCells().filter(
      (i) =>
        state.board[i] === "neutral" && !at(state, Math.floor(i / 8), i % 8),
    );
    if (!empty.length) break;
    const adjacent = empty.filter((i) =>
      fertile(state).some(
        (j) =>
          distance(
            { r: Math.floor(i / 8), c: i % 8 },
            { r: Math.floor(j / 8), c: j % 8 },
          ) === 1,
      ),
    );
    state.board[pick(state, adjacent.length ? adjacent : empty)] = "fertile";
  }
}
function iceCells(event) {
  return allCells().filter((i) => {
    const r = event.bottom ? 7 - Math.floor(i / 8) : Math.floor(i / 8),
      c = event.right ? 7 - (i % 8) : i % 8;
    return r < event.rows && c < event.cols;
  });
}
function earthquake(ctx) {
  const state = ctx.state,
    original = new Map(state.pieces.map((p) => [p.id, { r: p.r, c: p.c }])),
    assigned = new Map();
  const candidates = new Map(
    state.pieces.map((p) => [
      p.id,
      shuffle(
        state,
        allCells().filter(
          (i) => distance(p, { r: Math.floor(i / 8), c: i % 8 }) === 1,
        ),
      ),
    ]),
  );
  function assign(p, seen) {
    for (const i of candidates.get(p.id)) {
      if (seen.has(i)) continue;
      seen.add(i);
      const prior = assigned.get(i);
      if (!prior || assign(prior, seen)) {
        assigned.set(i, p);
        return true;
      }
    }
    return false;
  }
  // Include the original position only when an adjacent-only assignment fails.
  let success = true;
  for (const p of shuffle(state, state.pieces))
    if (!assign(p, new Set())) {
      success = false;
      break;
    }
  if (!success) {
    assigned.clear();
    for (const p of state.pieces) candidates.get(p.id).push(square(p.r, p.c));
    for (const p of state.pieces) assign(p, new Set());
  }
  if (assigned.size !== state.pieces.length)
    throw Error("Distribuição do terremoto inválida.");
  for (const [i, p] of assigned) {
    p.r = Math.floor(i / 8);
    p.c = i % 8;
  }
  for (const p of [...state.pieces])
    if (state.board[square(p.r, p.c)] === "hostile" && !has(p, "Voo"))
      ctx.kill(p.id, "Terremoto");
  return original.size;
}
function endEvent(state) {
  if (!state.event) return;
  for (const [i, t] of Object.entries(state.event.snapshots))
    state.board[Number(i)] = t;
  state.previousEvent = state.event.id;
  state.event = null;
}
export function startEvent(ctx, id = null) {
  const state = ctx.state;
  if (state.event) endEvent(state);
  const def = id
    ? EVENTS.find((e) => e.id === id)
    : pick(
        state,
        EVENTS.filter((e) => e.id !== state.previousEvent),
      );
  if (!def) throw Error("Evento inválido.");
  const event = {
    ...def,
    startRound: round(state),
    hazards: [],
    snapshots: {},
  };
  state.event = event;
  switch (event.id) {
    case "volcano": {
      const r = Math.floor(random(state) * 6),
        c = Math.floor(random(state) * 6);
      markHazard(
        state,
        event,
        allCells().filter(
          (i) =>
            Math.floor(i / 8) >= r &&
            Math.floor(i / 8) < r + 3 &&
            i % 8 >= c &&
            i % 8 < c + 3,
        ),
      );
      break;
    }
    case "ice":
      Object.assign(event, {
        bottom: random(state) < 0.5,
        right: random(state) < 0.5,
        rows: 1,
        cols: 1,
      });
      markHazard(state, event, iceCells(event));
      break;
    case "pathogen":
      startDisease(state);
      break;
    case "drought":
      event.cap = Math.max(1, Math.ceil(fertile(state).length / 2));
      trim(state, event.cap);
      break;
    case "sea":
      markHazard(
        state,
        event,
        allCells().filter(
          (i) => i < 8 || i >= 56 || i % 8 === 0 || i % 8 === 7,
        ),
      );
      break;
    case "meteor":
      markHazard(state, event, quadrant(Math.floor(random(state) * 4)));
      break;
    case "desert":
      event.initial = Math.max(1, fertile(state).length);
      trim(state, event.initial);
      break;
    case "blockade": {
      const anti = random(state) < 0.5;
      markHazard(
        state,
        event,
        allCells().filter(
          (i) => i % 8 === (anti ? 7 - Math.floor(i / 8) : Math.floor(i / 8)),
        ),
      );
      break;
    }
    case "abundance":
      addFertile(state, Math.max(1, fertile(state).length));
      break;
    case "fertilized":
      addFertile(state, 1);
      break;
    case "earthquake":
      earthquake(ctx);
      break;
    case "abundant-rains":
      for (const i of quadrant(Math.floor(random(state) * 4)))
        state.board[i] = "fertile";
      break;
    case "insularization": {
      const r = 1 + Math.floor(random(state) * 6),
        c = 1 + Math.floor(random(state) * 6);
      markHazard(
        state,
        event,
        allCells().filter((i) => Math.floor(i / 8) === r || i % 8 === c),
      );
      for (const p of [...state.pieces])
        if (event.hazards.includes(square(p.r, p.c)) && !has(p, "Voo"))
          ctx.kill(p.id, "Insularização");
      break;
    }
    case "alluvial-river": {
      const anti = random(state) < 0.5;
      for (const i of allCells())
        if (
          Math.abs(
            (i % 8) - (anti ? 7 - Math.floor(i / 8) : Math.floor(i / 8)),
          ) <= 1
        )
          state.board[i] = "fertile";
      break;
    }
  }
  notice(state, "Evento ecológico", [
    event.name,
    event.description,
    "Duração: dez rodadas completas.",
  ]);
  log(state, `${event.name}: ${event.description}`);
}
export function tickEnvironment(ctx) {
  const state = ctx.state,
    now = round(state);

  while (state.maxGenerationReached >= state.nextHabitatGeneration) {
    advanceConway(ctx);
    state.nextHabitatGeneration += 2;
  }
  while (state.maxGenerationReached >= state.nextEventGeneration) {
    state.pendingEcologicalEvents++;
    state.nextEventGeneration += 6;
  }

  if (state.event && now - state.event.startRound >= 10) endEvent(state);

  const event = state.event;
  if (event) {
    const age = now - event.startRound;
    if (event.id === "ice") {
      if (event.rows < 8 && (event.cols === 8 || random(state) < 0.5))
        event.rows++;
      else if (event.cols < 8) event.cols++;
      markHazard(state, event, iceCells(event));
    } else if (event.id === "drought") trim(state, event.cap);
    else if (event.id === "desert")
      trim(state, Math.max(1, Math.ceil((event.initial * (10 - age)) / 10)));
    else if (event.id === "fertilized") addFertile(state, 1);
    for (const i of event.hazards) state.board[i] = "hostile";
  } else if (state.pendingEcologicalEvents > 0) {
    state.pendingEcologicalEvents--;
    startEvent(ctx);
  }
}
