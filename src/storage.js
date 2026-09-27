import { assertState, createCampaignState } from "./state.js";
import { STATE_VERSION } from "./constants.js";
import { normalizeGenome } from "./genetics.js";

export const SAVE_KEY = `xadrez-evolutivo-save-v${STATE_VERSION}`;
const LEGACY_SAVE_VERSIONS = [27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];
const legacySaveKey = (version) => `xadrez-evolutivo-save-v${version}`;

const LEGACY_TRAIT_NAMES = Object.freeze({
  "Mutação Deletéria": "Mutação Letal",
  Garras: "Presas",
});
const RETIRED_TRAITS = new Set([
  "Locomoção Avançada",
  "Carnivoria Botânica",
]);

function removeRetiredTraits(value) {
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) {
      const child = value[i];
      if (typeof child === "string" && RETIRED_TRAITS.has(child))
        value.splice(i, 1);
      else removeRetiredTraits(child);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const trait of RETIRED_TRAITS) delete value[trait];
  for (const [key, child] of Object.entries(value)) {
    if (key === "locomotion" && typeof child === "boolean") {
      value[key] = false;
      continue;
    }
    if (typeof child === "string" && RETIRED_TRAITS.has(child))
      delete value[key];
    else removeRetiredTraits(child);
  }
}

function normalizeLegacyTraitNames(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const child = value[i];
      if (typeof child === "string" && LEGACY_TRAIT_NAMES[child])
        value[i] = LEGACY_TRAIT_NAMES[child];
      else normalizeLegacyTraitNames(child);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [legacy, current] of Object.entries(LEGACY_TRAIT_NAMES))
    if (Object.hasOwn(value, legacy)) {
      if (!Object.hasOwn(value, current)) value[current] = value[legacy];
      delete value[legacy];
    }
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && LEGACY_TRAIT_NAMES[child])
      value[key] = LEGACY_TRAIT_NAMES[child];
    else normalizeLegacyTraitNames(child);
  }
}

function normalizeStoredGenomes(value) {
  if (!value || typeof value !== "object") return;
  if (Object.hasOwn(value, "genome"))
    value.genome = normalizeGenome(value.genome, value);
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) normalizeStoredGenomes(item);
    else if (child && typeof child === "object")
      normalizeStoredGenomes(child);
  }
}

function restoreLegacyResidueTerrain(state) {
  const residues = [
    ...(state.deathSites ?? []),
    ...(state.fertileTraces ?? []),
  ];
  for (const residue of residues) {
    if (!Number.isInteger(residue?.cell)) continue;
    const base = ["neutral", "fertile", "hostile"].includes(residue.base)
      ? residue.base
      : "neutral";
    if (state.event?.hazards?.includes(residue.cell))
      state.event.snapshots[residue.cell] = base;
    else if (Array.isArray(state.board) && residue.cell < state.board.length)
      state.board[residue.cell] = base;
  }
}

function defaultPathogenTransmission(agent) {
  return agent === "bacteria"
    ? "trail"
    : agent === "fungus"
      ? "environmental"
      : "contact";
}

function normalizePathogenEvolution(state) {
  for (const disease of state?.diseases ?? [])
    disease.transmission ??= defaultPathogenTransmission(disease.agent);

  state.pathogenSpores ??= [];
  state.nextPathogenSpore ??=
    Math.max(0, ...state.pathogenSpores.map((spore) => spore.id ?? 0)) + 1;
  if (state.cyclePathogenProfile === undefined) {
    const existing = state.diseases?.[0] ?? null;
    state.cyclePathogenProfile = existing
      ? { agent: existing.agent, transmission: existing.transmission }
      : null;
  }

  if (state?.sexualPathogenUnlockTotalCycle === undefined) {
    state.sexualPathogenUnlockTotalCycle = null;
    if (
      state.scenario !== "arena" &&
      (state.historicalTraits ?? []).includes("Reprodução Sexuada")
    ) {
      const order = [
        "hadean",
        "archean",
        "proterozoic",
        "ediacaran",
        "cambrian",
        "ordovician",
        "silurian",
        "devonian",
        "carboniferous",
        "permian",
        "triassic",
        "jurassic",
        "cretaceous",
        "paleogene",
        "neogene",
        "quaternary",
      ];
      const stageIndex = order.indexOf(state.geologicalStage),
        proterozoicIndex = order.indexOf("proterozoic");
      state.sexualPathogenUnlockTotalCycle =
        stageIndex > proterozoicIndex
          ? state.totalCycles
          : (state.totalCycles ?? 1) + 1;
    }
  }
  return state;
}

