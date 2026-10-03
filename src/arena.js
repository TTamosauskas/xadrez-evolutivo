import { EVOLUTION_PATHS, TRAITS } from "./constants.js";
import {
  MULTICELLULAR_DEPENDENT_TRAITS,
  PLANT_DERIVED_TRAITS,
  PLANT_INCOMPATIBLE_TRAITS,
  TRAIT_DEPENDENCIES,
  TRAIT_BRANCH_SCOPE,
  NEGATIVE_TRAITS,
  normalizeActiveTraits,
  photosyntheticRankCeiling,
  traitCombinationValid,
} from "./geology.js";
import { ARENA_ENGINEERING_CHANGES } from "./scenarios.js";
import {
  genomeFromTraits,
  syncGenomePhenotype,
} from "./genetics.js";

const NEGATIVE = NEGATIVE_TRAITS;
const BASAL = "Respiração anaeróbia";
export const ARENA_FOUNDATIONAL_TRAITS = new Set([
  "Reparo Celular",
  "Simetria Bilateral",
  "Cefalização",
]);
export const ARENA_BRANCHES = Object.freeze([
  {
    id: "animal",
    label: "Ramo Animal",
    energy: "Predação",
    scope: "predation",
    limit: 14,
  },
  {
    id: "plant",
    label: "Ramo Vegetal",
    energy: "Fotossíntese",
    scope: "photosynthesis",
    limit: 10,
  },
]);
export const ARENA_TRAIT_LIMITS = Object.freeze(
  Object.fromEntries(ARENA_BRANCHES.map((branch) => [branch.id, branch.limit])),
);
export const ARENA_RANKS = Object.freeze([0, 1, 2, 3, 4, 5]);
export const ARENA_BODY_PLANS = Object.freeze(["Vertebrado", "Artrópode"]);
export const oppositeArenaBodyPlan = (bodyPlan) =>
  bodyPlan === "Vertebrado" ? "Artrópode" : "Vertebrado";
export const arenaBodyPlan = (genome = []) =>
  genome.includes("Artrópode")
    ? "Artrópode"
    : genome.includes("Vertebrado")
      ? "Vertebrado"
      : null;
const ARENA_BRANCH_RANK_VALUES = Object.freeze({
  animal: Object.freeze([1, 3, 4, 5, 2, 6]),
  plant: Object.freeze([1, 3, 3, 5, 100, 9]),
});
const ARENA_BRANCH_EXCLUSIONS = new Set(["Quimiossíntese", "Mixotrofia"]);
export const arenaTraitCost = (genome, legacy = []) => {
  const free = new Set([
    ...ARENA_FOUNDATIONAL_TRAITS,
    ...(legacy ?? []),
  ]);
  return new Set((genome ?? []).filter((trait) => !free.has(trait))).size;
};
const order = new Map(Object.keys(TRAITS).map((trait, index) => [trait, index]));

