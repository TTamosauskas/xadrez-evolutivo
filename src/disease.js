import {
  has,
  distance,
  OWNERS,
  other,
  square,
  inside,
  PATHOGEN_AGENTS,
  PATHOGEN_AGENT_IDS,
} from "./constants.js";
import { round, random, pick, log, notice } from "./state.js";
import {
  availablePathogenAgents,
  pathogenUnlocked,
  sexualPathogenUnlocked,
  negativeTraitUnlocked,
  SOMATIC_NEGATIVE_TRAITS,
} from "./geology.js";
import { recordDiscovery } from "./discoveries.js";
import { chooseDistantCells } from "./dispersal.js";

export const POPULATION_RESISTANCE_MORTALITY_FACTOR = 0.25;
export const VECTOR_PATHOGEN_TRANSMISSION_CHANCE = 0.25;
export const VECTOR_PATHOGEN_MORTALITY = 20;
export const VECTOR_RESISTANCE_MORTALITY_FACTOR = 0.5;
export const SEXUAL_PATHOGEN_EVENT_CHANCE = 0.25;
export const SEXUAL_PATHOGEN_TRANSMISSION_CHANCE = 0.5;
export const SEXUAL_PATHOGEN_MORTALITY = 15;
export const SEXUAL_PATHOGEN_DELAY = 8;
export const SEXUAL_PATHOGEN_DURATION = 12;
export const PATHOGEN_SOMATIC_MUTATION_CHANCE = 0.25;
export const PRE_REPAIR_PATHOGEN_SOMATIC_MUTATION_CHANCE = 0.5;
export const pathogenSomaticMutationChance = (piece) =>
  has(piece, "Reparo Celular")
    ? PATHOGEN_SOMATIC_MUTATION_CHANCE
    : PRE_REPAIR_PATHOGEN_SOMATIC_MUTATION_CHANCE;
export const NEGATIVE_SOMATIC_MUTATIONS = Object.freeze([
  ...SOMATIC_NEGATIVE_TRAITS,
]);

const agentDefinition = (disease) =>
  PATHOGEN_AGENTS[disease?.agent] ?? PATHOGEN_AGENTS.virus;

const activeDisease = (disease, now) =>
  now >= disease.startRound && now <= disease.endRound;

const defaultPathogenTransmission = (agent) =>
  agent === "bacteria"
    ? "trail"
    : agent === "fungus"
      ? "environmental"
      : "contact";

const fullyImmuneToEcologicalPathogen = (piece) =>
  has(piece, "Resistência") && !has(piece, "Imunodeficiência");

function sexualPathogenCandidates(state) {
  return state.pieces.filter(
    (piece) =>
      has(piece, "Reprodução Sexuada") &&
      !piece.infection &&
      !fullyImmuneToEcologicalPathogen(piece) &&
      state.pieces.some(
        (candidate) =>
          candidate.id !== piece.id &&
          candidate.owner === piece.owner &&
          has(candidate, "Reprodução Sexuada"),
      ),
  );
}

export function pathogenMortalityChance(piece, disease) {
  const base = disease.mortality / 100,
    resistant =
      has(piece, "Resistência") && !has(piece, "Imunodeficiência");
  if (!resistant) return base;
  if (disease.source === "population")
    return base * POPULATION_RESISTANCE_MORTALITY_FACTOR;
  if (disease.source === "vector")
    return base * VECTOR_RESISTANCE_MORTALITY_FACTOR;
  return base;
}

export function fungalExposureMortalityChance(piece, disease) {
  if (
    disease.agent === "fungus" &&
    disease.source === "eco" &&
    has(piece, "Resistência") &&
    !has(piece, "Imunodeficiência")
  )
    return 0;
  const cumulative = Math.min(0.99, pathogenMortalityChance(piece, disease)),
    duration = Math.max(1, disease.endRound - disease.startRound);
  return 1 - Math.pow(1 - cumulative, 1 / duration);
}

function exposureAlreadyRecorded(piece, disease, now) {
  return piece.pathogenExposureRounds?.[String(disease.id)] === now;
}

