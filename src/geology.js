import {
  earthTraitWindowAllows,
  scenarioEventWeights,
  scenarioHabitatProfile,
  scenarioInnovationWeight,
} from "./scenarios.js";

export const NEGATIVE_TRAIT_RULES = Object.freeze({
  Esterilidade: { stage: null, somatic: true },
  "Mutação Deletéria": { stage: null, somatic: true },
  "Mutação Disfuncional": { stage: null, somatic: true },
  "Insuficiência Respiratória": {
    stage: "proterozoic",
    lineage: ["Multicelularismo"],
    somatic: true,
  },
  Imunodeficiência: {
    stage: "proterozoic",
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
    stage: "proterozoic",
    lineage: ["Reprodução Sexuada"],
    somatic: false,
  },
  "Má absorção Alimentar": {
    stage: "ediacaran",
    lineage: ["Multicelularismo", "Predação"],
    somatic: true,
  },
  Semelparidade: {
    stage: "proterozoic",
    lineage: ["Multicelularismo"],
    somatic: false,
  },
  "Regressão Evolutiva": {
    stage: "proterozoic",
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
    stage: "archean",
    lineage: ["Reparo Celular"],
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
    group: "Pré-Cambriano",
    period: "Hadeano",
    required: ["Respiração anaeróbia"],
    habitat: {
      fertile: 64,
      hostile: 0,
      founderFertile: true,
      naturalBarriers: [0, 0],
      pattern: "primordial",
    },
    events: {},
  },
  {
    id: "archean",
    group: "Pré-Cambriano",
    period: "Arqueano",
    required: ["Fotossíntese", "Predação", "Reparo Celular", "Dormência"],
    cycles: [
      ["Fotossíntese", "Predação"],
      ["Reparo Celular"],
      ["Dormência"],
    ],
    optionalCycles: {
      "Transferência Horizontal": 2,
    },
    habitat: { fertile: 64, hostile: 0, founderFertile: true, naturalBarriers: [0, 0], pattern: "aquatic" },
    events: { volcano: 4, earthquake: 3, solar: 3, meteor: 2, grb: 1 },
  },
  {
    id: "proterozoic",
    group: "Pré-Cambriano",
    period: "Proterozoico",
    required: [
      "Multicelularismo",
      "Resistência",
      "Regeneração",
      "Reprodução Sexuada",
      "Carnívoro",
    ],
    habitat: { fertile: 64, hostile: 0, founderFertile: true, naturalBarriers: [0, 0], pattern: "aquatic" },
    events: {
      fertilized: 3,
      volcano: 2,
      ice: 2,
      "abundant-rains": 2,
      solar: 1,
      earthquake: 1,
      grb: 1,
    },
  },
  {
    id: "ediacaran",
    group: "Pré-Cambriano",
    period: "Ediacarano",
    required: ["Simetria Bilateral", "Locomoção Primitiva", "Escavador", "Construtor de Nicho"],
    habitat: { fertile: 64, hostile: 0, founderFertile: true, naturalBarriers: [0, 0], pattern: "aquatic" },
    events: {
      abundance: 3,
      fertilized: 3,
      "abundant-rains": 2,
      sea: 1,
      earthquake: 1,
      volcano: 1,
    },
  },
  {
    id: "cambrian",
    group: "Paleozoico",
    period: "Cambriano",
    required: [
      "Locomoção Articulada",
      "Percepção Espacial",
      "Carapaça",
      "Camuflagem",
      "Veneno",
    ],
    habitat: { fertile: 64, hostile: 0, founderFertile: true, naturalBarriers: [0, 0], pattern: "aquatic" },
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
    habitat: { fertile: 64, hostile: 0, founderFertile: true, naturalBarriers: [0, 0], pattern: "aquatic" },
    events: { ice: 4, grb: 3, sea: 3, blockade: 1, earthquake: 1 },
  },
  {
    id: "silurian",
    group: "Paleozoico",
    period: "Siluriano",
    required: ["Locomoção Terrestre", "Coletor"],
    habitat: { fertile: 28, hostile: 7, standard: true, naturalBarriers: [1, 3], pattern: "coast" },
    events: {
      "alluvial-river": 3,
      "abundant-rains": 3,
      sea: 2,
      fertilized: 1,
      volcano: 1,
    },
  },
  {
    id: "devonian",
    group: "Paleozoico",
    period: "Devoniano",
    required: ["Locomoção Avançada", "Onívoro"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 3], pattern: "corridors" },
    events: {
      "alluvial-river": 3,
      abundance: 2,
      drought: 2,
      desert: 1,
      sea: 1,
      warming: 1,
    },
  },
  {
    id: "carboniferous",
    group: "Paleozoico",
    period: "Carbonífero",
    required: ["Ovíparos Amniotas", "Ooteca", "Voo"],
    habitat: { fertile: 18, hostile: 5, standard: true, naturalBarriers: [3, 6], pattern: "forest" },
    events: {
      "abundant-rains": 4,
      abundance: 3,
      fertilized: 2,
      sea: 1,
      ice: 2,
    },
  },
  {
    id: "permian",
    group: "Paleozoico",
    period: "Permiano",
    required: ["Incubação"],
    habitat: { fertile: 10, hostile: 12, standard: true, naturalBarriers: [3, 5], pattern: "arid" },
    events: { volcano: 5, warming: 2, drought: 4, desert: 4, blockade: 2, earthquake: 1 },
  },
  {
    id: "triassic",
    group: "Mesozoico",
    period: "Triássico",
    required: ["Vivíparo", "Notívago"],
    habitat: { fertile: 12, hostile: 5, standard: true, naturalBarriers: [1, 2], pattern: "open" },
    events: { drought: 3, desert: 3, volcano: 2, warming: 2, eutrophication: 1, insularization: 1, sea: 1 },
  },
  {
    id: "jurassic",
    group: "Mesozoico",
    period: "Jurássico",
    required: ["Visão Noturna"],
    habitat: { fertile: 18, hostile: 5, standard: true, naturalBarriers: [3, 5], pattern: "dense" },
    events: {
      sea: 3,
      eutrophication: 1,
      insularization: 2,
      "abundant-rains": 2,
      "alluvial-river": 2,
      earthquake: 1,
      warming: 1,
      volcano: 1,
    },
  },
  {
    id: "cretaceous",
    group: "Mesozoico",
    period: "Cretáceo",
    required: ["Eusocialidade", "Ovífagia"],
    habitat: { fertile: 18, hostile: 6, standard: true, naturalBarriers: [2, 4], pattern: "clusters" },
    events: { sea: 3, abundance: 2, eutrophication: 1, insularization: 1, meteor: 3, volcano: 1, warming: 2 },
  },
  {
    id: "paleogene",
    group: "Cenozoico",
    period: "Paleógeno",
    required: [],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [3, 5], pattern: "mosaic" },
    events: {
      earthquake: 2,
      "alluvial-river": 2,
      "abundant-rains": 2,
      eutrophication: 1,
      insularization: 1,
      abundance: 1,
      warming: 2,
    },
  },
  {
    id: "neogene",
    group: "Cenozoico",
    period: "Neógeno",
    required: ["Chifre", "Polegar Opositor"],
    habitat: { fertile: 12, hostile: 8, standard: true, naturalBarriers: [4, 6], pattern: "fragmented" },
    events: { drought: 3, desert: 3, earthquake: 2, ice: 1, warming: 2, "alluvial-river": 1 },
  },
  {
    id: "quaternary",
    group: "Cenozoico",
    period: "Quaternário",
    required: ["Neocórtex Desenvolvido", "Antropização"],
    habitat: { fertile: 14, hostile: 7, standard: true, naturalBarriers: [2, 4], pattern: "balanced" },
    events: { ice: 5, warming: 4, drought: 3, desert: 3, earthquake: 2, meteor: 1 },
  },
].map((stage, index) => ({ ...stage, index }));

