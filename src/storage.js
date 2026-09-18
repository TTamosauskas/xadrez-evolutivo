import { createState, newPiece, assertState, round, notice } from "./state.js";
import { TRAITS, EVENTS, PIECES, square, has } from "./constants.js";
import {
  normalizeReproGenes,
  syncReproTraits,
} from "./reproductive-genetics.js";
export const SAVE_KEY = "xadrez-evolutivo-save-v2";
export const LEGACY_KEY = "xadrez-evolutivo-save";
const traitName = (name) => (name === "Predação" ? "Predador" : name);
const mutationLabel = (label) =>
  label === "Predação"
    ? "Predador"
    : label === "Perda de Predação"
      ? "Perda de Predador"
      : label;
function historicalMutations(data) {
  const valid = new Set([
      ...Object.keys(TRAITS),
      ...Object.keys(TRAITS).map((t) => `Perda de ${t}`),
      ...PIECES.map((p) => `Mutação de peça: ${p}`),
    ]),
    seen = new Set(
      Array.isArray(data.seenMutations)
        ? data.seenMutations.map(mutationLabel).filter((m) => valid.has(m))
        : [],
    );
  for (const notice of data.notices ?? [])
    if (notice?.title === "Novas mutações")
      for (const line of notice.lines ?? []) {
        const label = mutationLabel(line);
        if (valid.has(label)) seen.add(label);
      }
  for (const entry of data.logs ?? []) {
    const text = entry?.text ?? entry?.msg;
    if (typeof text !== "string") continue;
    const colon = text.indexOf(": "),
      label = mutationLabel(
        (colon >= 0 ? text.slice(colon + 2) : text).replace(/\.$/, ""),
      );
    if (valid.has(label)) seen.add(label);
  }
  return [...seen];
}
const terrain = (t) =>
  t === "biohazard"
    ? "hostile"
    : ["neutral", "fertile", "hostile"].includes(t)
      ? t
      : "neutral";