export function recordPathogenExposure(state, piece, disease) {
  if (!piece || !disease) return false;
  const now = round(state);
  piece.pathogenExposureRounds ??= {};
  if (exposureAlreadyRecorded(piece, disease, now)) return false;
  piece.pathogenExposureRounds[String(disease.id)] = now;

  piece.pathogenMutationDiseases ??= [];
  piece.somaticMutations ??= [];
  if (
    piece.pathogenMutationDiseases.includes(disease.id) ||
    random(state) >= pathogenSomaticMutationChance(piece)
  )
    return true;

  const available = NEGATIVE_SOMATIC_MUTATIONS.filter(
    (trait) =>
      !has(piece, trait) &&
      negativeTraitUnlocked(state, trait, piece, { somatic: true }),
  );
  const trait = pick(state, available);
  if (!trait) {
    piece.pathogenMutationDiseases.push(disease.id);
    return true;
  }

  piece.somaticMutations.push(trait);
  piece.pathogenMutationDiseases.push(disease.id);
  if (trait === "Mutação Deletéria") piece.deleteriousDue = now + 3;
  log(
    state,
    `${OWNERS[piece.owner]}: 🧬 exposição a ${agentDefinition(disease).name} induziu ${trait} somática.`,
  );
  return true;
}

export function infect(state, piece, disease) {
  if (!piece || !disease || disease.agent === "fungus") return false;
  if (
    (has(piece, "Resistência") &&
      !has(piece, "Imunodeficiência") &&
      !["population", "vector"].includes(disease.source)) ||
    piece.infection ||
    disease.survivors.includes(piece.id)
  )
    return false;
  piece.infection = {
    disease: disease.id,
    due: round(state) + disease.delay,
  };
  if (!disease.infected.includes(piece.id)) disease.infected.push(piece.id);
  return true;
}

function initialCandidates(state, source, agent, transmission) {
  if (transmission === "sexual") return sexualPathogenCandidates(state);
  return state.pieces.filter((piece) => {
    if (agent === "fungus") return true;
    if (piece.infection) return false;
    return (
      ["population", "vector"].includes(source) ||
      !has(piece, "Resistência") ||
      has(piece, "Imunodeficiência")
    );
  });
}

export function startDisease(
  state,
  source = "eco",
  seed = null,
  triggerOwner = null,
  agent = null,
  transmission = null,
) {
  const availableAgents = availablePathogenAgents(state);
  if (!availableAgents.length) return null;

  const explicitAgent = agent !== null;
  if (
    explicitAgent &&
    (!PATHOGEN_AGENT_IDS.includes(agent) || !availableAgents.includes(agent))
  )
    return null;

  if (transmission === "sexual") {
    if (!sexualPathogenUnlocked(state)) return null;
    agent ??= "virus";
    if (agent !== "virus") return null;
  } else if (
    source === "eco" &&
    !explicitAgent &&
    transmission === null &&
    sexualPathogenUnlocked(state) &&
    sexualPathogenCandidates(state).length &&
    random(state) < SEXUAL_PATHOGEN_EVENT_CHANCE
  ) {
    agent = "virus";
    transmission = "sexual";
  }

  agent ??= pick(state, availableAgents);
  if (!agent) return null;
  transmission ??= defaultPathogenTransmission(agent);

  if (
    transmission !== defaultPathogenTransmission(agent) &&
    !(agent === "virus" && transmission === "sexual")
  )
    return null;

  const candidates = initialCandidates(state, source, agent, transmission);
  if (seed && !candidates.some((candidate) => candidate.id === seed.id))
    seed = null;
  seed ??= pick(state, candidates);
  if (!seed) return null;

  const sexual = transmission === "sexual",
    disease = {
      id: state.nextDisease++,
      source,
      triggerOwner,
      agent,
      transmission,
      mode:
        transmission === "contact" && agent === "virus" && source !== "vector"
          ? pick(state, ["diagonal", "orthogonal", "omnidirectional"])
          : "omnidirectional",
      startRound: round(state),
      endRound:
        round(state) +
        (sexual
          ? SEXUAL_PATHOGEN_DURATION
          : source === "vector"
            ? 6
            : 10),
      delay:
        sexual
          ? SEXUAL_PATHOGEN_DELAY
          : source === "vector"
            ? 3
            : 2 + Math.floor(random(state) * 5),
      mortality:
        sexual
          ? SEXUAL_PATHOGEN_MORTALITY
          : source === "vector"
            ? VECTOR_PATHOGEN_MORTALITY
            : 60 + Math.floor(random(state) * 41),
      infected: [],
      survivors: [],
      deaths: 0,
      contaminated:
        transmission === "environmental" && agent === "fungus"
          ? [square(seed.r, seed.c)]
          : [],
    };
  state.diseases.push(disease);
  recordDiscovery(state, "events", "pathogen");
  if (agent === "fungus") recordPathogenExposure(state, seed, disease);
  else if (infect(state, seed, disease))
    recordPathogenExposure(state, seed, disease);

  const def = agentDefinition(disease),
    origin =
      source === "population"
        ? "pressão populacional"
        : source === "vector"
          ? "vetor"
          : "evento ecológico";
  if (source !== "vector") {
    const behavior =
      transmission === "sexual"
        ? "Transmissão apenas durante Reprodução Sexuada; proximidade comum não transmite, e Resistência impede a infecção."
        : transmission === "contact"
          ? `Contágio ${disease.mode === "diagonal" ? "diagonal" : disease.mode === "orthogonal" ? "ortogonal" : "omnidirecional"} durante dez rodadas.`
          : transmission === "trail"
            ? "Criaturas infectadas deixam 🦠 nas casas que abandonam; essas casas podem contaminar novos hospedeiros."
            : "Casas 🍄 expõem seus ocupantes a uma nova chance de mortalidade a cada rodada e dois novos focos surgem por rodada.";
    notice(state, `${def.icon} ${def.name}`, [
      `Origem: ${origin}.`,
      `Mortalidade-base do surto: ${disease.mortality}%.`,
      behavior,
    ]);
  }
  log(
    state,
    `${def.icon} ${def.name}: origem ${origin}, rota ${transmission}, mortalidade-base ${disease.mortality}%.`,
  );
  return disease;
}