export const ARENA_PRESETS = Object.freeze({
  animal: [
    { id: "microbial-predator", stage: "archean", label: "Predador microbiano", traits: ["Predação", "Transferência Horizontal"] },
    { id: "protoanimal", stage: "proterozoic", label: "Protoanimal filtrador", traits: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada"] },
    { id: "dickinsonia", stage: "ediacaran", label: "Dickinsonia", traits: ["Predação", "Multicelularismo", "Simetria Bilateral", "Locomoção Primitiva"], note: "Na Arena, Predação representa a raiz heterotrófica do Ramo Animal; não implica predação macroscópica para Dickinsonia." },
    { id: "anomalocaris", stage: "cambrian", label: "Anomalocaris", traits: ["Predação", "Artrópode", "Locomoção Articulada", "Percepção Espacial", "Carnívoro", "Carapaça"] },
    { id: "nautiloid", stage: "ordovician", label: "Nautiloide gigante", traits: ["Predação", "Multicelularismo", "Jatopropulsão", "Corpo Gelatinoso", "Carnívoro", "Ovíparo", "Camuflagem"] },
    { id: "eurypterid", stage: "silurian", label: "Euriptérido", traits: ["Predação", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Carapaça"] },
    { id: "dunkleosteus", stage: "devonian", label: "Dunkleosteus", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Carnívoro", "Mandíbula", "Carapaça"] },
    { id: "meganeura", stage: "carboniferous", label: "Meganeura", traits: ["Predação", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Voo", "Carnívoro", "Visão Binocular"] },
    { id: "dimetrodon", stage: "permian", label: "Dimetrodon", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Presas"] },
    { id: "coelophysis", stage: "triassic", label: "Coelophysis", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Endotermia", "Ovíparos Amniotas"] },
    { id: "archaeopteryx", stage: "jurassic", label: "Archaeopteryx", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Voo", "Penas", "Ovíparos Amniotas"] },
    { id: "tyrannosaurus", stage: "cretaceous", label: "Tiranossauro rex", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Presas", "Visão Binocular"] },
    { id: "basilosaurus", stage: "paleogene", label: "Basilosaurus", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Carnívoro", "Respiração Pulmonar", "Predação em Massa", "Longevidade", "Vivíparo", "Lactação"], legacy: ["Incubação", "Pelos"] },
    { id: "megalodon", stage: "neogene", label: "Megalodon", traits: ["Predação", "Vertebrado", "Carnívoro", "Mandíbula", "Dentes", "Presas", "Longevidade"] },
    { id: "mammoth", stage: "quaternary", label: "Mamute", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Herbívoro", "Pelos", "Tromba", "Cuidado Parental", "Vivíparo", "Lactação"], legacy: ["Incubação"] },
    { id: "kangaroo", stage: "quaternary", label: "Canguru-gigante", traits: ["Predação", "Marsupial", "Pulo"] },
    { id: "homo-sapiens", stage: "quaternary", label: "Homo sapiens", traits: ["Predação", "Antropização", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Bipedalismo", "Vivíparo", "Lactação", "Pelos", "Onívoro", "Cuidado Parental", "Reprodução Sexuada", "Herbívoro"], legacy: ["Incubação", "Polegar Opositor", "Construtor de Nicho", "Escavador"] },
  ],
  plant: [
    { id: "photosynthetic-mat", stage: "archean", label: "Tapete fotossintético", traits: ["Fotossíntese", "Dormência"] },
    { id: "multicellular-alga", stage: "proterozoic", label: "Alga multicelular", traits: ["Fotossíntese", "Multicelularismo", "Reprodução Sexuada", "Fragmentação"] },
    { id: "ediacaran-macroalga", stage: "ediacaran", label: "Macroalga ediacarana", traits: ["Fotossíntese", "Multicelularismo", "Fragmentação", "Séssil"] },
    { id: "calcareous-alga", stage: "cambrian", label: "Alga calcária", traits: ["Fotossíntese", "Multicelularismo", "Carapaça", "Colônia"] },
    { id: "early-embryophyte", stage: "ordovician", label: "Embriófita pioneira", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Tropismo"] },
    { id: "cooksonia", stage: "silurian", label: "Cooksonia", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Estômatos"] },
    { id: "archaeopteris", stage: "devonian", label: "Archaeopteris", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Madeira"] },
    { id: "lepidodendron", stage: "carboniferous", label: "Lepidodendron", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Madeira", "Estômatos"] },
    { id: "glossopteris", stage: "permian", label: "Glossopteris", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Madeira", "Extremófitas"] },
    { id: "cycad", stage: "triassic", label: "Cicadácea", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Espinhos", "Extremófitas"] },
    { id: "araucaria", stage: "jurassic", label: "Araucária", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Madeira", "Extremófitas"] },
    { id: "cretaceous-flower", stage: "cretaceous", label: "Angiosperma cretácea", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Perfume Floral"] },
    { id: "palm", stage: "paleogene", label: "Palmeira", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Endozoocoria"] },
    { id: "pepper", stage: "neogene", label: "Pimenteira", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Endozoocoria", "Capsaicina"] },
    { id: "mandacaru", stage: "quaternary", label: "Mandacaru", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Espinhos", "Extremófitas"] },
  ],
});

export const ARENA_ARCHETYPES = Object.freeze([
  ...ARENA_PRESETS.animal
    .slice(3, 7)
    .map((preset) => completeArenaBranchGenome(preset.traits, "animal")),
  ...ARENA_PRESETS.plant
    .slice(5, 9)
    .map((preset) => completeArenaBranchGenome(preset.traits, "plant")),
]);

const COUNTER_RULES = Object.freeze([
  ["Camuflagem", ["Visão Binocular"], 2],
  ["Notívago", ["Visão Noturna"], 2],
  ["Movimento proteano", ["Interceptação preditiva"], 3],
  ["Velocidade", ["Velocidade"], 2],
  ["Pele grossa", ["Presas"], 2],
  ["Madeira", ["Roedor"], 3],
  ["Ovíparo", ["Ovífagia"], 2],
  ["Ovíparos Amniotas", ["Ovífagia"], 2],
  ["Ovovivíparo", ["Ovífagia"], 2],
  ["Chifre", ["Carapaça", "Osteodermos"], 3],
  ["Espinhos", ["Osteodermos"], 2],
  ["Parasitismo de Ninhada", ["Incubação"], 3],
  ["Tanatose", ["Necrófago"], 2],
  ["Mimetismo", ["Mimetismo Agressivo"], 2],
  ["Exibição deimática", ["Mimetismo Agressivo"], 1],
  ["Adrenalina", ["Mimetismo Agressivo"], 1],
  ["Ofuscamento por movimento", ["Mimetismo Agressivo"], 1],
  ["Fotossíntese", ["Herbívoro"], 3],
  ["Herbívoro", ["Espinhos", "Madeira"], 2],
  ["Presas", ["Carapaça"], 1],
]);

export function arenaTraitBranch(trait) {
  if (trait === "Predação") return "predation";
  if (trait === "Fotossíntese") return "photosynthesis";
  return (
    TRAIT_BRANCH_SCOPE[trait] ??
    (PLANT_DERIVED_TRAITS.has(trait)
      ? "photosynthesis"
      : PLANT_INCOMPATIBLE_TRAITS.has(trait)
        ? "predation"
        : "shared")
  );
}

function arenaTraitAllowedForBodyPlan(trait, bodyPlan) {
  if (!bodyPlan) return true;
  const opposite = oppositeArenaBodyPlan(bodyPlan),
    dependencies = TRAIT_DEPENDENCIES[trait] ?? {};
  if (trait === opposite) return false;
  if ((dependencies.lineage ?? []).includes(opposite)) return false;
  if ((dependencies.active ?? []).includes(opposite)) return false;
  if (
    dependencies.lineageAny?.length &&
    dependencies.lineageAny.includes(opposite) &&
    !dependencies.lineageAny.includes(bodyPlan)
  )
    return false;
  return true;
}

export function arenaSelectableTraits(branchId = null, bodyPlan = null) {
  const branch = ARENA_BRANCHES.find((candidate) => candidate.id === branchId);
  return Object.keys(TRAITS).filter((trait) => {
    if (
      trait === BASAL ||
      NEGATIVE.has(trait) ||
      ARENA_FOUNDATIONAL_TRAITS.has(trait) ||
      ARENA_BRANCH_EXCLUSIONS.has(trait)
    )
      return false;
    if (!branch) return arenaTraitAllowedForBodyPlan(trait, bodyPlan);
    const scope = arenaTraitBranch(trait);
    return (
      (scope === "shared" || scope === branch.scope) &&
      (branch.id !== "animal" || arenaTraitAllowedForBodyPlan(trait, bodyPlan))
    );
  });
}

export function arenaBranchLimit(branchId) {
  return ARENA_TRAIT_LIMITS[branchId] ?? Infinity;
}

function sorted(traits) {
  return [...new Set(traits)].sort(
    (a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999),
  );
}

function sanitizeEnergy(set, preferred) {
  const prefersPlant =
    preferred === "Fotossíntese" || PLANT_DERIVED_TRAITS.has(preferred);
  const prefersAnimal =
    preferred === "Predação" || PLANT_INCOMPATIBLE_TRAITS.has(preferred);
  if (prefersPlant) {
    set.delete("Predação");
    for (const trait of PLANT_INCOMPATIBLE_TRAITS) set.delete(trait);
  } else if (prefersAnimal) {
    set.delete("Fotossíntese");
    for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
  } else if (
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  ) {
    set.delete("Fotossíntese");
    for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
  }
}

function preferredArenaScope(preferred) {
  if (
    preferred === "Fotossíntese" ||
    preferred === "plant" ||
    PLANT_DERIVED_TRAITS.has(preferred)
  )
    return "photosynthesis";
  if (
    preferred === "Predação" ||
    preferred === "animal" ||
    PLANT_INCOMPATIBLE_TRAITS.has(preferred)
  )
    return "predation";
  return null;
}

function preferredDependency(dependencies, preferred) {
  const scope = preferredArenaScope(preferred);
  return (
    dependencies.find((dependency) => arenaTraitBranch(dependency) === scope) ??
    dependencies.find((dependency) => arenaTraitBranch(dependency) === "shared") ??
    dependencies[0] ??
    null
  );
}

export function completeArenaGenome(input, preferred = null) {
  const set = new Set(
    (input ?? []).filter(
      (trait) => TRAITS[trait] && trait !== BASAL && !NEGATIVE.has(trait),
    ),
  );
  sanitizeEnergy(set, preferred);
  let changed = true;
  while (changed) {
    changed = false;
    for (const trait of [...set]) {
      if (MULTICELLULAR_DEPENDENT_TRAITS.has(trait) && trait !== "Multicelularismo") {
        if (!set.has("Multicelularismo")) {
          set.add("Multicelularismo");
          changed = true;
        }
      }
      const deps = TRAIT_DEPENDENCIES[trait];
      for (const dependency of [...(deps?.lineage ?? []), ...(deps?.active ?? [])]) {
        if (dependency === BASAL) continue;
        if (!set.has(dependency)) {
          set.add(dependency);
          changed = true;
        }
      }
      if (
        deps?.lineageAny?.length &&
        !deps.lineageAny.some((dependency) => set.has(dependency))
      ) {
        const dependency = preferredDependency(deps.lineageAny, preferred);
        if (dependency && dependency !== BASAL) {
          set.add(dependency);
          changed = true;
        }
      }
    }
    sanitizeEnergy(set, preferred);
  }
  return sorted(set);
}

export function completeArenaBranchGenome(input, branchId) {
  const branch = ARENA_BRANCHES.find((candidate) => candidate.id === branchId);
  if (!branch) return completeArenaGenome(input);
  const allowed = new Set(arenaSelectableTraits(branchId)),
    filtered = (input ?? []).filter(
      (trait) =>
        ARENA_FOUNDATIONAL_TRAITS.has(trait) ||
        trait === branch.energy ||
        allowed.has(trait),
    );
  return completeArenaGenome(
    [branch.energy, ...filtered],
    branch.energy,
  );
}

export function arenaAllowedRanks(genome, branchId) {
  const completed = completeArenaBranchGenome(genome, branchId);
  if (completed.includes("Nanismo")) return [branchId === "plant" ? 0 : 4];

  let allowed;
  if (branchId === "plant") {
    const ceiling = photosyntheticRankCeiling({ traits: completed }),
      ceilingIndex = EVOLUTION_PATHS.photosynthetic.indexOf(ceiling);
    allowed = EVOLUTION_PATHS.photosynthetic.slice(
      0,
      Math.max(0, ceilingIndex) + 1,
    );
  } else {
    const articulated = completed.includes("Locomoção Articulada");
    if (articulated && completed.includes("Vertebrado"))
      allowed = [1, 2, 3, 4, 5];
    else if (articulated && completed.includes("Artrópode"))
      allowed = [1, 2, 4];
    else allowed = [4];
  }

  if (completed.includes("Sacos Aéreos"))
    allowed = allowed.filter(
      (rank) => rank !== 0 && (branchId === "plant" || rank !== 4),
    );
  if (completed.includes("Predação em Massa"))
    allowed = allowed.filter((rank) => [3, 5].includes(rank));
  return allowed;
}

export function arenaRankValid(genome, rank, branchId) {
  return (
    Number.isInteger(rank) &&
    ARENA_RANKS.includes(rank) &&
    arenaAllowedRanks(genome, branchId).includes(rank)
  );
}

export function arenaRankRestrictionReason(genome, rank, branchId) {
  if (arenaRankValid(genome, rank, branchId)) return null;
  const completed = completeArenaBranchGenome(genome, branchId);
  const basalRank = branchId === "plant" ? 0 : 4;
  if (completed.includes("Nanismo") && rank !== basalRank)
    return branchId === "plant"
      ? "Nanismo força a forma Peão."
      : "Nanismo força a forma Rei.";
  if (
    completed.includes("Sacos Aéreos") &&
    (rank === 0 || (branchId === "animal" && rank === 4))
  )
    return "Sacos Aéreos exige Cavalo ou forma superior.";
  if (completed.includes("Predação em Massa") && ![3, 5].includes(rank))
    return "Predação em Massa exige uma forma grande: Torre ou Rainha.";
  if (branchId === "plant") {
    if (rank === 4 && !completed.includes("Multicelularismo"))
      return "Rei vegetal exige Multicelularismo.";
    if (
      rank === 1 &&
      !["Trepadeira", "Gimnospermas", "Angiospermas"].some((trait) =>
        completed.includes(trait),
      )
    )
      return "Cavalo vegetal exige Trepadeira ou uma inovação posterior de planta com sementes.";
    if (
      rank === 2 &&
      !["Gimnospermas", "Angiospermas"].some((trait) =>
        completed.includes(trait),
      )
    )
      return "Bispo vegetal exige Gimnospermas ou Angiospermas.";
    if (rank === 3 && !completed.includes("Angiospermas"))
      return "Torre vegetal exige Angiospermas.";
    if (
      rank === 5 &&
      (!completed.includes("Angiospermas") || !completed.includes("Madeira"))
    )
      return "Rainha vegetal exige Angiospermas e Madeira.";
  } else {
    if (rank === 0)
      return "Peão é exclusivo do ramo fotossintético.";
    if (completed.includes("Artrópode") && [3, 5].includes(rank))
      return "Artrópodes não podem assumir Torre ou Rainha.";
    if (
      [1, 2, 3, 5].includes(rank) &&
      (!completed.includes("Locomoção Articulada") ||
        (!completed.includes("Vertebrado") && !completed.includes("Artrópode")))
    )
      return "Formas derivadas animais exigem Locomoção Articulada e Vertebrado ou Artrópode.";
  }
  return "Esta forma é incompatível com o genoma selecionado.";
}

export function arenaPreferredRank(genome, branchId, preferred = 4) {
  const allowed = arenaAllowedRanks(genome, branchId);
  if (allowed.includes(preferred)) return preferred;
  if (allowed.includes(4)) return 4;
  return allowed[0] ?? 4;
}

export function arenaSetupSelectionValid(genome, rank, branchId, legacy = []) {
  return arenaSetupGenomeValid(genome, branchId, legacy) &&
    arenaRankValid(genome, rank, branchId);
}

export function arenaGenomeValid(genome, branchId = null) {
  const branch = ARENA_BRANCHES.find((candidate) => candidate.id === branchId),
    normalized = branch
      ? completeArenaBranchGenome(genome, branchId)
      : completeArenaGenome(genome),
    input = new Set(
      (genome ?? []).filter(
        (trait) => TRAITS[trait] && !ARENA_FOUNDATIONAL_TRAITS.has(trait),
      ),
    ),
    normalizedBillable = normalized.filter(
      (trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait),
    );
  if (normalized.includes("Vertebrado") && normalized.includes("Artrópode"))
    return false;
  if (branch) {
    if (!normalized.includes(branch.energy)) return false;
    const wrongScope = branch.scope === "predation" ? "photosynthesis" : "predation";
    if (
      [...input].some((trait) => arenaTraitBranch(trait) === wrongScope)
    )
      return false;
  }
  if (normalizedBillable.length !== input.size) return false;
  const traits = normalizeActiveTraits(
    [BASAL, ...normalized],
    branch?.energy ?? null,
  );
  return traitCombinationValid(traits);
}

export function arenaSetupGenomeValid(genome, branchId, legacy = []) {
  return (
    arenaGenomeValid(genome, branchId) &&
    arenaTraitCost(genome, legacy) <= arenaBranchLimit(branchId)
  );
}

function arenaPreset(branchId, presetId) {
  return ARENA_PRESETS[branchId]?.find(
    (candidate) => candidate.id === presetId,
  ) ?? null;
}

export function arenaPresetGenome(branchId, presetId) {
  const preset = arenaPreset(branchId, presetId);
  return preset
    ? completeArenaBranchGenome(preset.traits, branchId)
    : completeArenaBranchGenome([], branchId);
}

export function arenaPresetLegacy(branchId, presetId) {
  const preset = arenaPreset(branchId, presetId);
  if (!preset) return [];
  const branch = ARENA_BRANCHES.find((candidate) => candidate.id === branchId),
    genome = arenaPresetGenome(branchId, presetId),
    active = new Set(
      normalizeActiveTraits(
        [BASAL, ...genome],
        branch?.energy ?? null,
      ),
    );
  return sorted([
    ...(preset.legacy ?? []),
    ...genome.filter((trait) => !active.has(trait)),
  ]).filter((trait) => genome.includes(trait));
}

export function arenaPresetCost(branchId, presetId) {
  const genome = arenaPresetGenome(branchId, presetId);
  return arenaTraitCost(genome, arenaPresetLegacy(branchId, presetId));
}

export function arenaProfile(genome, rank = 4, legacy = []) {
  const completed = completeArenaGenome(genome),
    branchId = completed.includes("Fotossíntese")
      ? "plant"
      : completed.includes("Predação")
        ? "animal"
        : null,
    preferred =
      branchId === "plant"
        ? "Fotossíntese"
        : branchId === "animal"
          ? "Predação"
          : null,
    legacySet = new Set(
      (legacy ?? []).filter((trait) => completed.includes(trait)),
    ),
    expressedGenome = completed.filter((trait) => !legacySet.has(trait));
  const profile = {
    rank,
    traits: normalizeActiveTraits([BASAL, ...expressedGenome], preferred),
    ancestry: [BASAL, ...completed],
    genome: genomeFromTraits([BASAL, ...expressedGenome]),
  };
  return syncGenomePhenotype(profile, preferred);
}

function lcg(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function archetypePool(branchId) {
  return (ARENA_PRESETS[branchId] ?? [])
    .map((preset) => ({
      genome: arenaPresetGenome(branchId, preset.id),
      legacy: arenaPresetLegacy(branchId, preset.id),
    }))
    // AI/random setup keeps the historical invariant that each returned
    // genome is independently legal without preset-only metadata.
    .filter(({ genome }) => arenaSetupGenomeValid(genome, branchId))
    .map(({ genome }) => genome);
}

function arenaLegacyForGenome(branchId, genome) {
  const signature = sorted(genome ?? []).join("\u001f");
  for (const preset of ARENA_PRESETS[branchId] ?? []) {
    const candidate = arenaPresetGenome(branchId, preset.id);
    if (sorted(candidate).join("\u001f") === signature)
      return arenaPresetLegacy(branchId, preset.id);
  }
  return [];
}

export function randomArenaSide(seed = Date.now(), requiredBodyPlan = null) {
  const random = lcg(seed);
  return ARENA_BRANCHES.map((branch) => {
    let pool = archetypePool(branch.id);
    if (branch.id === "animal" && requiredBodyPlan)
      pool = pool.filter(
        (genome) => arenaBodyPlan(genome) === requiredBodyPlan,
      );
    return (
      pool[Math.floor(random() * pool.length)] ??
      completeArenaBranchGenome(
        branch.id === "animal" && requiredBodyPlan
          ? [requiredBodyPlan]
          : [],
        branch.id,
      )
    );
  });
}

export function randomArenaSetupSide(seed = Date.now(), requiredBodyPlan = null) {
  const random = lcg(seed),
    genomes = randomArenaSide(seed, requiredBodyPlan);
  return {
    genomes,
    legacies: genomes.map((genome, index) =>
      arenaLegacyForGenome(ARENA_BRANCHES[index].id, genome),
    ),
    ranks: genomes.map((genome, index) => {
      const allowed = arenaAllowedRanks(genome, ARENA_BRANCHES[index].id);
      return allowed[Math.floor(random() * allowed.length)] ?? 4;
    }),
  };
}

function counterTargets(opponentGenomes) {
  const opponent = new Set((opponentGenomes ?? []).flat()),
    wanted = [];
  for (const [threat, counters, weight] of COUNTER_RULES)
    if (opponent.has(threat))
      for (const counter of counters)
        wanted.push({ trait: counter, weight, threat });
  return wanted;
}

function counterScore(genome, opponentGenomes) {
  const own = new Set(genome);
  let score = 0;
  for (const { trait, weight } of counterTargets(opponentGenomes))
    if (own.has(trait)) score += weight;
  return score;
}

function adaptSetupGenome(
  genome,
  branchId,
  opponentGenomes,
  requiredBodyPlan = null,
) {
  let result = completeArenaBranchGenome(genome, branchId);
  const wanted = counterTargets(opponentGenomes)
    .filter(({ trait }) =>
      arenaSelectableTraits(branchId, requiredBodyPlan).includes(trait),
    )
    .sort((a, b) => b.weight - a.weight)
    .map(({ trait }) => trait);
  for (const trait of wanted) {
    if (result.includes(trait)) continue;
    const expanded = completeArenaBranchGenome([...result, trait], branchId);
    if (arenaSetupGenomeValid(expanded, branchId)) {
      result = expanded;
      continue;
    }
    const swapped = swapToward(result, [trait], branchId);
    if (arenaSetupGenomeValid(swapped, branchId)) result = swapped;
  }
  return result;
}

export function arenaAISide(
  difficulty = "medium",
  opponentGenomes = null,
  seed = Date.now(),
  requiredBodyPlan = null,
) {
  if (difficulty === "easy")
    return randomArenaSide(seed, requiredBodyPlan);
  if (difficulty === "hard" && opponentGenomes?.length) {
    return ARENA_BRANCHES.map((branch) => {
      let pool = archetypePool(branch.id);
      if (branch.id === "animal" && requiredBodyPlan)
        pool = pool.filter(
          (genome) => arenaBodyPlan(genome) === requiredBodyPlan,
        );
      const candidates = pool.map((genome, index) => {
          const adapted = adaptSetupGenome(
            genome,
            branch.id,
            opponentGenomes,
            branch.id === "animal" ? requiredBodyPlan : null,
          );
          return {
            genome: adapted,
            index,
            score: counterScore(adapted, opponentGenomes),
            breadth: adapted.length,
          };
        });
      return candidates
        .sort(
          (a, b) =>
            b.score - a.score ||
            b.breadth - a.breadth ||
            a.index - b.index,
        )[0]?.genome ??
        completeArenaBranchGenome(
          branch.id === "animal" && requiredBodyPlan
            ? [requiredBodyPlan]
            : [],
          branch.id,
        );
    });
  }
  return ARENA_BRANCHES.map((branch, index) => {
    let pool = archetypePool(branch.id);
    if (branch.id === "animal" && requiredBodyPlan)
      pool = pool.filter(
        (genome) => arenaBodyPlan(genome) === requiredBodyPlan,
      );
    return (
      pool[((seed >>> 0) + index * 7) % Math.max(1, pool.length)] ??
      completeArenaBranchGenome(
        branch.id === "animal" && requiredBodyPlan
          ? [requiredBodyPlan]
          : [],
        branch.id,
      )
    );
  });
}

export function arenaAISideSetup(
  difficulty = "medium",
  opponentSetup = null,
  seed = Date.now(),
  requiredBodyPlan = null,
) {
  if (difficulty === "easy")
    return randomArenaSetupSide(seed, requiredBodyPlan);
  const opponentGenomes = opponentSetup?.genomes ?? opponentSetup ?? null,
    genomes = arenaAISide(
      difficulty,
      opponentGenomes,
      seed,
      requiredBodyPlan,
    ),
    ranks = genomes.map((genome, index) => {
      const branch = ARENA_BRANCHES[index],
        allowed = arenaAllowedRanks(genome, branch.id);
      if (difficulty !== "hard")
        return arenaPreferredRank(genome, branch.id, 4);
      const values = ARENA_BRANCH_RANK_VALUES[branch.id];
      return [...allowed].sort(
        (a, b) => (values[b] ?? 0) - (values[a] ?? 0) || b - a,
      )[0] ?? 4;
    });
  return {
    genomes,
    legacies: genomes.map((genome, index) =>
      arenaLegacyForGenome(ARENA_BRANCHES[index].id, genome),
    ),
    ranks,
  };
}

export function arenaInterventionCount(before, after, ranks = null) {
  let removed = 0,
    added = 0;
  for (let i = 0; i < 2; i++) {
    const a = new Set(
        (before?.[i] ?? []).filter(
          (trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait),
        ),
      ),
      b = new Set(
        (after?.[i] ?? []).filter(
          (trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait),
        ),
      );
    for (const trait of a) if (!b.has(trait)) removed++;
    for (const trait of b) if (!a.has(trait)) added++;
  }
  return {
    removed,
    added,
    substitutions: removed === added ? removed : Infinity,
    valid:
      removed === added &&
      removed <= ARENA_ENGINEERING_CHANGES &&
      (after ?? []).every((genome, index) => {
        const branchId = ARENA_BRANCHES[index]?.id ?? null;
        return (
          arenaGenomeValid(genome, branchId) &&
          (!ranks || arenaRankValid(genome, ranks[index], branchId))
        );
      }),
  };
}

function swapToward(genome, wanted, branchId, rank = null) {
  const base = completeArenaBranchGenome(genome, branchId),
    wantedSet = new Set(wanted);
  for (const add of wanted) {
    if (base.includes(add)) continue;
    for (const remove of base) {
      if (wantedSet.has(remove)) continue;
      const candidate = completeArenaBranchGenome(
        [...base.filter((trait) => trait !== remove), add],
        branchId,
      );
      if (
        candidate.length === base.length &&
        arenaGenomeValid(candidate, branchId) &&
        (rank === null || arenaRankValid(candidate, rank, branchId)) &&
        !candidate.includes(remove) &&
        candidate.includes(add)
      )
        return candidate;
    }
  }
  return base;
}

export function engineerArenaAISide(
  baseGenomes,
  difficulty = "medium",
  opponentGenomes = null,
  seed = Date.now(),
  ranks = null,
) {
  let result = ARENA_BRANCHES.map((branch, index) =>
    completeArenaBranchGenome(baseGenomes?.[index] ?? [], branch.id),
  );
  const random = lcg(seed);
  let wanted;
  if (difficulty === "hard") {
    wanted = [
      ...new Set(counterTargets(opponentGenomes).map((entry) => entry.trait)),
    ];
  } else if (difficulty === "medium") {
    wanted = arenaAISide("medium", null, seed).flat();
  } else {
    wanted = ARENA_BRANCHES.flatMap((branch) => {
      const all = arenaSelectableTraits(branch.id);
      return Array.from(
        { length: 4 },
        () => all[Math.floor(random() * all.length)],
      );
    });
  }
  for (let change = 0; change < ARENA_ENGINEERING_CHANGES; change++) {
    const index = change % 2,
      branch = ARENA_BRANCHES[index],
      branchWanted = wanted.filter((trait) =>
        arenaSelectableTraits(branch.id).includes(trait),
      );
    result[index] = swapToward(
      result[index],
      branchWanted,
      branch.id,
      ranks?.[index] ?? null,
    );
  }
  return result;
}

export { ARENA_ENGINEERING_CHANGES };
