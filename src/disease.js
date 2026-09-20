import { has, distance, OWNERS, other } from "./constants.js";
import { round, random, pick, log, notice } from "./state.js";
import { pathogenUnlocked } from "./geology.js";
import { recordDiscovery } from "./discoveries.js";
export const POPULATION_RESISTANCE_MORTALITY_FACTOR = 0.25;

export function infect(state, p, disease) {
  if (
    !p ||
    (has(p, "Resistência") && disease.source !== "population") ||
    p.infection ||
    disease.survivors.includes(p.id)
  )
    return false;
  p.infection = { disease: disease.id, due: round(state) + disease.delay };
  if (!disease.infected.includes(p.id)) disease.infected.push(p.id);
  return true;
}
export function startDisease(
  state,
  source = "eco",
  seed = null,
  triggerOwner = null,
) {
  const candidates = state.pieces.filter(
    (p) =>
      !p.infection &&
      (source === "population" || !has(p, "Resistência")),
  );
  seed ??= pick(state, candidates);
  if (!seed) return null;
  const disease = {
    id: state.nextDisease++,
    source,
    triggerOwner,
    mode: pick(state, ["diagonal", "orthogonal", "omnidirectional"]),
    startRound: round(state),
    endRound: round(state) + 10,
    delay: 2 + Math.floor(random(state) * 5),
    mortality: 60 + Math.floor(random(state) * 41),
    infected: [],
    survivors: [],
    deaths: 0,
  };
  state.diseases.push(disease);
  recordDiscovery(state, "events", "pathogen");
  infect(state, seed, disease);
  notice(state, "Patógeno Virulento", [
    `Origem: ${source === "population" ? "pressão populacional" : "evento ecológico"}.`,
    `Mortalidade: ${disease.mortality}%. Desfecho após ${disease.delay} rodadas de infecção.`,
    `Contágio ${disease.mode === "diagonal" ? "diagonal" : disease.mode === "orthogonal" ? "ortogonal" : "omnidirecional"} durante dez rodadas.`,
  ]);
  log(
    state,
    `Patógeno Virulento: mortalidade ${disease.mortality}%, prazo ${disease.delay} rodadas.`,
  );
  return disease;
}
export function populationPathogenChance(gap) {
  return Number(
    Math.min(0.45, 0.05 + Math.max(0, gap) * 0.04).toFixed(2),
  );
}

export function checkPopulation(state) {
  if (!pathogenUnlocked(state) || state.turn === 0 || state.turn % 2 !== 0)
    return;
  if (round(state) < state.populationDiseaseCooldownUntil) return;
  if (
    state.diseases.some(
      (d) => d.source === "population" && d.endRound > round(state),
    )
  )
    return;

  const counts = {
      blue: state.pieces.filter((p) => p.owner === "blue").length,
      amber: state.pieces.filter((p) => p.owner === "amber").length,
    },
    dominant =
      counts.blue === counts.amber
        ? pick(state, ["blue", "amber"])
        : counts.blue > counts.amber
          ? "blue"
          : "amber",
    gap = Math.abs(counts.blue - counts.amber);

  if (
    counts[dominant] < 17 ||
    random(state) >= populationPathogenChance(gap)
  )
    return;

  const enemies = state.pieces.filter((p) => p.owner === other(dominant)),
    candidates = state.pieces.filter(
      (p) => p.owner === dominant && !p.infection,
    );
  if (!candidates.length) return;

  const score = (p) =>
      enemies.length ? Math.min(...enemies.map((e) => distance(p, e))) : 0,
    max = Math.max(...candidates.map(score)),
    seed = pick(
      state,
      candidates.filter((p) => score(p) === max),
    );
  if (seed) {
    const disease = startDisease(state, "population", seed, dominant);
    state.populationDiseaseCooldownUntil =
      (disease?.endRound ?? round(state)) + 6;
    if (disease)
      log(
        state,
        `🦠 Pressão demográfica: diferença ${gap} iniciou surto nas ${OWNERS[dominant]}.`,
      );
  }
}
export function tickDiseases(ctx) {
  const state = ctx.state,
    now = round(state);
  for (const disease of state.diseases) {
    if (now > disease.startRound && now <= disease.endRound) {
      const sources = state.pieces.filter(
        (p) => p.infection?.disease === disease.id,
      );
      const targets = new Set();
      for (const source of sources)
        for (const target of state.pieces) {
          const dr = Math.abs(target.r - source.r),
            dc = Math.abs(target.c - source.c);
          if (target.id === source.id) continue;
          const contact =
            disease.mode === "diagonal"
              ? dr === 1 && dc === 1
              : disease.mode === "orthogonal"
                ? dr + dc === 1
                : Math.max(dr, dc) === 1;
          if (contact) targets.add(target);
        }
      for (const p of targets) infect(state, p, disease);
    }
    const due = state.pieces.filter(
      (p) => p.infection?.disease === disease.id && p.infection.due <= now,
    );
    for (const p of due) {
      if (disease.source === "population") {
        const mortality =
          (disease.mortality / 100) *
          (has(p, "Resistência")
            ? POPULATION_RESISTANCE_MORTALITY_FACTOR
            : 1);
        if (random(state) < mortality) {
          if (ctx.kill(p.id, "Patógeno Virulento")) disease.deaths++;
          else {
            disease.survivors.push(p.id);
            delete p.infection;
            log(
              state,
              `${OWNERS[p.owner]}: uma peça regenerou e sobreviveu ao patógeno.`,
            );
          }
        } else {
          disease.survivors.push(p.id);
          delete p.infection;
          log(
            state,
            has(p, "Resistência")
              ? `${OWNERS[p.owner]}: 🧬 Resistência reduziu a severidade do patógeno populacional.`
              : `${OWNERS[p.owner]}: uma peça sobreviveu ao patógeno.`,
          );
        }
        continue;
      }
      const quota = Math.ceil(
        (disease.infected.length * disease.mortality) / 100,
      );
      if (disease.deaths < quota) {
        if (ctx.kill(p.id, "Patógeno Virulento")) disease.deaths++;
        else {
          disease.survivors.push(p.id);
          delete p.infection;
          log(
            state,
            `${OWNERS[p.owner]}: uma peça regenerou e sobreviveu ao patógeno.`,
          );
        }
      } else {
        disease.survivors.push(p.id);
        delete p.infection;
        log(state, `${OWNERS[p.owner]}: uma peça sobreviveu ao patógeno.`);
      }
    }
  }
  state.diseases = state.diseases.filter(
    (d) =>
      d.endRound >= now ||
      state.pieces.some((p) => p.infection?.disease === d.id),
  );
}