export function transmitSexualPathogen(state, participants) {
  const unique = [
      ...new Map(
        (participants ?? [])
          .filter(Boolean)
          .map((piece) => [piece.id, piece]),
      ).values(),
    ],
    now = round(state);
  if (unique.length < 2) return 0;

  let transmitted = 0;
  for (const disease of state.diseases) {
    if (
      disease.transmission !== "sexual" ||
      !activeDisease(disease, now)
    )
      continue;

    const infectedAtStart = new Set(
      unique
        .filter((piece) => piece.infection?.disease === disease.id)
        .map((piece) => piece.id),
    );
    if (!infectedAtStart.size) continue;

    for (const target of unique) {
      if (
        infectedAtStart.has(target.id) ||
        target.infection ||
        fullyImmuneToEcologicalPathogen(target) ||
        random(state) >= SEXUAL_PATHOGEN_TRANSMISSION_CHANCE
      )
        continue;
      if (!infect(state, target, disease)) continue;
      recordPathogenExposure(state, target, disease);
      transmitted++;
      log(
        state,
        `${OWNERS[target.owner]}: transmissão sexual de ${agentDefinition(disease).name} durante acasalamento.`,
      );
    }
  }
  return transmitted;
}

export function tryVectorPathogen(state, vector, agent = null) {
  if (!has(vector, "Vetor Patógeno")) return null;
  const availableAgents = availablePathogenAgents(state),
    resolvedAgent =
      agent && PATHOGEN_AGENT_IDS.includes(agent)
        ? availableAgents.includes(agent)
          ? agent
          : null
        : pick(state, availableAgents),
    targets = state.pieces.filter(
      (piece) =>
        piece.owner !== vector.owner &&
        distance(piece, vector) === 1 &&
        (resolvedAgent === "fungus" || !piece.infection),
    );
  if (
    !resolvedAgent ||
    !targets.length ||
    random(state) >= VECTOR_PATHOGEN_TRANSMISSION_CHANCE
  )
    return null;
  const target = pick(state, targets),
    disease = startDisease(
      state,
      "vector",
      target,
      vector.owner,
      resolvedAgent,
    );
  if (disease)
    log(
      state,
      `${OWNERS[vector.owner]}: 🦟 Vetor Patógeno iniciou ${agentDefinition(disease).name} em uma peça adversária adjacente.`,
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
      (disease) =>
        disease.source === "population" &&
        disease.endRound > round(state),
    )
  )
    return;

  const counts = {
      blue: state.pieces.filter((piece) => piece.owner === "blue").length,
      amber: state.pieces.filter((piece) => piece.owner === "amber").length,
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

  const enemies = state.pieces.filter((piece) => piece.owner === other(dominant)),
    candidates = state.pieces.filter((piece) => piece.owner === dominant);
  if (!candidates.length) return;

  const score = (piece) =>
      enemies.length
        ? Math.min(...enemies.map((enemy) => distance(piece, enemy)))
        : 0,
    max = Math.max(...candidates.map(score)),
    seed = pick(
      state,
      candidates.filter((piece) => score(piece) === max),
    );
  if (seed) {
    const disease = startDisease(state, "population", seed, dominant);
    state.populationDiseaseCooldownUntil =
      (disease?.endRound ?? round(state)) + 6;
    if (disease)
      log(
        state,
        `☣️ Pressão demográfica: diferença ${gap} iniciou ${agentDefinition(disease).name} nas ${OWNERS[dominant]}.`,
      );
  }
}

