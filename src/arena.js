import { TRAITS, has } from "./constants.js";
import {
  BODY_PLAN_TRAITS,
  ENERGY_BRANCH_TRAITS,
  MULTICELLULAR_DEPENDENT_TRAITS,
  PLANT_DERIVED_TRAITS,
  PLANT_INCOMPATIBLE_TRAITS,
  TRAIT_DEPENDENCIES,
  normalizeActiveTraits,
  traitCombinationValid,
} from "./geology.js";
import {
  ARENA_ENGINEERING_CHANGES,
  ARENA_TRAIT_BUDGET,
} from "./scenarios.js";
import {
  genomeFromTraits,
  hiddenRecessiveTraits,
  syncGenomePhenotype,
} from "./genetics.js";

const NEGATIVE = new Set([
  "Esterilidade",
  "Mutação Deletéria",
  "Mutação Disfuncional",
]);
const BASAL = "Respiração anaeróbia";
export const ARENA_RECESSIVE_COUNT = 2;
export const ARENA_FOUNDATIONAL_TRAITS = new Set([
  "Reparo Celular",
  "Simetria Bilateral",
]);
export const arenaTraitCost = (genome) =>
  new Set(
    (genome ?? []).filter((trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait)),
  ).size;
const order = new Map(Object.keys(TRAITS).map((trait, index) => [trait, index]));

