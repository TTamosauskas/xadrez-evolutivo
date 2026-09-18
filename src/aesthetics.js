export const AESTHETIC_GENE_DEFS = {
  style: { normal: "normal", mutants: ["bold", "italic"] },
  height: { normal: "normal", mutants: ["low", "high"] },
  width: { normal: "normal", mutants: ["narrow", "wide"] },
  posture: { normal: "normal", mutants: ["left", "right"] },
  stroke: { normal: 0, mutants: [0.4, 0.8] },
  pigment: { normal: "none", mutants: ["violet", "cyan"] },
};

const geneNames = Object.keys(AESTHETIC_GENE_DEFS);
const cloneAllele = (a) => ({ value: a.value, dominance: a.dominance });
const neutralAllele = (value) => ({ value, dominance: "neutral" });

export function ancestralAestheticGenes() {
  return Object.fromEntries(
    geneNames.map((name) => {
      const value = AESTHETIC_GENE_DEFS[name].normal;
      return [name, [neutralAllele(value), neutralAllele(value)]];
    }),
  );
}

export function normalizeAestheticGenes(source) {
  const fallback = ancestralAestheticGenes();
  if (!source || typeof source !== "object") return fallback;
  const result = {};
  for (const name of geneNames) {
    const def = AESTHETIC_GENE_DEFS[name],
      allowed = new Set([def.normal, ...def.mutants]),
      pair = Array.isArray(source[name]) ? source[name] : null;
    if (
      !pair ||
      pair.length !== 2 ||
      pair.some((a) => !a || !allowed.has(a.value))
    ) {
      result[name] = fallback[name];
      continue;
    }
    result[name] = pair.map((a) => {
      if (a.value === def.normal) return neutralAllele(def.normal);
      return {
        value: a.value,
        dominance:
          a.dominance === "dominant" || a.dominance === "recessive"
            ? a.dominance
            : "recessive",
      };
    });
  }
  return result;
}

export function validAestheticGenes(source) {
  if (!source || typeof source !== "object") return false;
  for (const name of geneNames) {
    const def = AESTHETIC_GENE_DEFS[name],
      allowed = new Set([def.normal, ...def.mutants]),
      pair = source[name];
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    for (const a of pair) {
      if (!a || !allowed.has(a.value)) return false;
      if (
        a.value === def.normal
          ? a.dominance !== "neutral"
          : !["dominant", "recessive"].includes(a.dominance)
      )
        return false;
    }
  }
  return true;
}

export function cloneAestheticGenes(source) {
  const genes = normalizeAestheticGenes(source);
  return Object.fromEntries(
    geneNames.map((name) => [name, genes[name].map(cloneAllele)]),
  );
}

export function aestheticGenotypeSignature(source) {
  const genes = normalizeAestheticGenes(source);
  return geneNames
    .map(
      (name) =>
        `${name}:${genes[name]
          .map((a) => `${a.value}:${a.dominance}`)
          .sort()
          .join("/")}`,
    )
    .join(";");
}

export function inheritSexualAestheticGenes(a, b, random) {
  const ga = normalizeAestheticGenes(a),
    gb = normalizeAestheticGenes(b);
  return Object.fromEntries(
    geneNames.map((name) => [
      name,
      [
        cloneAllele(ga[name][Math.floor(random() * 2)]),
        cloneAllele(gb[name][Math.floor(random() * 2)]),
      ],
    ]),
  );
}

