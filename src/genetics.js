import { TRAITS } from "./constants.js";
import {
  MULTICELLULAR_DEPENDENT_TRAITS,
  PLANT_DERIVED_TRAITS,
  TRAIT_DEPENDENCIES,
  activeTraitFamily,
  normalizeActiveTraits,
  traitCombinationValid,
} from "./geology.js";

export const GENETIC_TRAITS = Object.freeze(Object.keys(TRAITS));
export const BASAL_GENETIC_TRAIT = "Respiração anaeróbia";
export const NEGATIVE_GENETIC_TRAITS = new Set([
  "Esterilidade",
  "Mutação Deletéria",
  "Mutação Disfuncional",
]);

const LEGACY_REPRO_MAP = {
  development: {
    oviparous: "Ovíparo",
    amniotic: "Ovíparos Amniotas",
    ovoviviparous: "Ovovivíparo",
    viviparous: "Vivíparo",
  },
  dispersal: {
    spores: "Esporos",
  },
};
const LEGACY_NORMAL = { development: "immediate", dispersal: "local" };
const LEGACY_PRIORITY = {
  development: ["Vivíparo", "Ovovivíparo", "Ovíparos Amniotas", "Ovíparo"],
  dispersal: ["Esporos"],
};
const LEGACY_TRAITS = new Set(
  Object.values(LEGACY_REPRO_MAP).flatMap((mapping) => Object.values(mapping)),
);

const ancestralAllele = () => ({ value: "ancestral", dominance: "neutral" });
const derivedAllele = (dominance = "dominant") => ({
  value: "derived",
  dominance: dominance === "recessive" ? "recessive" : "dominant",
});
const cloneAllele = (allele) => ({
  value: allele.value,
  dominance: allele.dominance,
});
const ancestralPair = () => [ancestralAllele(), ancestralAllele()];

function validAllele(allele) {
  return (
    !!allele &&
    ((allele.value === "ancestral" && allele.dominance === "neutral") ||
      (allele.value === "derived" &&
        ["dominant", "recessive"].includes(allele.dominance)))
  );
}

export function ancestralGenome() {
  return Object.fromEntries(
    GENETIC_TRAITS.map((trait) => [trait, ancestralPair()]),
  );
}

function setActivePair(genome, trait) {
  if (!TRAITS[trait]) return;
  genome[trait] = [derivedAllele("dominant"), derivedAllele("dominant")];
}

function setHiddenPair(genome, trait) {
  if (!TRAITS[trait]) return;
  genome[trait] = [derivedAllele("recessive"), ancestralAllele()];
}

function importLegacyReproGenes(genome, reproGenes, activeTraits) {
  if (!reproGenes || typeof reproGenes !== "object") return;
  for (const mapping of Object.values(LEGACY_REPRO_MAP))
    for (const trait of Object.values(mapping)) genome[trait] = ancestralPair();

  for (const [locus, mapping] of Object.entries(LEGACY_REPRO_MAP)) {
    const pair = Array.isArray(reproGenes?.[locus]) ? reproGenes[locus] : [];
    for (let chromosome = 0; chromosome < Math.min(2, pair.length); chromosome++) {
      const allele = pair[chromosome],
        trait = mapping[allele?.value];
      if (!trait) continue;
      genome[trait][chromosome] = derivedAllele(
        allele?.dominance === "recessive" ? "recessive" : "dominant",
      );
    }
  }

  for (const trait of activeTraits)
    if (
      LEGACY_TRAITS.has(trait) &&
      !genome[trait].some((allele) => allele.value === "derived")
    )
      setActivePair(genome, trait);
}

export function genomeFromTraits(
  activeTraits = [],
  hiddenRecessives = [],
  legacyReproGenes = null,
) {
  const genome = ancestralGenome(),
    active = [...new Set(activeTraits)].filter((trait) => TRAITS[trait]),
    hidden = new Set(
      (hiddenRecessives ?? []).filter((trait) => TRAITS[trait]),
    );

  for (const trait of active)
    if (!hidden.has(trait)) setActivePair(genome, trait);
  importLegacyReproGenes(genome, legacyReproGenes, active);
  for (const trait of hidden) {
    const pair = genome[trait];
    if (!pair.some((allele) => allele.value === "derived"))
      setHiddenPair(genome, trait);
    else if (!active.includes(trait)) {
      const firstDerived = pair.findIndex((allele) => allele.value === "derived");
      if (firstDerived >= 0) pair[firstDerived].dominance = "recessive";
      const other = firstDerived === 0 ? 1 : 0;
      if (pair[other].value === "derived") pair[other] = ancestralAllele();
    }
  }
  return genome;
}

export function genomeFromLegacyProfile(profile = {}) {
  return genomeFromTraits(
    profile.traits ?? [],
    profile.recessiveTraits ?? [],
    profile.reproGenes ?? null,
  );
}

export function normalizeGenome(source, legacyProfile = null) {
  if (!source || typeof source !== "object")
    return legacyProfile ? genomeFromLegacyProfile(legacyProfile) : ancestralGenome();
  const result = ancestralGenome();
  for (const trait of GENETIC_TRAITS) {
    const pair = source[trait];
    if (
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every(validAllele)
    )
      result[trait] = pair.map(cloneAllele);
  }
  return result;
}

