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
import {
  round,
  random,
  pick,
  log,
  notice,
  fecalResidueAt,
  barrierAt,
  lethalHazardAt,
} from "./state.js";
import {
  availablePathogenAgents,
  pathogenUnlocked,
  sexualPathogenUnlocked,
  fecalPathogenUnlocked,
  sporePathogenUnlocked,
  negativeTraitUnlocked,
  SOMATIC_NEGATIVE_TRAITS,
} from "./geology.js";
import { recordDiscovery } from "./discoveries.js";
import { chooseDistantCells } from "./dispersal.js";

export const POPULATION_RESISTANCE_MORTALITY_FACTOR = 0.25;
export const VECTOR_PATHOGEN_TRANSMISSION_CHANCE = 0.25;
export const VECTOR_PATHOGEN_MORTALITY = 20;
export const VECTOR_RESISTANCE_MORTALITY_FACTOR = 0.5;
export const SEXUAL_PATHOGEN_TRANSMISSION_CHANCE = 0.5;
export const SEXUAL_PATHOGEN_MORTALITY = 15;
export const SEXUAL_PATHOGEN_DELAY = 8;
export const SEXUAL_PATHOGEN_DURATION = 12;
export const FECAL_PATHOGEN_CONTACT_CHANCE = 0.5;
export const FECAL_PATHOGEN_INGESTION_CHANCE = 1;
export const FECAL_PATHOGEN_MORTALITY = 30;
export const FECAL_PATHOGEN_DELAY = 5;
export const FECAL_PATHOGEN_DURATION = 10;
export const FUNGAL_SPORE_CONTACT_CHANCE = 0.35;
export const FUNGAL_SPORE_GERMINATION_CHANCE = 0.6;
export const FUNGAL_SPORE_MORTALITY = 45;
export const FUNGAL_SPORE_DURATION = 10;
export const FUNGAL_SPORE_LIFETIME = 3;
export const FUNGAL_SPORE_MAX_ACTIVE = 4;
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

const lineageReached = (piece, trait) =>
  has(piece, trait) || (piece?.ancestry ?? []).includes(trait);

export const fecalPathogenSusceptible = (piece) =>
  !!piece &&
  !(has(piece, "Fotossíntese") && !has(piece, "Mixotrofia"));

function fecalPathogenCandidates(state) {
  return state.pieces.filter(
    (piece) =>
      !piece.infection &&
      fecalPathogenSusceptible(piece) &&
      !fullyImmuneToEcologicalPathogen(piece) &&
      lineageReached(piece, "Multicelularismo") &&
      has(piece, "Predação") &&
      ["Carnívoro", "Herbívoro", "Onívoro"].some((trait) =>
        has(piece, trait),
      ),
  );
}

export function availableEcologicalPathogenTransmissions(
  state,
  agent,
) {
  const locked = state?.cyclePathogenProfile;
  if (locked) {
    if (locked.agent !== agent) return [];
    return initialCandidates(
      state,
      "eco",
      locked.agent,
      locked.transmission,
    ).length
      ? [locked.transmission]
      : [];
  }

  const routes = [defaultPathogenTransmission(agent)];
  if (
    agent === "virus" &&
    sexualPathogenUnlocked(state) &&
    sexualPathogenCandidates(state).length
  )
    routes.push("sexual");
  if (
    agent === "bacteria" &&
    fecalPathogenUnlocked(state) &&
    fecalPathogenCandidates(state).length
  )
    routes.push("fecal");
  if (agent === "fungus" && sporePathogenUnlocked(state))
    routes.push("spore");
  return routes.filter(
    (transmission) =>
      initialCandidates(state, "eco", agent, transmission).length,
  );
}

