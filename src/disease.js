import { has, distance, OWNERS, other } from "./constants.js";
import { round, random, pick, log, notice } from "./state.js";
export function infect(state, p, disease) {
  if (
    !p ||
    has(p, "Resistência") ||
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
    (p) => !has(p, "Resistência") && !p.infection,
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
  infect(state, seed, disease);
  notice(state, "Patógeno Virulento", [
    `Origem: ${source === "population" ? "superpopulação" : "evento ecológico"}.`,
    `Mortalidade: ${disease.mortality}%. Desfecho após ${disease.delay} rodadas de infecção.`,
    `Contágio ${disease.mode === "diagonal" ? "diagonal" : disease.mode === "orthogonal" ? "ortogonal" : "omnidirecional"} durante dez rodadas.`,
  ]);
  log(
    state,
    `Patógeno Virulento: mortalidade ${disease.mortality}%, prazo ${disease.delay} rodadas.`,
  );
  return disease;
}
export function checkPopulation(state) {
  for (const owner of ["blue", "amber"])
    if (state.pieces.filter((p) => p.owner === owner).length < 17)
      state.populationLatched[owner] = false;
  if (
    state.diseases.some(
      (d) => d.source === "population" && d.endRound > round(state),
    )
  )
    return;
  const counts = {
    blue: state.pieces.filter((p) => p.owner === "blue").length,
    amber: state.pieces.filter((p) => p.owner === "amber").length,
  };
  const triggers = ["blue", "amber"].filter(
    (o) => counts[o] >= 17 && !state.populationLatched[o],
  );
  if (!triggers.length) return;
  const trigger = pick(
    state,
    triggers.filter(
      (o) => counts[o] === Math.max(...triggers.map((x) => counts[x])),
    ),
  );
  state.populationLatched[trigger] = true;
  const dominant =
    counts.blue === counts.amber
      ? pick(state, ["blue", "amber"])
      : counts.blue > counts.amber
        ? "blue"
        : "amber";
  const enemies = state.pieces.filter((p) => p.owner === other(dominant));
  const candidates = state.pieces.filter(
    (p) => p.owner === dominant && !has(p, "Resistência") && !p.infection,
  );
  const score = (p) =>
    enemies.length ? Math.min(...enemies.map((e) => distance(p, e))) : 0;
  const max = Math.max(...candidates.map(score));
  const seed = pick(
    state,
    candidates.filter((p) => score(p) === max),
  );
  if (seed) startDisease(state, "population", seed, trigger);
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