export function leaveBacterialTrail(state, piece, cell = null) {
  if (!piece?.infection) return false;
  const disease = state.diseases.find(
    (candidate) =>
      candidate.id === piece.infection.disease &&
      candidate.agent === "bacteria" &&
      candidate.transmission === "trail",
  );
  if (!disease || !activeDisease(disease, round(state))) return false;
  cell ??= square(piece.r, piece.c);
  disease.contaminated ??= [];
  if (!disease.contaminated.includes(cell)) disease.contaminated.push(cell);
  return true;
}

function diseasesOnCell(state, piece) {
  const cell = square(piece.r, piece.c),
    now = round(state);
  return state.diseases.filter(
    (disease) =>
      activeDisease(disease, now) &&
      ["trail", "environmental"].includes(disease.transmission) &&
      disease.contaminated?.includes(cell),
  );
}

export function exposePathogenCell(state, piece) {
  let exposed = false;
  for (const disease of diseasesOnCell(state, piece)) {
    exposed = true;
    recordPathogenExposure(state, piece, disease);
    if (disease.agent === "bacteria") infect(state, piece, disease);
    else if (!disease.infected.includes(piece.id))
      disease.infected.push(piece.id);
  }
  return exposed;
}

function virusContacts(state, source, disease) {
  const targets = [];
  for (const target of state.pieces) {
    if (target.id === source.id) continue;
    const dr = Math.abs(target.r - source.r),
      dc = Math.abs(target.c - source.c),
      contact =
        disease.mode === "diagonal"
          ? dr === 1 && dc === 1
          : disease.mode === "orthogonal"
            ? dr + dc === 1
            : Math.max(dr, dc) === 1;
    if (contact) targets.push(target);
  }
  return targets;
}

function spreadFungus(state, disease) {
  const blocked = new Set([
      ...(state.barriers ?? []),
      ...(state.naturalBarriers ?? []),
    ]),
    contaminated = new Set(disease.contaminated ?? []),
    cells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const cell = square(r, c);
      if (!blocked.has(cell) && !contaminated.has(cell)) cells.push({ r, c });
    }
  const anchors = (disease.contaminated ?? []).map((cell) => ({
      r: Math.floor(cell / 8),
      c: cell % 8,
    })),
    added = chooseDistantCells(state, cells, anchors, 2);
  for (const cell of added) disease.contaminated.push(square(cell.r, cell.c));
  return added.length;
}

