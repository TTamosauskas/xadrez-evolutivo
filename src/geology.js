import {
  EARTH_FOUNDER_GENOMES,
  earthFounderHistory,
  earthFounderPersistentTraits,
  earthTraitWindowAllows,
  scenarioEventWeights,
  scenarioHabitatProfile,
  scenarioInnovationWeight,
} from "./scenarios.js";

export const NEGATIVE_TRAIT_RULES = Object.freeze({
  Esterilidade: { stage: "eoarchean", somatic: true },
  "Mutação Letal": { stage: "eoarchean", somatic: true },
  "Mutação Disfuncional": { stage: "eoarchean", somatic: true },
  "Insuficiência Respiratória": {
    stage: "orosirian",
    lineage: ["Multicelularismo"],
    somatic: true,
  },
  Imunodeficiência: {
    stage: "siderian",
    lineage: ["Resistência"],
    somatic: true,
  },
  "Deficiência Motora": {
    stage: "ediacaran",
    lineage: ["Locomoção Primitiva"],
    somatic: true,
  },
  "Deficiência Sensorial": {
    stage: "cambrian",
    lineage: ["Percepção Espacial"],
    somatic: true,
  },
  "Filho único": {
    stage: "triassic",
    lineage: ["Vivíparo"],
    somatic: false,
  },
  Subfertilidade: {
    stage: "calymmian",
    lineage: ["Reprodução Sexuada"],
    somatic: false,
  },
  "Má absorção Alimentar": {
    stage: "ectasian",
    lineage: ["Multicelularismo", "Predação"],
    somatic: true,
  },
  Semelparidade: {
    stage: "orosirian",
    lineage: ["Multicelularismo"],
    somatic: false,
  },
  "Regressão Evolutiva": {
    stage: "calymmian",
    lineage: ["Reprodução Sexuada"],
    somatic: false,
  },
  Nanismo: {
    stage: "cambrian",
    lineageAny: ["Vertebrado", "Artrópode"],
    somatic: false,
  },
  Gigantismo: {
    stage: "devonian",
    lineage: ["Locomoção Articulada"],
    somatic: false,
  },
  "Mutação Mutadora": {
    stage: "mesoarchean",
    lineage: ["Reparo Celular"],
    somatic: false,
  },
  "Assimetria Flutuante": {
    stage: "ediacaran",
    lineage: ["Simetria Bilateral"],
    somatic: false,
  },
  Ataxia: {
    stage: "cambrian",
    lineage: ["Locomoção Articulada"],
    somatic: true,
  },
  "Anemia Falciforme": {
    stage: "pleistocene",
    lineage: ["Vertebrado", "Respiração aeróbia"],
    somatic: false,
  },
});
export const NEGATIVE_TRAITS = new Set(Object.keys(NEGATIVE_TRAIT_RULES));
export const SOMATIC_NEGATIVE_TRAITS = new Set(
  Object.entries(NEGATIVE_TRAIT_RULES)
    .filter(([, rule]) => rule.somatic)
    .map(([trait]) => trait),
);

