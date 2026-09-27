import { TRAITS } from "./constants.js";
import {
  MULTICELLULAR_DEPENDENT_TRAITS,
  PLANT_DERIVED_TRAITS,
  PLANT_INCOMPATIBLE_TRAITS,
  TRAIT_DEPENDENCIES,
  TRAIT_BRANCH_SCOPE,
  NEGATIVE_TRAITS,
  normalizeActiveTraits,
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
const ARENA_BRANCH_EXCLUSIONS = new Set(["Quimiossíntese", "Mixotrofia"]);
export const arenaTraitCost = (genome) =>
  new Set(
    (genome ?? []).filter((trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait)),
  ).size;
const order = new Map(Object.keys(TRAITS).map((trait, index) => [trait, index]));

export const ARENA_PRESETS = Object.freeze({
  animal: [
    { id: "microbial-predator", stage: "archean", label: "Predador microbiano", traits: ["Predação", "Transferência Horizontal", "Dormência"] },
    { id: "protoanimal", stage: "proterozoic", label: "Protoanimal filtrador", traits: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada"] },
    { id: "dickinsonia", stage: "ediacaran", label: "Dickinsonia", traits: ["Predação", "Multicelularismo", "Regeneração", "Simetria Bilateral", "Locomoção Primitiva"] },
    { id: "anomalocaris", stage: "cambrian", label: "Anomalocaris", traits: ["Predação", "Artrópode", "Locomoção Articulada", "Percepção Espacial", "Carnívoro", "Carapaça"] },
    { id: "nautiloid", stage: "ordovician", label: "Nautiloide gigante", traits: ["Predação", "Multicelularismo", "Jatopropulsão", "Corpo Gelatinoso", "Carnívoro", "Ovíparo", "Camuflagem"] },
    { id: "eurypterid", stage: "silurian", label: "Euriptérido", traits: ["Predação", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Carapaça"] },
    { id: "dunkleosteus", stage: "devonian", label: "Dunkleosteus", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Carnívoro", "Mandíbula", "Dentes", "Carapaça"] },
    { id: "meganeura", stage: "carboniferous", label: "Meganeura", traits: ["Predação", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Voo", "Carnívoro", "Visão Binocular"] },
    { id: "dimetrodon", stage: "permian", label: "Dimetrodon", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Presas"] },
    { id: "coelophysis", stage: "triassic", label: "Coelophysis", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Endotermia", "Ovíparos Amniotas"] },
    { id: "archaeopteryx", stage: "jurassic", label: "Archaeopteryx", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Voo", "Penas", "Ovíparos Amniotas"] },
    { id: "tyrannosaurus", stage: "cretaceous", label: "Tiranossauro rex", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Carnívoro", "Presas", "Visão Binocular", "Endotermia"] },
    { id: "basilosaurus", stage: "paleogene", label: "Basilosaurus", traits: ["Predação", "Vertebrado", "Carnívoro", "Respiração Pulmonar", "Predação em Massa", "Longevidade"] },
    { id: "megalodon", stage: "neogene", label: "Megalodon", traits: ["Predação", "Vertebrado", "Carnívoro", "Mandíbula", "Dentes", "Presas", "Longevidade"] },
    { id: "mammoth", stage: "quaternary", label: "Mamute", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Herbívoro", "Pelos", "Tromba", "Manada", "Vivíparo", "Lactação"] },
    { id: "kangaroo", stage: "quaternary", label: "Canguru-gigante", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Herbívoro", "Pelos", "Marsupial", "Pulo"] },
    { id: "homo-sapiens", stage: "quaternary", label: "Homo sapiens", traits: ["Predação", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Bipedalismo", "Polegar Opositor", "Córtex Pré-Frontal", "Neocórtex Desenvolvido", "Sociabilidade", "Caça Cooperativa"] },
  ],
  plant: [
    { id: "photosynthetic-mat", stage: "archean", label: "Tapete fotossintético", traits: ["Fotossíntese", "Dormência"] },
    { id: "multicellular-alga", stage: "proterozoic", label: "Alga multicelular", traits: ["Fotossíntese", "Multicelularismo", "Reprodução Sexuada", "Fragmentação"] },
    { id: "ediacaran-macroalga", stage: "ediacaran", label: "Macroalga ediacarana", traits: ["Fotossíntese", "Multicelularismo", "Fragmentação", "Séssil"] },
    { id: "calcareous-alga", stage: "cambrian", label: "Alga calcária", traits: ["Fotossíntese", "Multicelularismo", "Carapaça", "Colônia"] },
    { id: "early-embryophyte", stage: "ordovician", label: "Embriófita pioneira", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Tropismo"] },
    { id: "cooksonia", stage: "silurian", label: "Cooksonia", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Estômatos"] },
    { id: "archaeopteris", stage: "devonian", label: "Archaeopteris", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Madeira", "Espinhos"] },
    { id: "lepidodendron", stage: "carboniferous", label: "Lepidodendron", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Madeira", "Estômatos", "Trepadeira"] },
    { id: "glossopteris", stage: "permian", label: "Glossopteris", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Madeira", "Extremófitas"] },
    { id: "cycad", stage: "triassic", label: "Cicadácea", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Espinhos", "Extremófitas"] },
    { id: "araucaria", stage: "jurassic", label: "Araucária", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Madeira", "Extremófitas"] },
    { id: "cretaceous-flower", stage: "cretaceous", label: "Angiosperma cretácea", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Perfume Floral"] },
    { id: "palm", stage: "paleogene", label: "Palmeira", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Endozoocoria"] },
    { id: "pepper", stage: "neogene", label: "Pimenteira", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Endozoocoria", "Capsaicina"] },
    { id: "mandacaru", stage: "quaternary", label: "Mandacaru", traits: ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Espinhos", "Extremófitas"] },
  ],
});

export const ARENA_ARCHETYPES = Object.freeze(
  [...ARENA_PRESETS.animal.slice(3, 7), ...ARENA_PRESETS.plant.slice(5, 9)].map(
    (preset) => preset.traits,
  ),
);

const COUNTERS = {
  Camuflagem: "Visão Binocular",
  Notívago: "Visão Noturna",
  Velocidade: "Velocidade",
  "Pele grossa": "Presas",
  Ovíparo: "Ovífagia",
  "Ovíparos Amniotas": "Ovífagia",
  Ovovivíparo: "Ovífagia",
  Chifre: "Carapaça",
  Fotossíntese: "Herbívoro",
};

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

export function arenaSelectableTraits(branchId = null) {
  const branch = ARENA_BRANCHES.find((candidate) => candidate.id === branchId);
  return Object.keys(TRAITS).filter((trait) => {
    if (
      trait === BASAL ||
      NEGATIVE.has(trait) ||
      ARENA_FOUNDATIONAL_TRAITS.has(trait) ||
      ARENA_BRANCH_EXCLUSIONS.has(trait)
    )
      return false;
    if (!branch) return true;
    const scope = arenaTraitBranch(trait);
    return scope === "shared" || scope === branch.scope;
  });
}

export function arenaBranchLimit(branchId) {
  return ARENA_TRAIT_LIMITS[branchId] ?? Infinity;
}

const sorted = (traits) =>
  [...new Set(traits)].sort(
    (a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999),
  );

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

export function arenaSetupGenomeValid(genome, branchId) {
  return (
    arenaGenomeValid(genome, branchId) &&
    arenaTraitCost(genome) <= arenaBranchLimit(branchId)
  );
}

export function arenaPresetGenome(branchId, presetId) {
  const preset = ARENA_PRESETS[branchId]?.find(
    (candidate) => candidate.id === presetId,
  );
  return preset
    ? completeArenaBranchGenome(preset.traits, branchId)
    : completeArenaBranchGenome([], branchId);
}

export function arenaProfile(genome, rank = 4) {
  const completed = completeArenaGenome(genome),
    preferred = completed.includes("Fotossíntese")
      ? "Fotossíntese"
      : completed.includes("Predação")
        ? "Predação"
        : null,
    profile = {
      rank,
      traits: normalizeActiveTraits([BASAL, ...completed], preferred),
      ancestry: [BASAL, ...completed],
      genome: genomeFromTraits([BASAL, ...completed]),
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
    .map((preset) => arenaPresetGenome(branchId, preset.id))
    .filter((genome) => arenaSetupGenomeValid(genome, branchId));
}

export function randomArenaSide(seed = Date.now()) {
  const random = lcg(seed);
  return ARENA_BRANCHES.map((branch) => {
    const pool = archetypePool(branch.id);
    return pool[Math.floor(random() * pool.length)] ?? completeArenaBranchGenome([], branch.id);
  });
}

function counterScore(genome, opponentGenomes) {
  const own = new Set(genome),
    opponent = new Set((opponentGenomes ?? []).flat()),
    wanted = new Set(
      [...opponent].map((trait) => COUNTERS[trait]).filter(Boolean),
    );
  let score = 0;
  for (const trait of wanted) if (own.has(trait)) score++;
  return Math.min(3, score);
}

export function arenaAISide(
  difficulty = "medium",
  opponentGenomes = null,
  seed = Date.now(),
) {
  if (difficulty === "easy") return randomArenaSide(seed);
  if (difficulty === "hard" && opponentGenomes?.length) {
    return ARENA_BRANCHES.map((branch) => {
      const pool = archetypePool(branch.id);
      return pool
        .map((genome, index) => ({
          genome,
          index,
          score: counterScore(genome, opponentGenomes),
        }))
        .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.genome ??
        completeArenaBranchGenome([], branch.id);
    });
  }
  return ARENA_BRANCHES.map((branch, index) => {
    const pool = archetypePool(branch.id);
    return pool[((seed >>> 0) + index * 7) % pool.length];
  });
}

export function arenaInterventionCount(before, after) {
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
      (after ?? []).every((genome, index) =>
        arenaGenomeValid(genome, ARENA_BRANCHES[index]?.id ?? null),
      ),
  };
}

function swapToward(genome, wanted, branchId) {
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
) {
  let result = (baseGenomes ?? []).map((genome) => completeArenaGenome(genome));
  while (result.length < 2) result.push([...result[0]]);
  const random = lcg(seed);
  let wanted;
  if (difficulty === "hard") {
    const opponent = new Set((opponentGenomes ?? []).flat());
    wanted = [...new Set([...opponent].map((trait) => COUNTERS[trait]).filter(Boolean))];
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
    );
  }
  return result;
}

export { ARENA_ENGINEERING_CHANGES };