export function availableEcologicalPathogenProfiles(state) {
  return availablePathogenAgents(state).flatMap((agent) =>
    availableEcologicalPathogenTransmissions(state, agent).map(
      (transmission) => ({ agent, transmission }),
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
  if (trait === "Mutação Letal") piece.deleteriousDue = now + 3;
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
  if (transmission === "fecal") return fecalPathogenCandidates(state);
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

  const lockedProfile = state.cyclePathogenProfile ?? null;
  if (lockedProfile) {
    if (agent !== null && agent !== lockedProfile.agent) return null;
    if (
      transmission !== null &&
      transmission !== lockedProfile.transmission
    )
      return null;
    agent = lockedProfile.agent;
    transmission = lockedProfile.transmission;
  }

  const explicitAgent = agent !== null;
  if (
    explicitAgent &&
    (!PATHOGEN_AGENT_IDS.includes(agent) || !availableAgents.includes(agent))
  )
    return null;

  if (transmission === "sexual") {
    if (source !== "eco" || !sexualPathogenUnlocked(state)) return null;
    agent ??= "virus";
    if (agent !== "virus") return null;
  } else if (transmission === "fecal") {
    if (source !== "eco" || !fecalPathogenUnlocked(state)) return null;
    agent ??= "bacteria";
    if (agent !== "bacteria") return null;
  } else if (transmission === "spore") {
    if (source !== "eco" || !sporePathogenUnlocked(state)) return null;
    agent ??= "fungus";
    if (agent !== "fungus") return null;
  } else if (
    source === "eco" &&
    !explicitAgent &&
    transmission === null
  ) {
    const viableAgents = availableAgents.filter(
      (candidate) =>
        availableEcologicalPathogenTransmissions(state, candidate).length,
    );
    agent = pick(state, viableAgents);
    if (!agent) return null;
    transmission = pick(
      state,
      availableEcologicalPathogenTransmissions(state, agent),
    );
  }

  agent ??= pick(state, availableAgents);
  if (!agent) return null;
  transmission ??= defaultPathogenTransmission(agent);

  if (
    transmission !== defaultPathogenTransmission(agent) &&
    !(agent === "virus" && transmission === "sexual") &&
    !(agent === "bacteria" && transmission === "fecal") &&
    !(agent === "fungus" && transmission === "spore")
  )
    return null;

  const candidates = initialCandidates(state, source, agent, transmission);
  if (seed && !candidates.some((candidate) => candidate.id === seed.id))
    seed = null;
  seed ??= pick(state, candidates);
  if (!seed) return null;

  const sexual = transmission === "sexual",
    fecal = transmission === "fecal",
    spore = transmission === "spore",
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
          : fecal
            ? FECAL_PATHOGEN_DURATION
            : spore
              ? FUNGAL_SPORE_DURATION
              : source === "vector"
                ? 6
                : 10),
      delay:
        sexual
          ? SEXUAL_PATHOGEN_DELAY
          : fecal
            ? FECAL_PATHOGEN_DELAY
            : spore
              ? 3
              : source === "vector"
                ? 3
                : 2 + Math.floor(random(state) * 5),
      mortality:
        sexual
          ? SEXUAL_PATHOGEN_MORTALITY
          : fecal
            ? FECAL_PATHOGEN_MORTALITY
            : spore
              ? FUNGAL_SPORE_MORTALITY
              : source === "vector"
                ? VECTOR_PATHOGEN_MORTALITY
                : 60 + Math.floor(random(state) * 41),
      infected: [],
      survivors: [],
      deaths: 0,
      contaminated:
        agent === "fungus" &&
        ["environmental", "spore"].includes(transmission)
          ? [square(seed.r, seed.c)]
          : [],
    };
  state.diseases.push(disease);
  state.cyclePathogenProfile ??= { agent, transmission };
  recordDiscovery(state, "events", "pathogen");
  if (agent === "fungus") {
    if (!fullyImmuneToEcologicalPathogen(seed))
      recordPathogenExposure(state, seed, disease);
  } else if (infect(state, seed, disease))
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
        : transmission === "fecal"
          ? "Hospedeiros infectados podem deixar 💩 contaminadas após reprodução trófica; tocar o resíduo pode transmitir, e Coprofagia implica ingestão direta."
          : transmission === "spore"
            ? "Focos 🍄 liberam esporos ◌ que se dispersam por até três rodadas; o contato pode causar exposição e esporos maduros podem germinar em novos focos."
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

export function fecalPathogenDiseaseIdsForHost(state, piece) {
  if (!piece?.infection) return [];
  const disease = state.diseases.find(
    (candidate) =>
      candidate.id === piece.infection.disease &&
      candidate.transmission === "fecal",
  );
  return disease ? [disease.id] : [];
}

export function exposeFecalResidue(
  state,
  piece,
  cell = square(piece?.r ?? -1, piece?.c ?? -1),
  { ingestion = false } = {},
) {
  if (
    !piece ||
    !fecalPathogenSusceptible(piece) ||
    fullyImmuneToEcologicalPathogen(piece) ||
    piece.infection
  )
    return false;
  const r = Math.floor(cell / 8),
    col = cell % 8,
    residue = fecalResidueAt(state, r, col);
  if (!residue?.pathogenDiseaseIds?.length) return false;

  const chance = ingestion
    ? FECAL_PATHOGEN_INGESTION_CHANCE
    : FECAL_PATHOGEN_CONTACT_CHANCE;
  for (const diseaseId of residue.pathogenDiseaseIds) {
    const disease = state.diseases.find(
      (candidate) =>
        candidate.id === diseaseId &&
        candidate.agent === "bacteria" &&
        candidate.transmission === "fecal",
    );
    if (!disease || random(state) >= chance) continue;
    if (!infect(state, piece, disease)) continue;
    recordPathogenExposure(state, piece, disease);
    log(
      state,
      `${OWNERS[piece.owner]}: 🦠 exposição fecal transmitiu ${agentDefinition(disease).name}.`,
    );
    return true;
  }
  return false;
}

export function tryVectorPathogen(state, vector, agent = null) {
  if (!has(vector, "Vetor Patógeno")) return null;
  const lockedProfile = state.cyclePathogenProfile ?? null;
  if (
    lockedProfile &&
    lockedProfile.transmission !==
      defaultPathogenTransmission(lockedProfile.agent)
  )
    return null;
  const availableAgents = availablePathogenAgents(state),
    resolvedAgent = lockedProfile
      ? agent && agent !== lockedProfile.agent
        ? null
        : lockedProfile.agent
      : agent && PATHOGEN_AGENT_IDS.includes(agent)
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
      ["trail", "environmental", "spore"].includes(disease.transmission) &&
      disease.contaminated?.includes(cell),
  );
}

