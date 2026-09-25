import { EVENTS } from "./constants.js";

export const SCENARIOS = [
  { id: "earth", label: "Vida na Terra" },
  { id: "alternative", label: "Cenários Alternativos" },
  { id: "arena", label: "Arena" },
];
export const DEFAULT_SCENARIO = "earth";
export const LEGACY_SCENARIO = "alternative";
export const ARENA_TRAIT_BUDGET = 6;
export const ARENA_ENGINEERING_CHANGES = 2;
export const ARENA_HABITAT = {
  fertile: 14,
  hostile: 7,
  standard: true,
  naturalBarriers: [2, 4],
  pattern: "balanced",
};

export const EARTH_FOUNDER_GENOMES = {
  proterozoic: {
    plant: ["Fotossíntese", "Dormência"],
    animal: ["Predação", "Dormência"],
    rank: 0,
  },
  ediacaran: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Reprodução Sexuada",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Reprodução Sexuada",
      "Carnívoro",
    ],
    rank: 0,
  },
  cambrian: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Reprodução Sexuada",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Escavador",
      "Construtor de Nicho",
      "Necrófago",
    ],
    rank: 0,
  },
  ordovician: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Reprodução Sexuada",
      "Carapaça",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Percepção Espacial",
      "Carnívoro",
      "Carapaça",
      "Camuflagem",
    ],
    rank: 1,
  },
  silurian: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Reprodução Sexuada",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Percepção Espacial",
      "Ovíparo",
      "Herbívoro",
    ],
    rank: 1,
  },
  devonian: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Herbívoro",
      "Coletor",
    ],
    rank: 2,
  },
  carboniferous: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Madeira",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Onívoro",
      "Visão Binocular",
      "Ovíparo",
    ],
    rank: 2,
  },
  permian: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Voo",
      "Carnívoro",
    ],
    rank: 3,
  },
  triassic: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      "Extremófitas",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Incubação",
      "Carnívoro",
      "Garras",
    ],
    rank: 3,
  },
  jurassic: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      "Extremófitas",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Vivíparo",
      "Incubação",
      "Notívago",
      "Lactação",
    ],
    rank: 3,
  },
  cretaceous: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      "Extremófitas",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Vivíparo",
      "Incubação",
      "Notívago",
      "Visão Noturna",
      "Sociabilidade",
    ],
    rank: 5,
  },
  paleogene: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      "Angiospermas",
      "Perfume Floral",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Incubação",
      "Eusocialidade",
      "Voo",
    ],
    rank: 5,
  },
  neogene: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      "Angiospermas",
      "Carnivoria Botânica",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Vivíparo",
      "Lactação",
      "Onívoro",
    ],
    rank: 5,
  },
  quaternary: {
    plant: [
      "Fotossíntese",
      "Multicelularismo",
      "Respiração aeróbia",
      "Embriófitas",
      "Traqueófitas",
      "Gimnospermas",
      "Angiospermas",
    ],
    animal: [
      "Predação",
      "Multicelularismo",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Vertebrado",
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Percepção Espacial",
      "Ovíparo",
      "Ovíparos Amniotas",
      "Vivíparo",
      "Onívoro",
      "Escavador",
      "Construtor de Nicho",
      "Polegar Opositor",
    ],
    rank: 5,
  },
};

const CONTEXT_AFFINITIES = {
  "Percepção Espacial": ["Locomoção Articulada"],
  Carapaça: ["Predação"],
  Camuflagem: ["Locomoção Articulada"],
  Veneno: ["Carnívoro"],
  Necrófago: ["Predação"],
  Coprofagia: ["Locomoção Terrestre"],
  Ooteca: ["Ovíparo"],
  Mimetismo: ["Camuflagem"],
  Sociabilidade: ["Incubação"],
  Eusocialidade: ["Sociabilidade"],
  "Perfume Floral": ["Angiospermas"],
  "Carnivoria Botânica": ["Angiospermas"],
  "Plantas Domesticadas": ["Angiospermas"],
  "Animais Domésticos": ["Neocórtex Desenvolvido"],
};

export function validScenario(id) {
  return SCENARIOS.some((entry) => entry.id === id);
}

export function scenarioEventWeights(state, periodWeights) {
  if (state?.scenario === "alternative" || state?.scenario === "arena")
    return Object.fromEntries(EVENTS.map((event) => [event.id, 1]));
  return { ...periodWeights };
}

export function immediateEventRepeatAllowed(state) {
  return state?.scenario === "alternative" || state?.scenario === "arena";
}

export function scenarioHabitatProfile(state, periodProfile) {
  return state?.scenario === "arena" ? { ...ARENA_HABITAT } : { ...periodProfile };
}

export function earthTraitWindowAllows(state, currentStageId, traitStageId) {
  if (state?.scenario !== "earth" || !traitStageId) return true;
  return currentStageId === traitStageId;
}

export function scenarioInnovationWeight(
  state,
  trait,
  piece,
  { required = false, dependencyMatched = false } = {},
) {
  if (state?.scenario !== "earth") return 1;
  if (required) return 4;
  if (dependencyMatched) return 3;
  const lineage = new Set([...(piece?.ancestry ?? []), ...(piece?.traits ?? [])]);
  if ((CONTEXT_AFFINITIES[trait] ?? []).some((candidate) => lineage.has(candidate)))
    return 2;
  return 1;
}
