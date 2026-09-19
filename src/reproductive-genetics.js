export const REPRO_LOCI = {
  development: {
    normal: "immediate",
    mutants: ["oviparous", "amniotic", "ovoviviparous", "viviparous"],
    traits: {
      oviparous: "Ovíparo",
      amniotic: "Ovíparos Amniotas",
      ovoviviparous: "Ovovivíparo",
      viviparous: "Vivíparo",
    },
    priority: ["viviparous", "ovoviviparous", "amniotic", "oviparous"],
  },
  dispersal: {
    normal: "local",
    mutants: ["spores"],
    traits: { spores: "Esporos" },
    priority: ["spores"],
  },
};

export const GENETIC_TRAITS = [
  "Ovíparo",
  "Ovíparos Amniotas",
  "Ovovivíparo",
  "Vivíparo",
  "Esporos",
];

const locusNames = Object.keys(REPRO_LOCI);
const cloneAllele = (a) => ({ value: a.value, dominance: a.dominance });
const neutralAllele = (value) => ({ value, dominance: "neutral" });

function traitEntry(trait) {
  for (const [locus, def] of Object.entries(REPRO_LOCI))
    for (const [value, name] of Object.entries(def.traits))
      if (name === trait) return { locus, value };
  return null;
}

export function ancestralReproGenes() {
  return Object.fromEntries(
    locusNames.map((name) => {
      const value = REPRO_LOCI[name].normal;
      return [name, [neutralAllele(value), neutralAllele(value)]];
    }),
  );
}

export function normalizeReproGenes(source, legacyTraits = []) {
  const fallback = ancestralReproGenes(),
    result = {};
  for (const name of locusNames) {
    const def = REPRO_LOCI[name],
      allowed = new Set([def.normal, ...def.mutants]),
      pair = Array.isArray(source?.[name]) ? source[name] : null,
      migratedPair = pair?.map((allele) => {
        if (name === "dispersal" && allele?.value === "eggs")
          return neutralAllele(def.normal);
        if (
          name === "development" &&
          legacyTraits.includes("Ovíparos Amniotas") &&
          allele?.value === "oviparous"
        )
          return { ...allele, value: "amniotic" };
        return allele;
      });
    result[name] =
      migratedPair &&
      migratedPair.length === 2 &&
      migratedPair.every((a) => a && allowed.has(a.value))
        ? migratedPair.map((a) =>
            a.value === def.normal
              ? neutralAllele(def.normal)
              : {
                  value: a.value,
                  dominance:
                    a.dominance === "dominant" || a.dominance === "recessive"
                      ? a.dominance
                      : "recessive",
                },
          )
        : fallback[name].map(cloneAllele);
  }
  if (!source)
    for (const trait of legacyTraits) {
      const entry = traitEntry(trait);
      if (!entry) continue;
      const def = REPRO_LOCI[entry.locus];
      result[entry.locus] = [
        { value: entry.value, dominance: "dominant" },
        neutralAllele(def.normal),
      ];
    }
  return result;
}

export function cloneReproGenes(source) {
  const genes = normalizeReproGenes(source);
  return Object.fromEntries(
    locusNames.map((name) => [name, genes[name].map(cloneAllele)]),
  );
}

export function validReproGenes(source) {
  if (!source || typeof source !== "object") return false;
  for (const name of locusNames) {
    const def = REPRO_LOCI[name],
      allowed = new Set([def.normal, ...def.mutants]),
      pair = source[name];
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    for (const allele of pair) {
      if (!allele || !allowed.has(allele.value)) return false;
      if (
        allele.value === def.normal
          ? allele.dominance !== "neutral"
          : !["dominant", "recessive"].includes(allele.dominance)
      )
        return false;
    }
  }
  return true;
}

function resolveLocus(name, pair) {
  const def = REPRO_LOCI[name],
    normalized = normalizeReproGenes({ [name]: pair })[name],
    dominant = [
      ...new Set(
        normalized
          .filter(
            (a) => a.value !== def.normal && a.dominance === "dominant",
          )
          .map((a) => a.value),
      ),
    ];
  if (dominant.length === 1) return dominant[0];
  if (dominant.length > 1)
    return def.priority.find((value) => dominant.includes(value)) ?? dominant[0];
  if (
    normalized[0].value !== def.normal &&
    normalized[0].value === normalized[1].value &&
    normalized[0].dominance === "recessive" &&
    normalized[1].dominance === "recessive"
  )
    return normalized[0].value;
  return def.normal;
}

