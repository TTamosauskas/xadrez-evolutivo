import { createState, newPiece, assertState, round, notice } from "./state.js";
import { TRAITS, EVENTS, PIECES, square, has } from "./constants.js";
import {
  normalizeReproGenes,
  syncReproTraits,
} from "./reproductive-genetics.js";
import {
  GEOLOGICAL_STAGES,
  firstCompatibleStage,
  geologicalStage,
  normalizeEnergyBranch,
  priorRequiredInnovations,
  isNegativeTrait,
} from "./geology.js";
import { legacyDiscoveries } from "./discoveries.js";
export const SAVE_KEY = "xadrez-evolutivo-save-v7";
export const V6_KEY = "xadrez-evolutivo-save-v6";
export const V5_KEY = "xadrez-evolutivo-save-v5";
export const V4_KEY = "xadrez-evolutivo-save-v4";
export const V3_KEY = "xadrez-evolutivo-save-v3";
export const V2_KEY = "xadrez-evolutivo-save-v2";
export const LEGACY_KEY = "xadrez-evolutivo-save";
const currentTraitName = (name) =>
  name === "Construção de Nicho"
    ? "Construtor de Nicho"
    : name === "Construtor Avançado"
      ? "Antropização"
      : name;
const v3TraitName = (name) =>
  currentTraitName(name === "Predador" ? "Carnívoro" : name);
const legacyTraitName = (name) =>
  currentTraitName(
    name === "Predador" || name === "Predação" ? "Carnívoro" : name,
  );
const v2TraitName = (name) =>
  name === "Locomoção" ? "Locomoção Avançada" : legacyTraitName(name);
