import { inside, square, TRAITS, EVENTS } from "./constants.js";
import {
  GEOLOGICAL_STAGES,
  currentGeologicalStage,
  nextGeologicalStage,
  geologicalLabel,
  habitatProfile,
  recordHistoricalTraits,
  stageComplete,
} from "./geology.js";
import {
  cloneDiscoveries,
  recordDiscovery,
  validDiscoveries,
} from "./discoveries.js";
import {
  cloneReproGenes,
  normalizeReproGenes,
  reproGeneSignature,
  syncReproTraits,
  validReproGenes,
} from "./reproductive-genetics.js";
export const clone = (value) => structuredClone(value);
export function random(state) {
  state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
  return state.rng / 4294967296;
}
export const pick = (state, items) =>
  items.length ? items[Math.floor(random(state) * items.length)] : null;
export function shuffle(state, items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const at = (state, r, c) =>
  state.pieces.find((p) => p.r === r && p.c === c);
export const eggAt = (state, r, c) =>
  state.eggs?.find((egg) => egg.r === r && egg.c === c);
export const plantSeedAt = (state, r, c) =>
  state.plantSeeds?.find((seed) => seed.r === r && seed.c === c);
export const builtBarrierAt = (state, r, c) =>
  state.barriers?.includes(square(r, c)) ?? false;
export const naturalBarrierAt = (state, r, c) =>
  state.naturalBarriers?.includes(square(r, c)) ?? false;
export const barrierAt = (state, r, c) =>
  builtBarrierAt(state, r, c) || naturalBarrierAt(state, r, c);
export const terrain = (state, r, c) => state.board[square(r, c)];
export const round = (state) => Math.floor(state.turn / 2);
export const juvenile = (state, piece) =>
  !!piece &&
  Number.isInteger(piece.maturesRound) &&
  round(state) < piece.maturesRound;
export const reproductionReady = (state, piece) =>
  !!piece &&
  !juvenile(state, piece) &&
  !(piece.traits ?? []).includes("Esterilidade") &&
  !(piece.pregnancies ?? []).some(
    (pregnancy) => pregnancy.kind === "ovoviviparous",
  ) &&
  round(state) >= (piece.nextReproductionRound ?? 0);
export function log(state, text) {
  state.logs.unshift({ turn: state.turn, text });
  state.logs.length = Math.min(state.logs.length, 160);
}
export function notice(state, title, lines, key = null) {
  if (key && state.seen.includes(key)) return;
  if (key) state.seen.push(key);
  const pending = state.notices.find((n) => n.title === title);
  if (pending) {
    for (const line of lines)
      if (!pending.lines.includes(line)) pending.lines.push(line);
  } else
    state.notices.push({
      id: state.nextNotice++,
      title,
      lines: [...new Set(lines)],
    });
}
export function newPiece(state, owner, r, c, source = {}) {
  const bornRound = round(state),
    piece = {
    id: state.nextId++,
    owner,
    r,
    c,
    rank: source.rank ?? 0,
    traits: [...(source.traits ?? [])],
    ancestry: [
      ...new Set([...(source.ancestry ?? []), ...(source.traits ?? [])]),
    ],
    reproGenes: cloneReproGenes(
      source.reproGenes ?? normalizeReproGenes(null, source.traits ?? []),
    ),
    mutations: source.mutations ?? 0,
    generation: source.generation ?? 0,
    parentId: source.parentId ?? null,
    pawnDir: owner === "blue" ? -1 : 1,
    seeds: 0,
    pregnancies: [],
    bornRound: source.bornRound ?? bornRound,
    maturesRound: source.maturesRound ?? bornRound,
    nextReproductionRound: source.nextReproductionRound ?? bornRound,
  };
  return syncReproTraits(piece);
}

export function registerDiscoveries(state, piece) {
  const added = recordHistoricalTraits(state, piece);
  if (!added.length) return added;
  for (const trait of added)
    recordDiscovery(state, "mutations", trait);
  return added;
}

const ORTHOGONAL = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

function connectedOpenFraction(blocked) {
  const open = Array.from({ length: 64 }, (_, cell) => cell).filter(
    (cell) => !blocked.has(cell),
  );
  if (!open.length) return 0;
  const seen = new Set([open[0]]),
    queue = [open[0]];
  while (queue.length) {
    const cell = queue.shift(),
      r = Math.floor(cell / 8),
      c = cell % 8;
    for (const [dr, dc] of ORTHOGONAL) {
      const rr = r + dr,
        cc = c + dc,
        next = square(rr, cc);
      if (
        inside(rr, cc) &&
        !blocked.has(next) &&
        !seen.has(next)
      ) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size / open.length;
}

function seedNaturalBarriers(state) {
  const [min = 0, max = min] =
      habitatProfile(state).naturalBarriers ?? [0, 0],
    target = min + Math.floor(random(state) * (max - min + 1)),
    protectedCells = new Set(),
    founders = [
      ...state.pieces.map((piece) => ({ r: piece.r, c: piece.c })),
      ...(state.origin ? [{ r: state.origin.r, c: state.origin.c }] : []),
    ];
  for (const founder of founders)
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const r = founder.r + dr,
          c = founder.c + dc;
        if (inside(r, c)) protectedCells.add(square(r, c));
      }
  const barriers = new Set(),
    all = Array.from({ length: 64 }, (_, cell) => cell).filter(
      (cell) => !protectedCells.has(cell),
    );
  let attempts = 0;
  while (barriers.size < target && attempts++ < 256) {
    const clustered =
        barriers.size > 0 && random(state) < 0.72
          ? all.filter((cell) => {
              const r = Math.floor(cell / 8),
                c = cell % 8;
              return [...barriers].some((other) => {
                const rr = Math.floor(other / 8),
                  cc = other % 8;
                return Math.max(Math.abs(r - rr), Math.abs(c - cc)) === 1;
              });
            })
          : [],
      pool = (clustered.length ? clustered : all).filter(
        (cell) => !barriers.has(cell),
      ),
      cell = pick(state, pool);
    if (cell === null) break;
    const proposed = new Set(barriers);
    proposed.add(cell);
    if (connectedOpenFraction(proposed) < 0.8) continue;
    barriers.add(cell);
  }
  state.naturalBarriers = [...barriers].sort((a, b) => a - b);
}

function seedHabitat(state) {
  const profile = habitatProfile(state);
  state.board.fill("neutral");
  const founderCells = new Set([
    ...state.pieces.map((p) => square(p.r, p.c)),
    ...(state.origin ? [square(state.origin.r, state.origin.c)] : []),
  ]);
  if (profile.standard) {
    const empty = shuffle(
      state,
      Array.from({ length: 64 }, (_, i) => i).filter(
        (i) => !founderCells.has(i) && !state.naturalBarriers.includes(i),
      ),
    );
    for (const i of empty.slice(0, profile.fertile)) state.board[i] = "fertile";
    const safe = new Set([3, 4, 11, 12, 51, 52, 59, 60]);
    for (const i of empty
      .filter((i) => !safe.has(i) && state.board[i] === "neutral")
      .slice(0, profile.hostile))
      state.board[i] = "hostile";
    for (const c of [3, 4]) {
      for (let r = 1; r <= 6; r++)
        if (terrain(state, r, c) === "fertile")
          state.board[square(r, c)] = "neutral";
      for (const rows of [
        [1, 2, 3],
        [4, 5, 6],
      ]) {
        const candidates = rows.filter(
          (r) =>
            terrain(state, r, c) === "neutral" &&
            !naturalBarrierAt(state, r, c),
        );
        const fallback = rows.filter(
          (r) => !naturalBarrierAt(state, r, c),
        );
        const chosen = pick(
          state,
          candidates.length ? candidates : fallback,
        );
        if (chosen !== null) state.board[square(chosen, c)] = "fertile";
      }
    }
    const mobileFounder = state.pieces.some(
      (piece) =>
        piece.traits.includes("Locomoção") ||
        piece.traits.includes("Locomoção Avançada"),
    );
    if (!mobileFounder)
      for (const cell of founderCells) state.board[cell] = "fertile";
    return;
  }

  if (profile.founderFertile)
    for (const cell of founderCells) state.board[cell] = "fertile";
  const fertileNeeded = Math.max(
    0,
    profile.fertile - state.board.filter((t) => t === "fertile").length,
  );
  const fertileCandidates = shuffle(
    state,
    Array.from({ length: 64 }, (_, i) => i).filter(
      (i) =>
        state.board[i] === "neutral" &&
        !state.naturalBarriers.includes(i),
    ),
  );
  for (const cell of fertileCandidates.slice(0, fertileNeeded))
    state.board[cell] = "fertile";
  const hostileCandidates = shuffle(
    state,
    Array.from({ length: 64 }, (_, i) => i).filter(
      (i) =>
        state.board[i] === "neutral" &&
        !founderCells.has(i) &&
        !state.naturalBarriers.includes(i),
    ),
  );
  for (const cell of hostileCandidates.slice(0, profile.hostile))
    state.board[cell] = "hostile";
}
export function createState(seed = Date.now(), options = {}) {
  const founder = options.founder ?? null,
    founders = options.founders ?? null,
    originPrelude = !!options.originPrelude,
    canonicalPair = !!options.canonicalPair;
  const state = {
    version: 7,
    rng: seed >>> 0,
    revision: 0,
    turn: 0,
    current: "blue",
    phase: originPrelude ? "origin" : "move",
    origin: null,
    chain: null,
    partner: null,
    manipulation: null,
    building: null,
    eggPlacement: null,
    domesticPlacement: null,
    socialDefense: null,
    nextId: 1,
    nextNotice: 1,
    board: Array(64).fill("neutral"),
    pieces: [],
    reproductions: { blue: 0, amber: 0 },
    notices: [],
    seen: [],
    seenMutations: [],
    historicalTraits: [...(options.historicalTraits ?? [])],
    discoveries: cloneDiscoveries(options.discoveries),
    logs: [],
    event: null,
    previousEvent: null,
    geologicalStage: options.geologicalStage ?? "archean",
    cycle: options.cycle ?? 1,
    totalCycles: options.totalCycles ?? 1,
    generationOffset: options.generationOffset ?? 0,
    maxGenerationReached: 0,
    nextHabitatGeneration: 3,
    nextEventGeneration: 4,
    pendingEcologicalEvents: 0,
    conwayWatchUntil: null,
    deathSites: [],
    fertileTraces: [],
    diseases: [],
    nextDisease: 1,
    nextEgg: 1,
    eggs: [],
    nextPlantSeed: 1,
    plantSeeds: [],
    barriers: [],
    naturalBarriers: [],
    populationLatched: { blue: false, amber: false },
    result: null,
  };
  if (originPrelude) {
    const cell = pick(state, [27, 28, 35, 36]);
    state.origin = {
      r: Math.floor(cell / 8),
      c: cell % 8,
      selected: false,
    };
  } else {
    const starts = canonicalPair
      ? [
          ["blue", 7, 4],
          ["amber", 0, 4],
        ]
      : [
          ["blue", 7, 3],
          ["blue", 7, 4],
          ["amber", 0, 3],
          ["amber", 0, 4],
        ];
    for (const [owner, r, c] of starts) {
      const source = founders?.[owner] ?? founder;
      state.pieces.push(
        newPiece(
          state,
          owner,
          r,
          c,
          source
            ? {
                rank: source.rank,
                traits: source.traits,
                ancestry: source.ancestry,
                reproGenes: source.reproGenes,
                mutations: 0,
                generation: 0,
              }
            : {},
        ),
      );
    }
  }
  if (options.naturalBarriers !== false) seedNaturalBarriers(state);
  seedHabitat(state);
  recordDiscovery(state, "geology", state.geologicalStage);
  log(
    state,
    originPrelude
      ? "Origem da campanha: o ancestral comum aguarda a separação das linhagens."
      : `${geologicalLabel(state)} · ${state.cycle}º Ciclo começa com um organismo de cada lado.`,
  );
  return state;
}

export function createCampaignState(seed = Date.now()) {
  return createState(seed, { originPrelude: true });
}

export function activateOrigin(state) {
  if (state.phase !== "origin" || !state.origin)
    throw Error("Origem indisponível.");
  if (!state.origin.selected) {
    state.origin.selected = true;
    return false;
  }
  const clearOfNaturalBarriers = (r, c) =>
      state.naturalBarriers.every((cell) => {
        const rr = Math.floor(cell / 8),
          cc = cell % 8;
        return Math.max(Math.abs(r - rr), Math.abs(c - cc)) > 1;
      }),
    candidates = [];
  for (let r = 4; r <= 7; r++)
    for (let c = 0; c < 8; c++) {
      const opposite = square(7 - r, 7 - c),
        oppositeR = 7 - r,
        oppositeC = 7 - c;
      if (
        square(r, c) !== square(state.origin.r, state.origin.c) &&
        opposite !== square(state.origin.r, state.origin.c) &&
        clearOfNaturalBarriers(r, c) &&
        clearOfNaturalBarriers(oppositeR, oppositeC)
      )
        candidates.push({ r, c });
    }
  const blue = pick(state, candidates),
    amber = { r: 7 - blue.r, c: 7 - blue.c };
  state.pieces.push(
    newPiece(state, "blue", blue.r, blue.c, { rank: 4 }),
    newPiece(state, "amber", amber.r, amber.c, { rank: 4 }),
  );
  state.board[square(blue.r, blue.c)] = "fertile";
  state.board[square(amber.r, amber.c)] = "fertile";
  state.origin = null;
  state.phase = "move";
  log(
    state,
    `${geologicalLabel(state)} · 1º Ciclo começa com a separação do ancestral comum em dois Reis fundadores.`,
  );
  return true;
}
export function signature(p) {
  const ancestry = [...(p.ancestry ?? p.traits ?? [])].sort().join("|");
  return `${p.rank}|${[...p.traits].sort().join("|")}|${ancestry}|${reproGeneSignature(p.reproGenes)}`;
}
export function dominantLineage(state, owner = null, predicate = null) {
  const pieces = state.pieces.filter(
      (piece) =>
        (!owner || piece.owner === owner) &&
        (!predicate || predicate(piece)),
    ),
    groups = new Map();
  for (const piece of pieces) {
    const key = signature(piece),
      group = groups.get(key);
    if (group) group.count++;
    else groups.set(key, { piece, count: 1 });
  }
  const selected = [...groups.values()].sort(
    (a, b) =>
      b.count - a.count ||
      b.piece.generation - a.piece.generation ||
      signature(a.piece).localeCompare(signature(b.piece), "pt-BR"),
  )[0];
  return selected
    ? { ...selected, total: pieces.length }
    : { piece: null, count: 0, total: pieces.length };
}
function founderProfile(previous, piece) {
  if (!piece) return null;
  const excluded = new Set(["Esterilidade", "Mutação Deletéria"]);
  return {
    rank: piece.rank,
    traits: piece.traits.filter((trait) => !excluded.has(trait)),
    ancestry: [
      ...new Set([...(piece.ancestry ?? piece.traits ?? []), ...piece.traits]),
    ],
    reproGenes: cloneReproGenes(piece.reproGenes),
  };
}

export function createSuccessorState(previous, seed = Date.now()) {
  const winner = previous.result?.winner ?? null,
    selected = dominantLineage(previous, winner),
    founder = founderProfile(previous, selected.piece),
    founderIsPhotosynthetic = founder?.traits.includes("Fotossíntese") ?? false,
    counterpart = dominantLineage(
      previous,
      null,
      founderIsPhotosynthetic
        ? (piece) => !piece.traits.includes("Fotossíntese")
        : (piece) => piece.traits.includes("Fotossíntese"),
    ),
    companion =
      counterpart.piece &&
      (!selected.piece ||
        signature(counterpart.piece) !== signature(selected.piece))
        ? founderProfile(previous, counterpart.piece)
        : null,
    primaryOwner = ["blue", "amber"].includes(winner) ? winner : "blue",
    companionOwner = primaryOwner === "blue" ? "amber" : "blue",
    founders =
      founder && companion
        ? { [primaryOwner]: founder, [companionOwner]: companion }
        : null,
    priorStage = currentGeologicalStage(previous),
    candidate = stageComplete(previous)
      ? nextGeologicalStage(priorStage.id)
      : priorStage,
    advanced = candidate.id !== priorStage.id,
    geologicalStage = candidate.id,
    cycle = advanced ? 1 : previous.cycle + 1,
    totalCycles = previous.totalCycles + 1,
    generationOffset =
      previous.generationOffset + previous.maxGenerationReached + 1;
  const state = createState(seed, {
    geologicalStage,
    cycle,
    totalCycles,
    generationOffset,
    historicalTraits: previous.historicalTraits,
    discoveries: previous.discoveries,
    founder,
    founders,
    canonicalPair: true,
  });
  if (companion)
    log(
      state,
      founderIsPhotosynthetic
        ? "Dupla fundadora: 🏆🟢 a linhagem dominante fotossintética segue adiante junto da linhagem não fotossintética mais bem-sucedida."
        : "Dupla fundadora: 🏆 a linhagem dominante segue adiante junto da 🟢 linhagem fotossintética mais bem-sucedida.",
    );
  log(
    state,
    advanced
      ? `Transição Evolutiva: inicia-se ${candidate.group} · ${candidate.period}.`
      : `A vida persiste em ${candidate.period}; inicia-se o ${cycle}º Ciclo.`,
  );
  return state;
}
export function summary(state, owner) {
  const pieces = state.pieces.filter((p) => p.owner === owner),
    profiles = new Map(pieces.map((p) => [signature(p), p]));
  return {
    pieces: pieces.length,
    generations: state.reproductions[owner],
    mutations: [...profiles.values()].reduce((n, p) => n + p.mutations, 0),
    lineages: profiles.size,
  };
}
export function assertState(state) {
  const integer = (n, min = 0, max = Number.MAX_SAFE_INTEGER) =>
      Number.isSafeInteger(n) && n >= min && n <= max,
    validBroodProfile = (profile, owner = null) =>
      !!profile &&
      (!owner || profile.owner === owner) &&
      ["blue", "amber"].includes(profile.owner) &&
      integer(profile.rank, 0, 5) &&
      Array.isArray(profile.traits) &&
      profile.traits.every((t) => TRAITS[t]) &&
      (profile.ancestry === undefined ||
        (Array.isArray(profile.ancestry) &&
          profile.ancestry.every((t) => TRAITS[t]) &&
          new Set(profile.ancestry).size === profile.ancestry.length)) &&
      validReproGenes(profile.reproGenes) &&
      integer(profile.mutations) &&
      integer(profile.generation);
  if (!state || typeof state !== "object") throw Error("Partida inválida.");
  if (
    !integer(state.revision) ||
    !integer(state.nextNotice, 1) ||
    !integer(state.nextDisease, 1) ||
    !integer(state.nextEgg, 1) ||
    !integer(state.nextPlantSeed, 1) ||
    !GEOLOGICAL_STAGES.some((stage) => stage.id === state.geologicalStage) ||
    !integer(state.cycle, 1) ||
    !integer(state.totalCycles, 1) ||
    state.totalCycles < state.cycle ||
    !integer(state.generationOffset) ||
    !integer(state.maxGenerationReached) ||
    !integer(state.nextHabitatGeneration, 3) ||
    !integer(state.nextEventGeneration, 4) ||
    !integer(state.pendingEcologicalEvents) ||
    !(
      state.conwayWatchUntil === null ||
      integer(state.conwayWatchUntil, state.turn)
    ) ||
    !Array.isArray(state.seen) ||
    !Array.isArray(state.seenMutations) ||
    state.seenMutations.some((m) => typeof m !== "string") ||
    !Array.isArray(state.historicalTraits) ||
    state.historicalTraits.some((trait) => !TRAITS[trait]) ||
    new Set(state.historicalTraits).size !== state.historicalTraits.length ||
    !validDiscoveries(state.discoveries) ||
    !Array.isArray(state.deathSites) ||
    !Array.isArray(state.fertileTraces) ||
    !Array.isArray(state.eggs) ||
    !Array.isArray(state.plantSeeds) ||
    !Array.isArray(state.barriers) ||
    state.barriers.some((cell) => !integer(cell, 0, 63)) ||
    new Set(state.barriers).size !== state.barriers.length ||
    !Array.isArray(state.naturalBarriers) ||
    state.naturalBarriers.some((cell) => !integer(cell, 0, 63)) ||
    new Set(state.naturalBarriers).size !== state.naturalBarriers.length ||
    state.naturalBarriers.some((cell) => state.barriers.includes(cell)) ||
    state.fertileTraces.some(
      (t) =>
        !integer(t.cell, 0, 63) ||
        !integer(t.clearAfterTurn) ||
        !["neutral", "fertile", "hostile"].includes(t.base),
    ) ||
    state.deathSites.some(
      (d) =>
        !integer(d.cell, 0, 63) ||
        !integer(d.dueRound, 1) ||
        !["neutral", "fertile", "hostile"].includes(d.base),
    ) ||
    new Set(state.deathSites.map((d) => d.cell)).size !== state.deathSites.length ||
    !(
      state.eggPlacement === null ||
      (state.eggPlacement &&
        state.eggPlacement.kind === "amniote" &&
        integer(state.eggPlacement.parentId, 1) &&
        ["blue", "amber"].includes(state.eggPlacement.owner) &&
        inside(state.eggPlacement.origin?.r, state.eggPlacement.origin?.c) &&
        Array.isArray(state.eggPlacement.brood) &&
        state.eggPlacement.brood.length > 0 &&
        ["local", "spores"].includes(state.eggPlacement.dispersal))
    ) ||
    state.seen.some((s) => typeof s !== "string")
  )
    throw Error("Metadados inválidos.");
  if (
    !state.reproductions ||
    !["blue", "amber"].every(
      (o) =>
        integer(state.reproductions[o]) &&
        typeof state.populationLatched?.[o] === "boolean",
    )
  )
    throw Error("Contadores inválidos.");

  if (
    state.version !== 7 ||
    !Array.isArray(state.board) ||
    state.board.length !== 64 ||
    !state.board.every((t) => ["neutral", "fertile", "hostile"].includes(t))
  )
    throw Error("Tabuleiro inválido.");
  if (
    !["blue", "amber"].includes(state.current) ||
    !Number.isInteger(state.turn) ||
    state.turn < 0 ||
    !Number.isInteger(state.rng)
  )
    throw Error("Turno inválido.");
  if (
    ![
      "origin",
      "move",
      "partner",
      "manipulate",
      "build",
      "egg-placement",
      "domestic-placement",
      "social-defense",
      "over",
    ].includes(state.phase)
  )
    throw Error("Fase inválida.");
  if (
    state.origin !== null &&
    (!state.origin ||
      !inside(state.origin.r, state.origin.c) ||
      typeof state.origin.selected !== "boolean")
  )
    throw Error("Origem inválida.");
  if (
    (state.phase === "origin" && (!state.origin || state.pieces.length)) ||
    (state.phase !== "origin" && state.origin)
  )
    throw Error("Fase de origem inválida.");
  if (
    (state.phase === "egg-placement" && !state.eggPlacement) ||
    (state.phase !== "egg-placement" && state.eggPlacement)
  )
    throw Error("Fase de postura inválida.");
  if (
    (state.phase === "domestic-placement" && !state.domesticPlacement) ||
    (state.phase !== "domestic-placement" && state.domesticPlacement)
  )
    throw Error("Fase de domesticação inválida.");
  if (
    state.domesticPlacement &&
    (!integer(state.domesticPlacement.parentId, 1) ||
      !["blue", "amber"].includes(state.domesticPlacement.owner) ||
      !inside(
        state.domesticPlacement.origin?.r,
        state.domesticPlacement.origin?.c,
      ) ||
      !Array.isArray(state.domesticPlacement.brood) ||
      !state.domesticPlacement.brood.length ||
      !state.domesticPlacement.brood.every((profile) =>
        validBroodProfile(profile, state.domesticPlacement.owner),
      ))
  )
    throw Error("Domesticação inválida.");
  if (
    (state.phase === "social-defense" && !state.socialDefense) ||
    (state.phase !== "social-defense" && state.socialDefense)
  )
    throw Error("Fase de Sociabilidade inválida.");
  if (
    state.socialDefense &&
    (!integer(state.socialDefense.attackerId, 1) ||
      !integer(state.socialDefense.victimId, 1) ||
      !["blue", "amber"].includes(state.socialDefense.attackerOwner) ||
      !Array.isArray(state.socialDefense.memberIds) ||
      state.socialDefense.memberIds.length < 4 ||
      state.socialDefense.memberIds.some((id) => !integer(id, 1)))
  )
    throw Error("Sociabilidade inválida.");
  if (!Array.isArray(state.pieces) || state.pieces.length > 64)
    throw Error("População inválida.");
  const ids = new Set(),
    cells = new Set();
  for (const p of state.pieces) {
    if (
      !Number.isInteger(p.id) ||
      ids.has(p.id) ||
      !inside(p.r, p.c) ||
      cells.has(square(p.r, p.c)) ||
      (state.naturalBarriers.includes(square(p.r, p.c)) &&
        !p.traits?.includes("Escalador") &&
        !p.traits?.includes("Trepadeira")) ||
      (state.barriers.includes(square(p.r, p.c)) &&
        !p.traits?.includes("Trepadeira"))
    )
      throw Error("Ocupação inválida.");
    if (
      !["blue", "amber"].includes(p.owner) ||
      !Number.isInteger(p.rank) ||
      p.rank < 0 ||
      p.rank > 5 ||
      !Array.isArray(p.traits) ||
      p.traits.some((t) => !TRAITS[t]) ||
      !Array.isArray(p.ancestry) ||
      p.ancestry.some((t) => !TRAITS[t]) ||
      new Set(p.ancestry).size !== p.ancestry.length ||
      !validReproGenes(p.reproGenes) ||
      !Array.isArray(p.pregnancies)
    )
      throw Error("Peça inválida.");
    if (
      !integer(p.mutations) ||
      !integer(p.seeds) ||
      !integer(p.generation) ||
      !integer(p.bornRound) ||
      !integer(p.maturesRound) ||
      !integer(p.nextReproductionRound) ||
      ![1, -1].includes(p.pawnDir) ||
      (p.regenerationUsed !== undefined &&
        typeof p.regenerationUsed !== "boolean") ||
      (p.regenerationRestThroughRound !== undefined &&
        !integer(p.regenerationRestThroughRound)) ||
      (p.photosynthesisCell !== undefined &&
        !integer(p.photosynthesisCell, 0, 63)) ||
      (p.photosynthesisSinceTurn !== undefined &&
        !integer(p.photosynthesisSinceTurn))
    )
      throw Error("Perfil inválido.");
    ids.add(p.id);
    cells.add(square(p.r, p.c));
  }
  const eggIds = new Set();
  for (const egg of state.eggs) {
    const cell = square(egg.r, egg.c);
    if (
      !integer(egg.id, 1) ||
      eggIds.has(egg.id) ||
      !["blue", "amber"].includes(egg.owner) ||
      !inside(egg.r, egg.c) ||
      cells.has(cell) ||
      !integer(egg.laidRound) ||
      !integer(egg.hatchRound, egg.laidRound + 1) ||
      !integer(egg.expireRound, egg.hatchRound) ||
      !["basal", "amniote", "ovoviviparous"].includes(egg.mode) ||
      (egg.mode === "basal" && egg.expireRound !== egg.laidRound + 6) ||
      (egg.mode !== "basal" && egg.expireRound !== egg.hatchRound) ||
      (egg.parentId !== undefined && egg.parentId !== null && !integer(egg.parentId, 1)) ||
      !["local", "spores"].includes(egg.dispersal) ||
      !Array.isArray(egg.brood) ||
      !egg.brood.length ||
      !egg.brood.every((profile) => validBroodProfile(profile, egg.owner))
    )
      throw Error("Ovo inválido.");
    eggIds.add(egg.id);
    cells.add(cell);
  }
  if (state.nextEgg <= Math.max(0, ...eggIds))
    throw Error("Identificadores de ovos inválidos.");

  const plantSeedIds = new Set(),
    plantSeedCells = new Set();
  for (const seed of state.plantSeeds) {
    const cell = square(seed.r, seed.c);
    if (
      !integer(seed.id, 1) ||
      plantSeedIds.has(seed.id) ||
      !["blue", "amber"].includes(seed.owner) ||
      !inside(seed.r, seed.c) ||
      !integer(seed.movesRemaining, 0, 3) ||
      !validBroodProfile(seed.profile, seed.owner) ||
      plantSeedCells.has(cell) ||
      ((state.barriers.includes(cell) ||
        state.naturalBarriers.includes(cell)) &&
        !seed.profile.traits.includes("Trepadeira"))
    )
      throw Error("Semente vegetal inválida.");
    plantSeedIds.add(seed.id);
    plantSeedCells.add(cell);
  }
  if (state.nextPlantSeed <= Math.max(0, ...plantSeedIds))
    throw Error("Identificadores de sementes vegetais inválidos.");
  const eggCells = new Set(state.eggs.map((egg) => square(egg.r, egg.c)));
  if (
    state.barriers.some(
      (cell) =>
        state.naturalBarriers.includes(cell) ||
        eggCells.has(cell),
    ) ||
    state.naturalBarriers.some((cell) => eggCells.has(cell)) ||
    (state.origin &&
      (state.naturalBarriers.includes(square(state.origin.r, state.origin.c)) ||
        state.barriers.includes(square(state.origin.r, state.origin.c))))
  )
    throw Error("Barreira sobreposta.");

  for (const p of state.pieces)
    for (const pregnancy of p.pregnancies)
      if (
        !integer(pregnancy.dueRound) ||
        ![undefined, "viviparous", "ovoviviparous"].includes(pregnancy.kind) ||
        (pregnancy.readyLogged !== undefined &&
          typeof pregnancy.readyLogged !== "boolean") ||
        !["local", "spores"].includes(pregnancy.dispersal) ||
        !Array.isArray(pregnancy.brood) ||
        !pregnancy.brood.length ||
        !pregnancy.brood.every((profile) =>
          validBroodProfile(profile, p.owner),
        )
      )
        throw Error("Gestação inválida.");
  if (!Number.isInteger(state.nextId) || state.nextId <= Math.max(0, ...ids))
    throw Error("Identificadores inválidos.");
  const unbornGenerations = [
    ...state.eggs.flatMap((egg) => egg.brood.map((p) => p.generation)),
    ...state.plantSeeds.map((seed) => seed.profile.generation),
    ...(state.domesticPlacement?.brood ?? []).map((p) => p.generation),
    ...state.pieces.flatMap((p) =>
      p.pregnancies.flatMap((pregnancy) =>
        pregnancy.brood.map((child) => child.generation),
      ),
    ),
  ];
  if (
    state.maxGenerationReached <
    Math.max(0, ...state.pieces.map((p) => p.generation), ...unbornGenerations)
  )
    throw Error("Geração histórica inválida.");
  if (
    state.chain &&
    !state.pieces.some((p) => p.id === state.chain && p.owner === state.current)
  )
    throw Error("Locomoção inválida.");
  if (
    state.phase === "partner" &&
    (!state.partner ||
      !state.pieces.some(
        (p) => p.id === state.partner.id && p.owner === state.current,
      ))
  )
    throw Error("Parceiro inválido.");
  if (
    state.phase === "manipulate" &&
    (!state.manipulation ||
      !state.pieces.some(
        (p) =>
          p.id === state.manipulation.id && p.owner === state.current,
      ) ||
      !integer(state.manipulation.origin, 0, 63) ||
      !["fertile", "hostile"].includes(state.manipulation.terrain) ||
      typeof state.manipulation.second !== "boolean" ||
      typeof state.manipulation.locomotion !== "boolean")
  )
    throw Error("Manipulação inválida.");
  if (state.phase !== "manipulate" && state.manipulation)
    throw Error("Manipulação fora de fase.");
  if (
    state.phase === "build" &&
    (!state.building ||
      !state.pieces.some(
        (p) => p.id === state.building.id && p.owner === state.current,
      ) ||
      typeof state.building.second !== "boolean" ||
      typeof state.building.locomotion !== "boolean")
  )
    throw Error("Construção inválida.");
  if (state.phase !== "build" && state.building)
    throw Error("Construção fora de fase.");

  if (
    !Array.isArray(state.notices) ||
    !Array.isArray(state.diseases) ||
    !Array.isArray(state.logs)
  )
    throw Error("Registro inválido.");
  if (
    state.logs.length > 160 ||
    state.logs.some((l) => !integer(l.turn) || typeof l.text !== "string") ||
    state.notices.length > 100 ||
    state.notices.some(
      (n) =>
        !integer(n.id, 1) ||
        typeof n.title !== "string" ||
        !Array.isArray(n.lines) ||
        n.lines.some((l) => typeof l !== "string"),
    )
  )
    throw Error("Mensagem inválida.");
  if (state.notices.some((n) => n.id >= state.nextNotice))
    throw Error("Sequência de avisos inválida.");
  const diseaseIds = new Set();
  for (const d of state.diseases) {
    if (
      !integer(d.id, 1) ||
      diseaseIds.has(d.id) ||
      d.id >= state.nextDisease ||
      !integer(d.startRound) ||
      !integer(d.endRound) ||
      !integer(d.delay, 2, 6) ||
      !integer(d.mortality, 60, 100) ||
      !integer(d.deaths) ||
      !["diagonal", "orthogonal", "omnidirectional"].includes(d.mode) ||
      !Array.isArray(d.infected) ||
      !Array.isArray(d.survivors)
    )
      throw Error("Doença inválida.");
    diseaseIds.add(d.id);
  }
  for (const p of state.pieces) {
    if (
      p.decompositionImmunity &&
      (!integer(p.decompositionImmunity.cell, 0, 63) ||
        !integer(p.decompositionImmunity.throughTurn))
    )
      throw Error("Imunidade de decomposição inválida.");
    if (
      p.infection &&
      (!diseaseIds.has(p.infection.disease) || !integer(p.infection.due))
    )
      throw Error("Infecção inválida.");
    if (
      p.venom &&
      (!integer(p.venom.remaining, 1, 2) || !integer(p.venom.infectedTurn))
    )
      throw Error("Veneno inválido.");
    if (p.traits.includes("Mutação Deletéria") && !integer(p.deleteriousDue))
      throw Error("Tempo de vida inválido.");
  }
  if (state.event) {
    const e = state.event;
    if (
      !EVENTS.some((x) => x.id === e.id) ||
      !integer(e.startRound) ||
      !Array.isArray(e.hazards) ||
      e.hazards.some((i) => !integer(i, 0, 63)) ||
      !e.snapshots ||
      Object.entries(e.snapshots).some(
        ([i, t]) =>
          !integer(Number(i), 0, 63) ||
          !["neutral", "fertile", "hostile"].includes(t),
      )
    )
      throw Error("Evento inválido.");
    if (
      (e.id === "ice" && (!integer(e.rows, 1, 8) || !integer(e.cols, 1, 8))) ||
      (e.id === "drought" && !integer(e.cap, 1, 64)) ||
      (e.id === "desert" && !integer(e.initial, 1, 64))
    )
      throw Error("Duração do evento inválida.");
  }
  if (
    (state.phase === "over" && !state.result) ||
    (state.result &&
      (!["blue", "amber", null].includes(state.result.winner) ||
        typeof state.result.reason !== "string" ||
        state.phase !== "over"))
  )
    throw Error("Resultado inválido.");

  return state;
}