const byId = new Map(GEOLOGICAL_STAGES.map((stage) => [stage.id, stage]));

export const TRAIT_STAGE = {
  "Respiração anaeróbia": "hadean",
  "Reparo Celular": "archean",
  "Respiração aeróbia": "proterozoic",
  Fotossíntese: "archean",
  Embriófitas: "ordovician",
  Traqueófitas: "silurian",
  Espinhos: "devonian",
  Madeira: "devonian",
  Gimnospermas: "carboniferous",
  Trepadeira: "carboniferous",
  Extremófitas: "permian",
  Angiospermas: "cretaceous",
  Haustório: "cretaceous",
  "Perfume Floral": "cretaceous",
  "Carnivoria Botânica": "paleogene",
  Dormência: "archean",
  Multicelularismo: "proterozoic",
  "Simetria Bilateral": "ediacaran",
  "Reprodução Sexuada": "proterozoic",
  "Precocidade Sexual": "ediacaran",
  Regeneração: "proterozoic",
  Resistência: "proterozoic",
  Predação: "archean",
  Carnívoro: "proterozoic",
  Herbívoro: "ordovician",
  Canibalismo: "cambrian",
  Parasitismo: "cambrian",
  "Vetor Patógeno": "cretaceous",
  "Locomoção Primitiva": "ediacaran",
  Vertebrado: "cambrian",
  "Artrópode": "cambrian",
  "Locomoção Articulada": "cambrian",
  "Locomoção Terrestre": "silurian",
  "Percepção Espacial": "cambrian",
  Escavador: "ediacaran",
  "Construtor de Nicho": "ediacaran",
  Necrófago: "ediacaran",
  Coprofagia: "cretaceous",
  Carapaça: "cambrian",
  Camuflagem: "cambrian",
  Veneno: "cambrian",
  Coletor: "silurian",
  "Locomoção Avançada": "devonian",
  Escalador: "devonian",
  Onívoro: "devonian",
  "Respiração Cutânea": "devonian",
  "Visão Binocular": "devonian",
  Voo: "carboniferous",
  Velocidade: "carboniferous",
  Ovíparo: "ordovician",
  "Ovíparos Amniotas": "carboniferous",
  Ooteca: "carboniferous",
  "Incubação": "permian",
  Ovovivíparo: "permian",
  "Pele grossa": "permian",
  Garras: "permian",
  Lactação: "triassic",
  Vivíparo: "triassic",
  "Sacos Aéreos": "triassic",
  Mixotrofia: "triassic",
  "Ovulação Induzida": "paleogene",
  Mimetismo: "permian",
  Notívago: "triassic",
  Sociabilidade: "jurassic",
  "Visão Noturna": "jurassic",
  Eusocialidade: "cretaceous",
  Ovífagia: "cretaceous",
  "Polegar Opositor": "neogene",
  Chifre: "neogene",
  "Antropização": "quaternary",
  "Plantas Domesticadas": "quaternary",
  "Animais Domésticos": "quaternary",
  "Neocórtex Desenvolvido": "quaternary",
  "Transferência Horizontal": "archean",
  Brotamento: "proterozoic",
  Fragmentação: "ediacaran",
  Colônia: "ediacaran",
  "Séssil": "ediacaran",
  "Acasalamento Preferencial": "cambrian",
  "Onívoro Oportunista": "carboniferous",
  Metamorfose: "carboniferous",
  "Cuidado Parental": "permian",
  Promiscuidade: "jurassic",
  Pedogênese: "cretaceous",
  Marsupial: "cretaceous",
  "Acasalamento Múltiplo": "cretaceous",
  Monogamia: "paleogene",
};

