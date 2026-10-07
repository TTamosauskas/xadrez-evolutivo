import { assertState, createCampaignState } from "./state.js";
import { STATE_VERSION } from "./constants.js";
import { normalizeGenome } from "./genetics.js";
import {
  energyCapacity,
  movementEnergyCost,
  reproductionEnergyCost,
} from "./energy.js";

export const SAVE_KEY = `xadrez-evolutivo-save-v${STATE_VERSION}`;
const LEGACY_SAVE_VERSIONS = [39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];
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

function removeLegacyRegeneration(value) {
  if (Array.isArray(value)) {
    for (let i = value.length - 1; i >= 0; i--) {
      const child = value[i];
      if (child === "Regeneração") value.splice(i, 1);
      else removeLegacyRegeneration(child);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  delete value.Regeneração;
  for (const [key, child] of Object.entries(value)) {
    if (child === "Regeneração") delete value[key];
    else removeLegacyRegeneration(child);
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
        "hadean", "eoarchean", "paleoarchean", "mesoarchean", "neoarchean",
        "siderian", "rhyacian", "orosirian", "statherian", "calymmian",
        "ectasian", "stenian", "tonian", "cryogenian", "ediacaran",
        "cambrian", "ordovician", "silurian", "devonian", "carboniferous",
        "permian", "triassic", "jurassic", "cretaceous", "paleocene",
        "eocene", "oligocene", "miocene", "pliocene", "pleistocene", "holocene",
      ];
      const stageIndex = order.indexOf(state.geologicalStage),
        sexualIndex = order.indexOf("calymmian");
      state.sexualPathogenUnlockTotalCycle =
        stageIndex > sexualIndex
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
  state.inkClouds ??= [];
  state.mineralRemnants ??= [];
  state.chemosynthesisExhausted ??= [];
  if (state.geologicalStage === "hadean") {
    state.hadeanTutorial ??= {
      moved: false,
      divided: false,
      captured: false,
      fertile: false,
    };
    state.hadeanTutorial.fertile ??= false;
    state.hadeanEnvironment ??= {
      hostileDeathExplained: false,
      fertileExplained: false,
      pendingFertility: [],
    };
    state.hadeanEnvironment.hostileDeathExplained ??= false;
    state.hadeanEnvironment.fertileExplained ??= false;
    state.hadeanEnvironment.pendingFertility ??= [];
  } else {
    state.hadeanEnvironment = null;
  }
  for (const piece of state?.pieces ?? []) {
    piece.lifetimeOffspring ??= 0;
    piece.hematophagyDepletedUntilRound ??= null;
    piece.autotomyRecovery ??= null;
    piece.inkReadyRound ??= piece.bornRound ?? 0;
    piece.tentacleReadyRound ??= piece.bornRound ?? 0;
    piece.chromaticReadyRound ??= piece.bornRound ?? 0;
    piece.chromaticCrypsis ??= false;
    piece.tentacleProtection ??= null;
    piece.byssusAttached ??= null;
    piece.broodParasite ??= null;
    piece.parasitoidism ??= null;
    piece.rumination ??= null;
    piece.eukaryoteBufferUses ??= 0;
    piece.eukaryoteBufferedTraits ??= [];
    piece.adaptiveImmuneMemory ??= [];
    piece.adaptiveImmuneNotifiedDisease ??= null;
    piece.stomataStartedRound ??= piece.bornRound ?? 0;
    piece.endothermyUsedTurn ??= null;
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

const OLD_GEOLOGY_EXPANSION = Object.freeze({
  archean: ["eoarchean", "paleoarchean", "mesoarchean", "neoarchean"],
  proterozoic: ["siderian", "rhyacian", "orosirian", "statherian", "calymmian", "ectasian", "stenian", "tonian", "cryogenian"],
  paleogene: ["paleocene", "eocene", "oligocene"],
  neogene: ["miocene", "pliocene"],
  quaternary: ["pleistocene", "holocene"],
});

function detailedLegacyStage(state) {
  const history = new Set(state.historicalTraits ?? []);
  if (state.geologicalStage === "archean")
    return ["eoarchean", "paleoarchean", "mesoarchean", "neoarchean"][
      Math.min(3, Math.max(0, (state.cycle ?? 1) - 1))
    ];
  if (state.geologicalStage === "proterozoic") {
    if (history.has("Carnívoro")) return "stenian";
    if (history.has("Ingestão")) return "ectasian";
    if (history.has("Reprodução Sexuada")) return "calymmian";
    if (history.has("Regeneração") || history.has("Brotamento")) return "statherian";
    if (history.has("Multicelularismo")) return "orosirian";
    if (history.has("Eucarionte") || history.has("Endossimbiose")) return "rhyacian";
    return "siderian";
  }
  if (state.geologicalStage === "paleogene") {
    if (["Eletrodescarga", "Interceptação preditiva", "Superorganismo", "Sinzoocoria", "Mirmecocoria"].some((trait) => history.has(trait)))
      return "oligocene";
    if (["Predação em Massa", "Ovulação Induzida", "Ecolocalização", "Caça Cooperativa", "Epizoocoria"].some((trait) => history.has(trait)))
      return "eocene";
    return "paleocene";
  }
  if (state.geologicalStage === "neogene")
    return ["Polegar Opositor", "Bipedalismo", "Córtex Pré-Frontal", "Neurodivergência"].some((trait) => history.has(trait))
      ? "pliocene"
      : "miocene";
  if (state.geologicalStage === "quaternary")
    return ["Antropização", "Plantas Domesticadas", "Animais Domésticos"].some((trait) => history.has(trait))
      ? "holocene"
      : "pleistocene";
  return state.geologicalStage;
}

function migrateDetailedGeology(state) {
  const oldStage = state.geologicalStage,
    nextStage = detailedLegacyStage(state);
  if (nextStage === oldStage) return state;
  state.geologicalStage = nextStage;
  state.cycle = 1;

  if (state.discoveries) {
    const geology = state.discoveries.geology ?? [];
    state.discoveries.geology = [
      ...new Set(
        geology.flatMap((id) => OLD_GEOLOGY_EXPANSION[id] ?? [id]),
      ),
    ];
    state.discoveries.read = (state.discoveries.read ?? []).flatMap((key) => {
      if (!key.startsWith("geology:")) return [key];
      const id = key.slice("geology:".length),
        expanded = OLD_GEOLOGY_EXPANSION[id];
      return expanded ? expanded.map((stage) => `geology:${stage}`) : [key];
    });
  }
  return state;
}

function migrateUnifiedEnergy(state) {
  const currentRound = Math.floor((state.turn ?? 0) / 2);
  for (const piece of state.pieces ?? []) {
    const capacity = energyCapacity(piece);
    if (!Number.isFinite(piece.energy)) {
      const fatigue = Math.max(0, piece.exertionStreak ?? 0),
        locomotorEnergy = capacity - fatigue * movementEnergyCost(piece),
        remainingRecovery = Math.max(
          0,
          (piece.nextReproductionRound ?? currentRound) - currentRound,
        ),
        reproductiveEnergy =
          remainingRecovery > 0
            ? reproductionEnergyCost(piece) - remainingRecovery
            : capacity;
      piece.energy = Math.min(
        capacity,
        locomotorEnergy,
        reproductiveEnergy,
      );
    } else piece.energy = Math.min(capacity, piece.energy);
    piece.energyCapacitySnapshot = capacity;
    if (
      Number.isInteger(piece.endosymbiosisDebtUntilRound) &&
      piece.endosymbiosisDebtUntilRound > currentRound
    )
      piece.endosymbiosisEnergyDebt = true;
    delete piece.nextReproductionRound;
    delete piece.exertionStreak;
    delete piece.fatigueRestTurn;
    delete piece.lastOwnExertionTurn;
    delete piece.lastReactiveExertionTurn;
    delete piece.endosymbiosisDebtUntilRound;
  }
  return state;
}

function migratePredatoryBaseForm(value) {
  if (Array.isArray(value)) {
    for (const child of value) migratePredatoryBaseForm(child);
    return value;
  }
  if (!value || typeof value !== "object") return value;

  if (
    value.rank === 0 &&
    Array.isArray(value.traits) &&
    value.traits.includes("Predação") &&
    !value.traits.includes("Fotossíntese") &&
    !value.traits.includes("Mixotrofia")
  ) {
    const oldCapacity = Number.isFinite(value.energyCapacitySnapshot)
        ? value.energyCapacitySnapshot
        : 5,
      oldEnergy = Number.isFinite(value.energy) ? value.energy : oldCapacity;
    value.rank = 4;
    if (Number.isFinite(value.energy)) {
      const newCapacity = energyCapacity(value),
        deficit = oldCapacity - oldEnergy;
      value.energy = Math.min(newCapacity, newCapacity - deficit);
      value.energyCapacitySnapshot = newCapacity;
    }
  }

  for (const child of Object.values(value)) migratePredatoryBaseForm(child);
  return value;
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
      (id) =>
        !["archean", "eoarchean", "paleoarchean", "mesoarchean", "neoarchean"].includes(id),
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
        (key) =>
          !["geology:archean", "geology:eoarchean", "geology:paleoarchean", "geology:mesoarchean", "geology:neoarchean"].includes(key),
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
  migrateDetailedGeology(state);
  if (data.version <= 38) removeLegacyRegeneration(state);
  if (data.version <= 33) migrateUnifiedEnergy(state);
  state.version = STATE_VERSION;
  normalizeLegacyTraitNames(state);
  if (Array.isArray(state?.discoveries?.read))
    state.discoveries.read = state.discoveries.read.map((key) =>
      key === "mutations:Garras" ? "mutations:Presas" : key,
    );
  normalizeStoredGenomes(state);
  if (data.version <= 34) migratePredatoryBaseForm(state);
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
