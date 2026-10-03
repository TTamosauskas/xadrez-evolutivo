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
    plant: ["Respiração anaeróbia", "Quimiossíntese"],
    animal: ["Respiração anaeróbia", "Quimiossíntese"],
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
    animal: ["Predação", "Reparo Celular"],
    rank: 4,
  },
  rhyacian: {
    plant: ["Fotossíntese", "Reparo Celular", "Dormência", "Respiração aeróbia", "Resistência"],
    animal: ["Predação", "Reparo Celular", "Respiração aeróbia", "Resistência"],
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
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Brotamento"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Brotamento"],
    rank: 4,
  },
  ectasian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Brotamento", "Reprodução Sexuada"],
    animal: ["Predação", "Multicelularismo", "Respiração aeróbia", "Brotamento", "Reprodução Sexuada"],
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
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Fragmentação", "Colônia"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Fragmentação", "Carnívoro"],
    rank: 4,
  },
  cambrian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Simetria Bilateral", "Locomoção Primitiva", "Biomineralização", "Escavador", "Construtor de Nicho", "Necrófago"],
    rank: 0,
  },
  ordovician: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Reprodução Sexuada", "Carapaça"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Simetria Bilateral", "Vertebrado", "Locomoção Articulada", "Percepção Espacial", "Carnívoro", "Carapaça", "Camuflagem", "Toxicidade"],
    rank: 1,
  },
  silurian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Tropismo", "Reprodução Sexuada"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Percepção Espacial", "Ovíparo", "Herbívoro"],
    rank: 1,
  },
  devonian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Estômatos"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Mandíbula", "Ovíparo", "Herbívoro", "Coletor"],
    rank: 2,
  },
  carboniferous: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Madeira"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Mandíbula", "Dentes", "Onívoro", "Visão Binocular", "Ovíparo"],
    rank: 2,
  },
  permian: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Voo", "Carnívoro"],
    rank: 3,
  },
  triassic: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Incubação", "Carnívoro", "Presas"],
    animalLegacy: ["Mandíbula", "Dentes"],
    rank: 3,
  },
  jurassic: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Vivíparo", "Incubação", "Notívago", "Endotermia", "Lactação"],
    animalLegacy: ["Pelos"],
    rank: 3,
  },
  cretaceous: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparo", "Ovíparos Amniotas", "Vivíparo", "Incubação", "Notívago", "Visão Noturna", "Penas", "Sociabilidade"],
    rank: 5,
  },
  paleocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Endozoocoria", "Perfume Floral"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Ovíparos Amniotas", "Incubação", "Vivíparo", "Lactação", "Pelos", "Onívoro", "Eusocialidade"],
    animalLegacy: ["Ovífagia"],
    rank: 5,
  },
  eocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Perfume Floral"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Carnívoro", "Pelos", "Garras", "Roedor", "Monogamia"],
    animalLegacy: ["Cuidado Parental"],
    rank: 5,
  },
  oligocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Epizoocoria"],
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Herbívoro", "Pelos", "Ecolocalização"],
    animalLegacy: ["Predação em Massa", "Roedor", "Cuidado Parental"],
    rank: 5,
  },
  miocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Mirmecocoria"],
    animal: ["Predação", "Escavador", "Construtor de Nicho", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Herbívoro", "Pelos", "Ruminante", "Interceptação preditiva"],
    rank: 5,
  },
  pliocene: {
    plant: ["Fotossíntese", "Multicelularismo", "Respiração aeróbia", "Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas", "Endozoocoria", "Capsaicina"],
    animal: ["Predação", "Escavador", "Construtor de Nicho", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Vertebrado", "Locomoção Articulada", "Locomoção Terrestre", "Bipedalismo", "Respiração Pulmonar", "Percepção Espacial", "Vivíparo", "Lactação", "Onívoro", "Chifre"],
    animalLegacy: ["Tromba"],
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


export const EARTH_ARTHROPOD_FOUNDER_GENOMES = Object.freeze({
  cambrian: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Percepção Espacial", "Biomineralização", "Carapaça", "Carnívoro", "Esclerotização"],
    rank: 1,
  },
  ordovician: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Percepção Espacial", "Carnívoro", "Carapaça", "Camuflagem", "Toxicidade", "Ovíparo", "Sistema Adipocinético"],
    rank: 2,
  },
  silurian: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Mandíbula", "Carapaça", "Sistema Adipocinético"],
    rank: 2,
  },
  devonian: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Mandíbula", "Peçonha", "Extremotolerância", "Sistema Adipocinético"],
    rank: 2,
  },
  carboniferous: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Onívoro", "Voo", "Ooteca", "Metamorfose", "Esclerotização"],
    rank: 2,
  },
  permian: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Metamorfose", "Esclerotização", "Extremotolerância", "Movimento Lateral"],
    rank: 2,
  },
  triassic: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Metamorfose", "Parasitoidismo", "Teia", "Esclerotização"],
    rank: 2,
  },
  jurassic: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Metamorfose", "Forésia", "Matrifagia", "Teia", "Esclerotização"],
    rank: 2,
  },
  cretaceous: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Incubação", "Sociabilidade", "Eusocialidade", "Metamorfose", "Hipermetamorfose", "Recrutamento em Massa", "Trilhas"],
    rank: 2,
  },
  paleocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Onívoro", "Incubação", "Sociabilidade", "Eusocialidade", "Metamorfose", "Hipermetamorfose", "Recrutamento em Massa", "Ooteca"],
    rank: 2,
  },
  eocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Carnívoro", "Eusocialidade", "Metamorfose", "Hipermetamorfose", "Recrutamento em Massa", "Caça Cooperativa", "Ooteca"],
    rank: 2,
  },
  oligocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Onívoro", "Eusocialidade", "Metamorfose", "Recrutamento em Massa", "Superorganismo", "Trilhas", "Ooteca"],
    rank: 2,
  },
  miocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Herbívoro", "Eusocialidade", "Metamorfose", "Recrutamento em Massa", "Superorganismo", "Trilhas", "Extremotolerância"],
    rank: 2,
  },
  pliocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Onívoro", "Eusocialidade", "Metamorfose", "Hipermetamorfose", "Recrutamento em Massa", "Superorganismo", "Trilhas"],
    rank: 2,
  },
  pleistocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Onívoro", "Eusocialidade", "Metamorfose", "Hipermetamorfose", "Recrutamento em Massa", "Superorganismo", "Trilhas", "Ooteca"],
    rank: 2,
  },
  holocene: {
    animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Simetria Bilateral", "Artrópode", "Locomoção Articulada", "Locomoção Terrestre", "Percepção Espacial", "Ovíparo", "Onívoro", "Eusocialidade", "Metamorfose", "Hipermetamorfose", "Recrutamento em Massa", "Superorganismo", "Trilhas", "Ooteca"],
    rank: 2,
  },
});