export const GEOLOGICAL_STAGES = [
  {
    id: "hadean",
    group: "Hadeano",
    period: "Hadeano",
    chronology: { eon: "Hadeano" },
    required: ["Respiração anaeróbia", "Quimiossíntese"],
    habitat: { fertile: 0, hostile: 0, founderFertile: false, naturalBarriers: [0, 0], pattern: "primordial" },
    events: {},
    founderLayout: [[5, 2], [5, 3], [2, 4], [2, 5]],
  },
  {
    id: "eoarchean",
    group: "Arqueano",
    period: "Eoarqueana",
    chronology: { eon: "Arqueano", era: "Eoarqueana" },
    required: ["Fotossíntese", "Predação"],
    // O 2º ciclo consolida os dois ramos antes de a pressão de mutações
    // negativas entrar na campanha.
    cycles: [["Fotossíntese", "Predação"], []],
    habitat: { fertile: 36, hostile: 20, founderFertile: true, naturalBarriers: [0, 0], pattern: "volcanic-ocean" },
    events: { volcano: 5, earthquake: 4, solar: 3, meteor: 3, grb: 1 },
    founderLayout: [[5, 2], [5, 3], [2, 4], [2, 5]],
  },
  {
    id: "paleoarchean",
    group: "Arqueano",
    period: "Paleoarqueana",
    chronology: { eon: "Arqueano", era: "Paleoarqueana" },
    required: ["Transferência Horizontal", "Biofilme"],
    cycles: [["Transferência Horizontal"], ["Biofilme"]],
    habitat: { fertile: 44, hostile: 12, founderFertile: true, naturalBarriers: [0, 0], pattern: "hydrothermal" },
    events: { volcano: 4, earthquake: 3, solar: 3, meteor: 2, grb: 1 },
    founderLayout: [[5, 2], [4, 2], [2, 5], [3, 5]],
  },
  {
    id: "mesoarchean",
    group: "Arqueano",
    period: "Mesoarqueana",
    chronology: { eon: "Arqueano", era: "Mesoarqueana" },
    required: ["Reparo Celular", "Fixação de Nitrogênio"],
    cycles: [["Reparo Celular"], ["Fixação de Nitrogênio"]],
    habitat: { fertile: 50, hostile: 8, founderFertile: true, naturalBarriers: [0, 0], pattern: "microbial-mats" },
    events: { fertilized: 1, volcano: 3, earthquake: 3, solar: 2, meteor: 1, grb: 1 },
    founderLayout: [[6, 2], [5, 3], [1, 5], [2, 4]],
  },
  {
    id: "neoarchean",
    group: "Arqueano",
    period: "Neoarqueana",
    chronology: { eon: "Arqueano", era: "Neoarqueana" },
    required: ["Dormência"],
    cycles: [["Dormência"]],
    habitat: { fertile: 54, hostile: 6, founderFertile: true, naturalBarriers: [0, 0], pattern: "oxygen-oases" },
    events: { fertilized: 2, volcano: 2, ice: 1, solar: 2, earthquake: 1, grb: 1 },
    founderLayout: [[6, 1], [5, 3], [1, 6], [2, 4]],
  },
  {
    id: "siderian",
    group: "Proterozoico · Paleoproterozoica",
    period: "Sideriano",
    chronology: { eon: "Proterozoico", era: "Paleoproterozoica", period: "Sideriano" },
    required: ["Respiração aeróbia", "Resistência"],
    cycles: [["Respiração aeróbia", "Resistência"]],
    habitat: { fertile: 44, hostile: 12, founderFertile: true, naturalBarriers: [0, 0], pattern: "banded-iron" },
    events: { ice: 3, fertilized: 2, volcano: 2, solar: 1, grb: 1 },
    founderLayout: [[6, 2], [5, 2], [1, 5], [2, 5]],
  },
  {
    id: "rhyacian",
    group: "Proterozoico · Paleoproterozoica",
    period: "Riaciano",
    chronology: { eon: "Proterozoico", era: "Paleoproterozoica", period: "Riaciano" },
    required: ["Eucarionte", "Endossimbiose"],
    cycles: [["Eucarionte", "Endossimbiose"]],
    habitat: { fertile: 40, hostile: 16, founderFertile: true, naturalBarriers: [0, 0], pattern: "glacial-ocean" },
    events: { ice: 4, fertilized: 3, "abundant-rains": 2, volcano: 1, grb: 1 },
    founderLayout: [[6, 1], [5, 3], [1, 6], [2, 4]],
  },
  {
    id: "orosirian",
    group: "Proterozoico · Paleoproterozoica",
    period: "Orosiriano",
    chronology: { eon: "Proterozoico", era: "Paleoproterozoica", period: "Orosiriano" },
    required: ["Multicelularismo"],
    cycles: [["Multicelularismo"]],
    habitat: { fertile: 48, hostile: 10, founderFertile: true, naturalBarriers: [0, 1], pattern: "impact-basins" },
    events: { meteor: 3, earthquake: 2, volcano: 2, fertilized: 2, grb: 1 },
    founderLayout: [[6, 2], [5, 4], [1, 5], [2, 3]],
  },
  {
    id: "statherian",
    group: "Proterozoico · Paleoproterozoica",
    period: "Estateriano",
    chronology: { eon: "Proterozoico", era: "Paleoproterozoica", period: "Estateriano" },
    required: ["Brotamento"],
    cycles: [["Brotamento"]],
    habitat: { fertile: 52, hostile: 8, founderFertile: true, naturalBarriers: [0, 1], pattern: "continental-shelves" },
    events: { fertilized: 3, "abundant-rains": 2, sea: 2, volcano: 1, earthquake: 1 },
    founderLayout: [[6, 1], [5, 4], [1, 6], [2, 3]],
  },
  {
    id: "calymmian",
    group: "Proterozoico · Mesoproterozoica",
    period: "Calimiano",
    chronology: { eon: "Proterozoico", era: "Mesoproterozoica", period: "Calimiano" },
    required: ["Diferenciação Celular", "Reprodução Sexuada"],
    cycles: [["Diferenciação Celular"], ["Reprodução Sexuada"]],
    habitat: { fertile: 54, hostile: 6, founderFertile: true, naturalBarriers: [0, 1], pattern: "inland-seas" },
    events: { fertilized: 4, sea: 2, "abundant-rains": 2, earthquake: 1, volcano: 1 },
    founderLayout: [[6, 2], [4, 1], [1, 5], [3, 6]],
  },
  {
    id: "ectasian",
    group: "Proterozoico · Mesoproterozoica",
    period: "Ectasiano",
    chronology: { eon: "Proterozoico", era: "Mesoproterozoica", period: "Ectasiano" },
    required: ["Ingestão"],
    cycles: [["Ingestão"]],
    habitat: { fertile: 56, hostile: 5, founderFertile: true, naturalBarriers: [0, 1], pattern: "continental-shelves" },
    events: { fertilized: 3, sea: 2, abundance: 1, "abundant-rains": 1, warming: 1 },
    founderLayout: [[6, 1], [4, 2], [1, 6], [3, 5]],
  },
  {
    id: "stenian",
    group: "Proterozoico · Mesoproterozoica",
    period: "Esteniano",
    chronology: { eon: "Proterozoico", era: "Mesoproterozoica", period: "Esteniano" },
    required: ["Carnívoro"],
    cycles: [["Carnívoro"]],
    habitat: { fertile: 52, hostile: 7, founderFertile: true, naturalBarriers: [0, 2], pattern: "supercontinent-coast" },
    events: { sea: 2, abundance: 2, earthquake: 2, fertilized: 2, volcano: 1 },
    founderLayout: [[6, 2], [4, 1], [1, 5], [3, 6]],
  },
  {
    id: "tonian",
    group: "Proterozoico · Neoproterozoica",
    period: "Toniano",
    chronology: { eon: "Proterozoico", era: "Neoproterozoica", period: "Toniano" },
    required: ["Colônia", "Séssil"],
    cycles: [["Colônia", "Séssil"]],
    habitat: { fertile: 48, hostile: 10, founderFertile: true, naturalBarriers: [1, 2], pattern: "rift-seas" },
    events: { sea: 3, "abundant-rains": 2, fertilized: 2, earthquake: 2, warming: 1 },
    founderLayout: [[6, 1], [4, 3], [1, 6], [3, 4]],
  },
  {
    id: "cryogenian",
    group: "Proterozoico · Neoproterozoica",
    period: "Criogeniano",
    chronology: { eon: "Proterozoico", era: "Neoproterozoica", period: "Criogeniano" },
    required: ["Fragmentação"],
    cycles: [["Fragmentação"]],
    habitat: { fertile: 24, hostile: 32, founderFertile: true, naturalBarriers: [2, 4], pattern: "snowball" },
    events: { ice: 7, blockade: 3, volcano: 2, sea: 1, earthquake: 1 },
    founderLayout: [[6, 2], [5, 5], [1, 5], [2, 2]],
  },
  {
    id: "ediacaran",
    group: "Proterozoico · Neoproterozoica",
    period: "Ediacarano",
    chronology: { eon: "Proterozoico", era: "Neoproterozoica", period: "Ediacarano" },
    required: ["Simetria Bilateral", "Locomoção Primitiva", "Escavador", "Construtor de Nicho", "Biomineralização"],
    cycles: [
      ["Simetria Bilateral", "Locomoção Primitiva"],
      ["Escavador", "Construtor de Nicho"],
      ["Biomineralização"],
    ],
    habitat: { fertile: 56, hostile: 5, founderFertile: true, naturalBarriers: [0, 2], pattern: "shallow-sea" },
    events: { abundance: 4, fertilized: 3, "abundant-rains": 2, sea: 2, earthquake: 1, volcano: 1 },
    founderLayout: [[6, 2], [6, 4], [1, 3], [1, 5]],
  },
  {
    id: "cambrian",
    group: "Fanerozoico · Paleozoica",
    period: "Cambriano",
    chronology: { eon: "Fanerozoico", era: "Paleozoica", period: "Cambriano" },
    required: ["Locomoção Articulada", "Percepção Espacial", "Carapaça"],
    cycles: [["Locomoção Articulada", "Percepção Espacial"], ["Carapaça"]],
    habitat: { fertile: 58, hostile: 4, founderFertile: true, naturalBarriers: [0, 2], pattern: "reef" },
    events: { sea: 4, abundance: 4, "alluvial-river": 2, volcano: 1, earthquake: 1 },
    founderLayout: [[6, 1], [6, 4], [1, 3], [1, 6]],
  },
  {
    id: "ordovician",
    group: "Fanerozoico · Paleozoica",
    period: "Ordoviciano",
    chronology: { eon: "Fanerozoico", era: "Paleozoica", period: "Ordoviciano" },
    required: ["Embriófitas", "Tropismo"],
    cycles: [["Embriófitas"], ["Tropismo"]],
    habitat: { fertile: 56, hostile: 6, founderFertile: true, naturalBarriers: [0, 2], pattern: "continental-shelves" },
    events: { ice: 4, grb: 3, sea: 3, blockade: 1, earthquake: 1 },
    founderLayout: [[6, 1], [5, 4], [1, 6], [2, 3]],
  },
  {
    id: "silurian",
    group: "Fanerozoico · Paleozoica",
    period: "Siluriano",
    chronology: { eon: "Fanerozoico", era: "Paleozoica", period: "Siluriano" },
    required: ["Traqueófitas", "Estômatos", "Locomoção Terrestre", "Mandíbula"],
    cycles: [
      ["Traqueófitas", "Estômatos"],
      ["Locomoção Terrestre", "Mandíbula"],
    ],
    habitat: { fertile: 28, hostile: 7, standard: true, naturalBarriers: [1, 3], pattern: "coast" },
    events: { "alluvial-river": 3, "abundant-rains": 3, sea: 2, fertilized: 1, volcano: 1 },
    founderLayout: [[6, 1], [5, 3], [1, 6], [2, 4]],
  },
  {
    id: "devonian",
    group: "Fanerozoico · Paleozoica",
    period: "Devoniano",
    chronology: { eon: "Fanerozoico", era: "Paleozoica", period: "Devoniano" },
    required: ["Madeira", "Respiração Pulmonar", "Dentes"],
    cycles: [["Madeira"], ["Respiração Pulmonar", "Dentes"]],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 3], pattern: "corridors" },
    events: { "alluvial-river": 3, abundance: 2, drought: 2, desert: 1, sea: 1, warming: 1 },
    founderLayout: [[6, 0], [5, 3], [1, 7], [2, 4]],
  },
  {
    id: "carboniferous",
    group: "Fanerozoico · Paleozoica",
    period: "Carbonífero",
    chronology: { eon: "Fanerozoico", era: "Paleozoica", period: "Carbonífero" },
    required: ["Gimnospermas", "Ovíparos Amniotas", "Voo"],
    cycles: [["Gimnospermas"], ["Ovíparos Amniotas"], ["Voo"]],
    habitat: { fertile: 22, hostile: 4, standard: true, naturalBarriers: [3, 6], pattern: "swamp" },
    events: { "abundant-rains": 5, abundance: 4, fertilized: 2, sea: 1, ice: 2 },
    founderLayout: [[7, 1], [5, 4], [0, 6], [2, 3]],
  },
  {
    id: "permian",
    group: "Fanerozoico · Paleozoica",
    period: "Permiano",
    chronology: { eon: "Fanerozoico", era: "Paleozoica", period: "Permiano" },
    required: ["Presas", "Incubação"],
    cycles: [["Presas"], ["Incubação"]],
    habitat: { fertile: 10, hostile: 12, standard: true, naturalBarriers: [3, 5], pattern: "arid" },
    events: { volcano: 5, warming: 3, drought: 4, desert: 4, blockade: 2, earthquake: 1 },
    founderLayout: [[7, 0], [5, 5], [0, 7], [2, 2]],
  },
  {
    id: "triassic",
    group: "Fanerozoico · Mesozoica",
    period: "Triássico",
    chronology: { eon: "Fanerozoico", era: "Mesozoica", period: "Triássico" },
    required: ["Endotermia", "Pelos", "Lactação"],
    cycles: [["Endotermia"], ["Pelos"], ["Lactação"]],
    habitat: { fertile: 12, hostile: 5, standard: true, naturalBarriers: [1, 2], pattern: "open" },
    events: { drought: 3, desert: 3, volcano: 2, warming: 2, eutrophication: 1, insularization: 1, sea: 1 },
    founderLayout: [[7, 1], [5, 4], [0, 6], [2, 3]],
  },
  {
    id: "jurassic",
    group: "Fanerozoico · Mesozoica",
    period: "Jurássico",
    chronology: { eon: "Fanerozoico", era: "Mesozoica", period: "Jurássico" },
    required: ["Penas", "Visão Noturna"],
    cycles: [["Penas"], ["Visão Noturna"]],
    habitat: { fertile: 18, hostile: 5, standard: true, naturalBarriers: [3, 5], pattern: "dense" },
    events: { sea: 3, eutrophication: 1, insularization: 2, "abundant-rains": 2, "alluvial-river": 2, earthquake: 1, warming: 1, volcano: 1 },
    founderLayout: [[7, 1], [5, 5], [0, 6], [2, 2]],
  },
  {
    id: "cretaceous",
    group: "Fanerozoico · Mesozoica",
    period: "Cretáceo",
    chronology: { eon: "Fanerozoico", era: "Mesozoica", period: "Cretáceo" },
    required: ["Angiospermas", "Endozoocoria", "Eusocialidade"],
    cycles: [["Angiospermas"], ["Endozoocoria"], ["Eusocialidade"]],
    habitat: { fertile: 18, hostile: 6, standard: true, naturalBarriers: [2, 4], pattern: "clusters" },
    events: { sea: 3, abundance: 2, eutrophication: 1, insularization: 1, meteor: 3, volcano: 1, warming: 2 },
    founderLayout: [[7, 1], [4, 5], [0, 6], [3, 2]],
  },
  {
    id: "paleocene",
    group: "Fanerozoico · Cenozoica · Paleógeno",
    period: "Paleoceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Paleógeno", epoch: "Paleoceno" },
    required: ["Roedor"],
    cycles: [["Roedor"]],
    habitat: { fertile: 16, hostile: 7, standard: true, naturalBarriers: [2, 4], pattern: "recovery" },
    events: { warming: 3, abundance: 2, "alluvial-river": 2, earthquake: 2, "abundant-rains": 2 },
    founderLayout: [[7, 1], [4, 6], [0, 6], [3, 1]],
  },
  {
    id: "eocene",
    group: "Fanerozoico · Cenozoica · Paleógeno",
    period: "Eoceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Paleógeno", epoch: "Eoceno" },
    required: ["Ecolocalização", "Predação em Massa"],
    cycles: [["Ecolocalização"], ["Predação em Massa"]],
    habitat: { fertile: 20, hostile: 5, standard: true, naturalBarriers: [3, 5], pattern: "rainforest" },
    events: { warming: 4, "abundant-rains": 4, abundance: 2, sea: 1, earthquake: 1 },
    founderLayout: [[7, 1], [4, 5], [0, 6], [3, 2]],
  },
  {
    id: "oligocene",
    group: "Fanerozoico · Cenozoica · Paleógeno",
    period: "Oligoceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Paleógeno", epoch: "Oligoceno" },
    required: ["Ruminante"],
    cycles: [["Ruminante"]],
    habitat: { fertile: 14, hostile: 8, standard: true, naturalBarriers: [3, 5], pattern: "mosaic" },
    events: { ice: 2, drought: 2, warming: 1, earthquake: 2, "alluvial-river": 1 },
    founderLayout: [[7, 0], [4, 5], [0, 7], [3, 2]],
  },
  {
    id: "miocene",
    group: "Fanerozoico · Cenozoica · Neógeno",
    period: "Mioceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Neógeno", epoch: "Mioceno" },
    required: ["Tromba", "Chifre", "Bipedalismo"],
    cycles: [["Tromba"], ["Chifre"], ["Bipedalismo"]],
    habitat: { fertile: 12, hostile: 8, standard: true, naturalBarriers: [4, 6], pattern: "savanna" },
    events: { drought: 3, desert: 2, earthquake: 2, warming: 2, "alluvial-river": 1 },
    founderLayout: [[7, 0], [4, 6], [0, 7], [3, 1]],
  },
  {
    id: "pliocene",
    group: "Fanerozoico · Cenozoica · Neógeno",
    period: "Plioceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Neógeno", epoch: "Plioceno" },
    required: ["Polegar Opositor", "Córtex Pré-Frontal"],
    cycles: [["Polegar Opositor"], ["Córtex Pré-Frontal"]],
    habitat: { fertile: 10, hostile: 10, standard: true, naturalBarriers: [4, 6], pattern: "fragmented" },
    events: { drought: 3, desert: 3, earthquake: 2, ice: 2, warming: 1 },
    founderLayout: [[7, 0], [4, 6], [0, 7], [3, 1]],
  },
  {
    id: "pleistocene",
    group: "Fanerozoico · Cenozoica · Quaternário",
    period: "Pleistoceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Quaternário", epoch: "Pleistoceno" },
    required: ["Neocórtex Desenvolvido"],
    cycles: [["Neocórtex Desenvolvido"]],
    habitat: { fertile: 12, hostile: 12, standard: true, naturalBarriers: [3, 6], pattern: "steppe" },
    events: { ice: 6, warming: 2, drought: 3, desert: 2, earthquake: 2, meteor: 1 },
    founderLayout: [[7, 0], [4, 6], [0, 7], [3, 1]],
  },
  {
    id: "holocene",
    group: "Fanerozoico · Cenozoica · Quaternário",
    period: "Holoceno",
    chronology: { eon: "Fanerozoico", era: "Cenozoica", period: "Quaternário", epoch: "Holoceno" },
    required: ["Plantas Domesticadas", "Animais Domésticos", "Antropização"],
    cycles: [["Plantas Domesticadas"], ["Animais Domésticos"], ["Antropização"]],
    habitat: { fertile: 14, hostile: 9, standard: true, naturalBarriers: [2, 5], pattern: "anthropic" },
    events: { warming: 5, drought: 3, desert: 2, earthquake: 2, blockade: 1, abundance: 1 },
    founderLayout: [[7, 0], [4, 7], [0, 7], [3, 0]],
  },
].map((stage, index) => ({ ...stage, index }));