const mutationLabel = (label, version = 7) => {
  let mapped = label;
  if (mapped === "Construção de Nicho") mapped = "Construtor de Nicho";
  if (mapped === "Perda de Construção de Nicho")
    mapped = "Perda de Construtor de Nicho";
  if (mapped === "Construtor Avançado") mapped = "Antropização";
  if (mapped === "Perda de Construtor Avançado")
    mapped = "Perda de Antropização";
  if (version <= 3) {
    if (mapped === "Predador") mapped = "Carnívoro";
    if (mapped === "Perda de Predador") mapped = "Perda de Carnívoro";
  }
  if (version <= 2) {
    if (mapped === "Predação") mapped = "Carnívoro";
    if (mapped === "Perda de Predação") mapped = "Perda de Carnívoro";
    if (mapped === "Locomoção") mapped = "Locomoção Avançada";
    if (mapped === "Perda de Locomoção") mapped = "Perda de Locomoção Avançada";
  }
  return mapped;
};
function historicalMutations(data, version = 7) {
  const valid = new Set([
      ...Object.keys(TRAITS),
      ...Object.keys(TRAITS).map((t) => `Perda de ${t}`),
      ...PIECES.map((p) => `Mutação de peça: ${p}`),
    ]),
    seen = new Set(
      Array.isArray(data.seenMutations)
        ? data.seenMutations
            .map((label) => mutationLabel(label, version))
            .filter((m) => valid.has(m))
        : [],
    );
  for (const notice of data.notices ?? [])
    if (notice?.title === "Novas mutações")
      for (const line of notice.lines ?? []) {
        const label = mutationLabel(line, version);
        if (valid.has(label)) seen.add(label);
      }
  for (const entry of data.logs ?? []) {
    const text = entry?.text ?? entry?.msg;
    if (typeof text !== "string") continue;
    const marked = text.startsWith("🧬 Nova mutação:")
        ? text.split(" · ").at(-1)
        : null,
      colon = text.indexOf(": "),
      label = mutationLabel(
        (marked ?? (colon >= 0 ? text.slice(colon + 2) : text)).replace(/\.$/, ""),
        version,
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
  if ([7, 6, 5, 4, 3, 2].includes(data?.version)) {
    const sourceVersion = data.version,
      legacyV2 = sourceVersion === 2,
      legacyV3 = sourceVersion === 3,
      normalizeProfile = (profile) => {
        const mapper = legacyV2
            ? v2TraitName
            : legacyV3
              ? v3TraitName
              : currentTraitName,
          traits = new Set((profile.traits ?? []).map(mapper));
        if (legacyV2) traits.add("Locomoção");
        if (sourceVersion < 4) traits.add("Predação");
        const validTraits = [...traits].filter((trait) => TRAITS[trait]),
          ancestry = new Set(
            (profile.ancestry ?? []).map(mapper).filter((trait) => TRAITS[trait]),
          );
        for (const trait of validTraits) ancestry.add(trait);
        profile.traits = normalizeEnergyBranch(validTraits);
        profile.ancestry = [...ancestry];
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
        const currentRound = Math.floor((data.turn ?? 0) / 2);
        if (!Number.isInteger(piece.bornRound)) piece.bornRound = currentRound;
        if (!Number.isInteger(piece.maturesRound))
          piece.maturesRound = currentRound;
        if (!Number.isInteger(piece.nextReproductionRound))
          piece.nextReproductionRound = currentRound;
        piece.pregnancies = Array.isArray(piece.pregnancies)
          ? piece.pregnancies.map((pregnancy) => ({
              ...pregnancy,
              kind:
                pregnancy.kind === "ovoviviparous"
                  ? "ovoviviparous"
                  : "viviparous",
              readyLogged:
                pregnancy.kind === "ovoviviparous"
                  ? !!pregnancy.readyLogged
                  : undefined,
              dispersal:
                pregnancy.dispersal === "spores" ? "spores" : "local",
              brood: (pregnancy.brood ?? []).map(normalizeProfile),
            }))
          : [];
      }
    data.eggs = Array.isArray(data.eggs)
      ? data.eggs.map((egg) => {
          const currentRound = Math.floor((data.turn ?? 0) / 2),
            mode = ["basal", "amniote", "ovoviviparous"].includes(egg.mode)
              ? egg.mode
              : "amniote",
            mobileBasal = mode === "basal",
            lifecycle =
              egg.lifecycle === "fixed" || egg.lifecycle === "mobile-basal"
                ? egg.lifecycle
                : mobileBasal
                  ? "mobile-basal"
                  : "fixed";
          if (lifecycle === "mobile-basal") {
            const hatchRound = Number.isInteger(egg.hatchRound)
                ? egg.hatchRound
                : currentRound + 3,
              laidRound = Number.isInteger(egg.laidRound)
                ? egg.laidRound
                : Math.max(0, hatchRound - 3);
            return {
              ...egg,
              mode: "basal",
              lifecycle,
              laidRound,
              hatchRound,
              expireRound: laidRound + 6,
              dispersal: egg.dispersal === "spores" ? "spores" : "local",
              brood: (egg.brood ?? []).map(normalizeProfile),
            };
          }
          const alreadyFixed = egg.lifecycle === "fixed",
            laidRound =
              alreadyFixed && Number.isInteger(egg.laidRound)
                ? egg.laidRound
                : currentRound,
            hatchRound =
              alreadyFixed && Number.isInteger(egg.hatchRound)
                ? Math.max(egg.hatchRound, laidRound + 1)
                : currentRound + 1;
          return {
            ...egg,
            mode: mode === "basal" ? "amniote" : mode,
            lifecycle: "fixed",
            laidRound,
            hatchRound,
            expireRound: hatchRound,
            dispersal: egg.dispersal === "spores" ? "spores" : "local",
            brood: (egg.brood ?? []).map(normalizeProfile),
          };
        })
      : [];
    data.nextEgg = Number.isInteger(data.nextEgg)
      ? data.nextEgg
      : Math.max(0, ...data.eggs.map((egg) => egg.id ?? 0)) + 1;
    data.plantSeeds = Array.isArray(data.plantSeeds)
      ? data.plantSeeds.map((seed) => ({
          ...seed,
          profile: normalizeProfile(seed.profile ?? {}),
          movesRemaining: Number.isInteger(seed.movesRemaining)
            ? Math.max(0, Math.min(3, seed.movesRemaining))
            : 3,
        }))
      : [];
    data.nextPlantSeed = Number.isInteger(data.nextPlantSeed)
      ? data.nextPlantSeed
      : Math.max(0, ...data.plantSeeds.map((seed) => seed.id ?? 0)) + 1;
    if (data.manipulation === undefined) data.manipulation = null;
    if (data.building === undefined) data.building = null;
    if (data.eggPlacement === undefined) data.eggPlacement = null;
    if (data.domesticPlacement === undefined) data.domesticPlacement = null;
    if (data.socialDefense === undefined) data.socialDefense = null;
    if (data.eggPlacement) {
      data.eggPlacement.brood = (data.eggPlacement.brood ?? []).map(
        normalizeProfile,
      );
      data.eggPlacement.dispersal =
        data.eggPlacement.dispersal === "spores" ? "spores" : "local";
    }
    if (data.domesticPlacement)
      data.domesticPlacement.brood = (
        data.domesticPlacement.brood ?? []
      ).map(normalizeProfile);
    if (data.origin === undefined) data.origin = null;
    if (!Array.isArray(data.barriers)) data.barriers = [];
    if (!Array.isArray(data.naturalBarriers)) data.naturalBarriers = [];
    data.naturalBarriers = [
      ...new Set(
        data.naturalBarriers.filter(
          (cell) =>
            Number.isInteger(cell) &&
            cell >= 0 &&
            cell < 64 &&
            !data.barriers.includes(cell),
        ),
      ),
    ];
    data.seenMutations = historicalMutations(data, sourceVersion);
    const liveMax = Math.max(
      0,
      ...(Array.isArray(data.pieces)
        ? data.pieces.map((p) => p.generation ?? 0)
        : []),
      ...data.plantSeeds.map((seed) => seed.profile?.generation ?? 0),
    );
    data.maxGenerationReached = Math.max(
      Number.isInteger(data.maxGenerationReached)
        ? data.maxGenerationReached
        : 0,
      liveMax,
    );
    if (legacyV2) {
      const profiles = [
          ...(data.pieces ?? []),
          ...(data.eggs ?? []).flatMap((egg) => egg.brood ?? []),
          ...(data.plantSeeds ?? []).map((seed) => seed.profile),
          ...(data.pieces ?? []).flatMap((piece) =>
            (piece.pregnancies ?? []).flatMap(
              (pregnancy) => pregnancy.brood ?? [],
            ),
          ),
        ],
        observed = new Set([
          ...profiles.flatMap((profile) => profile.traits ?? []),
          ...data.seenMutations.filter((label) => TRAITS[label]),
        ]);
      observed.delete("Esterilidade");
      observed.delete("Mutação Deletéria");
      observed.delete("Mutação Disfuncional");
      let stage = firstCompatibleStage(observed);
      if (stage.index < geologicalStage("cambrian").index)
        stage = geologicalStage("cambrian");
      data.geologicalStage = stage.id;
      data.cycle = 1;
      data.totalCycles =
        Number.isInteger(data.era) && data.era > 0 ? data.era : 1;
      data.historicalTraits = [
        ...new Set([
          ...priorRequiredInnovations(stage.id),
          ...[...observed].filter((trait) => !isNegativeTrait(trait)),
        ]),
      ];
      delete data.era;
    }
    if (legacyV3) {
      data.historicalTraits = [
        ...new Set(
          (data.historicalTraits ?? [])
            .map(v3TraitName)
            .filter((trait) => TRAITS[trait]),
        ),
      ];
    }
    if (sourceVersion < 4 && !data.historicalTraits.includes("Predação"))
      data.historicalTraits.push("Predação");
    if (!Number.isInteger(data.cycle) || data.cycle < 1) data.cycle = 1;
    if (!Number.isInteger(data.totalCycles) || data.totalCycles < data.cycle)
      data.totalCycles = data.cycle;
    if (!Array.isArray(data.historicalTraits)) data.historicalTraits = [];
    data.historicalTraits = [
      ...new Set(
        data.historicalTraits
          .map(currentTraitName)
          .filter((trait) => TRAITS[trait]),
      ),
    ];
    if (data.discoveries) {
      data.discoveries.mutations = [
        ...new Set(
          (data.discoveries.mutations ?? [])
            .map(currentTraitName)
            .filter((id) => id !== "Ovos"),
        ),
      ];
      data.discoveries.read = [
        ...new Set(
          (data.discoveries.read ?? [])
            .map((key) =>
              key === "mutations:Construção de Nicho"
                ? "mutations:Construtor de Nicho"
                : key === "mutations:Construtor Avançado"
                  ? "mutations:Antropização"
                  : key,
            )
            .filter((key) => key !== "mutations:Ovos"),
        ),
      ];
    }
    data.notices = (data.notices ?? [])
      .map((entry) =>
        entry?.title === "Novas mutações"
          ? {
              ...entry,
              lines: (entry.lines ?? [])
                .map((label) => mutationLabel(label, sourceVersion))
                .filter(
                  (label) => label !== "Ovos" && label !== "Perda de Ovos",
                ),
            }
          : entry,
      )
      .filter(
        (entry) => entry?.title !== "Novas mutações" || entry.lines.length,
      );
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
    if (
      data.conwayWatchUntil !== null &&
      !Number.isInteger(data.conwayWatchUntil)
    )
      data.conwayWatchUntil = null;
    if (data.conwayWatchUntil === undefined) data.conwayWatchUntil = null;
    if (!Array.isArray(data.deathSites)) data.deathSites = [];
    data.notices = (data.notices ?? []).filter(
      (entry) => entry?.title !== "Marco Evolutivo",
    );
    if (!Array.isArray(data.fertileTraces)) data.fertileTraces = [];
    data.fertileTraces = data.fertileTraces.map((trace) => ({
      ...trace,
      base: ["neutral", "fertile", "hostile"].includes(trace.base)
        ? trace.base
        : "neutral",
    }));
    if (sourceVersion < 5)
      data.discoveries = legacyDiscoveries({
        geologicalStage: data.geologicalStage,
        stages: GEOLOGICAL_STAGES,
        historicalTraits: data.historicalTraits,
        seenMutations: data.seenMutations,
        event: data.event,
        previousEvent: data.previousEvent,
        diseases: data.diseases,
      });
    if (data.totalCycles < 2) {
      const cleanProfile = (profile) => {
          profile.traits = (profile.traits ?? []).filter(
            (trait) => !isNegativeTrait(trait),
          );
          delete profile.deleteriousDue;
          delete profile.lastMoveRound;
          return profile;
        },
        profiles = [
          ...(data.pieces ?? []),
          ...(data.eggs ?? []).flatMap((egg) => egg.brood ?? []),
          ...(data.plantSeeds ?? []).map((seed) => seed.profile),
          ...(data.pieces ?? []).flatMap((piece) =>
            (piece.pregnancies ?? []).flatMap(
              (pregnancy) => pregnancy.brood ?? [],
            ),
          ),
        ];
      for (const profile of profiles) cleanProfile(profile);
      data.seenMutations = data.seenMutations.filter(
        (label) => !isNegativeTrait(label) && !label.startsWith("Perda de "),
      );
      data.notices = (data.notices ?? [])
        .map((entry) =>
          entry.title === "Novas mutações"
            ? {
                ...entry,
                lines: (entry.lines ?? []).filter(
                  (label) =>
                    !isNegativeTrait(label) && !label.startsWith("Perda de "),
                ),
              }
            : entry,
        )
        .filter((entry) => entry.title !== "Novas mutações" || entry.lines.length);
      if (data.discoveries) {
        const removed = new Set([
          "Esterilidade",
          "Mutação Deletéria",
          "Mutação Disfuncional",
        ]);
        data.discoveries.mutations = (data.discoveries.mutations ?? []).filter(
          (id) => !removed.has(id),
        );
        data.discoveries.read = (data.discoveries.read ?? []).filter(
          (key) => ![...removed].some((id) => key === `mutations:${id}`),
        );
      }
    }
    data.version = 7;
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
      (profile.traits ?? []).map(v2TraitName).filter((t) => TRAITS[t]),
    );
    traits.add("Locomoção");
    traits.add("Predação");
    for (const entry of profile.mutationStack ?? []) {
      const name = v2TraitName(entry.name);
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
  state.seenMutations = historicalMutations(data, 2);
  const observed = new Set([
      ...state.pieces.flatMap((piece) => piece.traits),
      ...state.seenMutations.filter((label) => TRAITS[label]),
    ]),
    compatible = firstCompatibleStage(observed),
    stage =
      compatible.index < geologicalStage("cambrian").index
        ? geologicalStage("cambrian")
        : compatible;
  state.geologicalStage = stage.id;
  state.cycle = 1;
  state.totalCycles = 1;
  state.historicalTraits = [
    ...new Set([
      ...priorRequiredInnovations(stage.id),
      ...[...observed].filter((trait) => !isNegativeTrait(trait)),
      "Predação",
    ]),
  ];
  state.discoveries = legacyDiscoveries({
    geologicalStage: state.geologicalStage,
    stages: GEOLOGICAL_STAGES,
    historicalTraits: state.historicalTraits,
    seenMutations: state.seenMutations,
    event: state.event,
    previousEvent: state.previousEvent,
    diseases: state.diseases,
  });
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
  const raw =
    storage.getItem(SAVE_KEY) ??
    storage.getItem(V6_KEY) ??
    storage.getItem(V5_KEY) ??
    storage.getItem(V4_KEY) ??
    storage.getItem(V3_KEY) ??
    storage.getItem(V2_KEY) ??
    storage.getItem(LEGACY_KEY);
  if (!raw) throw Error("Nenhuma partida salva neste navegador.");
  return deserialize(raw);
}