export const EARTH_CAMBRIAN_VERTEBRATE_FOUNDER = Object.freeze({
  animal: ["Predação", "Multicelularismo", "Ingestão", "Respiração aeróbia", "Reprodução Sexuada", "Simetria Bilateral", "Vertebrado", "Locomoção Articulada", "Percepção Espacial"],
  rank: 0,
});

const MOLLUSK_FOUNDER_STAGE_IDS = Object.freeze([
  "cambrian",
  "ordovician",
  "silurian",
  "devonian",
  "carboniferous",
  "permian",
  "triassic",
  "jurassic",
  "cretaceous",
  "paleocene",
  "eocene",
  "oligocene",
  "miocene",
  "pliocene",
  "pleistocene",
  "holocene",
]);

function molluskFounderGenome(stageId) {
  const index = MOLLUSK_FOUNDER_STAGE_IDS.indexOf(stageId);
  if (index < 0) return null;
  const animal = [
    "Predação",
    "Multicelularismo",
    "Ingestão",
    "Respiração aeróbia",
    "Reprodução Sexuada",
    "Simetria Bilateral",
    "Locomoção Primitiva",
    "Cefalização",
    "Molusco",
    "Rádula",
    "Jatopropulsão",
    "Percepção Espacial",
    "Carnívoro",
    "Biomineralização",
    "Carapaça",
  ];
  if (index >= 1) animal.push("Ovíparo", "Camuflagem");
  if (index >= 1 && index < 4) animal.push("Concha Camerada");
  if (index >= 2) animal.push("Locomoção Terrestre");
  if (index >= 4)
    animal.push("Corpo Gelatinoso", "Ventosas Quimiotáteis", "Tinta");
  if (index >= 5)
    animal.push("Contorcionismo", "Mimetismo", "Regeneração de Braços");
  if (index >= 7)
    animal.push("Visão Polarizada", "Tentáculo Preênsil");
  if (index >= 8) animal.push("Cromatóforos Neurais");
  return {
    animal: [...new Set(animal)],
    rank: index === 0 ? 4 : index < 3 ? 2 : 3,
  };
}