export function deserialize(raw) {
  if (typeof raw !== "string" || raw.length > 2000000)
    throw Error("Arquivo de partida inválido.");
  const data = JSON.parse(raw);
  if (data?.version === 2) {
    const normalizeProfile = (profile) => {
      profile.traits = [...new Set((profile.traits ?? []).map(traitName))];
      profile.reproGenes = normalizeReproGenes(
        profile.reproGenes,
        profile.traits,
      );
      syncReproTraits(profile);
      return profile;
    };
    if (Array.isArray(data.pieces))
      for (const piece of data.pieces) {
        normalizeProfile(piece);
        piece.pregnancies = Array.isArray(piece.pregnancies)
          ? piece.pregnancies.map((pregnancy) => ({
              ...pregnancy,
              brood: (pregnancy.brood ?? []).map(normalizeProfile),
            }))
          : [];
      }
    data.eggs = Array.isArray(data.eggs)
      ? data.eggs.map((egg) => ({
          ...egg,
          brood: (egg.brood ?? []).map(normalizeProfile),
        }))
      : [];
    data.nextEgg = Number.isInteger(data.nextEgg)
      ? data.nextEgg
      : Math.max(0, ...data.eggs.map((egg) => egg.id ?? 0)) + 1;
    if (data.manipulation === undefined) data.manipulation = null;
    data.seenMutations = historicalMutations(data);
    const liveMax = Array.isArray(data.pieces)
      ? Math.max(0, ...data.pieces.map((p) => p.generation ?? 0))
      : 0;
    data.maxGenerationReached = Math.max(
      Number.isInteger(data.maxGenerationReached)
        ? data.maxGenerationReached
        : 0,
      liveMax,
    );
    if (!Number.isInteger(data.era) || data.era < 1) data.era = 1;
    if (!Number.isInteger(data.generationOffset) || data.generationOffset < 0)
      data.generationOffset = 0;
    if (!Number.isInteger(data.nextHabitatGeneration)) {
      data.nextHabitatGeneration = 3;
      while (data.nextHabitatGeneration <= data.maxGenerationReached)
        data.nextHabitatGeneration += 2;
    }
    if (!Number.isInteger(data.nextEventGeneration)) {
      data.nextEventGeneration = 4;
      while (data.nextEventGeneration <= data.maxGenerationReached)
        data.nextEventGeneration += 6;
    }
    if (!Number.isInteger(data.pendingEcologicalEvents))
      data.pendingEcologicalEvents = 0;
    if (!Array.isArray(data.deathSites)) data.deathSites = [];
    if (!Array.isArray(data.fertileTraces)) data.fertileTraces = [];
    data.fertileTraces = data.fertileTraces.map((trace) => ({
      ...trace,
      base: ["neutral", "fertile", "hostile"].includes(trace.base)
        ? trace.base
        : "neutral",
    }));
    delete data.nextEventRound;
    return assertState(data);
  }
  if (
    !data ||
    !Array.isArray(data.organisms) ||
    !Array.isArray(data.board) ||
    data.board.length !== 8
  )
    throw Error("Formato de partida desconhecido.");
  if (data.gameOver)
    throw Error("Esta partida antiga já terminou. Inicie uma nova partida.");
  const state = createState(1);
  state.pieces = [];
  state.turn = data.turn;
  state.current = data.current;
  state.board = data.board.flat().map((c) => terrain(c.terrain));
  state.reproductions = {
    blue: data.reproCount?.blue ?? 0,
    amber: data.reproCount?.amber ?? 0,
  };
  for (const org of data.organisms) {
    const profile = data.lineages?.[org.owner]?.[org.lineage];
    if (!profile) throw Error("Linhagem ausente no arquivo antigo.");
    const traits = new Set(
      (profile.traits ?? []).map(traitName).filter((t) => TRAITS[t]),
    );
    for (const entry of profile.mutationStack ?? []) {
      const name = traitName(entry.name);
      if (entry.kind === "trait" && TRAITS[name]) traits.add(name);
      if (entry.kind === "trait-loss") traits.delete(name);
    }
    for (const [key, name] of [
      ["sterile", "Esterilidade"],
      ["sexual", "Reprodução Sexuada"],
      ["resistance", "Resistência"],
    ])
      if (profile[key]) traits.add(name);
    const p = newPiece(state, org.owner, org.r, org.c, {
      rank: profile.pieceRank ?? 0,
      traits: [...traits],
      mutations: profile.mutationStack?.length ?? 0,
    });
    p.id = org.id;
    p.pawnDir =
      org.pawnDir === 1 || org.pawnDir === -1 ? org.pawnDir : p.pawnDir;
    p.seeds = org.collectorSeeds ?? 0;
    if (Number.isInteger(org.dysfunctionalLastMoveRound))
      p.lastMoveRound = org.dysfunctionalLastMoveRound;
    if (Number.isInteger(org.collectorStationaryUsedTurn))
      p.seedUsedTurn = org.collectorStationaryUsedTurn;
    if (has(p, "Mutação Deletéria"))
      p.deleteriousDue =
        Math.max(round(state), org.deleteriousStartRound ?? round(state)) +
        (org.deleteriousRemaining ?? 3);
    if (org.venomPoison)
      p.venom = {
        remaining: org.venomPoison.remaining,
        infectedTurn: org.venomPoison.infectedAtTurn ?? state.turn,
      };
    state.pieces.push(p);
  }
  state.nextId = Math.max(0, ...state.pieces.map((p) => p.id)) + 1;
  const oldEvent = data.ecoCycle?.active;
  if (oldEvent) {
    const def = EVENTS.find((e) => e.id === oldEvent.id);
    if (!def) throw Error("Evento do arquivo antigo incompatível.");
    state.event = {
      ...def,
      startRound: oldEvent.startRound,
      hazards: (oldEvent.hazardCells ?? []).map((k) => {
        const [r, c] = k.split(",").map(Number);
        return square(r, c);
      }),
      snapshots: Object.fromEntries(
        (oldEvent.snapshots ?? []).map((c) => [
          square(c.r, c.c),
          terrain(c.terrain),
        ]),
      ),
      bottom: oldEvent.corner?.includes("bottom") ?? false,
      right: oldEvent.corner?.includes("right") ?? false,
      rows: oldEvent.rowDepth ?? 1,
      cols: oldEvent.colDepth ?? 1,
      cap: oldEvent.fertileCap ?? 1,
      initial: oldEvent.initialFertile ?? 1,
    };
  }
  state.previousEvent = data.ecoCycle?.previousId ?? null;
  state.maxGenerationReached = Math.max(
    0,
    ...state.pieces.map((p) => p.generation),
  );
  while (state.nextHabitatGeneration <= state.maxGenerationReached)
    state.nextHabitatGeneration += 2;
  while (state.nextEventGeneration <= state.maxGenerationReached)
    state.nextEventGeneration += 6;
  const diseaseIds = new Map();
  for (const org of data.organisms) {
    const inf = org.ecoSick ?? org.overpopSick;
    if (!inf) continue;
    const key = inf.diseaseId ?? (org.ecoSick ? "eco" : "population");
    let d = diseaseIds.get(key);
    if (!d) {
      const source = data.pathogenDiseases?.[key] ?? {};
      const outbreak = Object.values(data.overpopulationPathogen ?? {}).find(
        (p) => p?.pathogenDiseaseId === key,
      );
      const remaining = org.ecoSick
        ? oldEvent?.pathogenRemaining
        : outbreak?.remaining;
      d = {
        id: state.nextDisease++,
        source: org.ecoSick ? "eco" : "population",
        triggerOwner: outbreak?.triggerOwner ?? null,
        mode: org.ecoSick
          ? (oldEvent?.pathogenMode ?? "omnidirectional")
          : (outbreak?.mode ?? "omnidirectional"),
        startRound: round(state),
        endRound: round(state) + (remaining ?? 0),
        delay: source.lethalDelay ?? inf.diseaseDelay ?? 3,
        mortality: source.mortalityPercent ?? inf.mortalityPercent ?? 100,
        infected: source.mortalityInfectedIds ?? [],
        survivors: source.mortalitySurvivorIds ?? [],
        deaths: source.mortalityDeaths ?? 0,
      };
      diseaseIds.set(key, d);
      state.diseases.push(d);
    }
    const p = state.pieces.find((p) => p.id === org.id);
    p.infection = {
      disease: d.id,
      due: round(state) + (inf.deathRemaining ?? inf.remaining ?? d.delay),
    };
    if (!d.infected.includes(p.id)) d.infected.push(p.id);
  }
  state.logs = (data.logs ?? [])
    .slice(0, 150)
    .map((l) => ({ turn: state.turn, text: l.msg ?? l.text ?? "" }));
  state.seenMutations = historicalMutations(data);
  notice(state, "Partida importada", [
    "Posições, características e contadores foram convertidos. A jogada atual recomeça na fase de movimento. O arquivo antigo continua preservado.",
  ]);
  return assertState(state);
}
export function save(storage, state) {
  assertState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
export function load(storage) {
  const raw = storage.getItem(SAVE_KEY) ?? storage.getItem(LEGACY_KEY);
  if (!raw) throw Error("Nenhuma partida salva neste navegador.");
  return deserialize(raw);
}