export function cloneGenome(source) {
  return normalizeGenome(source);
}

export function validGenome(source) {
  if (!source || typeof source !== "object") return false;
  return GENETIC_TRAITS.every((trait) => {
    const pair = source[trait];
    return (
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every(validAllele)
    );
  });
}

export function locusExpressed(pair) {
  if (!Array.isArray(pair) || pair.length !== 2) return false;
  const derived = pair.filter((allele) => allele.value === "derived");
  return (
    derived.some((allele) => allele.dominance === "dominant") ||
    derived.length === 2
  );
}

function locusStrength(pair) {
  const derived = pair.filter((allele) => allele.value === "derived");
  if (derived.length === 2) return 3;
  if (derived.some((allele) => allele.dominance === "dominant")) return 2;
  if (derived.length) return 1;
  return 0;
}

export function genomeCarriedTraits(source) {
  const genome = normalizeGenome(source);
  return GENETIC_TRAITS.filter((trait) =>
    genome[trait].some((allele) => allele.value === "derived"),
  );
}

function sameActiveFamily(a, b) {
  const fa = activeTraitFamily(a),
    fb = activeTraitFamily(b);
  return !!fa && !!fb && fa.id === fb.id;
}

function dependencySatisfied(trait, dependency, active, carried) {
  if (dependency === BASAL_GENETIC_TRAIT)
    return active.has(BASAL_GENETIC_TRAIT) || carried.has(BASAL_GENETIC_TRAIT);
  if (sameActiveFamily(trait, dependency)) return carried.has(dependency);
  return active.has(dependency);
}

export function expressGenome(
  source,
  previousTraits = [],
  preferredEnergy = null,
) {
  const genome = normalizeGenome(source),
    carried = new Set(genomeCarriedTraits(genome)),
    raw = GENETIC_TRAITS.filter((trait) => locusExpressed(genome[trait]));

  let energyPreference = preferredEnergy;
  if (!energyPreference) {
    const previous = new Set(previousTraits ?? []);
    if (previous.has("Fotossíntese") !== previous.has("Predação"))
      energyPreference = previous.has("Predação") ? "Predação" : "Fotossíntese";
    else if (raw.includes("Fotossíntese") && raw.includes("Predação")) {
      const predation = locusStrength(genome.Predação),
        photosynthesis = locusStrength(genome.Fotossíntese);
      if (predation !== photosynthesis)
        energyPreference =
          predation > photosynthesis ? "Predação" : "Fotossíntese";
    }
  }

  let traits = normalizeActiveTraits(raw, energyPreference),
    changed = true;
  while (changed) {
    changed = false;
    const active = new Set(traits),
      next = [];
    for (const trait of traits) {
      if (
        MULTICELLULAR_DEPENDENT_TRAITS.has(trait) &&
        trait !== "Multicelularismo" &&
        !active.has("Multicelularismo")
      ) {
        changed = true;
        continue;
      }
      if (
        PLANT_DERIVED_TRAITS.has(trait) &&
        !active.has("Fotossíntese")
      ) {
        changed = true;
        continue;
      }
      const deps = TRAIT_DEPENDENCIES[trait],
        lineageOk = (deps?.lineage ?? []).every((dependency) =>
          dependencySatisfied(trait, dependency, active, carried),
        ),
        lineageAnyOk =
          !deps?.lineageAny?.length ||
          deps.lineageAny.some((dependency) =>
            dependencySatisfied(trait, dependency, active, carried),
          );
      if (!lineageOk || !lineageAnyOk) {
        changed = true;
        continue;
      }
      next.push(trait);
    }
    traits = normalizeActiveTraits(next, energyPreference);
  }
  return traitCombinationValid(traits)
    ? traits
    : normalizeActiveTraits(traits, energyPreference);
}

export function hiddenRecessiveTraits(source) {
  const profile = source?.genome ? source : null,
    genome = normalizeGenome(profile?.genome ?? source),
    expressed = new Set(
      profile?.traits ?? expressGenome(genome),
    );
  return GENETIC_TRAITS.filter((trait) => {
    if (expressed.has(trait)) return false;
    const pair = genome[trait];
    return (
      pair.some(
        (allele) =>
          allele.value === "derived" && allele.dominance === "recessive",
      ) &&
      !locusExpressed(pair)
    );
  });
}

export function genomeSignature(source) {
  const genome = normalizeGenome(source?.genome ?? source);
  return GENETIC_TRAITS.map(
    (trait) =>
      `${trait}:${genome[trait]
        .map((allele) => `${allele.value[0]}:${allele.dominance[0]}`)
        .join("/")}`,
  ).join(";");
}

export function inheritSexualGenome(a, b, random) {
  const ga = normalizeGenome(a?.genome ?? a),
    gb = normalizeGenome(b?.genome ?? b);
  return Object.fromEntries(
    GENETIC_TRAITS.map((trait) => [
      trait,
      [
        cloneAllele(ga[trait][Math.floor(random() * 2)]),
        cloneAllele(gb[trait][Math.floor(random() * 2)]),
      ],
    ]),
  );
}