function resolveInfectionMortality(ctx, piece, disease) {
  const state = ctx.state;
  if (
    ["population", "vector"].includes(disease.source) ||
    disease.transmission === "sexual"
  ) {
    const mortality = pathogenMortalityChance(piece, disease);
    if (random(state) < mortality) {
      if (ctx.kill(piece.id, agentDefinition(disease).name)) disease.deaths++;
      else {
        disease.survivors.push(piece.id);
        delete piece.infection;
        log(
          state,
          `${OWNERS[piece.owner]}: uma peça regenerou e sobreviveu a ${agentDefinition(disease).name}.`,
        );
      }
    } else {
      disease.survivors.push(piece.id);
      delete piece.infection;
      log(
        state,
        has(piece, "Resistência")
          ? `${OWNERS[piece.owner]}: 🧬 Resistência reduziu a severidade de ${agentDefinition(disease).name}.`
          : `${OWNERS[piece.owner]}: uma peça sobreviveu a ${agentDefinition(disease).name}.`,
      );
    }
    return;
  }

  const quota = Math.ceil(
    (disease.infected.length * disease.mortality) / 100,
  );
  if (disease.deaths < quota) {
    if (ctx.kill(piece.id, agentDefinition(disease).name)) disease.deaths++;
    else {
      disease.survivors.push(piece.id);
      delete piece.infection;
      log(
        state,
        `${OWNERS[piece.owner]}: uma peça regenerou e sobreviveu a ${agentDefinition(disease).name}.`,
      );
    }
  } else {
    disease.survivors.push(piece.id);
    delete piece.infection;
    log(
      state,
      `${OWNERS[piece.owner]}: uma peça sobreviveu a ${agentDefinition(disease).name}.`,
    );
  }
}

function resolveFungalExposure(ctx, piece, disease) {
  const chance = fungalExposureMortalityChance(piece, disease);
  if (chance <= 0 || random(ctx.state) >= chance) return;
  if (ctx.kill(piece.id, agentDefinition(disease).name)) {
    disease.deaths++;
    return;
  }
  log(
    ctx.state,
    `${OWNERS[piece.owner]}: uma peça regenerou após exposição a ${agentDefinition(disease).name}.`,
  );
}

export function tickDiseases(ctx) {
  const state = ctx.state,
    now = round(state);
  for (const disease of state.diseases) {
    const active = activeDisease(disease, now),
      exposures = new Set();

    for (const piece of state.pieces)
      if (piece.infection?.disease === disease.id) exposures.add(piece);

    if (
      disease.agent === "virus" &&
      disease.transmission === "contact" &&
      active &&
      now > disease.startRound
    ) {
      const sources = state.pieces.filter(
        (piece) => piece.infection?.disease === disease.id,
      );
      const targets = new Set();
      for (const source of sources)
        for (const target of virusContacts(state, source, disease))
          targets.add(target);
      for (const piece of targets) {
        exposures.add(piece);
        infect(state, piece, disease);
      }
    }

    if (
      disease.agent === "fungus" &&
      disease.transmission === "environmental" &&
      active &&
      now > disease.startRound
    )
      spreadFungus(state, disease);

    if (
      active &&
      ["trail", "environmental"].includes(disease.transmission)
    )
      for (const piece of state.pieces)
        if (disease.contaminated?.includes(square(piece.r, piece.c))) {
          exposures.add(piece);
          if (disease.agent === "bacteria") infect(state, piece, disease);
          else if (!disease.infected.includes(piece.id))
            disease.infected.push(piece.id);
        }

    for (const piece of [...exposures])
      if (state.pieces.some((candidate) => candidate.id === piece.id))
        recordPathogenExposure(state, piece, disease);

    if (disease.agent === "fungus" && active) {
      for (const piece of [...exposures])
        if (
          state.pieces.some((candidate) => candidate.id === piece.id) &&
          disease.contaminated?.includes(square(piece.r, piece.c))
        )
          resolveFungalExposure(ctx, piece, disease);
      continue;
    }

    const due = state.pieces.filter(
      (piece) =>
        piece.infection?.disease === disease.id &&
        piece.infection.due <= now,
    );
    for (const piece of due) resolveInfectionMortality(ctx, piece, disease);
  }

  state.diseases = state.diseases.filter((disease) => {
    if (disease.endRound >= now) return true;
    if (disease.agent === "fungus") return false;
    return state.pieces.some(
      (piece) => piece.infection?.disease === disease.id,
    );
  });
}

export function pathogenAgentAt(state, r, c) {
  if (!inside(r, c)) return [];
  const cell = square(r, c),
    now = round(state),
    agents = new Set();
  const piece = state.pieces.find(
    (candidate) => candidate.r === r && candidate.c === c,
  );
  if (piece?.infection) {
    const disease = state.diseases.find(
      (candidate) => candidate.id === piece.infection.disease,
    );
    if (disease) agents.add(disease.agent);
  }
  for (const disease of state.diseases)
    if (
      activeDisease(disease, now) &&
      disease.contaminated?.includes(cell)
    )
      agents.add(disease.agent);
  return [...agents];
}