export function reproPhenotype(source) {
  const genes = normalizeReproGenes(source),
    development = resolveLocus("development", genes.development),
    dispersal = resolveLocus("dispersal", genes.dispersal),
    traits = [];
  const developmentTrait = REPRO_LOCI.development.traits[development],
    dispersalTrait = REPRO_LOCI.dispersal.traits[dispersal];
  if (developmentTrait) traits.push(developmentTrait);
  if (dispersalTrait) traits.push(dispersalTrait);
  return { development, dispersal, traits };
}

export function syncReproTraits(piece) {
  piece.reproGenes = normalizeReproGenes(piece.reproGenes, piece.traits);
  let regular = piece.traits.filter(
    (t) => !GENETIC_TRAITS.includes(t) && t !== "Ovos",
  );
  const plant = regular.includes("Fotossíntese"),
    gymnosperm = regular.includes("Gimnospermas"),
    expressed = reproPhenotype(piece.reproGenes).traits.filter(
      (trait) =>
        (!plant ||
          ![
            "Ovíparo",
            "Ovíparos Amniotas",
            "Ovovivíparo",
            "Vivíparo",
          ].includes(trait)) &&
        (!gymnosperm || trait !== "Esporos"),
    );
  if (!expressed.includes("Vivíparo"))
    regular = regular.filter((trait) => trait !== "Ovulação Induzida");
  piece.traits = [...regular, ...expressed];
  return piece;
}

export function inheritSexualReproGenes(a, b, random) {
  const ga = normalizeReproGenes(a),
    gb = normalizeReproGenes(b);
  return Object.fromEntries(
    locusNames.map((name) => [
      name,
      [
        cloneAllele(ga[name][Math.floor(random() * 2)]),
        cloneAllele(gb[name][Math.floor(random() * 2)]),
      ],
    ]),
  );
}

export function reproGeneSignature(source) {
  const genes = normalizeReproGenes(source);
  return locusNames
    .map(
      (name) =>
        `${name}:${genes[name]
          .map((a) => `${a.value}:${a.dominance}`)
          .sort()
          .join("/")}`,
    )
    .join(";");
}

export function geneGainOptions(source) {
  const genes = normalizeReproGenes(source),
    options = [];
  for (const trait of GENETIC_TRAITS) {
    const entry = traitEntry(trait);
    if (
      genes[entry.locus].filter((a) => a.value === entry.value).length < 2
    )
      options.push(trait);
  }
  return options;
}

export function geneLossOptions(source) {
  const genes = normalizeReproGenes(source),
    values = new Set();
  for (const [locus, def] of Object.entries(REPRO_LOCI))
    for (const allele of genes[locus])
      if (allele.value !== def.normal) values.add(def.traits[allele.value]);
  return [...values];
}

export function gainReproAllele(source, trait, random) {
  const genes = cloneReproGenes(source),
    entry = traitEntry(trait);
  if (!entry) return genes;
  const pair = genes[entry.locus],
    normal = REPRO_LOCI[entry.locus].normal,
    candidates = pair
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.value === normal)
      .map(({ i }) => i),
    fallback = pair
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.value !== entry.value)
      .map(({ i }) => i),
    slots = candidates.length ? candidates : fallback;
  if (!slots.length) return genes;
  const index = slots[Math.floor(random() * slots.length)];
  pair[index] = {
    value: entry.value,
    dominance: random() < 0.5 ? "dominant" : "recessive",
  };
  return genes;
}

export function loseReproAllele(source, trait, random) {
  const genes = cloneReproGenes(source),
    entry = traitEntry(trait);
  if (!entry) return genes;
  const pair = genes[entry.locus],
    slots = pair
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.value === entry.value)
      .map(({ i }) => i);
  if (!slots.length) return genes;
  const index = slots[Math.floor(random() * slots.length)];
  pair[index] = neutralAllele(REPRO_LOCI[entry.locus].normal);
  return genes;
}
