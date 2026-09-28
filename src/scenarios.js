import { EVENTS } from "./constants.js";

export const SCENARIOS = [
  { id: "earth", label: "Vida na Terra" },
  { id: "alternative", label: "Cenários Alternativos" },
  { id: "arena", label: "Arena" },
];
export const DEFAULT_SCENARIO = "earth";
export const LEGACY_SCENARIO = "alternative";
export const ARENA_ENGINEERING_CHANGES = 2;
export const ARENA_HABITAT = {
  fertile: 14,
  hostile: 7,
  standard: true,
  naturalBarriers: [2, 4],
  pattern: "balanced",
};

export const EARTH_FOUNDER_GENOMES = Object.freeze({
  eoarchean: {
    plant: ["Respiração anaeróbia", "Fotossíntese"],
    animal: ["Respiração anaeróbia", "Predação"],
    rank: 4,
  },
  paleoarchean: {
    plant: ["Respiração anaeróbia", "Fotossíntese", "Quimiossíntese"],
    animal: ["Respiração anaeróbia", "Predação", "Quimiossíntese"],
    rank: 4,
  },
  mesoarchean: {
    plant: ["Respiração anaeróbia", "Fotossíntese", "Quimiossíntese", "Transferência Horizontal"],
    animal: ["Respiração anaeróbia", "Predação", "Quimiossíntese", "Transferência Horizontal"],
    rank: 4,
  },
  neoarchean: {
    plant: ["Respiração anaeróbia", "Fotossíntese", "Quimiossíntese", "Transferência Horizontal", "Reparo Celular"],
    animal: ["Respiração anaeróbia", "Predação", "Quimiossíntese", "Transferência Horizontal", "Reparo Celular"],
    rank: 4,
  },
  siderian: {
    plant: ["Fotossíntese", "Reparo Celular", "Dormência"],
    animal: ["Predação", "Reparo Celular", "Dormência"],
    rank: 4,
  },
  rhyacian: {
    plant: ["Fotossíntese", "Reparo Celular", "Dormência", "Respiração aeróbia", "Resistência"],
    animal: ["Predação", "Reparo Celular", "Dormência", "Respiração aeróbia", "Resistência"],
    rank: 4,
  },
  orosirian: {
    plant: ["Fotossíntese", "Reparo Celular", "Respiração aeróbia", "Eucarionte", "Endossimbiose"],
    animal: ["Predação", "Reparo Celular", "Respiração aeróbia", "Eucarionte", "Endossimbiose"],
    rank: 4,
  },
  statherian: {
    plant: ["Fotossíntese", "Reparo Celular", "Respiração aeróbia", "Eucarionte", "Endossimbiose", "Multicelularismo"],
    animal: ["Predação", "Reparo Celular", "Respiração aeróbia", "Eucarionte", "Endossimbiose", "Multicelularismo"],
    rank: 4,
  },
  calymmian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Regeneração", "Brotamento"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Regeneração", "Brotamento"],
    rank: 4,
  },
  ectasian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Regeneração", "Brotamento", "Reprodução Sexuada"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Regeneração", "Brotamento", "Reprodução Sexuada"],
    rank: 4,
  },
  stenian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Ingestão"],
    rank: 4,
  },
  tonian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Brotamento"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Ingestão", "Carnívoro"],
    rank: 4,
  },
  cryogenian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Brotamento", "Colônia", "Séssil"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Ingestão", "Carnívoro", "Brotamento", "Colônia"],
    rank: 4,
  },
  ediacaran: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Regeneração", "Fragmentação", "Colônia"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Regeneração", "Fragmentação", "Carnívoro"],
    rank: 4,
  },
  cambrian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Regeneração"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Simetria Bilateral", "Locomoção Primitiva", "Biomineralização", "Escavador", "Construtor de Nicho", "Necrófago"],
    rank: 0,
  },
  ordovician: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Carapaça"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Simetria Bilateral", "Vertebrado", "Locomoção Articulada", "Percepção Espacial", "Carnívoro", "Carapaça", "Camuflagem", "Toxicidade"],
    rank: 1,
  },
  silurian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Reprodução Sexuada"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Percepção Espacial", "Ovíparo", "Herbívoro"],
    rank: 1,
  },
  devonian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Herbívoro", "Coletor"],
    rank: 2,
  },
  carboniferous: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Madeira"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Onívoro", "Visão Binocular", "Ovíparo"],
    rank: 2,
  },
  permian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Ooteca", "Voo", "Carnívoro"],
    rank: 3,
  },
  triassic: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Incubação", "Carnívoro", "Presas"],
    rank: 3,
  },
  jurassic: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Vivíparo", "Incubação", "Notívago", "Lactação"],
    rank: 3,
  },
  cretaceous: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Vivíparo", "Incubação", "Notívago", "Visão Noturna", "Sociabilidade"],
    rank: 5,
  },
  paleocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Perfume Floral"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Incubação", "Eusocialidade", "Voo"],
    rank: 5,
  },
  eocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Perfume Floral"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Onívoro", "Ruminante", "Garras", "Roedor", "Monogamia"],
    rank: 5,
  },
  oligocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Epizoocoria"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Onívoro", "Ecolocalização", "Caça Cooperativa"],
    rank: 5,
  },
  miocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Mirmecocoria"],
    animal: ["Predação", "Escavador", "Construtor de Nicho", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Onívoro", "Interceptação preditiva"],
    rank: 5,
  },
  pliocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Capsaicina"],
    animal: ["Predação", "Escavador", "Construtor de Nicho", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Onívoro", "Chifre"],
    rank: 5,
  },
  pleistocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas"],
    animal: ["Predação", "Escavador", "Construtor de Nicho", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Onívoro", "Polegar Opositor", "Bipedalismo", "Córtex Pré-Frontal"],
    rank: 5,
  },
  holocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Onívoro", "Escavador", "Construtor de Nicho", "Polegar Opositor", "Córtex Pré-Frontal", "Neocórtex Desenvolvido"],
    rank: 5,
  },
});

const CONTEXT_AFFINITIES = {
  "Percepção Espacial": ["Locomoção Articulada"],
  "Respiração Pulmonar": ["Vertebrado", "Locomoção Terrestre"],
  Carapaça: ["Predação"],
  Ingestão: ["Multicelularismo", "Predação"],
  Camuflagem: ["Locomoção Articulada"],
  Veneno: ["Carnívoro"],
  Necrófago: ["Predação"],
  Coprofagia: ["Locomoção Terrestre"],
  Ooteca: ["Ovíparo"],
  Mimetismo: ["Camuflagem"],
  Sociabilidade: ["Incubação"],
  Eusocialidade: ["Sociabilidade"],
  "Perfume Floral": ["Angiospermas"],
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