export const ENERGY_BRANCH_TRAITS = new Set(["Fotossíntese", "Predação"]);

export const ACTIVE_TRAIT_FAMILIES = [
  {
    id: "respiration",
    traits: ["Respiração anaeróbia", "Respiração aeróbia"],
  },
  {
    id: "energy",
    traits: ["Fotossíntese", "Predação"],
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
      "Locomoção Avançada",
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
    id: "social-organization",
    traits: ["Sociabilidade", "Eusocialidade"],
  },
  {
    id: "body-size",
    traits: ["Nanismo", "Gigantismo"],
  },
  {
    id: "mating-system",
    traits: ["Promiscuidade", "Monogamia", "Acasalamento Múltiplo"],
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
  Multicelularismo: { lineage: ["Reparo Celular"] },
  "Simetria Bilateral": { lineage: ["Multicelularismo"] },
  "Reprodução Sexuada": {
    lineage: ["Respiração anaeróbia", "Multicelularismo"],
  },
  "Respiração aeróbia": {
    lineage: ["Respiração anaeróbia"],
    historical: ["Fotossíntese"],
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
  "Carnivoria Botânica": { lineage: ["Angiospermas"] },
  Carnívoro: { lineage: ["Predação", "Multicelularismo"] },
  Herbívoro: { lineage: ["Predação", "Multicelularismo"] },
  Necrófago: { lineage: ["Predação", "Multicelularismo"] },
  Coprofagia: {
    lineage: ["Predação", "Multicelularismo", "Locomoção Terrestre"],
  },
  "Pele grossa": { lineage: ["Herbívoro"] },
  Garras: { lineage: ["Carnívoro"] },
  Canibalismo: { lineage: ["Carnívoro"] },
  "Vetor Patógeno": { lineage: ["Parasitismo"] },
  "Precocidade Sexual": { lineage: ["Reprodução Sexuada"] },
  "Locomoção Primitiva": { lineage: ["Predação"] },
  Vertebrado: { lineage: ["Locomoção Primitiva", "Simetria Bilateral"] },
  "Artrópode": { lineage: ["Locomoção Primitiva", "Simetria Bilateral"] },
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
  "Locomoção Avançada": { lineage: ["Locomoção Terrestre"] },
  Escalador: { lineage: ["Locomoção Terrestre"] },
  "Respiração Cutânea": { lineage: ["Locomoção Articulada"] },
  "Visão Binocular": { lineage: ["Predação"] },
  Velocidade: { lineage: ["Locomoção Avançada"] },
  Notívago: { lineage: ["Locomoção Articulada"] },
  "Sacos Aéreos": { lineage: ["Locomoção Avançada"] },
  Voo: { lineage: ["Locomoção Terrestre"] },
  "Ovíparos Amniotas": { lineage: ["Ovíparo"] },
  Ovovivíparo: { lineage: ["Ovíparos Amniotas"] },
  "Incubação": { lineage: ["Ovíparo"] },
  Lactação: { lineage: ["Incubação"] },
  Vivíparo: { lineage: ["Ovíparos Amniotas"] },
  "Ovulação Induzida": {
    lineage: ["Vivíparo", "Reprodução Sexuada"],
  },
  "Visão Noturna": { lineage: ["Notívago"] },
  Ovífagia: { lineage: ["Ovíparo"] },
  Onívoro: { lineageAny: ["Carnívoro", "Herbívoro"] },
  "Construtor de Nicho": { lineage: ["Escavador"] },
  "Polegar Opositor": { lineage: ["Construtor de Nicho"] },
  Chifre: { lineage: ["Predação"] },
  "Antropização": { lineage: ["Neocórtex Desenvolvido"] },
  "Neocórtex Desenvolvido": { lineage: ["Polegar Opositor"] },
  Sociabilidade: { lineage: ["Incubação"] },
  "Plantas Domesticadas": { historical: ["Neocórtex Desenvolvido"] },
  "Animais Domésticos": { historical: ["Neocórtex Desenvolvido"] },
  "Insuficiência Respiratória": { lineage: ["Multicelularismo"] },
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
  "Transferência Horizontal": { lineage: ["Predação"] },
  Brotamento: { lineage: ["Multicelularismo"] },
  Fragmentação: { lineage: ["Multicelularismo", "Regeneração"] },
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
};

export const BODY_PLAN_TRAITS = new Set(["Vertebrado", "Artrópode"]);

export const MULTICELLULAR_DEPENDENT_TRAITS = new Set([
  "Simetria Bilateral",
  "Regeneração",
  "Reprodução Sexuada",
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
  "Locomoção Primitiva",
  "Vertebrado",
  "Artrópode",
  "Locomoção Articulada",
  "Locomoção Terrestre",
  "Percepção Espacial",
  "Mixotrofia",
  "Escavador",
  "Construtor de Nicho",
  "Necrófago",
  "Coprofagia",
  "Carapaça",
  "Camuflagem",
  "Veneno",
  "Coletor",
  "Locomoção Avançada",
  "Escalador",
  "Visão Binocular",
  "Velocidade",
  "Carnívoro",
  "Herbívoro",
  "Pele grossa",
  "Garras",
  "Onívoro",
  "Respiração Cutânea",
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
  "Parasitismo",
  "Vetor Patógeno",
  "Embriófitas",
  "Traqueófitas",
  "Espinhos",
  "Madeira",
  "Gimnospermas",
  "Trepadeira",
  "Extremófitas",
  "Angiospermas",
  "Haustório",
  "Perfume Floral",
  "Carnivoria Botânica",
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
]);

export function normalizeMulticellularTraits(traits) {
  const set = new Set(traits ?? []);
  if (!set.has("Multicelularismo"))
    for (const trait of MULTICELLULAR_DEPENDENT_TRAITS) set.delete(trait);
  return [...set];
}

export const PLANT_DERIVED_TRAITS = new Set([
  "Embriófitas",
  "Traqueófitas",
  "Espinhos",
  "Madeira",
  "Gimnospermas",
  "Trepadeira",
  "Extremófitas",
  "Angiospermas",
  "Haustório",
  "Perfume Floral",
  "Carnivoria Botânica",
  "Plantas Domesticadas",
]);

export const PLANT_INCOMPATIBLE_TRAITS = new Set([
  "Predação",
  "Simetria Bilateral",
  "Locomoção Primitiva",
  "Vertebrado",
  "Artrópode",
  "Locomoção Articulada",
  "Locomoção Terrestre",
  "Percepção Espacial",
  "Locomoção Avançada",
  "Escavador",
  "Escalador",
  "Respiração Cutânea",
  "Visão Binocular",
  "Velocidade",
  "Notívago",
  "Sacos Aéreos",
  "Carnívoro",
  "Herbívoro",
  "Pele grossa",
  "Garras",
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
  "Polegar Opositor",
  "Neocórtex Desenvolvido",
  "Antropização",
  "Animais Domésticos",
  "Sociabilidade",
  "Mimetismo",
  "Onívoro Oportunista",
  "Acasalamento Preferencial",
  "Promiscuidade",
  "Pedogênese",
  "Cuidado Parental",
  "Marsupial",
  "Monogamia",
  "Acasalamento Múltiplo",
  "Metamorfose",
  "Transferência Horizontal",
  "Insuficiência Respiratória",
  "Deficiência Motora",
  "Deficiência Sensorial",
  "Filho único",
  "Má absorção Alimentar",
  "Nanismo",
  "Gigantismo",
]);

export const TRAIT_BRANCH_SCOPE = Object.freeze({
  "Transferência Horizontal": "predation",
  Brotamento: "shared",
  Fragmentação: "shared",
  Colônia: "shared",
  "Séssil": "shared",
  Necrófago: "predation",
  Coprofagia: "predation",
  "Onívoro Oportunista": "predation",
  "Acasalamento Preferencial": "predation",
  Promiscuidade: "predation",
  Pedogênese: "predation",
  "Cuidado Parental": "predation",
  Marsupial: "predation",
  Monogamia: "predation",
  "Acasalamento Múltiplo": "predation",
  Metamorfose: "predation",
});

export const TRAIT_INCOMPATIBILITIES = Object.freeze({
  Fragmentação: ["Vertebrado", "Artrópode", "Ooteca"],
  Coprofagia: ["Mixotrofia"],
  Mixotrofia: ["Coprofagia"],
  Vertebrado: ["Fragmentação"],
  "Artrópode": ["Fragmentação"],
  Ooteca: ["Fragmentação"],
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

export function traitLossAllowed(piece, trait) {
  if (
    trait === "Respiração anaeróbia" ||
    BODY_PLAN_TRAITS.has(trait) ||
    ENERGY_BRANCH_TRAITS.has(trait)
  )
    return false;
  if (
    trait === "Simetria Bilateral" &&
    (piece?.traits ?? []).some((candidate) =>
      BODY_PLAN_TRAITS.has(candidate),
    )
  )
    return false;
  if (trait !== "Multicelularismo") return true;
  return !(piece?.traits ?? []).some(
    (candidate) =>
      candidate !== trait && MULTICELLULAR_DEPENDENT_TRAITS.has(candidate),
  );
}

export function geologicalStage(id) {
  return byId.get(id) ?? byId.get("archean");
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
  if (currentGeologicalStage(state).id === "hadean") {
    const tutorial = state.hadeanTutorial ?? {},
      steps = [
        ["Deslocar", !!tutorial.moved],
        ["Dividir", !!tutorial.divided],
        ["Capturar", !!tutorial.captured],
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
          current.id === "archean" &&
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
  return state.scenario === "arena" || (state.totalCycles ?? 1) >= 2;
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
  if (
    profile?.traits?.includes("Fotossíntese") &&
    ![0, 4].includes(profile.rank)
  )
    profile.rank = 0;
  return profile;
}

export function captureUnlocked(state, piece = null) {
  if (!piece) return false;
  if (currentGeologicalStage(state).id === "hadean")
    return (
      state.hadeanCaptureUnlocked === true ||
      state.hadeanTutorial?.captured === true ||
      ["blue", "amber"].every(
        (owner) => (state.reproductions?.[owner] ?? 0) >= 1,
      )
    );
  return (
    piece.traits?.includes("Predação") ||
    piece.traits?.includes("Mixotrofia") ||
    false
  );
}

export function pathogenUnlocked(state) {
  return currentGeologicalStage(state).index >= geologicalStage("proterozoic").index;
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
      deps.lineage.every((dependency) => lineage.has(dependency));
  return scenarioInnovationWeight(state, trait, piece, {
    required: current.required.includes(trait),
    dependencyMatched,
  });
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