export const LEGACY_GEOLOGICAL_STAGE_ALIASES = Object.freeze({
  // Old aggregate IDs represent the complete historical interval.
  // Saves are migrated more precisely from their discovered traits in storage.js.
  archean: "neoarchean",
  proterozoic: "cryogenian",
  paleogene: "oligocene",
  neogene: "pliocene",
  quaternary: "holocene",
});

const byId = new Map(GEOLOGICAL_STAGES.map((stage) => [stage.id, stage]));

export const TRAIT_STAGE = {
  "Respiração anaeróbia": "hadean",
  "Reparo Celular": "mesoarchean",
  "Quimiossíntese": "hadean",
  "Eucarionte": "rhyacian",
  "Respiração aeróbia": "siderian",
  "Endossimbiose": "rhyacian",
  "Biomineralização": "ediacaran",
  "Imunidade Adaptativa": "cambrian",
  "Estômatos": "silurian",
  "Xerofitismo": "permian",
  "Endotermia": "triassic",
  "Coração Compartimentado": "triassic",
  "Respiração Pulmonar": "devonian",
  "Adrenalina": "devonian",
  "Testosterona": "devonian",
  "Corticosteroides": "devonian",
  "Estrogênio": "carboniferous",
  "Forrageamento": "devonian",
  "Fotossíntese": "eoarchean",
  "Embriófitas": "ordovician",
  "Traqueófitas": "silurian",
  "Espinhos": "devonian",
  "Madeira": "devonian",
  "Gimnospermas": "carboniferous",
  "Trepadeira": "carboniferous",
  "Extremófitas": "permian",
  "Angiospermas": "cretaceous",
  "Haustório": "cretaceous",
  "Perfume Floral": "cretaceous",
  "Tropismo": "ordovician",
  "Dormência": "neoarchean",
  "Multicelularismo": "orosirian",
  "Simetria Bilateral": "ediacaran",
  "Reprodução Sexuada": "calymmian",
  "Precocidade Sexual": "ediacaran",
  "Imortalidade Biológica": "ediacaran",
  "Fertilidade Longeva": "triassic",
  "Longevidade": "jurassic",
  "Resistência": "siderian",
  "Predação": "eoarchean",
  "Ingestão": "ectasian",
  "Carnívoro": "stenian",
  "Herbívoro": "ordovician",
  "Granívoro": "carboniferous",
  "Canibalismo": "cambrian",
  "Partenogênese": "cambrian",
  "Canibalismo Sexual": "carboniferous",
  "Canibalismo Filial": "permian",
  "Matrifagia": "jurassic",
  "Cópula Agressiva": "cretaceous",
  "Parasitismo": "cambrian",
  "Vetor Patógeno": "cretaceous",
  "Locomoção Primitiva": "ediacaran",
  "Serotonina": "ediacaran",
  "Dopamina": "ediacaran",
  "Endorfinas": "cambrian",
  "Ciclo de Sono": "ediacaran",
  Hibernação: "jurassic",
  "Vertebrado": "cambrian",
  "Intestino": "ediacaran",
  "Estômago Ácido": "silurian",
  "Artrópode": "cambrian",
  "Sistema Adipocinético": "ordovician",
  "Locomoção Articulada": "cambrian",
  "Jatopropulsão": "cambrian",
  "Locomoção Terrestre": "silurian",
  "Rim Concentrador": "permian",
  "Rastejante": "carboniferous",
  "Movimento Lateral": "carboniferous",
  "Escansão": "carboniferous",
  "Arborícola": "carboniferous",
  "Bioadesão": "permian",
  "Forésia": "jurassic",
  "Tigmotaxia": "carboniferous",
  "Recuo": "permian",
  "Deslizamento": "permian",
  "Serpenteamento": "cretaceous",
  "Trilhas": "cretaceous",
  "Percepção Espacial": "cambrian",
  "Escavador": "ediacaran",
  "Construtor de Nicho": "ediacaran",
  "Zoorremediação": "ediacaran",
  "Necrófago": "ediacaran",
  "Coprofagia": "cretaceous",
  "Carapaça": "cambrian",
  "Camuflagem": "cambrian",
  "Veneno": "cambrian",
  "Peçonha": "devonian",
  "Biotransformação Hepática": "devonian",
  "Mandíbula": "silurian",
  "Dentes": "devonian",
  "Rizoma": "devonian",
  "Parasitoidismo": "triassic",
  "Rabo Chicote": "jurassic",
  "Ruminante": "oligocene",
  "Tromba": "miocene",
  "Autotomia": "cambrian",
  "Tinta": "carboniferous",
  "Alelopatia": "permian",
  "Hematofagia": "jurassic",
  "Parasitismo de Ninhada": "cretaceous",
  "Teia": "carboniferous",
  "Projétil Biológico": "carboniferous",
  "Predação em Massa": "eocene",
  "Garras": "paleocene",
  "Eletrodescarga": "oligocene",
  "Pescoço Verticalizado": "miocene",
  "Coletor": "silurian",
  "Escalador": "devonian",
  "Onívoro": "devonian",
  "Respiração Cutânea": "devonian",
  "Visão Binocular": "devonian",
  "Voo": "carboniferous",
  "Velocidade": "carboniferous",
  "Pulo": "carboniferous",
  "Ovíparo": "ordovician",
  "Ovíparos Amniotas": "carboniferous",
  "Ooteca": "carboniferous",
  "Incubação": "permian",
  "Ovovivíparo": "permian",
  "Pele grossa": "permian",
  "Presas": "permian",
  "Lactação": "triassic",
  "Vivíparo": "triassic",
  "Placenta": "jurassic",
  "Sacos Aéreos": "triassic",
  "Mixotrofia": "triassic",
  "Ovulação Induzida": "eocene",
  "Ecolocalização": "eocene",
  "Interceptação preditiva": "oligocene",
  "Mimetismo": "permian",
  "Mimetismo Agressivo": "triassic",
  "Notívago": "triassic",
  "Movimento proteano": "triassic",
  "Sociabilidade": "jurassic",
  "Manada": "jurassic",
  "Hierarquia": "cretaceous",
  "Superorganismo": "oligocene",
  "Recrutamento em Massa": "cretaceous",
  "Caça Cooperativa": "eocene",
  "Mutualismo": "devonian",
  "Ocitocina": "jurassic",
  "Visão Noturna": "jurassic",
  "Eusocialidade": "cretaceous",
  "Ovífagia": "cretaceous",
  "Polegar Opositor": "pliocene",
  "Bipedalismo": "miocene",
  "Córtex Pré-Frontal": "pliocene",
  "Neurodivergência": "pliocene",
  "Chifre": "miocene",
  "Antropização": "holocene",
  "Plantas Domesticadas": "holocene",
  "Animais Domésticos": "holocene",
  "Neocórtex Desenvolvido": "pleistocene",
  "Transferência Horizontal": "paleoarchean",
  Biofilme: "paleoarchean",
  "Fixação de Nitrogênio": "mesoarchean",
  "Diferenciação Celular": "calymmian",
  "Brotamento": "statherian",
  "Fragmentação": "cryogenian",
  "Colônia": "tonian",
  "Séssil": "tonian",
  "Acasalamento Preferencial": "cambrian",
  "Onívoro Oportunista": "carboniferous",
  "Metamorfose": "carboniferous",
  Hipermetamorfose: "cretaceous",
  "Cuidado Parental": "permian",
  "Promiscuidade": "jurassic",
  "Pedogênese": "cretaceous",
  "Marsupial": "cretaceous",
  "Acasalamento Múltiplo": "cretaceous",
  "Monogamia": "paleocene",
  "Pele Glandular": "devonian",
  "Escamas": "permian",
  "Osteodermos": "permian",
  "Pelos": "triassic",
  "Penas": "jurassic",
  "Endozoocoria": "cretaceous",
  "Epizoocoria": "eocene",
  "Sinzoocoria": "oligocene",
  "Mirmecocoria": "oligocene",
  "Roedor": "paleocene",
  "Capsaicina": "miocene",
  "Extremotolerância": "devonian",
  "Contorcionismo": "ediacaran",
  "Corpo Gelatinoso": "ediacaran",
  "Esclerotização": "cambrian",
  "Toxicidade": "cambrian",
  "Exibição deimática": "cambrian",
  "Tanatose": "cambrian",
  "Ofuscamento por movimento": "jurassic",
  Feromônios: "carboniferous",
  Bioluminescência: "cretaceous",
  "Bioluminescência Predatória": "eocene",
};

export const ENERGY_BRANCH_TRAITS = new Set(["Fotossíntese", "Predação"]);

export const ACTIVE_TRAIT_FAMILIES = [
  {
    id: "respiration",
    traits: ["Respiração anaeróbia", "Respiração aeróbia"],
  },
  {
    id: "energy",
    traits: ["Quimiossíntese", "Fotossíntese", "Predação"],
  },
  {
    id: "cellular-organization",
    traits: ["Biofilme", "Multicelularismo"],
  },
  {
    id: "cellular-domain",
    traits: ["Fixação de Nitrogênio", "Eucarionte"],
  },
  {
    id: "diet",
    traits: ["Carnívoro", "Herbívoro", "Onívoro"],
  },
  {
    id: "body-plan",
    traits: ["Vertebrado", "Artrópode"],
  },
  {
    id: "locomotion",
    traits: [
      "Locomoção Articulada",
      "Locomoção Terrestre",
      "Bipedalismo",
    ],
  },
  {
    id: "evasion",
    traits: [
      "Exibição deimática",
      "Tanatose",
      "Adrenalina",
      "Velocidade",
      "Movimento proteano",
      "Ofuscamento por movimento",
    ],
  },
  {
    id: "parasitism",
    traits: ["Parasitismo", "Vetor Patógeno"],
  },
  {
    id: "plant-form",
    traits: ["Embriófitas", "Traqueófitas", "Gimnospermas", "Angiospermas"],
  },
  {
    id: "development",
    traits: ["Ovíparo", "Ovíparos Amniotas", "Ovovivíparo", "Vivíparo"],
  },
  {
    id: "offspring-orientation",
    traits: ["Testosterona", "Corticosteroides", "Forrageamento"],
  },
  {
    id: "social-organization",
    traits: ["Sociabilidade", "Eusocialidade"],
  },
  {
    id: "bioluminescence",
    traits: ["Bioluminescência", "Bioluminescência Predatória"],
  },
  {
    id: "cognition",
    traits: ["Córtex Pré-Frontal", "Neocórtex Desenvolvido"],
  },
  {
    id: "body-size",
    traits: ["Nanismo", "Gigantismo"],
  },
  {
    id: "mating-system",
    traits: ["Promiscuidade", "Monogamia", "Acasalamento Múltiplo"],
  },
  {
    id: "integument",
    traits: ["Pele Glandular", "Escamas", "Pelos", "Penas"],
  },
  {
    id: "zoochory",
    traits: ["Endozoocoria", "Epizoocoria", "Sinzoocoria", "Mirmecocoria"],
  },
  {
    id: "body-consistency",
    traits: ["Corpo Gelatinoso", "Esclerotização"],
  },
  {
    id: "chemical-defense",
    traits: ["Toxicidade", "Veneno", "Peçonha"],
  },
  {
    id: "feeding-reach",
    traits: ["Rabo Chicote", "Garras", "Pescoço Verticalizado", "Tromba"],
  },
  {
    id: "parasite-specialization",
    traits: ["Parasitoidismo", "Parasitismo de Ninhada"],
  },
  {
    id: "clonal-growth",
    traits: ["Brotamento", "Rizoma"],
  },
  {
    id: "ranged-attack",
    traits: ["Projétil Biológico", "Eletrodescarga"],
  },
  {
    id: "motor-impairment",
    traits: ["Deficiência Motora", "Ataxia"],
  },
  {
    id: "metabolic-impairment",
    traits: ["Insuficiência Respiratória", "Anemia Falciforme"],
  },
  {
    id: "sexual-conflict",
    traits: ["Canibalismo Sexual", "Cópula Agressiva"],
  },
  {
    id: "juvenile-strategy",
    traits: ["Pedogênese", "Matrifagia"],
  },
  {
    id: "natural-mortality",
    traits: ["Longevidade", "Imortalidade Biológica"],
  },
];

