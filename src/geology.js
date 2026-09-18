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
    required: ["Fotossíntese", "Fertilidade", "Dormência"],
    habitat: { fertile: 52, hostile: 0, founderFertile: true },
    events: { volcano: 4, earthquake: 3, solar: 3, meteor: 2 },
  },
  {
    id: "proterozoic",
    group: "Pré-Cambriano",
    period: "Proterozoico",
    required: [
      "Reprodução Sexuada",
      "Regeneração",
      "Resistência",
      "Construção de Nicho",
      "Necrófago",
      "Esporos",
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
    required: ["Locomoção"],
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
    required: ["Predador", "Carapaça", "Camuflagem", "Veneno"],
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
    required: ["Voo", "Ovíparo", "Ooteca"],
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
    required: ["Polegar Opositor"],
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
];

const byId = new Map(GEOLOGICAL_STAGES.map((stage, index) => [stage.id, { ...stage, index }]));

export const TRAIT_STAGE = {
  Fotossíntese: "archean",
  Fertilidade: "archean",
  Dormência: "archean",
  "Reprodução Sexuada": "proterozoic",
  Regeneração: "proterozoic",
  Resistência: "proterozoic",
  "Construção de Nicho": "proterozoic",
  Necrófago: "proterozoic",
  Esporos: "proterozoic",
  Locomoção: "ediacaran",
  Predador: "cambrian",
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
  "Neocórtex Desenvolvido": "quaternary",
};

export const TRAIT_DEPENDENCIES = {
  "Locomoção Avançada": { piece: ["Locomoção"] },
  Voo: { historical: ["Locomoção"] },
  "Cuidado Parental": { historical: ["Ovíparo"] },
  Vivíparo: { historical: ["Ovíparo"] },
  "Visão Noturna": { historical: ["Camuflagem"] },
  Ovífagia: { historical: ["Ovíparo"] },
  "Polegar Opositor": { historical: ["Construção de Nicho"] },
  "Neocórtex Desenvolvido": { historical: ["Polegar Opositor"] },
};

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

export function missingInnovations(state) {
  const stage = currentGeologicalStage(state),
    discovered = new Set(state.historicalTraits ?? []);
  return stage.required.filter((trait) => !discovered.has(trait));
}

export function stageProgress(state) {
  const stage = currentGeologicalStage(state),
    missing = missingInnovations(state);
  return {
    required: [...stage.required],
    discovered: stage.required.filter((trait) =>
      (state.historicalTraits ?? []).includes(trait),
    ),
    missing,
    complete: missing.length === 0,
  };
}

export function stageComplete(state) {
  return missingInnovations(state).length === 0;
}

export function traitUnlocked(state, trait, piece = null) {
  if (NEGATIVE_TRAITS.has(trait)) return true;
  const stageId = TRAIT_STAGE[trait];
  if (!stageId) return true;
  const current = currentGeologicalStage(state),
    requiredStage = geologicalStage(stageId);
  if (current.index < requiredStage.index) return false;
  const deps = TRAIT_DEPENDENCIES[trait],
    history = new Set(state.historicalTraits ?? []);
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

export function rankMutationUnlocked(state) {
  return currentGeologicalStage(state).index >= geologicalStage("cambrian").index;
}

export function captureUnlocked(state) {
  return rankMutationUnlocked(state);
}

export function pathogenUnlocked(state) {
  return currentGeologicalStage(state).index >= geologicalStage("proterozoic").index;
}

export function innovationWeight(state, trait) {
  if (!currentGeologicalStage(state).required.includes(trait)) return 1;
  if ((state.historicalTraits ?? []).includes(trait)) return 1;
  const missing = missingInnovations(state),
    cycleBoost = Math.min(4, 1 + Math.max(0, (state.cycle ?? 1) - 1) * 0.5);
  return Math.min(5, cycleBoost + (missing.length === 1 ? 1 : 0));
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