export function earthBodyPlanFounder(stageId, bodyPlan) {
  if (bodyPlan === "Artrópode")
    return EARTH_ARTHROPOD_FOUNDER_GENOMES[stageId] ?? null;
  if (bodyPlan === "Molusco") return molluskFounderGenome(stageId);
  if (bodyPlan !== "Vertebrado") return null;
  if (stageId === "cambrian") return EARTH_CAMBRIAN_VERTEBRATE_FOUNDER;
  const profile = EARTH_FOUNDER_GENOMES[stageId];
  return profile?.animal?.includes("Vertebrado") ? profile : null;
}

const EARTH_SHARED_FOUNDER_MILESTONES = Object.freeze([
  { trait: "Biofilme", debut: "paleoarchean", activeFrom: "mesoarchean", activeThrough: "orosirian" },
  { trait: "Fixação de Nitrogênio", debut: "mesoarchean", activeFrom: "neoarchean", activeThrough: "rhyacian" },
  { trait: "Diferenciação Celular", debut: "calymmian", activeFrom: "ectasian", activeThrough: null },
]);

const EARTH_ANIMAL_FOUNDER_MILESTONES = Object.freeze([
  { trait: "Cefalização", debut: "ediacaran" },
]);

const earthFounderStageIds = Object.freeze(Object.keys(EARTH_FOUNDER_GENOMES));
const founderStageIndex = (stageId) => earthFounderStageIds.indexOf(stageId);

export function earthFounderPersistentTraits(stageId) {
  const stageIndex = founderStageIndex(stageId);
  if (stageIndex < 0) return [];
  return EARTH_SHARED_FOUNDER_MILESTONES
    .filter((entry) => {
      const from = founderStageIndex(entry.activeFrom),
        through = entry.activeThrough
          ? founderStageIndex(entry.activeThrough)
          : Number.POSITIVE_INFINITY;
      return stageIndex >= from && stageIndex <= through;
    })
    .map((entry) => entry.trait);
}

export function earthFounderHistory(stageId, branch) {
  if (!["plant", "animal"].includes(branch)) return [];
  const entries = Object.entries(EARTH_FOUNDER_GENOMES),
    stageIndex = entries.findIndex(([id]) => id === stageId);
  if (stageIndex < 0) return [];
  const legacyKey = branch === "plant" ? "plantLegacy" : "animalLegacy",
    completedShared = EARTH_SHARED_FOUNDER_MILESTONES
      .filter((entry) => founderStageIndex(entry.debut) < stageIndex)
      .map((entry) => entry.trait),
    completedBranch =
      branch === "animal"
        ? EARTH_ANIMAL_FOUNDER_MILESTONES
            .filter((entry) => founderStageIndex(entry.debut) < stageIndex)
            .map((entry) => entry.trait)
        : [];
  return [
    ...new Set([
      ...entries
        .slice(0, stageIndex + 1)
        .flatMap(([, profile]) => [
          ...(profile[branch] ?? []),
          ...(profile[legacyKey] ?? []),
        ]),
      ...completedShared,
      ...completedBranch,
    ]),
  ];
}

const CONTEXT_AFFINITIES = {
  "Percepção Espacial": ["Locomoção Articulada", "Jatopropulsão"],
  "Respiração Pulmonar": ["Vertebrado", "Locomoção Terrestre"],
  Carapaça: ["Predação"],
  Ingestão: ["Multicelularismo", "Predação"],
  Camuflagem: ["Locomoção Articulada"],
  Veneno: ["Carnívoro"],
  Necrófago: ["Predação"],
  Coprofagia: ["Locomoção Terrestre"],
  Ooteca: ["Artrópode", "Ovíparo"],
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