const activeFamilyByTrait = new Map(
  ACTIVE_TRAIT_FAMILIES.flatMap((family) =>
    family.traits.map((trait, index) => [
      trait,
      { family, index },
    ]),
  ),
);

export function activeTraitFamily(trait) {
  return activeFamilyByTrait.get(trait)?.family ?? null;
}

export const TRAIT_DEPENDENCIES = {
  Biofilme: { lineage: ["Respiração anaeróbia"] },
  "Fixação de Nitrogênio": { lineage: ["Respiração anaeróbia"] },
  "Diferenciação Celular": {
    lineage: ["Multicelularismo", "Eucarionte"],
  },
  Multicelularismo: {
    lineage: ["Reparo Celular"],
    historical: ["Eucarionte", "Endossimbiose"],
  },
  Quimiossíntese: { lineage: ["Respiração anaeróbia"] },
  Eucarionte: { lineage: ["Reparo Celular"] },
  Endossimbiose: {
    lineage: ["Eucarionte", "Respiração aeróbia"],
  },
  Biomineralização: { lineage: ["Multicelularismo"] },
  "Imunidade Adaptativa": { lineage: ["Vertebrado"] },
  Endorfinas: { lineage: ["Vertebrado"] },
  "Ciclo de Sono": { lineage: ["Multicelularismo", "Locomoção Primitiva"] },
  Hibernação: { lineage: ["Ciclo de Sono", "Endotermia"] },
  Intestino: { lineage: ["Ingestão", "Simetria Bilateral"] },
  "Estômago Ácido": { lineage: ["Vertebrado", "Ingestão"] },
  "Biotransformação Hepática": {
    lineage: ["Vertebrado", "Ingestão", "Respiração aeróbia"],
  },
  Estômatos: { lineage: ["Embriófitas"] },
  Xerofitismo: { lineage: ["Traqueófitas", "Estômatos"] },
  Endotermia: { lineage: ["Vertebrado", "Respiração aeróbia"] },
  "Coração Compartimentado": {
    lineage: ["Vertebrado", "Respiração Pulmonar"],
  },
  "Simetria Bilateral": { lineage: ["Multicelularismo"] },
  "Reprodução Sexuada": {
    lineage: ["Respiração anaeróbia", "Multicelularismo"],
  },
  "Respiração aeróbia": {
    lineage: ["Respiração anaeróbia"],
    historical: ["Fotossíntese"],
  },
  "Respiração Pulmonar": {
    lineage: ["Respiração aeróbia"],
    active: ["Vertebrado"],
  },
  Fotossíntese: { lineage: ["Respiração anaeróbia"] },
  Predação: { lineage: ["Respiração anaeróbia"] },
  Embriófitas: { lineage: ["Fotossíntese"] },
  Traqueófitas: { lineage: ["Embriófitas"] },
  Espinhos: { lineage: ["Traqueófitas"] },
  Madeira: { lineage: ["Traqueófitas"] },
  Gimnospermas: { lineage: ["Traqueófitas"] },
  Trepadeira: { lineage: ["Traqueófitas"] },
  Extremófitas: { lineage: ["Embriófitas"] },
  Angiospermas: { lineage: ["Gimnospermas"] },
  Haustório: { lineage: ["Angiospermas"] },
  "Perfume Floral": { lineage: ["Angiospermas"] },
  Tropismo: { lineage: ["Fotossíntese", "Embriófitas"] },
  Endozoocoria: { lineage: ["Angiospermas"] },
  Capsaicina: { lineage: ["Angiospermas"], active: ["Endozoocoria"] },
  Epizoocoria: { lineage: ["Angiospermas"] },
  Sinzoocoria: { lineage: ["Gimnospermas"] },
  Mirmecocoria: { lineage: ["Angiospermas"] },
  Ingestão: {
    lineage: ["Multicelularismo"],
    lineageAny: ["Predação", "Mixotrofia"],
  },
  Carnívoro: { lineage: ["Predação", "Multicelularismo", "Ingestão"] },
  Herbívoro: { lineage: ["Predação", "Multicelularismo", "Ingestão"] },
  Granívoro: {
    lineage: ["Locomoção Terrestre"],
    lineageAny: ["Herbívoro", "Onívoro"],
    historical: ["Gimnospermas"],
  },
  Necrófago: { lineage: ["Predação", "Multicelularismo"] },
  Coprofagia: {
    lineage: ["Predação", "Multicelularismo", "Locomoção Terrestre"],
  },
  "Pele grossa": { lineage: ["Herbívoro"] },
  "Pele Glandular": {
    lineage: ["Vertebrado", "Respiração Cutânea"],
  },
  Extremotolerância: {
    lineage: ["Artrópode", "Locomoção Terrestre"],
  },
  Contorcionismo: {
    lineage: ["Simetria Bilateral", "Locomoção Primitiva"],
  },
  "Corpo Gelatinoso": {
    lineage: ["Multicelularismo", "Locomoção Primitiva"],
  },
  Esclerotização: {
    lineage: ["Artrópode", "Locomoção Articulada"],
  },
  Toxicidade: {
    lineage: ["Multicelularismo", "Predação"],
  },
  Veneno: {
    lineage: ["Toxicidade"],
  },
  Peçonha: { lineage: ["Veneno"] },
  Mandíbula: {
    lineage: ["Ingestão"],
    lineageAny: ["Vertebrado", "Artrópode"],
  },
  Dentes: { lineage: ["Vertebrado", "Mandíbula", "Biomineralização"] },
  Rizoma: { lineage: ["Traqueófitas", "Brotamento"] },
  Parasitoidismo: { lineage: ["Artrópode", "Parasitismo"] },
  "Rabo Chicote": {
    lineage: ["Vertebrado", "Locomoção Terrestre", "Gigantismo"],
  },
  Ruminante: {
    lineage: ["Vertebrado", "Pelos", "Locomoção Terrestre"],
    active: ["Herbívoro"],
  },
  Tromba: {
    lineage: ["Vertebrado", "Locomoção Terrestre", "Pelos"],
    active: ["Herbívoro"],
  },
  Autotomia: {
    lineage: ["Simetria Bilateral", "Locomoção Primitiva"],
  },
  Tinta: { lineage: ["Jatopropulsão", "Corpo Gelatinoso"] },
  Alelopatia: { lineage: ["Traqueófitas", "Madeira"] },
  Hematofagia: { lineage: ["Carnívoro", "Presas"] },
  "Parasitismo de Ninhada": { lineage: ["Ovíparo", "Parasitismo"] },
  Teia: { lineage: ["Artrópode", "Carnívoro", "Locomoção Terrestre"] },
  "Projétil Biológico": {
    lineage: ["Artrópode", "Toxicidade", "Locomoção Terrestre"],
  },
  "Predação em Massa": {
    lineage: ["Vertebrado", "Carnívoro", "Ingestão", "Respiração Pulmonar"],
  },
  Garras: { lineage: ["Carnívoro", "Vertebrado", "Voo"] },
  "Pescoço Verticalizado": {
    lineage: ["Herbívoro", "Vertebrado", "Locomoção Terrestre"],
  },
  Eletrodescarga: {
    lineage: ["Vertebrado", "Carnívoro", "Percepção Espacial", "Respiração aeróbia"],
  },
  "Exibição deimática": {
    lineage: ["Locomoção Primitiva", "Percepção Espacial"],
  },
  Tanatose: {
    lineage: ["Multicelularismo", "Locomoção Primitiva"],
  },
  "Ofuscamento por movimento": {
    lineage: ["Sociabilidade", "Locomoção Terrestre"],
  },
  Escamas: { lineage: ["Vertebrado", "Ovíparos Amniotas"] },
  Osteodermos: { lineage: ["Vertebrado", "Locomoção Terrestre", "Biomineralização"] },
  Pelos: { lineage: ["Vertebrado", "Ovíparos Amniotas"] },
  Penas: { lineage: ["Vertebrado", "Ovíparos Amniotas"] },
  Presas: { lineage: ["Carnívoro", "Dentes"] },
  Canibalismo: { lineage: ["Carnívoro"] },
  Partenogênese: {
    lineage: ["Multicelularismo", "Simetria Bilateral", "Reprodução Sexuada"],
  },
  "Canibalismo Sexual": {
    lineage: ["Artrópode", "Reprodução Sexuada"],
    active: ["Canibalismo"],
  },
  "Canibalismo Filial": {
    lineage: ["Cuidado Parental"],
    active: ["Canibalismo"],
  },
  Matrifagia: {
    lineage: ["Artrópode", "Cuidado Parental"],
    active: ["Canibalismo"],
  },
  "Cópula Agressiva": {
    lineage: ["Reprodução Sexuada", "Simetria Bilateral", "Locomoção Terrestre"],
  },
  "Vetor Patógeno": { lineage: ["Parasitismo"] },
  "Precocidade Sexual": { lineage: ["Reprodução Sexuada"] },
  "Locomoção Primitiva": { lineage: ["Predação"] },
  Serotonina: { lineage: ["Multicelularismo", "Locomoção Primitiva"] },
  Dopamina: { lineage: ["Multicelularismo", "Locomoção Primitiva"] },
  Vertebrado: { lineage: ["Locomoção Primitiva", "Simetria Bilateral"] },
  Adrenalina: { lineage: ["Vertebrado", "Locomoção Articulada"] },
  Estrogênio: {
    lineage: ["Vertebrado", "Reprodução Sexuada"],
  },
  Testosterona: { lineage: ["Vertebrado", "Reprodução Sexuada"] },
  Corticosteroides: { lineage: ["Vertebrado", "Respiração aeróbia"] },
  "Artrópode": { lineage: ["Locomoção Primitiva", "Simetria Bilateral"] },
  "Sistema Adipocinético": { lineage: ["Artrópode", "Locomoção Articulada"] },
  "Locomoção Articulada": {
    lineage: ["Locomoção Primitiva"],
    lineageAny: ["Vertebrado", "Artrópode"],
  },
  Mixotrofia: {
    lineage: ["Respiração aeróbia"],
    lineageAny: ["Fotossíntese", "Predação"],
  },
  "Percepção Espacial": { lineage: ["Locomoção Articulada"] },
  Escavador: { lineage: ["Locomoção Primitiva"] },
  "Locomoção Terrestre": { lineage: ["Locomoção Articulada"] },
  "Rim Concentrador": {
    lineage: ["Vertebrado", "Locomoção Terrestre", "Respiração Pulmonar"],
  },
  Rastejante: { lineage: ["Locomoção Terrestre"] },
  "Movimento Lateral": {
    lineage: ["Locomoção Terrestre"],
    active: ["Artrópode"],
  },
  Escansão: {
    lineage: ["Locomoção Terrestre", "Escalador"],
    active: ["Vertebrado"],
  },
  Bioadesão: {
    lineage: ["Locomoção Terrestre", "Escalador"],
  },
  Arborícola: {
    lineage: ["Locomoção Terrestre", "Escalador"],
  },
  Forésia: {
    lineage: ["Locomoção Terrestre", "Sociabilidade"],
  },
  Tigmotaxia: { lineage: ["Locomoção Terrestre"] },
  Recuo: {
    lineage: ["Predação", "Locomoção Terrestre"],
    active: ["Velocidade"],
  },
  Deslizamento: { lineage: ["Locomoção Terrestre"] },
  Serpenteamento: {
    lineage: ["Locomoção Terrestre"],
    active: ["Vertebrado"],
  },
  Trilhas: {
    lineage: ["Locomoção Terrestre", "Sociabilidade"],
    active: ["Artrópode"],
  },
  Bipedalismo: { lineage: ["Vertebrado", "Locomoção Terrestre"] },
  Pulo: { lineage: ["Locomoção Articulada", "Locomoção Terrestre"] },
  Jatopropulsão: { lineage: ["Multicelularismo", "Locomoção Primitiva"] },
  Escalador: { lineage: ["Locomoção Terrestre"] },
  "Respiração Cutânea": { lineage: ["Locomoção Articulada"] },
  "Visão Binocular": { lineage: ["Predação"] },
  Velocidade: { lineage: ["Locomoção Terrestre"] },
  "Movimento proteano": { lineage: ["Locomoção Terrestre"] },
  Notívago: { lineage: ["Locomoção Articulada"] },
  "Sacos Aéreos": { lineage: ["Respiração Pulmonar", "Locomoção Terrestre"] },
  Voo: { lineage: ["Locomoção Terrestre"] },
  "Ovíparos Amniotas": { lineage: ["Ovíparo"] },
  Ovovivíparo: { lineage: ["Ovíparos Amniotas"] },
  "Incubação": { lineage: ["Ovíparo"] },
  Placenta: {
    lineage: ["Vertebrado", "Vivíparo", "Estrogênio"],
  },
  Lactação: { lineage: ["Incubação", "Pelos"] },
  Ocitocina: { lineage: ["Lactação"] },
  Forrageamento: {
    lineage: ["Herbívoro", "Locomoção Terrestre"],
  },
  Vivíparo: { lineage: ["Ovíparos Amniotas"] },
  "Ovulação Induzida": {
    lineage: ["Vivíparo", "Reprodução Sexuada"],
  },
  "Visão Noturna": { lineage: ["Notívago"] },
  Feromônios: {
    lineage: ["Reprodução Sexuada", "Locomoção Terrestre"],
    active: ["Predação"],
  },
  Bioluminescência: {
    lineage: ["Reprodução Sexuada", "Visão Noturna"],
    active: ["Predação"],
  },
  "Bioluminescência Predatória": {
    lineage: ["Bioluminescência", "Percepção Espacial"],
    lineageAny: ["Carnívoro", "Onívoro"],
    active: ["Predação"],
  },
  Ecolocalização: { lineage: ["Lactação", "Percepção Espacial"] },
  Ovífagia: { lineage: ["Ovíparo"] },
  Onívoro: { lineageAny: ["Carnívoro", "Herbívoro"] },
  "Interceptação preditiva": {
    lineage: ["Percepção Espacial"],
    lineageAny: ["Carnívoro", "Onívoro"],
  },
  Mimetismo: { lineage: ["Camuflagem"] },
  "Mimetismo Agressivo": {
    lineage: ["Predação", "Mimetismo"],
  },
  "Construtor de Nicho": { lineage: ["Escavador"] },
  Zoorremediação: { lineage: ["Construtor de Nicho"] },
  "Polegar Opositor": { lineage: ["Construtor de Nicho"] },
  Chifre: { lineage: ["Predação"] },
  Roedor: {
    lineage: ["Vertebrado", "Lactação"],
    lineageAny: ["Herbívoro", "Onívoro"],
    active: ["Pelos"],
  },
  "Antropização": { lineage: ["Neocórtex Desenvolvido"] },
  "Córtex Pré-Frontal": { lineage: ["Polegar Opositor"] },
  Neurodivergência: {
    lineage: ["Córtex Pré-Frontal", "Percepção Espacial"],
  },
  "Neocórtex Desenvolvido": { lineage: ["Córtex Pré-Frontal"] },
  Sociabilidade: { lineage: ["Incubação"] },
  Manada: { lineage: ["Sociabilidade"] },
  Hierarquia: { lineage: ["Sociabilidade"] },
  Superorganismo: {
    lineage: ["Eusocialidade", "Artrópode"],
  },
  "Recrutamento em Massa": {
    lineage: [
      "Artrópode",
      "Locomoção Terrestre",
      "Eusocialidade",
      "Percepção Espacial",
    ],
  },
  "Caça Cooperativa": {
    lineage: ["Sociabilidade", "Percepção Espacial"],
    lineageAny: ["Carnívoro", "Onívoro"],
  },
  Mutualismo: { lineage: ["Multicelularismo"] },
  "Plantas Domesticadas": { historical: ["Neocórtex Desenvolvido"] },
  "Animais Domésticos": { historical: ["Neocórtex Desenvolvido"] },
  "Insuficiência Respiratória": { lineage: ["Multicelularismo"] },
  "Anemia Falciforme": {
    lineage: ["Vertebrado", "Respiração aeróbia"],
  },
  "Assimetria Flutuante": { lineage: ["Simetria Bilateral"] },
  Ataxia: { lineage: ["Locomoção Articulada"] },
  Imunodeficiência: { lineage: ["Resistência"] },
  "Deficiência Motora": { lineage: ["Locomoção Primitiva"] },
  "Deficiência Sensorial": { lineage: ["Percepção Espacial"] },
  "Filho único": { lineage: ["Vivíparo"] },
  Subfertilidade: { lineage: ["Reprodução Sexuada"] },
  "Má absorção Alimentar": { lineage: ["Multicelularismo", "Predação"] },
  Semelparidade: { lineage: ["Multicelularismo"] },
  "Regressão Evolutiva": { lineage: ["Reprodução Sexuada"] },
  Nanismo: { lineageAny: ["Vertebrado", "Artrópode"] },
  Gigantismo: { lineage: ["Locomoção Articulada"] },
  "Mutação Mutadora": { lineage: ["Reparo Celular"] },
  "Transferência Horizontal": { lineage: ["Respiração anaeróbia"] },
  Brotamento: { lineage: ["Multicelularismo"] },
  Fragmentação: { lineage: ["Multicelularismo"] },
  Colônia: { lineage: ["Brotamento"] },
  "Séssil": { lineage: ["Multicelularismo"] },
  "Onívoro Oportunista": { lineage: ["Onívoro"] },
  "Acasalamento Preferencial": {
    lineage: ["Reprodução Sexuada", "Percepção Espacial"],
  },
  Promiscuidade: { lineage: ["Reprodução Sexuada", "Sociabilidade"] },
  Pedogênese: { lineage: ["Artrópode", "Metamorfose"] },
  "Cuidado Parental": { lineage: ["Incubação"] },
  Marsupial: { lineage: ["Vertebrado", "Vivíparo", "Lactação"] },
  Monogamia: { lineage: ["Reprodução Sexuada", "Cuidado Parental"] },
  "Acasalamento Múltiplo": {
    lineage: ["Promiscuidade", "Reprodução Sexuada"],
  },
  Metamorfose: {
    lineage: ["Artrópode", "Ovíparo", "Locomoção Terrestre"],
  },
  Hipermetamorfose: {
    lineage: ["Artrópode", "Metamorfose"],
  },
  Ooteca: {
    lineage: ["Artrópode", "Ovíparo"],
  },
};

