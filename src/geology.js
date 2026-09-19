const NEGATIVE_TRAITS = new Set([
  "Esterilidade",
  "Mutação Deletéria",
  "Mutação Disfuncional",
]);

export const GEOLOGICAL_STAGES = [
  {
    id: "archean",
    group: "Pré-Cambriano",
    period: "Arqueano",
    required: ["Fotossíntese", "Predação", "Fertilidade", "Dormência"],
    cycles: [
      ["Fotossíntese", "Predação"],
      ["Fertilidade", "Dormência"],
    ],
    habitat: { fertile: 52, hostile: 0, founderFertile: true },
    events: { volcano: 4, earthquake: 3, solar: 3, meteor: 2 },
  },
  {
    id: "proterozoic",
    group: "Pré-Cambriano",
    period: "Proterozoico",
    required: [
      "Resistência",
      "Regeneração",
      "Reprodução Sexuada",
      "Esporos",
      "Carnívoro",
    ],
    habitat: { fertile: 42, hostile: 2, founderFertile: true },
    events: {
      fertilized: 3,
      volcano: 2,
      ice: 2,
      "abundant-rains": 2,
      solar: 1,
      earthquake: 1,
    },
  },
  {
    id: "ediacaran",
    group: "Pré-Cambriano",
    period: "Ediacarano",
    required: ["Locomoção", "Necrófago", "Construção de Nicho"],
    habitat: { fertile: 30, hostile: 4, founderFertile: true },
    events: {
      abundance: 3,
      fertilized: 3,
      "abundant-rains": 2,
      sea: 1,
      earthquake: 1,
    },
  },
  {
    id: "cambrian",
    group: "Paleozoico",
    period: "Cambriano",
    required: ["Carapaça", "Camuflagem", "Veneno"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: {
      sea: 3,
      abundance: 3,
      "alluvial-river": 2,
      volcano: 1,
      earthquake: 1,
    },
  },
  {
    id: "ordovician",
    group: "Paleozoico",
    period: "Ordoviciano",
    required: ["Ovos"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: { ice: 4, sea: 3, blockade: 1, earthquake: 1 },
  },
  {
    id: "silurian",
    group: "Paleozoico",
    period: "Siluriano",
    required: ["Coletor"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: {
      "alluvial-river": 3,
      "abundant-rains": 3,
      sea: 2,
      fertilized: 1,
    },
  },
  {
    id: "devonian",
    group: "Paleozoico",
    period: "Devoniano",
    required: ["Locomoção Avançada", "Onívoro"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: {
      "alluvial-river": 3,
      abundance: 2,
      drought: 2,
      desert: 1,
      sea: 1,
    },
  },
  {
    id: "carboniferous",
    group: "Paleozoico",
    period: "Carbonífero",
    required: ["Ovíparo", "Ooteca", "Voo"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: {
      "abundant-rains": 4,
      abundance: 3,
      fertilized: 2,
      sea: 1,
    },
  },
  {
    id: "permian",
    group: "Paleozoico",
    period: "Permiano",
    required: ["Cuidado Parental"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: { volcano: 5, drought: 4, desert: 4, blockade: 2, earthquake: 1 },
  },
  {
    id: "triassic",
    group: "Mesozoico",
    period: "Triássico",
    required: ["Vivíparo"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: { drought: 3, desert: 3, volcano: 2, insularization: 2, sea: 1 },
  },
  {
    id: "jurassic",
    group: "Mesozoico",
    period: "Jurássico",
    required: ["Visão Noturna"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: {
      sea: 3,
      insularization: 3,
      "abundant-rains": 2,
      "alluvial-river": 2,
      earthquake: 1,
    },
  },
  {
    id: "cretaceous",
    group: "Mesozoico",
    period: "Cretáceo",
    required: ["Eusocialidade", "Ovífagia"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: { sea: 3, abundance: 2, insularization: 2, meteor: 1, volcano: 1 },
  },
  {
    id: "paleogene",
    group: "Cenozoico",
    period: "Paleógeno",
    required: [],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: {
      earthquake: 2,
      "alluvial-river": 2,
      "abundant-rains": 2,
      insularization: 2,
      abundance: 1,
    },
  },
  {
    id: "neogene",
    group: "Cenozoico",
    period: "Neógeno",
    required: ["Chifre", "Construtor Avançado", "Polegar Opositor"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: { drought: 3, desert: 3, earthquake: 2, ice: 1, "alluvial-river": 1 },
  },
  {
    id: "quaternary",
    group: "Cenozoico",
    period: "Quaternário",
    required: ["Neocórtex Desenvolvido"],
    habitat: { fertile: 14, hostile: 7, standard: true },
    events: { ice: 5, drought: 3, desert: 3, earthquake: 2, meteor: 1 },
  },
].map((stage, index) => ({ ...stage, index }));

const byId = new Map(GEOLOGICAL_STAGES.map((stage) => [stage.id, stage]));

export const TRAIT_STAGE = {
  Fotossíntese: "archean",
  Embriófitas: "ordovician",
  Traqueófitas: "silurian",
  Espinhos: "devonian",
  Gimnospermas: "carboniferous",
  Angiospermas: "cretaceous",
  Fertilidade: "archean",
  Dormência: "archean",
  "Reprodução Sexuada": "proterozoic",
  Regeneração: "proterozoic",
  Resistência: "proterozoic",
  Predação: "archean",
  Carnívoro: "proterozoic",
  Esporos: "proterozoic",
  Locomoção: "ediacaran",
  "Construção de Nicho": "ediacaran",
  Necrófago: "ediacaran",
  Carapaça: "cambrian",
  Camuflagem: "cambrian",
  Veneno: "cambrian",
  Ovos: "ordovician",
  Coletor: "silurian",
  "Locomoção Avançada": "devonian",
  Onívoro: "devonian",
  Voo: "carboniferous",
  Ovíparo: "carboniferous",
  Ooteca: "carboniferous",
  "Cuidado Parental": "permian",
  Vivíparo: "triassic",
  "Visão Noturna": "jurassic",
  Eusocialidade: "cretaceous",
  Ovífagia: "cretaceous",
  "Polegar Opositor": "neogene",
  Chifre: "neogene",
  "Construtor Avançado": "neogene",
  "Neocórtex Desenvolvido": "quaternary",
};

export const TRAIT_DEPENDENCIES = {
  Embriófitas: { historical: ["Fotossíntese"], piece: ["Fotossíntese"] },
  Traqueófitas: {
    historical: ["Embriófitas"],
    piece: ["Fotossíntese", "Embriófitas"],
  },
  Espinhos: {
    historical: ["Traqueófitas"],
    piece: ["Fotossíntese", "Traqueófitas"],
  },
  Gimnospermas: {
    historical: ["Traqueófitas"],
    piece: ["Fotossíntese", "Traqueófitas"],
  },
  Angiospermas: {
    historical: ["Gimnospermas"],
    piece: ["Fotossíntese", "Embriófitas", "Gimnospermas"],
  },
  Carnívoro: { historical: ["Predação"], piece: ["Predação"] },
  Locomoção: { historical: ["Predação"], piece: ["Predação"] },
  "Locomoção Avançada": { historical: ["Locomoção"] },
  Voo: { historical: ["Locomoção"] },
  "Cuidado Parental": { historical: ["Ovíparo"] },
  Vivíparo: { historical: ["Ovíparo"] },
  "Visão Noturna": { historical: ["Camuflagem"] },
  Ovífagia: { historical: ["Ovíparo"] },
  Onívoro: { historical: ["Carnívoro"], piece: ["Carnívoro"] },
  "Polegar Opositor": { historical: ["Construção de Nicho"] },
  Chifre: { historical: ["Predação"] },
  "Construtor Avançado": {
    historical: ["Construção de Nicho"],
    piece: ["Construção de Nicho"],
  },
  "Neocórtex Desenvolvido": { historical: ["Polegar Opositor"] },
};

export const PLANT_DERIVED_TRAITS = new Set([
  "Embriófitas",
  "Traqueófitas",
  "Espinhos",
  "Gimnospermas",
  "Angiospermas",
]);

export const PLANT_INCOMPATIBLE_TRAITS = new Set([
  "Predação",
  "Locomoção",
  "Locomoção Avançada",
  "Carnívoro",
  "Onívoro",
  "Necrófago",
  "Ovos",
  "Ovíparo",
  "Ovífagia",
  "Vivíparo",
  "Cuidado Parental",
  "Ooteca",
  "Voo",
  "Visão Noturna",
  "Eusocialidade",
  "Chifre",
  "Polegar Opositor",
  "Neocórtex Desenvolvido",
  "Construtor Avançado",
]);

export function traitCombinationValid(traits) {
  const set = new Set(traits ?? []);
  if (
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  )
    return false;
  if ([...PLANT_DERIVED_TRAITS].some((trait) => set.has(trait)) && !set.has("Fotossíntese"))
    return false;
  if (set.has("Locomoção") && !set.has("Predação")) return false;
  if (set.has("Carnívoro") && !set.has("Predação")) return false;
  if (set.has("Onívoro") && !set.has("Carnívoro")) return false;
  return true;
}

export function normalizeEnergyBranch(traits, preferred = null) {
  const set = new Set(traits ?? []);
  if (
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  ) {
    const requiresAnimalBranch =
      set.has("Predação") &&
      (set.has("Locomoção") ||
        set.has("Carnívoro") ||
        set.has("Onívoro") ||
        preferred === "Predação");
    if (requiresAnimalBranch) {
      set.delete("Fotossíntese");
      for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
    } else {
      for (const trait of PLANT_INCOMPATIBLE_TRAITS) set.delete(trait);
    }
  }
  if (!set.has("Fotossíntese"))
    for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
  if (!set.has("Predação")) {
    set.delete("Locomoção");
    set.delete("Carnívoro");
    set.delete("Onívoro");
  }
  if (!set.has("Carnívoro")) set.delete("Onívoro");
  return [...set];
}

export function applyTraitMutation(traits, trait) {
  const set = new Set(traits ?? []);
  if (trait === "Predação") {
    set.delete("Fotossíntese");
    for (const plantTrait of PLANT_DERIVED_TRAITS) set.delete(plantTrait);
    set.add("Predação");
  } else if (trait === "Fotossíntese") {
    for (const animalTrait of PLANT_INCOMPATIBLE_TRAITS) set.delete(animalTrait);
    set.add("Fotossíntese");
  } else set.add(trait);
  return normalizeEnergyBranch([...set]);
}

export function traitLossAllowed(piece, trait) {
  const traits = new Set(piece?.traits ?? []);
  if (
    trait === "Fotossíntese" &&
    [...PLANT_DERIVED_TRAITS].some((plantTrait) => traits.has(plantTrait))
  )
    return false;
  if (
    trait === "Embriófitas" &&
    (traits.has("Traqueófitas") || traits.has("Angiospermas"))
  )
    return false;
  if (
    trait === "Traqueófitas" &&
    (traits.has("Espinhos") ||
      traits.has("Gimnospermas") ||
      traits.has("Angiospermas"))
  )
    return false;
  if (trait === "Gimnospermas" && traits.has("Angiospermas")) return false;
  if (
    trait === "Predação" &&
    (traits.has("Locomoção") || traits.has("Carnívoro") || traits.has("Onívoro"))
  )
    return false;
  if (trait === "Carnívoro" && traits.has("Onívoro")) return false;
  return true;
}

export function geologicalStage(id) {
  return byId.get(id) ?? byId.get("archean");
}

export function currentGeologicalStage(state) {
  return geologicalStage(state.geologicalStage);
}

export function nextGeologicalStage(id) {
  const stage = geologicalStage(id);
  return GEOLOGICAL_STAGES[Math.min(stage.index + 1, GEOLOGICAL_STAGES.length - 1)];
}

export function geologicalLabel(state) {
  const stage = currentGeologicalStage(state);
  return `${stage.group} · ${stage.period}`;
}

export function cycleRequiredInnovations(state) {
  const stage = currentGeologicalStage(state);
  if (!stage.cycles?.length) return [...stage.required];
  const history = new Set(state.historicalTraits ?? []),
    availableCount = Math.min(
      Math.max(1, state.cycle ?? 1),
      stage.cycles.length,
    ),
    available = stage.cycles.slice(0, availableCount),
    pending = available.find((group) =>
      group.some((trait) => !history.has(trait)),
    );
  return [...(pending ?? available.at(-1) ?? stage.required)];
}

export function missingInnovations(state) {
  const stage = currentGeologicalStage(state),
    discovered = new Set(state.historicalTraits ?? []);
  return stage.required.filter((trait) => !discovered.has(trait));
}

export function stageProgress(state) {
  const required = cycleRequiredInnovations(state),
    discovered = required.filter((trait) =>
      (state.historicalTraits ?? []).includes(trait),
    ),
    missing = required.filter(
      (trait) => !(state.historicalTraits ?? []).includes(trait),
    );
  return {
    required,
    discovered,
    missing,
    complete: missing.length === 0,
  };
}

export function stageComplete(state) {
  const stage = currentGeologicalStage(state),
    minimumCycle = stage.cycles?.length ?? 1;
  return (
    (state.cycle ?? 1) >= minimumCycle &&
    missingInnovations(state).length === 0
  );
}

export function traitUnlocked(state, trait, piece = null) {
  if (NEGATIVE_TRAITS.has(trait)) return true;
  if (
    piece?.traits?.includes("Fotossíntese") &&
    trait !== "Predação" &&
    PLANT_INCOMPATIBLE_TRAITS.has(trait)
  )
    return false;
  const stageId = TRAIT_STAGE[trait];
  if (!stageId) return true;
  const current = currentGeologicalStage(state),
    requiredStage = geologicalStage(stageId);
  if (current.index < requiredStage.index) return false;
  const deps = TRAIT_DEPENDENCIES[trait],
    history = new Set(state.historicalTraits ?? []);
  if (current.id === requiredStage.id && current.required.includes(trait)) {
    const activeRequired = cycleRequiredInnovations(state),
      nextRequired = activeRequired.find((candidate) => !history.has(candidate));
    if (!history.has(trait)) {
      if (!activeRequired.includes(trait)) return false;
      if (nextRequired !== trait) return false;
    } else if (
      nextRequired &&
      activeRequired.includes(trait) &&
      activeRequired.indexOf(trait) < activeRequired.indexOf(nextRequired)
    )
      return false;
  }
  if (deps?.historical?.some((dependency) => !history.has(dependency)))
    return false;
  if (
    deps?.piece?.some(
      (dependency) => !piece?.traits?.includes(dependency),
    )
  )
    return false;
  return true;
}

export function pawnMutationUnlocked(state) {
  return (state.totalCycles ?? 1) >= 2;
}

export function deleteriousMutationUnlocked(state) {
  return (state.totalCycles ?? 1) >= 2;
}

export function rankMutationUnlocked(state) {
  return currentGeologicalStage(state).index >= geologicalStage("cambrian").index;
}

export function captureUnlocked(state, piece = null) {
  if (!piece) return false;
  return piece.traits?.includes("Predação") ?? false;
}

export function pathogenUnlocked(state) {
  return currentGeologicalStage(state).index >= geologicalStage("proterozoic").index;
}

export function innovationWeight() {
  return 1;
}

export function eventWeights(state) {
  return { ...currentGeologicalStage(state).events };
}

export function habitatProfile(stateOrStage) {
  const stage =
    typeof stateOrStage === "string"
      ? geologicalStage(stateOrStage)
      : currentGeologicalStage(stateOrStage);
  return { ...stage.habitat };
}

export function recordHistoricalTraits(state, piece) {
  const seen = new Set(state.historicalTraits ?? []),
    added = [];
  for (const trait of piece?.traits ?? []) {
    if (NEGATIVE_TRAITS.has(trait) || !TRAIT_STAGE[trait] || seen.has(trait))
      continue;
    seen.add(trait);
    added.push(trait);
  }
  state.historicalTraits = [...seen];
  return added;
}

export function firstCompatibleStage(traits) {
  const wanted = new Set(traits ?? []);
  let max = 0;
  for (const trait of wanted) {
    const id = TRAIT_STAGE[trait];
    if (id) max = Math.max(max, geologicalStage(id).index);
  }
  return GEOLOGICAL_STAGES[max];
}

export function priorRequiredInnovations(stageId) {
  const stage = geologicalStage(stageId);
  return GEOLOGICAL_STAGES.slice(0, stage.index).flatMap(
    (entry) => entry.required,
  );
}


export function isNegativeTrait(trait) {
  return NEGATIVE_TRAITS.has(trait);
}