export function mutateAestheticGenes(source, random, options = {}) {
  const genes = cloneAestheticGenes(source),
    candidates = [],
    before = aestheticDescription(genes);
  for (const name of geneNames) {
    const def = AESTHETIC_GENE_DEFS[name];
    for (let allele = 0; allele < 2; allele++) {
      const current = genes[name][allele].value,
        values =
          current === def.normal
            ? def.mutants
            : [def.normal, ...def.mutants.filter((value) => value !== current)];
      for (const value of values) {
        const candidate = { name, allele, value };
        if (options.forceVisible) {
          if (value === def.normal) continue;
          const trial = cloneAestheticGenes(genes);
          trial[name][allele] = { value, dominance: "dominant" };
          if (aestheticDescription(trial) === before) continue;
        }
        candidates.push(candidate);
      }
    }
  }
  if (!candidates.length) return { genes, mutation: null };
  const selected = candidates[Math.floor(random() * candidates.length)],
    def = AESTHETIC_GENE_DEFS[selected.name],
    dominance =
      selected.value === def.normal
        ? "neutral"
        : options.forceVisible
          ? "dominant"
          : random() < 0.5
            ? "dominant"
            : "recessive";
  genes[selected.name][selected.allele] = {
    value: selected.value,
    dominance,
  };
  return {
    genes,
    mutation: { gene: selected.name, value: selected.value, dominance },
  };
}

function resolvePair(name, source) {
  const def = AESTHETIC_GENE_DEFS[name],
    pair = normalizeAestheticGenes({ [name]: source })[name],
    dominant = pair
      .filter((a) => a.value !== def.normal && a.dominance === "dominant")
      .map((a) => a.value);
  if (dominant.length) {
    const unique = [...new Set(dominant)];
    if (name === "style")
      return unique.includes("bold") ? "bold" : "italic";
    if (name === "height")
      return unique.includes("low") && unique.includes("high")
        ? def.normal
        : unique[0];
    if (name === "width")
      return unique.includes("narrow") && unique.includes("wide")
        ? def.normal
        : unique[0];
    if (name === "posture")
      return unique.includes("left") && unique.includes("right")
        ? def.normal
        : unique[0];
    if (name === "stroke") return Math.max(...unique);
    if (name === "pigment")
      return unique.includes("violet") ? "violet" : unique[0];
  }
  if (
    pair[0].value !== def.normal &&
    pair[0].value === pair[1].value &&
    pair[0].dominance === "recessive" &&
    pair[1].dominance === "recessive"
  )
    return pair[0].value;
  return def.normal;
}

export function aestheticPhenotype(source) {
  const genes = normalizeAestheticGenes(source),
    raw = Object.fromEntries(
      geneNames.map((name) => [name, resolvePair(name, genes[name])]),
    ),
    result = {
      style: "normal",
      height: "normal",
      width: "normal",
      posture: "normal",
      stroke: 0,
      pigment: "none",
    };
  let expressed = 0;
  const take = (active, apply) => {
    if (!active || expressed >= 3) return;
    apply();
    expressed++;
  };
  take(raw.style !== "normal", () => (result.style = raw.style));
  take(raw.height !== "normal", () => (result.height = raw.height));
  take(raw.width !== "normal", () => (result.width = raw.width));
  take(raw.stroke > 0, () => {
    result.stroke = raw.stroke;
    result.pigment = raw.pigment;
  });
  take(raw.posture !== "normal", () => (result.posture = raw.posture));
  return result;
}

export function aestheticMutationRate(reproductionCount) {
  if (reproductionCount < 5) return 0;
  if (reproductionCount <= 7) return 0.25;
  return 0.45;
}

export function aestheticDescription(source) {
  const p = aestheticPhenotype(source),
    labels = [];
  if (p.style === "bold") labels.push("negrito");
  if (p.style === "italic") labels.push("itálico");
  if (p.height === "low") labels.push("baixa");
  if (p.height === "high") labels.push("alta");
  if (p.width === "narrow") labels.push("estreita");
  if (p.width === "wide") labels.push("larga");
  if (p.stroke)
    labels.push(
      `contorno ${p.stroke === 0.4 ? "fino" : "marcado"}${
        p.pigment === "violet"
          ? " violeta"
          : p.pigment === "cyan"
            ? " ciano"
            : ""
      }`,
    );
  if (p.posture === "left") labels.push("inclinada à esquerda");
  if (p.posture === "right") labels.push("inclinada à direita");
  return labels.join(", ");
}