export const BODY_PLAN_TRAITS = new Set(["Vertebrado", "Artrópode"]);

export const MULTICELLULAR_DEPENDENT_TRAITS = new Set([
  "Simetria Bilateral",
  "Biomineralização",
  "Imunidade Adaptativa",
  "Endotermia",
  "Reprodução Sexuada",
  "Partenogênese",
  "Canibalismo Sexual",
  "Canibalismo Filial",
  "Matrifagia",
  "Cópula Agressiva",
  "Longevidade",
  "Fertilidade Longeva",
  "Imortalidade Biológica",
  "Precocidade Sexual",
  "Brotamento",
  "Fragmentação",
  "Colônia",
  "Séssil",
  "Onívoro Oportunista",
  "Acasalamento Preferencial",
  "Promiscuidade",
  "Pedogênese",
  "Cuidado Parental",
  "Marsupial",
  "Monogamia",
  "Acasalamento Múltiplo",
  "Metamorfose",
  "Hipermetamorfose",
  "Locomoção Primitiva",
  "Jatopropulsão",
  "Pulo",
  "Movimento proteano",
  "Manada",
  "Ecolocalização",
  "Interceptação preditiva",
  "Bipedalismo",
  "Serotonina",
  "Dopamina",
  "Adrenalina",
  "Testosterona",
  "Corticosteroides",
  "Ocitocina",
  "Córtex Pré-Frontal",
  "Vertebrado",
  "Artrópode",
  "Locomoção Articulada",
  "Locomoção Terrestre",
  "Rastejante",
  "Movimento Lateral",
  "Escansão",
  "Bioadesão",
  "Arborícola",
  "Forésia",
  "Tigmotaxia",
  "Recuo",
  "Deslizamento",
  "Serpenteamento",
  "Trilhas",
  "Percepção Espacial",
  "Mixotrofia",
  "Ingestão",
  "Escavador",
  "Construtor de Nicho",
  "Zoorremediação",
  "Necrófago",
  "Coprofagia",
  "Carapaça",
  "Camuflagem",
  "Veneno",
  "Peçonha",
  "Mandíbula",
  "Dentes",
  "Parasitoidismo",
  "Rabo Chicote",
  "Ruminante",
  "Tromba",
  "Rizoma",
  "Autotomia",
  "Tinta",
  "Hematofagia",
  "Parasitismo de Ninhada",
  "Alelopatia",
  "Teia",
  "Projétil Biológico",
  "Predação em Massa",
  "Garras",
  "Pescoço Verticalizado",
  "Eletrodescarga",
  "Coletor",
  "Escalador",
  "Visão Binocular",
  "Velocidade",
  "Carnívoro",
  "Herbívoro",
  "Granívoro",
  "Pele grossa",
  "Presas",
  "Onívoro",
  "Respiração Cutânea",
  "Respiração Pulmonar",
  "Voo",
  "Ovíparo",
  "Ovíparos Amniotas",
  "Ooteca",
  "Incubação",
  "Ovovivíparo",
  "Lactação",
  "Vivíparo",
  "Sacos Aéreos",
  "Ovulação Induzida",
  "Mimetismo",
  "Notívago",
  "Sociabilidade",
  "Visão Noturna",
  "Eusocialidade",
  "Ovífagia",
  "Polegar Opositor",
  "Chifre",
  "Antropização",
  "Animais Domésticos",
  "Plantas Domesticadas",
  "Neocórtex Desenvolvido",
  "Canibalismo",
  "Canibalismo Filial",
  "Canibalismo Sexual",
  "Matrifagia",
  "Cópula Agressiva",
  "Partenogênese",
  "Longevidade",
  "Fertilidade Longeva",
  "Imortalidade Biológica",
  "Parasitismo",
  "Vetor Patógeno",
  "Embriófitas",
  "Estômatos",
  "Traqueófitas",
  "Espinhos",
  "Madeira",
  "Gimnospermas",
  "Trepadeira",
  "Extremófitas",
  "Angiospermas",
  "Haustório",
  "Perfume Floral",
  "Insuficiência Respiratória",
  "Imunodeficiência",
  "Deficiência Motora",
  "Deficiência Sensorial",
  "Filho único",
  "Subfertilidade",
  "Má absorção Alimentar",
  "Semelparidade",
  "Regressão Evolutiva",
  "Nanismo",
  "Gigantismo",
  "Pele Glandular",
  "Escamas",
  "Osteodermos",
  "Pelos",
  "Penas",
  "Roedor",
  "Extremotolerância",
  "Contorcionismo",
  "Corpo Gelatinoso",
  "Esclerotização",
  "Toxicidade",
  "Veneno",
  "Exibição deimática",
  "Tanatose",
  "Ofuscamento por movimento",
  "Mimetismo Agressivo",
  "Tropismo",
  "Forrageamento",
  "Hierarquia",
  "Superorganismo",
  "Recrutamento em Massa",
  "Caça Cooperativa",
  "Mutualismo",
  "Feromônios",
  "Bioluminescência",
  "Bioluminescência Predatória",
  "Assimetria Flutuante",
  "Ataxia",
  "Anemia Falciforme",
  "Endozoocoria",
  "Capsaicina",
  "Epizoocoria",
  "Sinzoocoria",
  "Mirmecocoria",
]);

