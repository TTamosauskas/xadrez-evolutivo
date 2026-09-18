import { inside, square, TRAITS, EVENTS } from "./constants.js";
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
export const terrain = (state, r, c) => state.board[square(r, c)];
export const round = (state) => Math.floor(state.turn / 2);
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
  const piece = {
    id: state.nextId++,
    owner,
    r,
    c,
    rank: source.rank ?? 0,
    traits: [...(source.traits ?? [])],
    reproGenes: cloneReproGenes(
      source.reproGenes ?? normalizeReproGenes(null, source.traits ?? []),
    ),
    mutations: source.mutations ?? 0,
    generation: source.generation ?? 0,
    parentId: source.parentId ?? null,
    pawnDir: owner === "blue" ? -1 : 1,
    seeds: 0,
    pregnancies: [],
    bornRound: round(state),
  };
  return syncReproTraits(piece);
}
export function createState(seed = Date.now(), options = {}) {
  const founder = options.founder ?? null;
  const state = {
    version: 2,
    rng: seed >>> 0,
    revision: 0,
    turn: 0,
    current: "blue",
    phase: "move",
    chain: null,
    partner: null,
    manipulation: null,
    nextId: 1,
    nextNotice: 1,
    board: Array(64).fill("neutral"),
    pieces: [],
    reproductions: { blue: 0, amber: 0 },
    notices: [],
    seen: [],
    seenMutations: [],
    logs: [],
    event: null,
    previousEvent: null,
    era: options.era ?? 1,
    generationOffset: options.generationOffset ?? 0,
    maxGenerationReached: 0,
    nextHabitatGeneration: 3,
    nextEventGeneration: 4,
    pendingEcologicalEvents: 0,
    deathSites: [],
    fertileTraces: [],
    diseases: [],
    nextDisease: 1,
    nextEgg: 1,
    eggs: [],
    populationLatched: { blue: false, amber: false },
    result: null,
  };
  for (const [owner, r] of [
    ["blue", 7],
    ["amber", 0],
  ])
    for (const c of [3, 4])
      state.pieces.push(
        newPiece(state, owner, r, c, founder
          ? {
              rank: founder.rank,
              traits: founder.traits,
              reproGenes: founder.reproGenes,
              mutations: 0,
              generation: 0,
            }
          : {}),
      );
  const empty = shuffle(
    state,
    Array.from({ length: 64 }, (_, i) => i).filter(
      (i) => !at(state, Math.floor(i / 8), i % 8),
    ),
  );
  for (const i of empty.slice(0, 14)) state.board[i] = "fertile";
  const safe = new Set([3, 4, 11, 12, 51, 52, 59, 60]);
  for (const i of empty
    .filter((i) => !safe.has(i) && state.board[i] === "neutral")
    .slice(0, 7))
    state.board[i] = "hostile";
  for (const c of [3, 4]) {
    for (let r = 1; r <= 6; r++)
      if (terrain(state, r, c) === "fertile")
        state.board[square(r, c)] = "neutral";
    for (const rows of [
      [1, 2, 3],
      [4, 5, 6],
    ]) {
      const candidates = rows.filter((r) => terrain(state, r, c) === "neutral");
      state.board[
        square(pick(state, candidates.length ? candidates : rows), c)
      ] = "fertile";
    }
  }
  log(state, "A partida começa com dois organismos de cada lado.");
  return state;
}
export function signature(p) {
  return `${p.rank}|${[...p.traits].sort().join("|")}|${reproGeneSignature(
    p.reproGenes,
  )}`;
}
export function dominantLineage(state, owner = null) {
  const pieces = owner
      ? state.pieces.filter((p) => p.owner === owner)
      : state.pieces,
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
export function createSuccessorState(previous, seed = Date.now()) {
  const selected = dominantLineage(previous, previous.result?.winner ?? null),
    excluded = new Set(["Esterilidade", "Mutação Deletéria"]),
    founder = selected.piece
      ? {
          rank: selected.piece.rank,
          traits: selected.piece.traits.filter((t) => !excluded.has(t)),
          reproGenes: cloneReproGenes(selected.piece.reproGenes),
        }
      : null,
    era = previous.era + 1,
    generationOffset =
      previous.generationOffset + previous.maxGenerationReached + 1;
  const state = createState(seed, { era, generationOffset, founder });
  log(
    state,
    founder
      ? `A ${era}ª Era começa com a linhagem sobrevivente da Era anterior.`
      : `A ${era}ª Era começa após uma extinção em massa.`,
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
      validReproGenes(profile.reproGenes) &&
      integer(profile.mutations) &&
      integer(profile.generation);
  if (!state || typeof state !== "object") throw Error("Partida inválida.");
  if (
    !integer(state.revision) ||
    !integer(state.nextNotice, 1) ||
    !integer(state.nextDisease, 1) ||
    !integer(state.nextEgg, 1) ||
    !integer(state.era, 1) ||
    !integer(state.generationOffset) ||
    !integer(state.maxGenerationReached) ||
    !integer(state.nextHabitatGeneration, 3) ||
    !integer(state.nextEventGeneration, 4) ||
    !integer(state.pendingEcologicalEvents) ||
    !Array.isArray(state.seen) ||
    !Array.isArray(state.seenMutations) ||
    state.seenMutations.some((m) => typeof m !== "string") ||
    !Array.isArray(state.deathSites) ||
    !Array.isArray(state.fertileTraces) ||
    !Array.isArray(state.eggs) ||
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
    state.version !== 2 ||
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
  if (!["move", "partner", "manipulate", "over"].includes(state.phase))
    throw Error("Fase inválida.");
  if (!Array.isArray(state.pieces) || state.pieces.length > 64)
    throw Error("População inválida.");
  const ids = new Set(),
    cells = new Set();
  for (const p of state.pieces) {
    if (
      !Number.isInteger(p.id) ||
      ids.has(p.id) ||
      !inside(p.r, p.c) ||
      cells.has(square(p.r, p.c))
    )
      throw Error("Ocupação inválida.");
    if (
      !["blue", "amber"].includes(p.owner) ||
      !Number.isInteger(p.rank) ||
      p.rank < 0 ||
      p.rank > 5 ||
      !Array.isArray(p.traits) ||
      p.traits.some((t) => !TRAITS[t]) ||
      !validReproGenes(p.reproGenes) ||
      !Array.isArray(p.pregnancies)
    )
      throw Error("Peça inválida.");
    if (
      !integer(p.mutations) ||
      !integer(p.seeds) ||
      !integer(p.generation) ||
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
      !integer(egg.hatchRound) ||
      (egg.parentId !== undefined && egg.parentId !== null && !integer(egg.parentId, 1)) ||
      !["local", "eggs", "spores"].includes(egg.dispersal) ||
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
  for (const p of state.pieces)
    for (const pregnancy of p.pregnancies)
      if (
        !integer(pregnancy.dueRound) ||
        !["local", "eggs", "spores"].includes(pregnancy.dispersal) ||
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