function normalizeCycleInnovationPressure(state) {
  removeRetiredTraits(state);
  normalizeStoredGenomes(state);
  state.chainTrait ??= null;
  if (
    state.chainTrait !== "Bipedalismo" ||
    !state.pieces?.some(
      (piece) =>
        piece.id === state.chain &&
        piece.owner === state.current &&
        (piece.traits ?? []).includes("Bipedalismo"),
    )
  ) {
    state.chain = null;
    state.chainTrait = null;
  }
  state.serotoninReposition ??= null;
  state.movementTrace = null;
  state.webs ??= [];
  state.chemicalHazards ??= [];
  for (const piece of state?.pieces ?? []) {
    piece.lifetimeOffspring ??= 0;
    piece.webTrapped ??= null;
    piece.webCreatedStationarySinceRound ??= null;
  }
  if (!Array.isArray(state?.cyclePositiveInnovations))
    state.cyclePositiveInnovations = [];
  if (!Array.isArray(state?.passiveEffects)) state.passiveEffects = [];
  state.nextPassiveEffect ??=
    Math.max(0, ...state.passiveEffects.map((effect) => effect?.id ?? 0)) + 1;
  if (
    !state?.openingMutationSatisfied ||
    typeof state.openingMutationSatisfied.blue !== "boolean" ||
    typeof state.openingMutationSatisfied.amber !== "boolean"
  )
    state.openingMutationSatisfied = { blue: true, amber: true };
  if (
    !state?.energyBranchRepresentatives ||
    !("Fotossíntese" in state.energyBranchRepresentatives) ||
    !("Predação" in state.energyBranchRepresentatives)
  )
    state.energyBranchRepresentatives = {
      Fotossíntese: null,
      Predação: null,
    };
  return normalizePathogenEvolution(state);
}

function normalizeLegacyZoochory(state) {
  for (const seed of state?.plantSeeds ?? []) {
    seed.zoochory ??= null;
    seed.transport ??= null;
    seed.mirmecochoryMoved ??= false;
  }
  return state;
}

function normalizeLegacyDefenseState(state) {
  state.thanatosis ??= [];
  for (const piece of state.pieces ?? []) {
    piece.intoxicationRestThroughRound ??= null;
    piece.biologicalImmortalityTriggered ??= false;
  }
  return state;
}

function preserveLegacyMimicryLineage(value) {
  if (!value || typeof value !== "object") return;
  if (
    Array.isArray(value.traits) &&
    value.traits.includes("Mimetismo") &&
    value.genome?.Camuflagem
  ) {
    if (Array.isArray(value.ancestry) && !value.ancestry.includes("Camuflagem"))
      value.ancestry.push("Camuflagem");
    if (value.genome.Camuflagem.every((allele) => allele?.value === "ancestral"))
      value.genome.Camuflagem = [
        { value: "derived", dominance: "recessive" },
        { value: "ancestral", dominance: "neutral" },
      ];
  }
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) preserveLegacyMimicryLineage(item);
    else if (child && typeof child === "object")
      preserveLegacyMimicryLineage(child);
  }
}

function preserveLegacyVenomLineage(value) {
  if (!value || typeof value !== "object") return;
  if (
    Array.isArray(value.traits) &&
    value.traits.includes("Veneno") &&
    value.genome?.Toxicidade
  ) {
    if (Array.isArray(value.ancestry) && !value.ancestry.includes("Toxicidade"))
      value.ancestry.push("Toxicidade");
    if (value.genome.Toxicidade.every((allele) => allele?.value === "ancestral"))
      value.genome.Toxicidade = [
        { value: "derived", dominance: "recessive" },
        { value: "ancestral", dominance: "neutral" },
      ];
  }
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) preserveLegacyVenomLineage(item);
    else if (child && typeof child === "object")
      preserveLegacyVenomLineage(child);
  }
}

function normalizeLegacyNeurodivergenceState(state) {
  state.neurofocus ??= null;
  state.neurodivergenceAction ??= null;
  for (const piece of state.pieces ?? [])
    piece.neurodivergenceRestThroughRound ??= null;
  return state;
}

function preserveLegacyNicheRemediation(value) {
  if (!value || typeof value !== "object") return;
  if (
    Array.isArray(value.traits) &&
    value.traits.includes("Construtor de Nicho") &&
    value.genome?.Zoorremediação
  ) {
    if (!value.traits.includes("Zoorremediação"))
      value.traits.push("Zoorremediação");
    if (Array.isArray(value.ancestry) && !value.ancestry.includes("Zoorremediação"))
      value.ancestry.push("Zoorremediação");
    value.genome.Zoorremediação = [
      { value: "derived", dominance: "dominant" },
      { value: "derived", dominance: "dominant" },
    ];
  }
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) preserveLegacyNicheRemediation(item);
    else if (child && typeof child === "object")
      preserveLegacyNicheRemediation(child);
  }
}

function preserveLegacyLactationLineage(value) {
  if (!value || typeof value !== "object") return;
  if (
    Array.isArray(value.traits) &&
    value.traits.includes("Lactação") &&
    value.genome?.Pelos &&
    value.genome.Pelos.every((allele) => allele?.value === "ancestral")
  ) {
    value.genome.Pelos = [
      { value: "derived", dominance: "recessive" },
      { value: "ancestral", dominance: "neutral" },
    ];
    if (Array.isArray(value.ancestry) && !value.ancestry.includes("Pelos"))
      value.ancestry.push("Pelos");
  }
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) preserveLegacyLactationLineage(item);
    else if (child && typeof child === "object")
      preserveLegacyLactationLineage(child);
  }
}