export function genomeGainOptions(source, expressedTraits = null) {
  const genome = normalizeGenome(source?.genome ?? source),
    expressed = new Set(
      expressedTraits ?? source?.traits ?? expressGenome(genome),
    ),
    options = [];
  for (const trait of GENETIC_TRAITS) {
    if (trait === BASAL_GENETIC_TRAIT) continue;
    const pair = genome[trait],
      derived = pair.filter((allele) => allele.value === "derived").length;
    if (derived === 0 || (!expressed.has(trait) && derived < 2))
      options.push(trait);
  }
  return options;
}

export function genomeLossOptions(source) {
  const genome = normalizeGenome(source?.genome ?? source);
  return GENETIC_TRAITS.filter(
    (trait) =>
      trait !== BASAL_GENETIC_TRAIT &&
      genome[trait].some((allele) => allele.value === "derived"),
  );
}

export function gainGenomeAllele(source, trait, random) {
  const genome = cloneGenome(source?.genome ?? source);
  if (!TRAITS[trait] || trait === BASAL_GENETIC_TRAIT) return genome;
  const pair = genome[trait],
    derived = pair
      .map((allele, index) => ({ allele, index }))
      .filter(({ allele }) => allele.value === "derived"),
    ancestral = pair
      .map((allele, index) => ({ allele, index }))
      .filter(({ allele }) => allele.value === "ancestral");
  if (!ancestral.length) return genome;
  const index = ancestral[Math.floor(random() * ancestral.length)].index,
    hiddenCarrier =
      derived.length === 1 && derived[0].allele.dominance === "recessive";
  pair[index] = derivedAllele(
    hiddenCarrier ? "recessive" : random() < 0.5 ? "dominant" : "recessive",
  );
  return genome;
}

export function loseGenomeAllele(source, trait, random) {
  const genome = cloneGenome(source?.genome ?? source);
  if (!TRAITS[trait] || trait === BASAL_GENETIC_TRAIT) return genome;
  const pair = genome[trait],
    derived = pair
      .map((allele, index) => ({ allele, index }))
      .filter(({ allele }) => allele.value === "derived");
  if (!derived.length) return genome;
  const index = derived[Math.floor(random() * derived.length)].index;
  pair[index] = ancestralAllele();
  return genome;
}

export function legacyReproGenesFromGenome(source) {
  const genome = normalizeGenome(source?.genome ?? source),
    result = {
      development: [
        { value: "immediate", dominance: "neutral" },
        { value: "immediate", dominance: "neutral" },
      ],
      dispersal: [
        { value: "local", dominance: "neutral" },
        { value: "local", dominance: "neutral" },
      ],
    };
  for (const [locus, priority] of Object.entries(LEGACY_PRIORITY)) {
    const mapping = LEGACY_REPRO_MAP[locus],
      reverse = Object.fromEntries(
        Object.entries(mapping).map(([value, trait]) => [trait, value]),
      ),
      candidates = [];
    for (const trait of priority)
      for (const allele of genome[trait])
        if (allele.value === "derived")
          candidates.push({
            value: reverse[trait],
            dominance: allele.dominance,
            priority: priority.indexOf(trait),
          });
    candidates.sort(
      (a, b) =>
        (a.dominance === "dominant" ? 0 : 1) -
          (b.dominance === "dominant" ? 0 : 1) ||
        a.priority - b.priority,
    );
    for (let i = 0; i < Math.min(2, candidates.length); i++)
      result[locus][i] = {
        value: candidates[i].value,
        dominance: candidates[i].dominance,
      };
  }
  return result;
}

export function syncGenomePhenotype(profile, preferredEnergy = null) {
  const previous = [...(profile.traits ?? [])];
  profile.genome = normalizeGenome(
    profile.genome,
    profile.genome ? null : profile,
  );
  profile.traits = expressGenome(
    profile.genome,
    previous,
    preferredEnergy,
  );
  profile.reproGenes = legacyReproGenesFromGenome(profile.genome);
  profile.recessiveTraits = hiddenRecessiveTraits(profile).filter(
    (trait) => !LEGACY_TRAITS.has(trait),
  );
  return profile;
}

export function phenotypeMatchesGenome(profile) {
  if (!validGenome(profile?.genome)) return false;
  const expressed = expressGenome(profile.genome, profile.traits),
    current = [...new Set(profile.traits ?? [])];
  return (
    current.length === expressed.length &&
    current.every((trait) => expressed.includes(trait))
  );
}

export function developmentMode(profile) {
  for (const [trait, mode] of [
    ["Vivíparo", "viviparous"],
    ["Ovovivíparo", "ovoviviparous"],
    ["Ovíparos Amniotas", "amniotic"],
    ["Ovíparo", "oviparous"],
  ])
    if ((profile?.traits ?? []).includes(trait)) return mode;
  return "immediate";
}

export function dispersalMode(profile) {
  return (profile?.traits ?? []).includes("Esporos") ? "spores" : "local";
}