export function normalizeMulticellularTraits(traits) {
  const set = new Set(traits ?? []);
  if (!set.has("Multicelularismo"))
    for (const trait of MULTICELLULAR_DEPENDENT_TRAITS) set.delete(trait);
  return [...set];
}

export const PLANT_DERIVED_TRAITS = new Set([
  "Embriófitas",
  "Estômatos",
  "Traqueófitas",
  "Espinhos",
  "Madeira",
  "Alelopatia",
  "Rizoma",
  "Gimnospermas",
  "Trepadeira",
  "Extremófitas",
  "Angiospermas",
  "Haustório",
  "Perfume Floral",
  "Tropismo",
  "Plantas Domesticadas",
  "Endozoocoria",
  "Capsaicina",
  "Epizoocoria",
  "Sinzoocoria",
  "Mirmecocoria",
]);

export const PLANT_INCOMPATIBLE_TRAITS = new Set([
  "Predação",
  "Biomineralização",
  "Imunidade Adaptativa",
  "Endotermia",
  "Coração Compartimentado",
  "Endorfinas",
  "Ciclo de Sono",
  "Hibernação",
  "Sistema Adipocinético",
  "Intestino",
  "Estômago Ácido",
  "Rim Concentrador",
  "Estrogênio",
  "Placenta",
  "Biotransformação Hepática",
  "Simetria Bilateral",
  "Locomoção Primitiva",
  "Jatopropulsão",
  "Pulo",
  "Movimento proteano",
  "Manada",
  "Ecolocalização",
  "Interceptação preditiva",
  "Bipedalismo",
  "Serotonina",
  "Dopamina",
  "Adrenalina",
  "Testosterona",
  "Corticosteroides",
  "Ocitocina",
  "Córtex Pré-Frontal",
  "Vertebrado",
  "Artrópode",
  "Locomoção Articulada",
  "Locomoção Terrestre",
  "Rastejante",
  "Movimento Lateral",
  "Escansão",
  "Bioadesão",
  "Arborícola",
  "Forésia",
  "Tigmotaxia",
  "Recuo",
  "Deslizamento",
  "Serpenteamento",
  "Trilhas",
  "Percepção Espacial",
  "Escavador",
  "Escalador",
  "Respiração Cutânea",
  "Respiração Pulmonar",
  "Visão Binocular",
  "Velocidade",
  "Notívago",
  "Sacos Aéreos",
  "Carnívoro",
  "Herbívoro",
  "Granívoro",
  "Pele grossa",
  "Presas",
  "Canibalismo",
  "Parasitismo",
  "Vetor Patógeno",
  "Onívoro",
  "Necrófago",
  "Coprofagia",
  "Ovíparo",
  "Ovíparos Amniotas",
  "Ovovivíparo",
  "Ovífagia",
  "Vivíparo",
  "Incubação",
  "Lactação",
  "Ovulação Induzida",
  "Ooteca",
  "Voo",
  "Visão Noturna",
  "Eusocialidade",
  "Chifre",
  "Construtor de Nicho",
  "Zoorremediação",
  "Polegar Opositor",
  "Neurodivergência",
  "Neocórtex Desenvolvido",
  "Antropização",
  "Animais Domésticos",
  "Sociabilidade",
  "Mimetismo",
  "Mimetismo Agressivo",
  "Forrageamento",
  "Hierarquia",
  "Superorganismo",
  "Recrutamento em Massa",
  "Caça Cooperativa",
  "Assimetria Flutuante",
  "Ataxia",
  "Anemia Falciforme",
  "Extremotolerância",
  "Contorcionismo",
  "Corpo Gelatinoso",
  "Esclerotização",
  "Toxicidade",
  "Veneno",
  "Peçonha",
  "Mandíbula",
  "Dentes",
  "Parasitoidismo",
  "Rabo Chicote",
  "Ruminante",
  "Tromba",
  "Autotomia",
  "Tinta",
  "Hematofagia",
  "Parasitismo de Ninhada",
  "Teia",
  "Projétil Biológico",
  "Predação em Massa",
  "Garras",
  "Pescoço Verticalizado",
  "Eletrodescarga",
  "Exibição deimática",
  "Tanatose",
  "Ofuscamento por movimento",
  "Feromônios",
  "Bioluminescência",
  "Bioluminescência Predatória",
  "Onívoro Oportunista",
  "Acasalamento Preferencial",
  "Promiscuidade",
  "Pedogênese",
  "Cuidado Parental",
  "Marsupial",
  "Monogamia",
  "Acasalamento Múltiplo",
  "Metamorfose",
  "Hipermetamorfose",
  "Pele Glandular",
  "Escamas",
  "Osteodermos",
  "Pelos",
  "Penas",
  "Roedor",
  "Insuficiência Respiratória",
  "Deficiência Motora",
  "Deficiência Sensorial",
  "Filho único",
  "Má absorção Alimentar",
  "Nanismo",
  "Gigantismo",
]);

export const TRAIT_BRANCH_SCOPE = Object.freeze({
  Quimiossíntese: "shared",
  Eucarionte: "shared",
  Endossimbiose: "shared",
  Biomineralização: "predation",
  "Imunidade Adaptativa": "predation",
  Estômatos: "photosynthesis",
  Xerofitismo: "photosynthesis",
  Endotermia: "predation",
  "Coração Compartimentado": "predation",
  Endorfinas: "predation",
  "Ciclo de Sono": "predation",
  Hibernação: "predation",
  Intestino: "predation",
  "Estômago Ácido": "predation",
  "Sistema Adipocinético": "predation",
  "Rim Concentrador": "predation",
  Estrogênio: "predation",
  Placenta: "predation",
  "Biotransformação Hepática": "predation",
  "Transferência Horizontal": "shared",
  Biofilme: "shared",
  "Fixação de Nitrogênio": "shared",
  "Diferenciação Celular": "shared",
  Ingestão: "predation",
  Coletor: "predation",
  "Respiração Pulmonar": "predation",
  Brotamento: "shared",
  Fragmentação: "shared",
  Colônia: "shared",
  "Séssil": "shared",
  Necrófago: "predation",
  Coprofagia: "predation",
  Rastejante: "predation",
  "Movimento Lateral": "predation",
  Escansão: "predation",
  Bioadesão: "predation",
  Arborícola: "predation",
  Forésia: "predation",
  Tigmotaxia: "predation",
  Recuo: "predation",
  Deslizamento: "predation",
  Serpenteamento: "predation",
  Trilhas: "predation",
  Granívoro: "predation",
  "Onívoro Oportunista": "predation",
  "Acasalamento Preferencial": "predation",
  Promiscuidade: "predation",
  Pedogênese: "predation",
  "Cuidado Parental": "predation",
  Marsupial: "predation",
  Monogamia: "predation",
  "Acasalamento Múltiplo": "predation",
  Partenogênese: "predation",
  "Canibalismo Sexual": "predation",
  "Canibalismo Filial": "predation",
  Matrifagia: "predation",
  "Cópula Agressiva": "predation",
  Longevidade: "predation",
  "Fertilidade Longeva": "predation",
  "Imortalidade Biológica": "predation",
  Metamorfose: "predation",
  Hipermetamorfose: "predation",
  "Pele Glandular": "predation",
  Escamas: "predation",
  Osteodermos: "predation",
  Pelos: "predation",
  Penas: "predation",
  Roedor: "predation",
  Zoorremediação: "predation",
  Neurodivergência: "predation",
  Extremotolerância: "predation",
  Contorcionismo: "predation",
  "Corpo Gelatinoso": "predation",
  Esclerotização: "predation",
  Toxicidade: "predation",
  Veneno: "predation",
  Peçonha: "predation",
  Mandíbula: "predation",
  Dentes: "predation",
  Parasitoidismo: "predation",
  "Rabo Chicote": "predation",
  Ruminante: "predation",
  Tromba: "predation",
  Rizoma: "photosynthesis",
  Autotomia: "predation",
  Tinta: "predation",
  Hematofagia: "predation",
  "Parasitismo de Ninhada": "predation",
  Alelopatia: "photosynthesis",
  Teia: "predation",
  "Projétil Biológico": "predation",
  "Predação em Massa": "predation",
  Garras: "predation",
  "Pescoço Verticalizado": "predation",
  Eletrodescarga: "predation",
  "Exibição deimática": "predation",
  Tanatose: "predation",
  "Ofuscamento por movimento": "predation",
  Mimetismo: "predation",
  "Mimetismo Agressivo": "predation",
  Forrageamento: "predation",
  Hierarquia: "predation",
  Superorganismo: "predation",
  "Recrutamento em Massa": "predation",
  "Caça Cooperativa": "predation",
  Feromônios: "predation",
  Bioluminescência: "predation",
  "Bioluminescência Predatória": "predation",
  Mutualismo: "shared",
  Tropismo: "photosynthesis",
  "Assimetria Flutuante": "predation",
  Ataxia: "predation",
  "Anemia Falciforme": "predation",
  Endozoocoria: "photosynthesis",
  Capsaicina: "photosynthesis",
  Epizoocoria: "photosynthesis",
  Sinzoocoria: "photosynthesis",
  Mirmecocoria: "photosynthesis",
});

export const TRAIT_INCOMPATIBILITIES = Object.freeze({
  Fragmentação: ["Vertebrado", "Artrópode", "Ooteca"],
  Contorcionismo: ["Esclerotização"],
  Esclerotização: ["Contorcionismo"],
  Coprofagia: ["Mixotrofia"],
  Mixotrofia: ["Coprofagia"],
  Vertebrado: ["Fragmentação"],
  "Artrópode": ["Fragmentação", "Respiração Pulmonar"],
  "Respiração Pulmonar": ["Artrópode"],
  Ooteca: ["Fragmentação"],
  "Canibalismo Sexual": ["Acasalamento Múltiplo"],
  "Acasalamento Múltiplo": ["Canibalismo Sexual"],
  "Imortalidade Biológica": ["Simetria Bilateral"],
  "Simetria Bilateral": ["Imortalidade Biológica"],
  Pedogênese: ["Precocidade Sexual"],
  "Precocidade Sexual": ["Pedogênese"],
});

