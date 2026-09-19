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
    habitat: { fertile: 52, hostile: 0, founderFertile: true, naturalBarriers: [0, 1] },
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
    habitat: { fertile: 42, hostile: 2, founderFertile: true, naturalBarriers: [0, 2] },
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
    required: ["Locomoção", "Escavador", "Construtor de Nicho"],
    habitat: { fertile: 30, hostile: 4, founderFertile: true, naturalBarriers: [1, 2] },
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
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [1, 3] },
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
    required: ["Ovíparo"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [1, 3] },
    events: { ice: 4, sea: 3, blockade: 1, earthquake: 1 },
  },
  {
    id: "silurian",
    group: "Paleozoico",
    period: "Siluriano",
    required: ["Coletor"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [1, 3] },
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
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 3] },
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
    required: ["Ovíparos Amniotas", "Ooteca", "Voo"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 4] },
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
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [3, 5] },
    events: { volcano: 5, drought: 4, desert: 4, blockade: 2, earthquake: 1 },
  },
  {
    id: "triassic",
    group: "Mesozoico",
    period: "Triássico",
    required: ["Vivíparo"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 4] },
    events: { drought: 3, desert: 3, volcano: 2, insularization: 2, sea: 1 },
  },
  {
    id: "jurassic",
    group: "Mesozoico",
    period: "Jurássico",
    required: ["Visão Noturna"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 4] },
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
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 4] },
    events: { sea: 3, abundance: 2, insularization: 2, meteor: 1, volcano: 1 },
  },
  {
    id: "paleogene",
    group: "Cenozoico",
    period: "Paleógeno",
    required: [],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [3, 5] },
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
    required: ["Chifre", "Polegar Opositor"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [4, 6] },
    events: { drought: 3, desert: 3, earthquake: 2, ice: 1, "alluvial-river": 1 },
  },
  {
    id: "quaternary",
    group: "Cenozoico",
    period: "Quaternário",
    required: ["Neocórtex Desenvolvido", "Construtor Avançado"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [3, 6] },
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
  Trepadeira: "carboniferous",
  Angiospermas: "cretaceous",
  Fertilidade: "archean",
  Dormência: "archean",
  "Reprodução Sexuada": "proterozoic",
  "Precocidade Sexual": "ediacaran",
  Regeneração: "proterozoic",
  Resistência: "proterozoic",
  Predação: "archean",
  Carnívoro: "proterozoic",
  Canibalismo: "cambrian",
  Esporos: "proterozoic",
  Locomoção: "ediacaran",
  Escavador: "ediacaran",
  "Construtor de Nicho": "ediacaran",
  Necrófago: "ediacaran",
  Carapaça: "cambrian",
  Camuflagem: "cambrian",
  Veneno: "cambrian",
  Coletor: "silurian",
  "Locomoção Avançada": "devonian",
  Escalador: "devonian",
  Onívoro: "devonian",
  "Respiração Cutânea": "devonian",
  Voo: "carboniferous",
  Ovíparo: "ordovician",
  "Ovíparos Amniotas": "carboniferous",
  Ooteca: "carboniferous",
  "Cuidado Parental": "permian",
  Ovovivíparo: "permian",
  Lactação: "triassic",
  Vivíparo: "triassic",
  "Sacos Aéreos": "triassic",
  "Ovulação Induzida": "paleogene",
  "Visão Noturna": "jurassic",
  Eusocialidade: "cretaceous",
  Ovífagia: "cretaceous",
  "Polegar Opositor": "neogene",
  Chifre: "neogene",
  "Construtor Avançado": "quaternary",
  "Neocórtex Desenvolvido": "quaternary",
};

export const TRAIT_DEPENDENCIES = {
  Embriófitas: { lineage: ["Fotossíntese"] },
  Traqueófitas: { lineage: ["Embriófitas"] },
  Espinhos: { lineage: ["Traqueófitas"] },
  Gimnospermas: { lineage: ["Traqueófitas"] },
  Trepadeira: { lineage: ["Traqueófitas"] },
  Angiospermas: { lineage: ["Gimnospermas"] },
  Carnívoro: { lineage: ["Predação"] },
  Canibalismo: { lineage: ["Carnívoro"] },
  "Precocidade Sexual": { lineage: ["Reprodução Sexuada"] },
  Locomoção: { lineage: ["Predação"] },
  Escavador: { lineage: ["Locomoção"] },
  "Locomoção Avançada": { lineage: ["Locomoção"] },
  Escalador: { lineage: ["Locomoção"] },
  "Respiração Cutânea": { lineage: ["Locomoção"] },
  "Sacos Aéreos": { lineage: ["Locomoção Avançada"] },
  Voo: { lineage: ["Locomoção"] },
  "Ovíparos Amniotas": { lineage: ["Ovíparo"] },
  Ovovivíparo: { lineage: ["Ovíparos Amniotas"] },
  "Cuidado Parental": { lineage: ["Ovíparo"] },
  Lactação: { lineage: ["Cuidado Parental"] },
  Vivíparo: { lineage: ["Ovíparos Amniotas"] },
  "Ovulação Induzida": { lineage: ["Vivíparo"] },
  "Visão Noturna": { lineage: ["Camuflagem"] },
  Ovífagia: { lineage: ["Ovíparo"] },
  Onívoro: { lineage: ["Carnívoro"] },
  "Construtor de Nicho": { lineage: ["Escavador"] },
  "Polegar Opositor": { lineage: ["Construtor de Nicho"] },
  Chifre: { lineage: ["Predação"] },
  "Construtor Avançado": { lineage: ["Construtor de Nicho"] },
  "Neocórtex Desenvolvido": { lineage: ["Polegar Opositor"] },
};

export const PLANT_DERIVED_TRAITS = new Set([
  "Embriófitas",
  "Traqueófitas",
  "Espinhos",
  "Gimnospermas",
  "Trepadeira",
  "Angiospermas",
]);

export const PLANT_INCOMPATIBLE_TRAITS = new Set([
  "Predação",
  "Locomoção",
  "Locomoção Avançada",
  "Escavador",
  "Escalador",
  "Respiração Cutânea",
  "Sacos Aéreos",
  "Carnívoro",
  "Canibalismo",
  "Onívoro",
  "Necrófago",
  "Ovíparo",
  "Ovíparos Amniotas",
  "Ovovivíparo",
  "Ovífagia",
  "Vivíparo",
  "Cuidado Parental",
  "Lactação",
  "Ovulação Induzida",
  "Ooteca",
  "Voo",
  "Visão Noturna",
  "Eusocialidade",
  "Chifre",
  "Construtor de Nicho",
  "Polegar Opositor",
  "Neocórtex Desenvolvido",
  "Construtor Avançado",
]);

export function traitCombinationValid(traits) {
  const set = new Set(traits ?? []);
  return !(
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  );
}

export function normalizeEnergyBranch(traits, preferred = null) {
  const set = new Set(traits ?? []);
  if (
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  ) {
    const animalBranch =
      preferred === "Predação" ||
      (set.has("Predação") &&
        [...PLANT_INCOMPATIBLE_TRAITS].some(
          (trait) => trait !== "Predação" && set.has(trait),
        ));
    if (animalBranch) {
      set.delete("Fotossíntese");
      for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
    } else {
      for (const trait of PLANT_INCOMPATIBLE_TRAITS) set.delete(trait);
    }
  }
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

export function traitLossAllowed() {
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
  const lineage = new Set([
    ...(piece?.ancestry ?? piece?.traits ?? []),
    ...(piece?.traits ?? []),
  ]);
  if (deps?.lineage?.some((dependency) => !lineage.has(dependency)))
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
