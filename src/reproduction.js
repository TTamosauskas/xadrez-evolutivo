import {
  BIRTH_RATES,
  PIECES,
  TRAITS,
  has,
  inside,
  square,
  OWNERS,
} from "./constants.js";
import {
  at,
  random,
  pick,
  shuffle,
  newPiece,
  round,
  log,
  notice,
} from "./state.js";
const NEGATIVE = ["Esterilidade", "Mutação Deletéria", "Mutação Disfuncional"];
const POSITIVE = Object.keys(TRAITS).filter((t) => !NEGATIVE.includes(t));
function mutation(state, p, positiveOnly) {
  const gains = [];
  for (let rank = p.rank + 1; rank < 6; rank++) gains.push({ rank });
  for (const trait of POSITIVE) if (!has(p, trait)) gains.push({ gain: trait });
  const losses = [];
  if (p.rank > 0) losses.push({ rank: p.rank - 1 });
  for (const trait of p.traits)
    if (trait !== "Esterilidade") losses.push({ loss: trait });
  for (const trait of NEGATIVE)
    if (!has(p, trait)) losses.push({ gain: trait });
  const negative =
    !positiveOnly && random(state) < (p.rank === 0 ? 1 / 5 : 1 / 3);
  let options = negative ? losses : gains;
  if (!options.length) options = positiveOnly ? [] : negative ? gains : losses;
  const choice = pick(state, options);
  if (!choice) return;
  let label;
  if (choice.rank !== undefined) {
    p.rank = choice.rank;
    label = `Mutação de peça: ${PIECES[p.rank]}`;
  } else if (choice.gain) {
    p.traits.push(choice.gain);
    label = choice.gain;
  } else {
    p.traits = p.traits.filter((t) => t !== choice.loss);
    label = `Perda de ${choice.loss}`;
  }
  p.mutations++;
  if (!state.seenMutations.includes(label)) {
    state.seenMutations.push(label);
    notice(state, "Novas mutações", [label]);
  }
  log(state, `${OWNERS[p.owner]}: ${label}.`);
}
function sexualProfile(state, a, b) {
  const pool = [...new Set([...a.traits, ...b.traits])].filter(
    (t) => t !== "Esterilidade",
  );
  const target = Math.min(
    pool.length,
    Math.round((a.traits.length + b.traits.length) / 2),
  );
  let takeA = Math.floor(target / 2),
    takeB = target - takeA;
  if (target % 2 && random(state) < 0.5) [takeA, takeB] = [takeB, takeA];
  const traits = [
    ...new Set([
      ...shuffle(state, a.traits).slice(0, takeA),
      ...shuffle(state, b.traits).slice(0, takeB),
    ]),
  ];
  traits.push(
    ...shuffle(
      state,
      pool.filter((t) => !traits.includes(t)),
    ).slice(0, Math.max(0, target - traits.length)),
  );
  // These two later specializations have their own established inheritance rule.
  for (const t of ["Coletor", "Camuflagem"]) {
    const index = traits.indexOf(t);
    if (index >= 0) traits.splice(index, 1);
    if (
      (has(a, t) && has(b, t)) ||
      ((has(a, t) || has(b, t)) && random(state) < 0.5)
    )
      traits.push(t);
  }
  return {
    rank: Math.max(a.rank, b.rank),
    traits,
    mutations: Math.max(a.mutations, b.mutations),
  };
}
export function reproduce(ctx, parent, mate = null, reason = "casa fértil") {
  const state = ctx.state;
  if (has(parent, "Esterilidade") || (mate && has(mate, "Esterilidade")))
    return 0;
  const profile = mate ? sexualProfile(state, parent, mate) : parent;
  const range = has(profile, "Ovos") ? 2 : 1,
    cells = [];
  for (let dr = -range; dr <= range; dr++)
    for (let dc = -range; dc <= range; dc++) {
      const r = parent.r + dr,
        c = parent.c + dc;
      if (
        (dr || dc) &&
        inside(r, c) &&
        !at(state, r, c) &&
        !ctx.reserved.has(square(r, c))
      )
        cells.push({ r, c });
    }
  const wanted =
    BIRTH_RATES[profile.rank] * (has(profile, "Fertilidade") ? 2 : 1);
  let born = 0;
  for (const target of shuffle(state, cells)) {
    if (born >= wanted || state.pieces.length >= 64) break;
    // Recheck occupancy at the actual insertion boundary, including death effects.
    if (
      at(state, target.r, target.c) ||
      ctx.reserved.has(square(target.r, target.c))
    )
      continue;
    const child = newPiece(state, parent.owner, target.r, target.c, {
      ...profile,
      generation: Math.max(parent.generation, mate?.generation ?? 0) + 1,
      parentId: parent.id,
    });
    if (random(state) < (state.event?.id === "solar" ? 1 : 1 / 3))
      mutation(state, child, !!mate);
    if (has(child, "Mutação Deletéria"))
      child.deleteriousDue = Math.max(1, Math.ceil(state.turn / 2)) + 3;
    state.pieces.push(child);
    state.maxGenerationReached = Math.max(
      state.maxGenerationReached,
      child.generation,
    );
    born++;
  }
  if (born) {
    state.reproductions[parent.owner]++;
    log(
      state,
      `${OWNERS[parent.owner]} geraram ${born} descendente(s) por ${reason}.`,
    );
  }
  return born;
}
export function harvest(state, p, r, c) {
  if (!has(p, "Coletor") || state.board[square(r, c)] !== "fertile") return;
  let count = 0;
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if (inside(r + dr, c + dc)) {
        const i = square(r + dr, c + dc);
        if (state.board[i] === "fertile") {
          state.board[i] = "neutral";
          count++;
        }
      }
  p.seeds += count;
  log(state, `${OWNERS[p.owner]}: Coletor recolheu ${count} semente(s).`);
}
export function scatterSeeds(state, p) {
  if (!has(p, "Coletor") || !p.seeds) return;
  const cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if ((dr || dc) && inside(p.r + dr, p.c + dc))
        cells.push(square(p.r + dr, p.c + dc));
  let remaining = p.seeds;
  for (const i of [square(p.r, p.c), ...shuffle(state, cells)])
    if (remaining > 0 && state.board[i] === "neutral") {
      state.board[i] = "fertile";
      remaining--;
    }
}