export function traitCombinationValid(traits) {
  const set = new Set(traits ?? []);
  if (
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  )
    return false;
  if (
    [...set].some((trait) =>
      (TRAIT_INCOMPATIBILITIES[trait] ?? []).some((other) => set.has(other)),
    )
  )
    return false;
  return ACTIVE_TRAIT_FAMILIES.every(
    (family) =>
      family.id === "energy" ||
      family.traits.filter((trait) => set.has(trait)).length <= 1,
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
      (preferred !== "Fotossíntese" &&
        set.has("Predação") &&
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

export function normalizeActiveTraits(traits, preferredEnergy = null) {
  const source = [...new Set(normalizeEnergyBranch(traits, preferredEnergy))],
    keep = new Set(source);
  for (const family of ACTIVE_TRAIT_FAMILIES) {
    if (family.id === "energy") continue;
    const present = family.traits.filter((trait) => keep.has(trait));
    if (present.length <= 1) continue;
    const winner =
      family.id === "diet" && !keep.has("Onívoro")
        ? [...source]
            .reverse()
            .find((trait) => ["Carnívoro", "Herbívoro"].includes(trait))
        : present.at(-1);
    for (const trait of present)
      if (trait !== winner) keep.delete(trait);
  }
  return source.filter((trait) => keep.has(trait));
}

export function traitSupersededByActive(traits, trait) {
  const entry = activeFamilyByTrait.get(trait);
  if (!entry || entry.family.id === "energy") return false;
  const active = entry.family.traits.find((candidate) =>
    (traits ?? []).includes(candidate),
  );
  if (!active || active === trait) return false;
  if (entry.family.id === "diet")
    return active === "Onívoro" && trait !== "Onívoro";
  return (
    entry.family.traits.indexOf(active) >
    entry.family.traits.indexOf(trait)
  );
}

export function applyTraitMutation(traits, trait) {
  const set = new Set(traits ?? []),
    family = activeTraitFamily(trait);
  if (family)
    for (const member of family.traits) set.delete(member);
  for (const incompatible of TRAIT_INCOMPATIBILITIES[trait] ?? [])
    set.delete(incompatible);
  if (trait === "Predação") {
    set.delete("Fotossíntese");
    for (const plantTrait of PLANT_DERIVED_TRAITS) set.delete(plantTrait);
  } else if (trait === "Fotossíntese") {
    for (const animalTrait of PLANT_INCOMPATIBLE_TRAITS) set.delete(animalTrait);
  }
  set.add(trait);
  return normalizeActiveTraits(
    [...set],
    ["Predação", "Fotossíntese"].includes(trait) ? trait : null,
  );
}

export function applyTraitLoss(traits, ancestry, trait) {
  const next = (traits ?? []).filter((candidate) => candidate !== trait),
    family = activeTraitFamily(trait);
  if (!family || family.id === "energy") return normalizeActiveTraits(next);
  const activeFamilyMember = next.some((candidate) =>
    family.traits.includes(candidate),
  );
  if (activeFamilyMember) return normalizeActiveTraits(next);

  if (family.id === "diet" && trait !== "Onívoro")
    return normalizeActiveTraits(next);

  const lineage = ancestry ?? [],
    fallback = [...lineage]
      .reverse()
      .find(
        (candidate) =>
          candidate !== trait &&
          family.traits.includes(candidate) &&
          (family.id === "diet" ||
            family.traits.indexOf(candidate) < family.traits.indexOf(trait)),
      );
  if (fallback) next.push(fallback);
  return normalizeActiveTraits(next);
}

const LOSS_FOUNDATION_DEPENDENCIES = Object.freeze({
  Multicelularismo: ["Eucarionte", "Endossimbiose"],
});

function carriedTraitsForLoss(piece) {
  const genome = piece?.genome,
    carriedFromGenome =
      genome && typeof genome === "object"
        ? Object.entries(genome)
            .filter(
              ([, pair]) =>
                Array.isArray(pair) &&
                pair.some((allele) => allele?.value === "derived"),
            )
            .map(([trait]) => trait)
        : [];
  return new Set(
    carriedFromGenome.length
      ? carriedFromGenome
      : piece?.traits ?? [],
  );
}

function positiveDependentRequiresTrait(piece, dependent, trait, carried) {
  if (
    dependent === trait ||
    NEGATIVE_TRAITS.has(dependent)
  )
    return false;

  if (
    trait === "Multicelularismo" &&
    MULTICELLULAR_DEPENDENT_TRAITS.has(dependent)
  )
    return true;
  if (
    trait === "Fotossíntese" &&
    PLANT_DERIVED_TRAITS.has(dependent)
  )
    return true;
  if (
    (LOSS_FOUNDATION_DEPENDENCIES[dependent] ?? []).includes(trait)
  )
    return true;

  const dependencies = TRAIT_DEPENDENCIES[dependent] ?? {};
  if ((dependencies.lineage ?? []).includes(trait)) return true;

  if ((dependencies.lineageAny ?? []).includes(trait)) {
    const alternativeStillCarried = dependencies.lineageAny.some(
      (candidate) => candidate !== trait && carried.has(candidate),
    );
    if (!alternativeStillCarried) return true;
  }

  if (
    (dependencies.active ?? []).includes(trait) &&
    (piece?.traits ?? []).includes(dependent)
  )
    return true;

  return false;
}

export function traitLossAllowed(piece, trait) {
  if (trait === "Respiração anaeróbia" || BODY_PLAN_TRAITS.has(trait))
    return false;
  if (ENERGY_BRANCH_TRAITS.has(trait))
    return (piece?.ancestry ?? []).includes("Quimiossíntese");
  if (NEGATIVE_TRAITS.has(trait)) return true;

  const carried = carriedTraitsForLoss(piece);
  return ![...carried].some((dependent) =>
    positiveDependentRequiresTrait(piece, dependent, trait, carried),
  );
}

export function geologicalStage(id) {
  const normalized = LEGACY_GEOLOGICAL_STAGE_ALIASES[id] ?? id;
  return byId.get(normalized) ?? byId.get("eoarchean");
}

export function currentGeologicalStage(state) {
  return geologicalStage(state.geologicalStage);
}

export function aquaticFertilityRegime(stateOrStage) {
  const stage =
    typeof stateOrStage === "string"
      ? geologicalStage(stateOrStage)
      : currentGeologicalStage(stateOrStage);
  return stage.index <= geologicalStage("ordovician").index;
}

const SILURIAN_SHORE_FERTILE_ROWS = new Set([0, 2, 5, 7]);

export function aquaticTerrainCell(stateOrStage, r, c) {
  const stage =
    typeof stateOrStage === "string"
      ? geologicalStage(stateOrStage)
      : currentGeologicalStage(stateOrStage);
  if (stage.index <= geologicalStage("ordovician").index) return true;
  if (stage.id !== "silurian") return false;
  return c < 3 || (c === 3 && SILURIAN_SHORE_FERTILE_ROWS.has(r));
}

export function conwayUnlocked(stateOrStage) {
  const stage =
    typeof stateOrStage === "string"
      ? geologicalStage(stateOrStage)
      : currentGeologicalStage(stateOrStage);
  return stage.index >= geologicalStage("devonian").index;
}

export function nextGeologicalStage(id) {
  const stage = geologicalStage(id);
  return GEOLOGICAL_STAGES[Math.min(stage.index + 1, GEOLOGICAL_STAGES.length - 1)];
}

export function geologicalLabel(state) {
  const stage = currentGeologicalStage(state);
  return stage.group === stage.period
    ? stage.period
    : `${stage.group} · ${stage.period}`;
}

export function periodInnovations(stateOrStage) {
  const stage =
    typeof stateOrStage === "string"
      ? geologicalStage(stateOrStage)
      : currentGeologicalStage(stateOrStage),
    assigned = Object.entries(TRAIT_STAGE)
      .filter(([, stageId]) => stageId === stage.id)
      .map(([trait]) => trait);
  return [
    ...stage.required,
    ...assigned.filter((trait) => !stage.required.includes(trait)),
  ];
}

function lineageHas(piece, trait) {
  return (
    (piece?.traits ?? []).includes(trait) ||
    (piece?.ancestry ?? []).includes(trait)
  );
}

function canonicalPeriodLineages(state) {
  if (state?.scenario !== "earth") return [];
  const stage = currentGeologicalStage(state),
    curated = EARTH_FOUNDER_GENOMES[stage.id];
  if (!curated) return [];
  const inheritedRepair =
      stage.index > geologicalStage("mesoarchean").index
        ? ["Reparo Celular"]
        : [],
    inheritedBilateral =
      stage.index > geologicalStage("ediacaran").index
        ? ["Simetria Bilateral"]
        : [],
    persistent = earthFounderPersistentTraits(stage.id),
    plant = [
      ...new Set([...curated.plant, ...persistent, ...inheritedRepair]),
    ],
    animal = [
      ...new Set([
        ...curated.animal,
        ...persistent,
        ...inheritedRepair,
        ...inheritedBilateral,
      ]),
    ];
  return [
    {
      traits: normalizeActiveTraits(plant, "Fotossíntese"),
      ancestry: earthFounderHistory(stage.id, "plant"),
    },
    {
      traits: normalizeActiveTraits(animal, "Predação"),
      ancestry: earthFounderHistory(stage.id, "animal"),
    },
  ];
}

function periodTraitReachableOnPiece(state, trait, piece, visiting = new Set()) {
  if (!piece) return false;
  if (lineageHas(piece, trait)) return true;
  const current = currentGeologicalStage(state);
  if (TRAIT_STAGE[trait] !== current.id || visiting.has(trait)) return false;

  const active = piece.traits ?? [],
    nextVisiting = new Set(visiting).add(trait);

  if (
    ENERGY_BRANCH_TRAITS.has(trait) &&
    [...ENERGY_BRANCH_TRAITS].some(
      (candidate) => candidate !== trait && active.includes(candidate),
    )
  )
    return false;
  if (
    BODY_PLAN_TRAITS.has(trait) &&
    [...BODY_PLAN_TRAITS].some(
      (candidate) => candidate !== trait && active.includes(candidate),
    )
  )
    return false;
  if (traitSupersededByActive(active, trait)) return false;
  if (
    (TRAIT_INCOMPATIBILITIES[trait] ?? []).some((candidate) =>
      active.includes(candidate),
    )
  )
    return false;
  if (
    active.includes("Fotossíntese") &&
    trait !== "Predação" &&
    PLANT_INCOMPATIBLE_TRAITS.has(trait)
  )
    return false;
  if (
    PLANT_DERIVED_TRAITS.has(trait) &&
    !active.includes("Fotossíntese")
  )
    return false;

  const canReachLineage = (dependency) =>
    lineageHas(piece, dependency) ||
    (TRAIT_STAGE[dependency] === current.id &&
      periodTraitReachableOnPiece(
        state,
        dependency,
        piece,
        nextVisiting,
      ));

  if (
    MULTICELLULAR_DEPENDENT_TRAITS.has(trait) &&
    !active.includes("Multicelularismo") &&
    !canReachLineage("Multicelularismo")
  )
    return false;

  const deps = TRAIT_DEPENDENCIES[trait];
  if ((deps?.lineage ?? []).some((dependency) => !canReachLineage(dependency)))
    return false;
  if (
    deps?.lineageAny?.length &&
    !deps.lineageAny.some((dependency) => canReachLineage(dependency))
  )
    return false;

  const history = new Set(state.historicalTraits ?? []);
  if (
    (deps?.historical ?? []).some(
      (dependency) =>
        !history.has(dependency) &&
        TRAIT_STAGE[dependency] !== current.id,
    )
  )
    return false;

  if (
    (trait === "Carnívoro" && active.includes("Herbívoro")) ||
    (trait === "Herbívoro" && active.includes("Carnívoro"))
  )
    return false;
  return true;
}

export function periodTraitReachable(state, trait) {
  if ((state.historicalTraits ?? []).includes(trait)) return true;
  const candidates = [
    ...(state.pieces ?? []),
    ...canonicalPeriodLineages(state),
  ];
  return candidates.some((piece) =>
    periodTraitReachableOnPiece(state, trait, piece),
  );
}

const OPTIONAL_NON_COMPLETION_TRAITS = new Set([
  "Imunidade Adaptativa",
  "Pele Glandular",
  "Escamas",
  "Osteodermos",
  "Capsaicina",
  "Epizoocoria",
  "Sinzoocoria",
  "Mirmecocoria",
  "Zoorremediação",
  "Neurodivergência",
  "Extremotolerância",
  "Contorcionismo",
  "Corpo Gelatinoso",
  "Esclerotização",
  "Veneno",
  "Exibição deimática",
  "Tanatose",
  "Ofuscamento por movimento",
  "Mimetismo Agressivo",
  "Forrageamento",
  "Hierarquia",
  "Superorganismo",
  "Recrutamento em Massa",
  "Caça Cooperativa",
  "Mutualismo",
  "Partenogênese",
  "Canibalismo Sexual",
  "Canibalismo Filial",
  "Matrifagia",
  "Cópula Agressiva",
  "Longevidade",
  "Fertilidade Longeva",
  "Imortalidade Biológica",
  "Hipermetamorfose",
  "Feromônios",
  "Bioluminescência",
  "Bioluminescência Predatória",
]);

export function periodCompletionInnovations(state) {
  const stage = currentGeologicalStage(state),
    history = new Set(state.historicalTraits ?? []);
  return [...new Set(stage.required ?? [])].filter(
    (trait) => history.has(trait) || periodTraitReachable(state, trait),
  );
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
  const discovered = new Set(state.historicalTraits ?? []);
  return periodCompletionInnovations(state).filter(
    (trait) => !discovered.has(trait),
  );
}

export function stageProgress(state) {
  if (currentGeologicalStage(state).id === "hadean") {
    const tutorial = state.hadeanTutorial ?? {},
      history = new Set(state.historicalTraits ?? []),
      steps = [
        ["Reproduzir", !!tutorial.divided],
        ["Quimiossíntese", history.has("Quimiossíntese")],
        ["Casa fértil", !!tutorial.fertile],
      ],
      required = steps.map(([label]) => label),
      discovered = steps.filter(([, done]) => done).map(([label]) => label),
      missing = steps.filter(([, done]) => !done).map(([label]) => label);
    return {
      required,
      discovered,
      missing,
      complete: missing.length === 0,
    };
  }
  const required = periodCompletionInnovations(state),
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
    missingInnovations(state).length === 0 &&
    (stage.id !== "hadean" || state.hadeanTutorial?.fertile === true)
  );
}

export function traitUnlocked(state, trait, piece = null) {
  if (NEGATIVE_TRAITS.has(trait))
    return negativeTraitUnlocked(state, trait, piece);
  if (
    piece &&
    ENERGY_BRANCH_TRAITS.has(trait) &&
    [...ENERGY_BRANCH_TRAITS].some(
      (candidate) => candidate !== trait && piece.traits?.includes(candidate),
    )
  )
    return false;
  if (
    piece &&
    BODY_PLAN_TRAITS.has(trait) &&
    [...BODY_PLAN_TRAITS].some(
      (candidate) => candidate !== trait && piece.traits?.includes(candidate),
    )
  )
    return false;
  if (piece && traitSupersededByActive(piece.traits, trait)) return false;
  if (
    piece &&
    (TRAIT_INCOMPATIBILITIES[trait] ?? []).some((candidate) =>
      piece.traits?.includes(candidate),
    )
  )
    return false;
  if (
    piece?.traits?.includes("Fotossíntese") &&
    trait !== "Predação" &&
    PLANT_INCOMPATIBLE_TRAITS.has(trait)
  )
    return false;
  if (
    PLANT_DERIVED_TRAITS.has(trait) &&
    !piece?.traits?.includes("Fotossíntese")
  )
    return false;
  if (
    MULTICELLULAR_DEPENDENT_TRAITS.has(trait) &&
    !piece?.traits?.includes("Multicelularismo")
  )
    return false;
  const stageId = TRAIT_STAGE[trait];
  if (!stageId) return true;
  const current = currentGeologicalStage(state),
    requiredStage = geologicalStage(stageId),
    deps = TRAIT_DEPENDENCIES[trait],
    history = new Set(state.historicalTraits ?? []);
  if (state.scenario !== "arena") {
    if (current.index < requiredStage.index) return false;
    if (!earthTraitWindowAllows(state, current.id, requiredStage.id)) return false;
    if (
      current.id === requiredStage.id &&
      (current.optionalCycles?.[trait] ?? 1) > (state.cycle ?? 1)
    )
      return false;
    if (current.id === requiredStage.id && current.required.includes(trait)) {
      const activeRequired = cycleRequiredInnovations(state),
        nextRequired = activeRequired.find((candidate) => !history.has(candidate)),
        parallelArcheanMetabolism =
          current.id === "eoarchean" &&
          activeRequired.includes("Fotossíntese") &&
          activeRequired.includes("Predação") &&
          ["Fotossíntese", "Predação"].includes(trait);
      if (!history.has(trait)) {
        if (!activeRequired.includes(trait)) return false;
        if (!parallelArcheanMetabolism && nextRequired !== trait) return false;
      } else if (
        !parallelArcheanMetabolism &&
        nextRequired &&
        activeRequired.includes(trait) &&
        activeRequired.indexOf(trait) < activeRequired.indexOf(nextRequired)
      )
        return false;
    }
  }
  const lineage = new Set([
    ...(piece?.ancestry ?? piece?.traits ?? []),
    ...(piece?.traits ?? []),
  ]);
  if (
    state.scenario !== "arena" &&
    deps?.historical?.some((dependency) => !history.has(dependency))
  )
    return false;
  if (deps?.lineage?.some((dependency) => !lineage.has(dependency)))
    return false;
  if (
    deps?.active?.some(
      (dependency) => !piece?.traits?.includes(dependency),
    )
  )
    return false;
  if (
    deps?.lineageAny?.length &&
    !deps.lineageAny.some((dependency) => lineage.has(dependency))
  )
    return false;
  if (
    (trait === "Carnívoro" && piece?.traits?.includes("Herbívoro")) ||
    (trait === "Herbívoro" && piece?.traits?.includes("Carnívoro"))
  )
    return false;
  return true;
}

export function pawnMutationUnlocked(state, piece = null) {
  if (!piece) return false;
  return (
    (piece.traits ?? []).includes("Locomoção Primitiva") ||
    (piece.ancestry ?? []).includes("Locomoção Primitiva")
  );
}

export function deleteriousMutationUnlocked(state) {
  if (state.scenario === "arena") return true;
  const current = currentGeologicalStage(state),
    eoarchean = geologicalStage("eoarchean");
  if (current.index < eoarchean.index) return false;
  if (current.id === "eoarchean") return (state.cycle ?? 1) > 2;
  return true;
}

export function negativeTraitUnlocked(state, trait, piece = null, options = {}) {
  if (
    !NEGATIVE_TRAITS.has(trait) ||
    (!options.somatic && !deleteriousMutationUnlocked(state))
  )
    return false;
  const rule = NEGATIVE_TRAIT_RULES[trait] ?? {};
  if (options.somatic && !rule.somatic) return false;
  if (
    piece?.traits?.includes("Fotossíntese") &&
    PLANT_INCOMPATIBLE_TRAITS.has(trait)
  )
    return false;
  if (state.scenario !== "arena" && rule.stage) {
    const current = currentGeologicalStage(state),
      required = geologicalStage(rule.stage);
    if (current.index < required.index) return false;
  }
  const lineage = new Set([
    ...(piece?.ancestry ?? piece?.traits ?? []),
    ...(piece?.traits ?? []),
  ]);
  if ((rule.lineage ?? []).some((dependency) => !lineage.has(dependency)))
    return false;
  if (
    rule.lineageAny?.length &&
    !rule.lineageAny.some((dependency) => lineage.has(dependency))
  )
    return false;
  return true;
}

export function rankMutationUnlocked(state) {
  return currentGeologicalStage(state).index >= geologicalStage("cambrian").index;
}

export function normalizePhotosyntheticRank(profile) {
  if (!profile?.traits?.includes("Fotossíntese")) return profile;
  const multicellular = profile.traits.includes("Multicelularismo"),
    vascular = profile.traits.includes("Traqueófitas"),
    allowed = vascular
      ? new Set([0, 1, 2, 3, 4, 5])
      : multicellular
        ? new Set([0, 1, 2, 4])
        : new Set([0, 4]);
  if (!allowed.has(profile.rank)) profile.rank = 0;
  return profile;
}

export function contactCaptureUnlocked(piece = null) {
  if (!piece) return false;
  const predatory =
    piece.traits?.includes("Predação") ||
    piece.traits?.includes("Mixotrofia");
  return (
    predatory &&
    !piece.traits?.includes("Locomoção Primitiva") &&
    !(piece.ancestry ?? []).includes("Locomoção Primitiva")
  );
}

export function captureUnlocked(state, piece = null) {
  if (!piece) return false;
  return (
    piece.traits?.includes("Predação") ||
    piece.traits?.includes("Mixotrofia") ||
    false
  );
}

export const PATHOGEN_AGENT_STAGE = Object.freeze({
  virus: "siderian",
  bacteria: "ediacaran",
  fungus: "cambrian",
});

export function pathogenAgentUnlocked(state, agent) {
  const stageId = PATHOGEN_AGENT_STAGE[agent];
  if (!stageId) return false;
  if (state?.scenario === "arena") return true;
  return (
    currentGeologicalStage(state).index >= geologicalStage(stageId).index
  );
}

export function availablePathogenAgents(state) {
  return Object.keys(PATHOGEN_AGENT_STAGE).filter((agent) =>
    pathogenAgentUnlocked(state, agent),
  );
}

export function pathogenUnlocked(state) {
  return availablePathogenAgents(state).length > 0;
}

export function sexualPathogenUnlocked(state) {
  return !!(
    state?.scenario !== "arena" &&
    (state?.historicalTraits ?? []).includes("Reprodução Sexuada") &&
    Number.isInteger(state?.sexualPathogenUnlockTotalCycle) &&
    (state?.totalCycles ?? 0) >= state.sexualPathogenUnlockTotalCycle
  );
}

export function fecalPathogenUnlocked(state) {
  if (state?.scenario === "arena") return true;
  return (
    currentGeologicalStage(state).index >= geologicalStage("silurian").index
  );
}

export function sporePathogenUnlocked(state) {
  if (state?.scenario === "arena") return true;
  return (
    currentGeologicalStage(state).index >= geologicalStage("devonian").index
  );
}

export const CYCLE_POSITIVE_INNOVATION_MULTIPLIERS = Object.freeze([
  1,
  1,
  0.6,
  0.35,
  0.2,
  0.1,
]);

export function cyclePositiveInnovationMultiplier(state, trait) {
  if (state?.scenario === "arena") return 1;
  const history = new Set(state?.historicalTraits ?? []),
    cycleInnovations = state?.cyclePositiveInnovations ?? [];
  if (history.has(trait) || cycleInnovations.includes(trait)) return 1;
  return CYCLE_POSITIVE_INNOVATION_MULTIPLIERS[cycleInnovations.length] ?? 0;
}

export function innovationWeight(state, trait, piece = null) {
  const current = currentGeologicalStage(state),
    deps = TRAIT_DEPENDENCIES[trait],
    lineage = new Set([
      ...(piece?.ancestry ?? piece?.traits ?? []),
      ...(piece?.traits ?? []),
    ]),
    dependencyMatched =
      !!deps?.lineage?.length &&
      deps.lineage.every((dependency) => lineage.has(dependency)),
    history = new Set(state.historicalTraits ?? []),
    completionTarget =
      TRAIT_STAGE[trait] === current.id &&
      !history.has(trait) &&
      periodCompletionInnovations(state).includes(trait);
  return (
    scenarioInnovationWeight(state, trait, piece, {
      required: current.required.includes(trait) || completionTarget,
      dependencyMatched,
    }) * cyclePositiveInnovationMultiplier(state, trait)
  );
}

export function eventWeights(state) {
  if (currentGeologicalStage(state).id === "hadean") return {};
  const weights = scenarioEventWeights(
    state,
    currentGeologicalStage(state).events,
  );
  if (
    state.scenario !== "earth" ||
    pathogenUnlocked(state)
  )
    weights.pathogen ??= 1;
  else delete weights.pathogen;
  return weights;
}

export function habitatProfile(stateOrStage) {
  const stage =
    typeof stateOrStage === "string"
      ? geologicalStage(stateOrStage)
      : currentGeologicalStage(stateOrStage);
  return typeof stateOrStage === "string"
    ? { ...stage.habitat }
    : scenarioHabitatProfile(stateOrStage, stage.habitat);
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