export function exposePathogenCell(state, piece) {
  let exposed = false;
  for (const disease of diseasesOnCell(state, piece)) {
    if (
      disease.source === "eco" &&
      fullyImmuneToEcologicalPathogen(piece)
    )
      continue;
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

function fungalSporeGerminable(state, disease, r, c) {
  if (
    !inside(r, c) ||
    barrierAt(state, r, c) ||
    lethalHazardAt(state, r, c) ||
    state.board[square(r, c)] === "hostile"
  )
    return false;
  return !disease.contaminated?.includes(square(r, c));
}

function fungalSporeTarget(state, disease) {
  const anchors = (disease.contaminated ?? []).map((cell) => ({
      r: Math.floor(cell / 8),
      c: cell % 8,
    })),
    occupiedSpores = new Set(
      (state.pathogenSpores ?? []).map((spore) => square(spore.r, spore.c)),
    ),
    cells = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (
        fungalSporeGerminable(state, disease, r, c) &&
        !occupiedSpores.has(square(r, c))
      )
        cells.push({ r, c });
  return chooseDistantCells(state, cells, anchors, 1)[0] ?? null;
}

export function emitFungalSpores(state, disease) {
  if (
    !disease ||
    disease.agent !== "fungus" ||
    disease.transmission !== "spore" ||
    !activeDisease(disease, round(state))
  )
    return 0;

  const current = state.pathogenSpores.filter(
      (spore) => spore.diseaseId === disease.id,
    ),
    slots = Math.max(0, FUNGAL_SPORE_MAX_ACTIVE - current.length);
  if (!slots) return 0;

  const focusPool = [...(disease.contaminated ?? [])];
  let emitted = 0;
  while (emitted < slots && focusPool.length) {
    const focus = pick(state, focusPool),
      focusIndex = focusPool.indexOf(focus);
    focusPool.splice(focusIndex, 1);
    const target = fungalSporeTarget(state, disease);
    if (!target) continue;
    const r = Math.floor(focus / 8),
      c = focus % 8;
    state.pathogenSpores.push({
      id: state.nextPathogenSpore++,
      diseaseId: disease.id,
      r,
      c,
      targetR: target.r,
      targetC: target.c,
      movesRemaining: FUNGAL_SPORE_LIFETIME,
    });
    emitted++;
  }
  return emitted;
}

function stepFungalSpore(state, spore) {
  if (spore.movesRemaining <= 0) return false;
  const occupied = new Set(
      state.pathogenSpores
        .filter((candidate) => candidate.id !== spore.id)
        .map((candidate) => square(candidate.r, candidate.c)),
    ),
    candidates = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = spore.r + dr,
        c = spore.c + dc;
      if (
        !inside(r, c) ||
        barrierAt(state, r, c) ||
        lethalHazardAt(state, r, c) ||
        occupied.has(square(r, c))
      )
        continue;
      candidates.push({ r, c });
    }
  if (!candidates.length) {
    spore.movesRemaining = 0;
    return false;
  }
  const target = { r: spore.targetR, c: spore.targetC },
    bestDistance = Math.min(
      ...candidates.map((candidate) => distance(candidate, target)),
    ),
    chosen = pick(
      state,
      candidates.filter(
        (candidate) => distance(candidate, target) === bestDistance,
      ),
    );
  spore.r = chosen.r;
  spore.c = chosen.c;
  spore.movesRemaining--;
  return true;
}

function fungalSporeContact(state, disease, spore, exposures) {
  const piece = state.pieces.find(
    (candidate) => candidate.r === spore.r && candidate.c === spore.c,
  );
  if (
    !piece ||
    fullyImmuneToEcologicalPathogen(piece) ||
    random(state) >= FUNGAL_SPORE_CONTACT_CHANCE
  )
    return false;
  exposures.add(piece);
  if (!disease.infected.includes(piece.id)) disease.infected.push(piece.id);
  return true;
}

export function advanceFungalSpores(ctx, disease, exposures = new Set()) {
  const state = ctx.state;
  if (
    !disease ||
    disease.agent !== "fungus" ||
    disease.transmission !== "spore" ||
    !activeDisease(disease, round(state))
  )
    return { moved: 0, germinated: 0 };

  let moved = 0,
    germinated = 0;
  for (const spore of state.pathogenSpores.filter(
    (candidate) => candidate.diseaseId === disease.id,
  )) {
    fungalSporeContact(state, disease, spore, exposures);
    if (stepFungalSpore(state, spore)) moved++;
    fungalSporeContact(state, disease, spore, exposures);

    if (spore.movesRemaining > 0) continue;
    const canGerminate = fungalSporeGerminable(
      state,
      disease,
      spore.r,
      spore.c,
    );
    if (
      canGerminate &&
      random(state) < FUNGAL_SPORE_GERMINATION_CHANCE
    ) {
      disease.contaminated ??= [];
      disease.contaminated.push(square(spore.r, spore.c));
      germinated++;
      log(
        state,
        `🍄 Esporo fúngico germinou em ${String.fromCharCode(65 + spore.c)}${8 - spore.r}.`,
      );
    }
    state.pathogenSpores = state.pathogenSpores.filter(
      (candidate) => candidate.id !== spore.id,
    );
  }
  return { moved, germinated };
}

function resolveInfectionMortality(ctx, piece, disease) {
  const state = ctx.state;
  if (
    ["population", "vector"].includes(disease.source) ||
    ["sexual", "fecal"].includes(disease.transmission)
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
      disease.agent === "fungus" &&
      disease.transmission === "spore" &&
      active &&
      now > disease.startRound
    ) {
      emitFungalSpores(state, disease);
      advanceFungalSpores(ctx, disease, exposures);
    }

    if (
      active &&
      ["trail", "environmental", "spore"].includes(disease.transmission)
    )
      for (const piece of state.pieces)
        if (disease.contaminated?.includes(square(piece.r, piece.c))) {
          if (
            disease.source === "eco" &&
            fullyImmuneToEcologicalPathogen(piece)
          )
            continue;
          exposures.add(piece);
          if (disease.agent === "bacteria") infect(state, piece, disease);
          else if (!disease.infected.includes(piece.id))
            disease.infected.push(piece.id);
        }

    const freshExposures = new Set();
    for (const piece of [...exposures])
      if (
        state.pieces.some((candidate) => candidate.id === piece.id) &&
        recordPathogenExposure(state, piece, disease)
      )
        freshExposures.add(piece);

    if (disease.agent === "fungus" && active) {
      for (const piece of freshExposures)
        if (state.pieces.some((candidate) => candidate.id === piece.id))
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
    if (
      state.deathSites?.some((site) =>
        site.pathogenDiseaseIds?.includes(disease.id),
      )
    )
      return true;
    return state.pieces.some(
      (piece) => piece.infection?.disease === disease.id,
    );
  });
  const diseaseIds = new Set(state.diseases.map((disease) => disease.id));
  state.pathogenSpores = state.pathogenSpores.filter((spore) =>
    diseaseIds.has(spore.diseaseId),
  );
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