export const ARENA_ARCHETYPES = [
  ["Predação", "Multicelularismo", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Percepção Espacial"],
  ["Predação", "Multicelularismo", "Locomoção Primitiva", "Artrópode", "Locomoção Articulada", "Camuflagem"],
  ["Predação", "Multicelularismo", "Locomoção Primitiva", "Artrópode", "Locomoção Articulada", "Carapaça"],
  ["Predação", "Multicelularismo", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Notívago"],
  ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Madeira", "Espinhos"],
  ["Fotossíntese", "Multicelularismo", "Embriófitas", "Traqueófitas", "Gimnospermas", "Extremófitas"],
  ["Predação", "Multicelularismo", "Locomoção Primitiva", "Vertebrado", "Locomoção Articulada", "Ovíparo"],
  ["Predação", "Multicelularismo", "Locomoção Primitiva", "Artrópode", "Locomoção Articulada", "Visão Binocular"],
];

const COUNTERS = {
  Camuflagem: "Visão Binocular",
  Notívago: "Visão Noturna",
  Velocidade: "Velocidade",
  "Pele grossa": "Garras",
  Ovíparo: "Ovífagia",
  "Ovíparos Amniotas": "Ovífagia",
  Ovovivíparo: "Ovífagia",
  Chifre: "Carapaça",
  Fotossíntese: "Herbívoro",
};

export function arenaSelectableTraits() {
  return Object.keys(TRAITS).filter(
    (trait) =>
      trait !== BASAL &&
      !NEGATIVE.has(trait) &&
      !ARENA_FOUNDATIONAL_TRAITS.has(trait),
  );
}

const sorted = (traits) =>
  [...new Set(traits)].sort(
    (a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999),
  );

function sanitizeEnergy(set, preferred) {
  const prefersPlant =
    preferred === "Fotossíntese" || PLANT_DERIVED_TRAITS.has(preferred);
  const prefersAnimal =
    preferred === "Predação" || PLANT_INCOMPATIBLE_TRAITS.has(preferred);
  if (prefersPlant) {
    set.delete("Predação");
    for (const trait of PLANT_INCOMPATIBLE_TRAITS) set.delete(trait);
  } else if (prefersAnimal) {
    set.delete("Fotossíntese");
    for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
  } else if (
    set.has("Fotossíntese") &&
    [...PLANT_INCOMPATIBLE_TRAITS].some((trait) => set.has(trait))
  ) {
    set.delete("Fotossíntese");
    for (const trait of PLANT_DERIVED_TRAITS) set.delete(trait);
  }
}

export function completeArenaGenome(input, preferred = null) {
  const set = new Set(
    (input ?? []).filter(
      (trait) => TRAITS[trait] && trait !== BASAL && !NEGATIVE.has(trait),
    ),
  );
  sanitizeEnergy(set, preferred);
  let changed = true;
  while (changed) {
    changed = false;
    for (const trait of [...set]) {
      if (MULTICELLULAR_DEPENDENT_TRAITS.has(trait) && trait !== "Multicelularismo") {
        if (!set.has("Multicelularismo")) {
          set.add("Multicelularismo");
          changed = true;
        }
      }
      const deps = TRAIT_DEPENDENCIES[trait];
      for (const dependency of deps?.lineage ?? []) {
        if (dependency === BASAL) continue;
        if (!set.has(dependency)) {
          set.add(dependency);
          changed = true;
        }
      }
      if (
        deps?.lineageAny?.length &&
        !deps.lineageAny.some((dependency) => set.has(dependency))
      ) {
        const dependency = deps.lineageAny[0];
        if (dependency !== BASAL) {
          set.add(dependency);
          changed = true;
        }
      }
    }
    sanitizeEnergy(set, preferred);
  }
  return sorted(set);
}

export function arenaGenomeValid(genome, budget = null) {
  const normalized = completeArenaGenome(genome),
    input = new Set(
      (genome ?? []).filter(
        (trait) => TRAITS[trait] && !ARENA_FOUNDATIONAL_TRAITS.has(trait),
      ),
    ),
    normalizedBillable = normalized.filter(
      (trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait),
    );
  if (normalized.includes("Vertebrado") && normalized.includes("Artrópode"))
    return false;
  if (normalizedBillable.length !== input.size) return false;
  if (budget !== null && normalizedBillable.length !== budget) return false;
  const traits = normalizeActiveTraits([BASAL, ...normalized]);
  return traitCombinationValid(traits);
}

function phenotypeSupportsGenome(active) {
  const profile = { traits: [BASAL, ...active] };
  for (const trait of active) {
    if (
      MULTICELLULAR_DEPENDENT_TRAITS.has(trait) &&
      trait !== "Multicelularismo" &&
      !has(profile, "Multicelularismo")
    )
      return false;
    const deps = TRAIT_DEPENDENCIES[trait];
    if (
      deps?.lineage?.some(
        (dependency) => dependency !== BASAL && !has(profile, dependency),
      )
    )
      return false;
    if (
      deps?.lineageAny?.length &&
      !deps.lineageAny.some(
        (dependency) => dependency === BASAL || has(profile, dependency),
      )
    )
      return false;
    if (PLANT_DERIVED_TRAITS.has(trait) && !has(profile, "Fotossíntese"))
      return false;
  }
  return traitCombinationValid(normalizeActiveTraits(profile.traits));
}

export function arenaRecessivePairs(genome) {
  const completed = completeArenaGenome(genome),
    pairs = [];
  for (let i = 0; i < completed.length; i++)
    for (let j = i + 1; j < completed.length; j++) {
      const hidden = [completed[i], completed[j]];
      if (
        hidden.some(
          (trait) =>
            BODY_PLAN_TRAITS.has(trait) ||
            ENERGY_BRANCH_TRAITS.has(trait) ||
            ARENA_FOUNDATIONAL_TRAITS.has(trait),
        )
      )
        continue;
      const hiddenSet = new Set(hidden),
        active = completed.filter((trait) => !hiddenSet.has(trait));
      if (phenotypeSupportsGenome(active)) {
        const profile = arenaProfile(completed, 4, hidden),
          expressedHidden = hiddenRecessiveTraits(profile);
        if (hidden.every((trait) => expressedHidden.includes(trait)))
          pairs.push(hidden);
      }
    }
  return pairs;
}

export function chooseArenaRecessives(
  genome,
  seed = Date.now(),
  preferred = [],
) {
  const pairs = arenaRecessivePairs(genome);
  if (!pairs.length) return [];
  const wanted = new Set(preferred ?? []),
    preferredPairs = pairs.filter((pair) =>
      pair.every((trait) => wanted.has(trait)),
    ),
    partialPairs = pairs
      .map((pair) => ({
        pair,
        kept: pair.filter((trait) => wanted.has(trait)).length,
      }))
      .sort((a, b) => b.kept - a.kept),
    bestKept = partialPairs[0]?.kept ?? 0,
    candidates = preferredPairs.length
      ? preferredPairs
      : partialPairs
          .filter((entry) => entry.kept === bestKept)
          .map((entry) => entry.pair),
    random = lcg(seed);
  return [...candidates[Math.floor(random() * candidates.length)]];
}

export function arenaProfile(genome, rank = 4, recessiveTraits = []) {
  const completed = completeArenaGenome(genome),
    hidden = new Set(recessiveTraits),
    active = completed.filter((trait) => !hidden.has(trait)),
    preferred = active.includes("Fotossíntese")
      ? "Fotossíntese"
      : active.includes("Predação")
        ? "Predação"
        : null,
    profile = {
      rank,
      traits: normalizeActiveTraits([BASAL, ...active], preferred),
      ancestry: [BASAL, ...completed],
      genome: genomeFromTraits([BASAL, ...active], [...hidden]),
    };
  return syncGenomePhenotype(profile, preferred);
}

function lcg(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function archetypePool() {
  return ARENA_ARCHETYPES.map((genome) => completeArenaGenome(genome));
}

export function randomArenaSide(seed = Date.now()) {
  const random = lcg(seed),
    pool = archetypePool(),
    first = Math.floor(random() * pool.length);
  let second = Math.floor(random() * (pool.length - 1));
  if (second >= first) second++;
  return [pool[first], pool[second]];
}

function counterScore(genome, opponentGenomes) {
  const own = new Set(genome),
    opponent = new Set((opponentGenomes ?? []).flat()),
    wanted = new Set(
      [...opponent].map((trait) => COUNTERS[trait]).filter(Boolean),
    );
  let score = 0;
  for (const trait of wanted) if (own.has(trait)) score++;
  return Math.min(3, score);
}

export function arenaAISide(
  difficulty = "medium",
  opponentGenomes = null,
  seed = Date.now(),
) {
  if (difficulty === "easy") return randomArenaSide(seed);
  const pool = archetypePool();
  if (difficulty === "hard" && opponentGenomes?.length) {
    return pool
      .map((genome, index) => ({
        genome,
        index,
        score: counterScore(genome, opponentGenomes),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, 2)
      .map((entry) => entry.genome);
  }
  const pairs = [
    [0, 4],
    [1, 5],
    [2, 7],
    [3, 6],
  ];
  const pair = pairs[(seed >>> 0) % pairs.length];
  return pair.map((index) => pool[index]);
}

export function arenaInterventionCount(before, after) {
  let removed = 0,
    added = 0;
  for (let i = 0; i < 2; i++) {
    const a = new Set(
        (before?.[i] ?? []).filter(
          (trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait),
        ),
      ),
      b = new Set(
        (after?.[i] ?? []).filter(
          (trait) => !ARENA_FOUNDATIONAL_TRAITS.has(trait),
        ),
      );
    for (const trait of a) if (!b.has(trait)) removed++;
    for (const trait of b) if (!a.has(trait)) added++;
  }
  return {
    removed,
    added,
    substitutions: removed === added ? removed : Infinity,
    valid:
      removed === added &&
      removed <= ARENA_ENGINEERING_CHANGES &&
      (after ?? []).every((genome) => arenaGenomeValid(genome)),
  };
}

function swapToward(genome, wanted) {
  const base = completeArenaGenome(genome),
    wantedSet = new Set(wanted);
  for (const add of wanted) {
    if (base.includes(add)) continue;
    for (const remove of base) {
      if (wantedSet.has(remove)) continue;
      const candidate = completeArenaGenome(
        [...base.filter((trait) => trait !== remove), add],
        add,
      );
      if (
        candidate.length === base.length &&
        arenaGenomeValid(candidate) &&
        !candidate.includes(remove) &&
        candidate.includes(add)
      )
        return candidate;
    }
  }
  return base;
}

export function engineerArenaAISide(
  baseGenomes,
  difficulty = "medium",
  opponentGenomes = null,
  seed = Date.now(),
) {
  let result = (baseGenomes ?? []).map((genome) => completeArenaGenome(genome));
  while (result.length < 2) result.push([...result[0]]);
  const random = lcg(seed);
  let wanted;
  if (difficulty === "hard") {
    const opponent = new Set((opponentGenomes ?? []).flat());
    wanted = [...new Set([...opponent].map((trait) => COUNTERS[trait]).filter(Boolean))];
  } else if (difficulty === "medium") {
    wanted = arenaAISide("medium", null, seed).flat();
  } else {
    const all = arenaSelectableTraits();
    wanted = Array.from({ length: 8 }, () => all[Math.floor(random() * all.length)]);
  }
  for (let change = 0; change < ARENA_ENGINEERING_CHANGES; change++) {
    const index = change % 2;
    result[index] = swapToward(result[index], wanted);
  }
  return result;
}

export { ARENA_ENGINEERING_CHANGES, ARENA_TRAIT_BUDGET };