function migrateLegacy(data) {
  let state = normalizeLegacyZoochory(structuredClone(data));
  if (
    data.version === 19 &&
    state.geologicalStage === "hadean" &&
    state.phase === "move" &&
    !state.origin &&
    state.turn === 0 &&
    state.pieces?.length === 2 &&
    state.pieces.every(
      (piece) =>
        piece.rank === 4 &&
        piece.traits?.length === 1 &&
        piece.traits.includes("Respiração anaeróbia"),
    ) &&
    !Object.values(state.hadeanTutorial ?? {}).some(Boolean)
  ) {
    const discoveries = structuredClone(state.discoveries ?? {});
    state = createCampaignState(
      state.rng ?? Date.now(),
      state.scenario ?? "earth",
    );
    state.discoveries = {
      ...state.discoveries,
      ...discoveries,
      geology: [...new Set(["hadean", ...(discoveries.geology ?? [])])],
    };
    state.version = STATE_VERSION;
    return state;
  }
  if (state.phase === "origin" || state.origin) {
    const discoveries = structuredClone(state.discoveries ?? {});
    discoveries.geology = (discoveries.geology ?? []).filter(
      (id) => id !== "archean",
    );
    state = createCampaignState(
      state.rng ?? Date.now(),
      state.scenario ?? "earth",
    );
    state.discoveries = {
      ...state.discoveries,
      ...discoveries,
      geology: [...new Set(["hadean", ...(discoveries.geology ?? [])])],
      read: (discoveries.read ?? []).filter(
        (key) => key !== "geology:archean",
      ),
    };
    state.version = STATE_VERSION;
    return state;
  }
  if (data.version === 17) {
    restoreLegacyResidueTerrain(state);
    state.deathSites = [];
    state.fertileTraces = [];
    state.carcasses = [];
    state.captureDisturbances = [];
    if (state.event) state.event.lethalHazards ??= [];
    for (const piece of state.pieces ?? []) delete piece.decompositionImmunity;
  }
  state.version = STATE_VERSION;
  normalizeLegacyTraitNames(state);
  if (Array.isArray(state?.discoveries?.read))
    state.discoveries.read = state.discoveries.read.map((key) =>
      key === "mutations:Garras" ? "mutations:Presas" : key,
    );
  normalizeStoredGenomes(state);
  normalizeLegacyNeurodivergenceState(state);
  normalizeLegacyDefenseState(state);
  preserveLegacyVenomLineage(state);
  preserveLegacyMimicryLineage(state);
  preserveLegacyLactationLineage(state);
  if (data.version <= 24) {
    const venomKnown =
      (state.historicalTraits ?? []).includes("Veneno") ||
      (state.pieces ?? []).some((piece) =>
        (piece.traits ?? []).includes("Veneno"),
      );
    if (venomKnown) {
      if (
        Array.isArray(state.historicalTraits) &&
        !state.historicalTraits.includes("Toxicidade")
      )
        state.historicalTraits.push("Toxicidade");
      for (const collection of [
        state.seenMutations,
        state.cyclePositiveInnovations,
        state.discoveries?.mutations,
      ])
        if (
          Array.isArray(collection) &&
          collection.includes("Veneno") &&
          !collection.includes("Toxicidade")
        )
          collection.push("Toxicidade");
    }
  }
  if (data.version <= 22) {
    preserveLegacyNicheRemediation(state);
    if (
      Array.isArray(state.historicalTraits) &&
      state.historicalTraits.includes("Construtor de Nicho") &&
      !state.historicalTraits.includes("Zoorremediação")
    )
      state.historicalTraits.push("Zoorremediação");
    for (const collection of [
      state.seenMutations,
      state.cyclePositiveInnovations,
      state.discoveries?.mutations,
    ])
      if (
        Array.isArray(collection) &&
        collection.includes("Construtor de Nicho") &&
        !collection.includes("Zoorremediação")
      )
        collection.push("Zoorremediação");
  }
  return normalizeCycleInnovationPressure(state);
}

export function deserialize(raw) {
  if (typeof raw !== "string" || raw.length > 2_000_000)
    throw Error("Arquivo de partida inválido.");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw Error("Arquivo de partida inválido.");
  }
  if (LEGACY_SAVE_VERSIONS.includes(data?.version))
    return assertState(migrateLegacy(data));
  if (data?.version !== STATE_VERSION)
    throw Error(
      `Save incompatível com esta versão de desenvolvimento. Inicie uma nova partida na versão ${STATE_VERSION}.`,
    );
  return assertState(normalizeCycleInnovationPressure(data));
}

export function save(storage, state) {
  assertState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function load(storage) {
  const current = storage.getItem(SAVE_KEY);
  if (current) return deserialize(current);
  for (const version of LEGACY_SAVE_VERSIONS) {
    const legacy = storage.getItem(legacySaveKey(version));
    if (!legacy) continue;
    const migrated = deserialize(legacy);
    storage.setItem(SAVE_KEY, JSON.stringify(migrated));
    return migrated;
  }
  throw Error("Nenhuma partida salva nesta versão.");
}
