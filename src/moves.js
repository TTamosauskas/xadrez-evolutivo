import {
  inside,
  has,
  distance,
  square,
  energyBranch,
  canPhotosynthesize,
  largeFunctionalForm,
} from "./constants.js";
import {
  at,
  eggAt,
  plantSeedAt,
  fragmentAt,
  barrierAt,
  builtBarrierAt,
  naturalBarrierAt,
  eventBarrierAt,
  terrain,
  round,
  juvenile,
  reproductionReady,
  fertilityPaused,
  ecologicalDomainBlocked,
  organicResidueAt,
  carcassAt,
  captureDisturbanceAt,
  lethalHazardAt,
  organicResidueHazardousTo,
} from "./state.js";
import {
  captureUnlocked,
  contactCaptureUnlocked,
} from "./geology.js";
import {
  canBud,
  canPupate,
  canUseBasalFertility,
  canUseFertileResource,
  connectedAlliesWithin,
  paedogenesisReady,
  parentalCareProtects,
  sortPreferredMates,
} from "./reproduction-traits.js";
import { specialLocomotionTargets } from "./locomotion.js";
const ORTH = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ],
  DIAG = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
export const dysfunctionalResting = (state, p) =>
  has(p, "Mutação Disfuncional") &&
  Number.isInteger(p.lastMoveRound) &&
  round(state) + 1 <= p.lastMoveRound + 1;
export const regenerationResting = (state, p) =>
  Number.isInteger(p.regenerationRestThroughRound) &&
  round(state) <= p.regenerationRestThroughRound;
export const decompositionImmune = (state, p) =>
  p?.decompositionImmunity?.cell === square(p.r, p.c) &&
  state.turn <= p.decompositionImmunity.throughTurn;
export const dormant = (state, p) => {
  const scavengerOnCarcass =
    !!carcassAt(state, p.r, p.c) &&
    (has(p, "Necrófago") || has(p, "Onívoro Oportunista"));
  return (
    has(p, "Dormência") &&
    (terrain(state, p.r, p.c) === "hostile" ||
      (!!captureDisturbanceAt(state, p.r, p.c) && !scavengerOnCarcass) ||
      (!!organicResidueAt(state, p.r, p.c) &&
        organicResidueHazardousTo(p))) &&
    !decompositionImmune(state, p)
  );
};
export const pupating = (state, p) =>
  Number.isInteger(p?.pupaUntilRound) && round(state) < p.pupaUntilRound;
export const resting = (state, p) =>
  dysfunctionalResting(state, p) ||
  regenerationResting(state, p) ||
  pupating(state, p);

export function serotoninRepositionTargets(state) {
  const pending = state.serotoninReposition;
  if (state.phase !== "serotonin-reposition" || !pending) return [];
  const piece = state.pieces.find(
    (candidate) =>
      candidate.id === pending.id && candidate.owner === state.current,
  );
  if (!piece) return [];

  const terrestrialRestriction =
      has(piece, "Locomoção Primitiva") &&
      !has(piece, "Locomoção Terrestre"),
    targets = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = piece.r + dr,
        c = piece.c + dc;
      if (
        !inside(r, c) ||
        ecologicalDomainBlocked(state, piece.owner, r, c) ||
        at(state, r, c) ||
        eggAt(state, r, c) ||
        plantSeedAt(state, r, c) ||
        fragmentAt(state, r, c) ||
        barrierAt(state, r, c) ||
        (terrestrialRestriction && terrain(state, r, c) !== "fertile")
      )
        continue;
      targets.push({ r, c });
    }
  return targets;
}

export function manipulationTargets(state) {
  const pending = state.manipulation;
  if (state.phase !== "manipulate" || !pending) return [];
  const parent = state.pieces.find((piece) => piece.id === pending.id);
  if (!parent || ecologicalDomainBlocked(state, parent.owner, parent.r, parent.c))
    return [];
  const origin = {
      r: Math.floor(pending.origin / 8),
      c: pending.origin % 8,
    },
    targets = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = origin.r + dr,
        c = origin.c + dc;
      if (
        inside(r, c) &&
        terrain(state, r, c) === "neutral" &&
        !ecologicalDomainBlocked(state, parent.owner, r, c) &&
        !barrierAt(state, r, c) &&
        !lethalHazardAt(state, r, c)
      )
        targets.push({ r, c });
    }
  return targets;
}

export function constructionTargets(state) {
  const pending = state.building;
  if (state.phase !== "build" || !pending) return [];
  const parent = state.pieces.find((piece) => piece.id === pending.id);
  if (!parent) return [];
  const decomposition = new Set([
      ...state.deathSites.map((site) => site.cell),
      ...state.fertileTraces.map((trace) => trace.cell),
      ...state.carcasses.map((entry) => entry.cell),
      ...(state.captureDisturbances ?? []).map((entry) => entry.cell),
      ...(state.event?.lethalHazards ?? []),
    ]),
    targets = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = parent.r + dr,
        c = parent.c + dc,
        cell = square(r, c);
      if (
        inside(r, c) &&
        !at(state, r, c) &&
        !eggAt(state, r, c) &&
        !ecologicalDomainBlocked(state, parent.owner, r, c) &&
        !barrierAt(state, r, c) &&
        !decomposition.has(cell)
      )
        targets.push({ r, c });
    }
  return targets;
}
export function movesFor(state, p, { ignoreChain = false } = {}) {
  if (
    !p ||
    state.result ||
    !state.pieces.some((x) => x.id === p.id) ||
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
    resting(state, p) ||
    dormant(state, p)
  )
    return [];
  if (!ignoreChain && state.chain && state.chain !== p.id) return [];
  const targets = [],
    terrestrialRestriction =
      has(p, "Locomoção Primitiva") &&
      !has(p, "Locomoção Terrestre");
  function add(r, c, path, extra = {}) {
    if (!inside(r, c) || ecologicalDomainBlocked(state, p.owner, r, c)) return;
    if (
      terrestrialRestriction &&
      !extra.stay &&
      terrain(state, r, c) !== "fertile"
    )
      return;
    const victim = at(state, r, c),
      egg = eggAt(state, r, c),
      plantSeed = plantSeedAt(state, r, c),
      fragment = fragmentAt(state, r, c),
      builtBarrier = builtBarrierAt(state, r, c),
      naturalBarrier = naturalBarrierAt(state, r, c),
      eventBarrier = eventBarrierAt(state, r, c),
      botanicalPredation =
        victim?.owner !== undefined &&
        victim.owner !== p.owner &&
        distance(p, victim) === 1 &&
        has(p, "Fotossíntese") &&
        has(p, "Haustório") &&
        has(victim, "Fotossíntese"),
      cannibal =
        victim?.owner === p.owner &&
        victim.id !== p.id &&
        has(p, "Canibalismo") &&
        reproductionReady(state, p),
      contactCapture =
        victim?.owner !== undefined &&
        victim.owner !== p.owner &&
        distance(p, victim) === 1 &&
        contactCaptureUnlocked(p);
    const fruitConsume =
        !!plantSeed &&
        !plantSeed.sprouting &&
        ["endozoocoria", "capsaicina"].includes(plantSeed.zoochory) &&
        (has(p, "Herbívoro") || has(p, "Onívoro") || has(p, "Granívoro")),
      synzooCollect =
        !!plantSeed &&
        !plantSeed.sprouting &&
        plantSeed.zoochory === "sinzoocoria" &&
        has(p, "Coletor") &&
        !state.plantSeeds.some(
          (seed) =>
            seed.transport?.kind === "sinzoocoria" &&
            seed.transport.carrierId === p.id,
        ),
      seedCapture =
        !!plantSeed &&
        !plantSeed.sprouting &&
        !fruitConsume &&
        !synzooCollect &&
        plantSeed.owner !== p.owner &&
        has(p, "Granívoro") &&
        reproductionReady(state, p);
    if (
      fragment ||
      (victim?.owner === p.owner && !cannibal) ||
      egg?.owner === p.owner
    )
      return;
    if (
      victim &&
      victim.owner !== p.owner &&
      !captureUnlocked(state, p) &&
      !contactCapture &&
      !botanicalPredation
    )
      return;
    if (
      victim &&
      has(victim, "Multicelularismo") &&
      !has(p, "Ingestão") &&
      !botanicalPredation
    )
      return;
    if (builtBarrier && !has(p, "Escavador")) return;
    if (
      (naturalBarrier || eventBarrier) &&
      !has(p, "Escavador") &&
      !has(p, "Escalador")
    )
      return;
    if (egg) {
      const parent = state.pieces.find((piece) => piece.id === egg.parentId),
        protectedEgg =
          parent &&
          has(parent, "Incubação") &&
          distance(parent, egg) === 1;
      if (
        (!has(p, "Ovífagia") && !has(p, "Onívoro Oportunista")) ||
        protectedEgg
      )
        return;
    }
    if (
      plantSeed &&
      ["endozoocoria", "capsaicina"].includes(plantSeed.zoochory) &&
      !fruitConsume
    )
      return;
    if (
      victim &&
      victim.owner !== p.owner &&
      parentalCareProtects(state, victim)
    )
      return;
    if (
      victim &&
      has(victim, "Camuflagem") &&
      !extra.crawler &&
      !has(p, "Visão Binocular") &&
      (
        distance(p, victim) > 1 ||
        (
          distance(p, victim) === 1 &&
          Math.abs(p.r - victim.r) === 1 &&
          Math.abs(p.c - victim.c) === 1 &&
          (has(victim, "Pelos") || has(victim, "Penas"))
        )
      )
    )
      return;
    targets.push({
      r,
      c,
      path,
      capture: !!victim,
      cannibal,
      eggCapture: egg?.id ?? null,
      seedCapture: seedCapture ? plantSeed.id : null,
      fruitConsume: fruitConsume ? plantSeed.id : null,
      synzooCollect: synzooCollect ? plantSeed.id : null,
      ...extra,
      noContinuation:
        !!extra.noContinuation || fruitConsume || synzooCollect,
    });
  }
  const occupiedTarget = (r, c) => !!at(state, r, c) || !!eggAt(state, r, c);
  function ray(directions, captureOnly = false) {
    for (const [dr, dc] of directions) {
      let geometricRange = 0;
      while (
        inside(
          p.r + dr * (geometricRange + 1),
          p.c + dc * (geometricRange + 1),
        )
      )
        geometricRange++;
      const movementLimit = has(p, "Deficiência Motora")
          ? 1
          : has(p, "Gigantismo")
            ? Math.max(1, Math.floor(geometricRange / 2))
            : geometricRange,
        captureLimit = has(p, "Deficiência Motora")
          ? 1
          : has(p, "Deficiência Sensorial")
            ? Math.max(1, Math.floor(geometricRange / 2))
            : geometricRange,
        path = [];
      for (let n = 1; n <= geometricRange; n++) {
        const r = p.r + dr * n,
          c = p.c + dc * n;
        if (!inside(r, c)) break;
        path.push([r, c]);
        const builtBarrier = builtBarrierAt(state, r, c),
          naturalBarrier = naturalBarrierAt(state, r, c),
          eventBarrier = eventBarrierAt(state, r, c),
          occupied = occupiedTarget(r, c),
          movementAllowed = n <= movementLimit,
          captureAllowed = n <= captureLimit;
        if (builtBarrier) {
          if (
            !captureOnly &&
            movementAllowed &&
            has(p, "Escavador")
          )
            add(r, c, [...path]);
          if (!has(p, "Voo") && !has(p, "Escavador")) break;
        } else if (naturalBarrier || eventBarrier) {
          if (
            !captureOnly &&
            movementAllowed &&
            (has(p, "Escavador") || has(p, "Escalador"))
          )
            add(r, c, [...path]);
          if (
            !has(p, "Voo") &&
            !has(p, "Escavador") &&
            !has(p, "Escalador")
          )
            break;
        } else if (occupied) {
          const distantCapture =
            n > 1 && !has(p, "Percepção Espacial");
          if (!distantCapture && captureAllowed) add(r, c, [...path]);
        } else if (!captureOnly && movementAllowed) {
          add(r, c, [...path]);
        }
        if (occupied) break;
      }
    }
  }
  function chessTargets(captureOnly = false) {
    if (p.rank === 0) {
      const dir = p.r === 0 ? 1 : p.r === 7 ? -1 : p.pawnDir,
        r = p.r + dir;
      if (
        !captureOnly &&
        inside(r, p.c) &&
        !at(state, r, p.c) &&
        !eggAt(state, r, p.c)
      )
        add(r, p.c, [[r, p.c]]);
      for (const c of [p.c - 1, p.c + 1]) {
        const victim = at(state, r, c),
          egg = eggAt(state, r, c);
        if (
          inside(r, c) &&
          ((victim?.owner &&
            (victim.owner !== p.owner ||
              (victim.id !== p.id &&
                has(p, "Canibalismo") &&
                reproductionReady(state, p)))) ||
            (egg?.owner &&
              egg.owner !== p.owner &&
              (has(p, "Ovífagia") || has(p, "Onívoro Oportunista"))))
        )
          add(r, c, [[r, c]]);
      }
    } else if (p.rank === 1) {
      for (const [dr, dc] of [
        [-2, -1],
        [-2, 1],
        [2, -1],
        [2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
      ]) {
        const r = p.r + dr,
          c = p.c + dc;
        if (!captureOnly || occupiedTarget(r, c)) add(r, c, [[r, c]]);
      }
    } else if (p.rank === 2) ray(DIAG, captureOnly);
    else if (p.rank === 3) ray(ORTH, captureOnly);
    else if (p.rank === 4) {
      for (const [dr, dc] of [...ORTH, ...DIAG]) {
        const r = p.r + dr,
          c = p.c + dc;
        if (!captureOnly || occupiedTarget(r, c)) add(r, c, [[r, c]]);
      }
    } else ray([...ORTH, ...DIAG], captureOnly);
  }

  function primitiveMovementTargets() {
    for (const [dr, dc] of [...ORTH, ...DIAG]) {
      const r = p.r + dr,
        c = p.c + dc;
      if (
        inside(r, c) &&
        !at(state, r, c) &&
        !eggAt(state, r, c)
      )
        add(r, c, [[r, c]]);
    }
  }

  const wrap = (value) => (value + 8) % 8;
  function crawlerTargets() {
    if (
      !has(p, "Rastejante") ||
      !has(p, "Locomoção Terrestre") ||
      has(p, "Deficiência Motora") ||
      (p.r !== 0 && p.r !== 7 && p.c !== 0 && p.c !== 7)
    )
      return;

    const addCrawler = (rawR, rawC) => {
      if (inside(rawR, rawC)) return;
      const r = wrap(rawR),
        c = wrap(rawC),
        existingIndex = targets.findIndex(
          (target) => target.r === r && target.c === c,
        ),
        before = targets.length;
      add(r, c, [[r, c]], { crawler: true });
      if (targets.length === before) return;
      const crawler = targets.at(-1);
      if (existingIndex >= 0) {
        targets[existingIndex] = crawler;
        targets.pop();
      }
    };

    if (p.rank === 0 || p.rank === 4) {
      for (const [dr, dc] of [...ORTH, ...DIAG])
        addCrawler(p.r + dr, p.c + dc);
      return;
    }

    if (p.rank === 1) {
      for (const [dr, dc] of [
        [-2, -1],
        [-2, 1],
        [2, -1],
        [2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
      ])
        addCrawler(p.r + dr, p.c + dc);
      return;
    }

    const directions =
      p.rank === 2
        ? DIAG
        : p.rank === 3
          ? ORTH
          : [...ORTH, ...DIAG];
    for (const [dr, dc] of directions)
      addCrawler(p.r + dr, p.c + dc);
  }

  const hardMovementBlock = (r, c) =>
    !!eggAt(state, r, c) ||
    !!fragmentAt(state, r, c) ||
    barrierAt(state, r, c);
  const escalatorMovementBlock = (r, c) =>
    !!eggAt(state, r, c) ||
    !!fragmentAt(state, r, c) ||
    builtBarrierAt(state, r, c);

  function lateralMovementTargets() {
    if (
      !has(p, "Movimento Lateral") ||
      !has(p, "Artrópode") ||
      !has(p, "Locomoção Terrestre") ||
      has(p, "Deficiência Motora")
    )
      return;

    for (const dc of [-1, 1]) {
      const path = [];
      for (let c = p.c + dc; inside(p.r, c); c += dc) {
        path.push([p.r, c]);
        if (hardMovementBlock(p.r, c)) break;
        const occupant = at(state, p.r, c);
        if (occupant) {
          if (
            occupant.owner === p.owner &&
            !ecologicalDomainBlocked(state, p.owner, p.r, c)
          )
            targets.push({
              r: p.r,
              c,
              path: [...path],
              capture: false,
              cannibal: false,
              eggCapture: null,
              seedCapture: null,
              lateral: true,
              lateralSwapId: occupant.id,
              noContinuation: true,
            });
          break;
        }
        add(p.r, c, [...path], { lateral: true });
      }
    }
  }

  function escalationTargets() {
    if (
      !has(p, "Escansão") ||
      !has(p, "Vertebrado") ||
      !has(p, "Locomoção Terrestre") ||
      !has(p, "Escalador") ||
      has(p, "Deficiência Motora")
    )
      return;

    for (const dr of [-1, 1]) {
      const path = [];
      for (let r = p.r + dr; inside(r, p.c); r += dr) {
        path.push([r, p.c]);
        if (
          ecologicalDomainBlocked(state, p.owner, r, p.c) ||
          escalatorMovementBlock(r, p.c)
        )
          break;
        const occupant = at(state, r, p.c);
        if (occupant) {
          if (occupant.owner === p.owner)
            targets.push({
              r,
              c: p.c,
              path: [...path],
              capture: false,
              cannibal: false,
              eggCapture: null,
              seedCapture: null,
              escalation: true,
              escalationSwapId: occupant.id,
              noContinuation: true,
            });
          break;
        }
        if (
          !targets.some(
            (target) => target.r === r && target.c === p.c,
          )
        )
          add(r, p.c, [...path], {
            escalation: true,
            noContinuation: true,
          });
      }
    }
  }

  function bioadhesionTargets() {
    if (
      !has(p, "Bioadesão") ||
      !has(p, "Locomoção Terrestre") ||
      !has(p, "Escalador") ||
      has(p, "Deficiência Motora") ||
      (p.r !== 0 && p.r !== 7 && p.c !== 0 && p.c !== 7)
    )
      return;

    const perimeter = [];
    for (let c = 0; c < 8; c++) perimeter.push([0, c]);
    for (let r = 1; r < 8; r++) perimeter.push([r, 7]);
    for (let c = 6; c >= 0; c--) perimeter.push([7, c]);
    for (let r = 6; r > 0; r--) perimeter.push([r, 0]);

    const start = perimeter.findIndex(
        ([r, c]) => r === p.r && c === p.c,
      ),
      candidates = new Map();
    if (start < 0) return;

    const consider = (candidate) => {
      const key = `${candidate.r},${candidate.c}`,
        current = candidates.get(key);
      if (!current || candidate.path.length < current.path.length)
        candidates.set(key, candidate);
    };

    for (const direction of [-1, 1]) {
      const path = [];
      for (let step = 1; step < perimeter.length; step++) {
        const index =
            (start + direction * step + perimeter.length * 2) %
            perimeter.length,
          [r, c] = perimeter[index];
        if (ecologicalDomainBlocked(state, p.owner, r, c)) break;
        path.push([r, c]);
        if (escalatorMovementBlock(r, c)) break;

        const occupant = at(state, r, c);
        if (occupant) {
          if (occupant.owner === p.owner)
            consider({
              r,
              c,
              path: [...path],
              capture: false,
              cannibal: false,
              eggCapture: null,
              seedCapture: null,
              bioadhesion: true,
              bioadhesionSwapId: occupant.id,
              noContinuation: true,
            });
          break;
        }

        if (
          !targets.some(
            (target) => target.r === r && target.c === c,
          )
        )
          consider({
            r,
            c,
            path: [...path],
            bioadhesion: true,
            noContinuation: true,
          });
      }
    }

    for (const candidate of candidates.values()) {
      if (candidate.bioadhesionSwapId) {
        targets.push(candidate);
        continue;
      }
      add(candidate.r, candidate.c, candidate.path, {
        bioadhesion: true,
        noContinuation: true,
      });
    }
  }

  function arborealTargets() {
    if (
      !has(p, "Arborícola") ||
      !has(p, "Locomoção Terrestre") ||
      !has(p, "Escalador") ||
      has(p, "Deficiência Motora")
    )
      return;

    for (const [dr, dc] of [...ORTH, ...DIAG]) {
      const path = [],
        supportIds = [];
      let r = p.r + dr,
        c = p.c + dc;

      while (inside(r, c)) {
        if (ecologicalDomainBlocked(state, p.owner, r, c)) break;
        const occupant = at(state, r, c);
        if (
          occupant &&
          occupant.owner === p.owner &&
          canPhotosynthesize(occupant)
        ) {
          if (
            builtBarrierAt(state, r, c) ||
            eggAt(state, r, c) ||
            fragmentAt(state, r, c)
          )
            break;
          path.push([r, c]);
          supportIds.push(occupant.id);
          r += dr;
          c += dc;
          continue;
        }

        if (!supportIds.length || occupant) break;
        if (
          eggAt(state, r, c) ||
          fragmentAt(state, r, c) ||
          builtBarrierAt(state, r, c)
        )
          break;

        path.push([r, c]);
        if (
          !targets.some(
            (target) => target.r === r && target.c === c,
          )
        )
          add(r, c, [...path], {
            arboreal: true,
            arborealSupportIds: [...supportIds],
            noContinuation: true,
          });
        break;
      }
    }
  }

  function phoresyTargets() {
    if (
      !has(p, "Forésia") ||
      largeFunctionalForm(p) ||
      !has(p, "Locomoção Terrestre") ||
      !has(p, "Sociabilidade") ||
      has(p, "Deficiência Motora")
    )
      return;

    for (const [dr, dc] of [...ORTH, ...DIAG]) {
      const path = [],
        carrierIds = [];
      let r = p.r + dr,
        c = p.c + dc;

      while (inside(r, c)) {
        if (ecologicalDomainBlocked(state, p.owner, r, c)) break;
        const occupant = at(state, r, c);

        if (
          occupant &&
          occupant.owner === p.owner &&
          !canPhotosynthesize(occupant)
        ) {
          path.push([r, c]);
          carrierIds.push(occupant.id);
          r += dr;
          c += dc;
          continue;
        }

        if (!carrierIds.length || occupant) break;
        if (
          eggAt(state, r, c) ||
          fragmentAt(state, r, c) ||
          barrierAt(state, r, c)
        )
          break;

        path.push([r, c]);
        if (
          !targets.some(
            (target) => target.r === r && target.c === c,
          )
        )
          add(r, c, [...path], {
            phoresy: true,
            phoresyCarrierIds: [...carrierIds],
            noContinuation: true,
          });
        break;
      }
    }
  }

  function serpentineMovementTargets() {
    if (
      !has(p, "Serpenteamento") ||
      !has(p, "Vertebrado") ||
      !has(p, "Locomoção Terrestre") ||
      has(p, "Deficiência Motora")
    )
      return;

    const clearSerpentineCell = (r, c) =>
      inside(r, c) &&
      terrain(state, r, c) !== "hostile" &&
      !ecologicalDomainBlocked(state, p.owner, r, c) &&
      !at(state, r, c) &&
      !plantSeedAt(state, r, c) &&
      !hardMovementBlock(r, c);
    const addSerpentine = (r, c, path) => {
      if (
        targets.some(
          (target) =>
            target.r === r &&
            target.c === c &&
            !target.capture &&
            !target.eggCapture &&
            !target.seedCapture,
        )
      )
        return;
      add(r, c, path, {
        serpentine: true,
        noContinuation: true,
      });
    };

    for (const dr of [-1, 1]) {
      const row = p.r + dr;
      if (!clearSerpentineCell(row, p.c)) continue;

      const entryPath = [[row, p.c]];
      addSerpentine(row, p.c, [...entryPath]);

      for (const dc of [-1, 1]) {
        const path = [...entryPath];
        for (let c = p.c + dc; inside(row, c); c += dc) {
          if (!clearSerpentineCell(row, c)) break;
          path.push([row, c]);
          addSerpentine(row, c, [...path]);
        }
      }
    }
  }

  function trailMovementTargets() {
    if (
      !has(p, "Trilhas") ||
      !has(p, "Artrópode") ||
      !has(p, "Sociabilidade") ||
      has(p, "Deficiência Motora")
    )
      return;

    const active = new Set(
        (state.trails ?? [])
          .filter(
            (trail) =>
              trail.owner === p.owner && trail.expiresRound >= round(state),
          )
          .map((trail) => trail.cell),
      ),
      originCell = square(p.r, p.c),
      passableTrail = (r, c) =>
        inside(r, c) &&
        active.has(square(r, c)) &&
        !ecologicalDomainBlocked(state, p.owner, r, c) &&
        !hardMovementBlock(r, c) &&
        (!at(state, r, c) || (r === p.r && c === p.c)),
      queue = [],
      best = new Map();

    if (active.has(originCell)) {
      queue.push({ r: p.r, c: p.c, path: [] });
      best.set(originCell, []);
    }
    for (const [dr, dc] of [...ORTH, ...DIAG]) {
      const r = p.r + dr,
        c = p.c + dc,
        cell = square(r, c);
      if (!passableTrail(r, c) || best.has(cell)) continue;
      const path = [[r, c]];
      best.set(cell, path);
      queue.push({ r, c, path });
    }

    for (let index = 0; index < queue.length; index++) {
      const current = queue[index];
      for (const [dr, dc] of [...ORTH, ...DIAG]) {
        const r = current.r + dr,
          c = current.c + dc,
          cell = square(r, c);
        if (!passableTrail(r, c) || best.has(cell)) continue;
        const path = [...current.path, [r, c]];
        best.set(cell, path);
        queue.push({ r, c, path });
      }
    }

    for (const current of queue)
      for (const [dr, dc] of [...ORTH, ...DIAG]) {
        const r = current.r + dr,
          c = current.c + dc;
        if (
          !inside(r, c) ||
          ecologicalDomainBlocked(state, p.owner, r, c) ||
          active.has(square(r, c)) ||
          square(r, c) === originCell ||
          at(state, r, c) ||
          hardMovementBlock(r, c)
        )
          continue;
        if (
          targets.some(
            (target) => target.r === r && target.c === c,
          )
        )
          continue;
        add(r, c, [...current.path, [r, c]], {
          trail: true,
          trailExtension: true,
          noContinuation: true,
        });
      }
  }

  function tigmotaxisContinuationTargets() {
    const result = [];
    if (!has(p, "Tigmotaxia")) return result;
    const rowEdge = p.r === 0 || p.r === 7,
      colEdge = p.c === 0 || p.c === 7;
    if (!rowEdge || !colEdge) return result;
    const directions = [
      [p.r === 0 ? 1 : -1, 0],
      [0, p.c === 0 ? 1 : -1],
    ];
    for (const [dr, dc] of directions) {
      const path = [];
      for (let step = 1; step <= 2; step++) {
        const r = p.r + dr * step,
          c = p.c + dc * step;
        if (
          !inside(r, c) ||
          ecologicalDomainBlocked(state, p.owner, r, c) ||
          at(state, r, c) ||
          hardMovementBlock(r, c)
        )
          break;
        path.push([r, c]);
        result.push({
          r,
          c,
          path: [...path],
          capture: false,
          eggCapture: null,
          seedCapture: null,
          tigmotaxis: true,
          continuationTrait: "Tigmotaxia",
          noContinuation: true,
        });
      }
    }
    return result;
  }

  function slidingContinuationTargets() {
    if (!has(p, "Deslizamento")) return [];
    const result = [];
    for (const [dr, dc] of [...ORTH, ...DIAG]) {
      const r = p.r + dr,
        c = p.c + dc;
      if (
        !inside(r, c) ||
        ecologicalDomainBlocked(state, p.owner, r, c) ||
        at(state, r, c) ||
        hardMovementBlock(r, c)
      )
        continue;
      result.push({
        r,
        c,
        path: [[r, c]],
        capture: false,
        eggCapture: null,
        seedCapture: null,
        sliding: true,
        continuationTrait: "Deslizamento",
        noContinuation: true,
      });
    }
    return result;
  }

  function recoilContinuationTargets() {
    if (!has(p, "Recuo") || !state.chainOrigin) return [];
    const { r, c } = state.chainOrigin;
    if (
      !inside(r, c) ||
      ecologicalDomainBlocked(state, p.owner, r, c) ||
      at(state, r, c) ||
      hardMovementBlock(r, c)
    )
      return [];
    return [{
      r,
      c,
      path: [[r, c]],
      capture: false,
      eggCapture: null,
      seedCapture: null,
      recoil: true,
      continuationTrait: "Recuo",
      noContinuation: true,
    }];
  }

  const mobile =
    has(p, "Locomoção Primitiva") &&
    !has(p, "Séssil");
  if (mobile) {
    if (has(p, "Locomoção Articulada")) chessTargets(false);
    else {
      primitiveMovementTargets();
      if (captureUnlocked(state, p) || contactCaptureUnlocked(p))
        chessTargets(true);
    }
    const baseTargets = [...targets];
    for (const special of specialLocomotionTargets(state, p, baseTargets)) {
      if (
        targets.some(
          (target) =>
            target.r === special.r &&
            target.c === special.c &&
            !!target.capture === !!special.capture,
        )
      )
        continue;
      const extra = { ...special };
      delete extra.r;
      delete extra.c;
      delete extra.path;
      add(special.r, special.c, special.path, extra);
    }
    crawlerTargets();
    lateralMovementTargets();
    escalationTargets();
    bioadhesionTargets();
    arborealTargets();
    phoresyTargets();
    serpentineMovementTargets();
    trailMovementTargets();
  } else if (
    !has(p, "Séssil") &&
    (captureUnlocked(state, p) || contactCaptureUnlocked(p))
  )
    chessTargets(true);
  if (has(p, "Fotossíntese") && has(p, "Haustório"))
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = p.r + dr,
          c = p.c + dc,
          victim = at(state, r, c);
        if (
          victim &&
          victim.owner !== p.owner &&
          has(victim, "Fotossíntese")
        )
          add(r, c, [], {
            botanicalPredation: "Haustório",
            stay: true,
          });
      }
  const collector = has(p, "Coletor"),
    basalFertility = canUseBasalFertility(state, p),
    canReproduce =
      reproductionReady(state, p) || paedogenesisReady(state, p);
  if (
    canReproduce &&
    basalFertility &&
    (terrain(state, p.r, p.c) === "fertile" || (collector && p.seeds > 0)) &&
    (!collector || (!has(p, "Esterilidade") && p.seedUsedTurn !== state.turn))
  )
    targets.push({ r: p.r, c: p.c, path: [], stay: true, capture: false });
  if (
    canReproduce &&
    canUseFertileResource(state, p) &&
    has(p, "Respiração Cutânea") &&
    !has(p, "Fotossíntese")
  )
    for (const [dr, dc] of ORTH) {
      const r = p.r + dr,
        c = p.c + dc;
      if (
        inside(r, c) &&
        terrain(state, r, c) === "fertile" &&
        !at(state, r, c) &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        !barrierAt(state, r, c)
      ) {
        const existing = targets.find(
          (target) => target.r === r && target.c === c,
        );
        if (existing)
          Object.assign(existing, {
            path: [],
            stay: true,
            cutaneous: true,
            capture: false,
          });
        else
          targets.push({
            r,
            c,
            path: [],
            stay: true,
            cutaneous: true,
            capture: false,
          });
      }
    }
  if (
    canReproduce &&
    has(p, "Respiração anaeróbia") &&
    has(p, "Traqueófitas") &&
    !has(p, "Esterilidade")
  )
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const r = p.r + dr,
          c = p.c + dc;
        if (
          inside(r, c) &&
          terrain(state, r, c) === "fertile" &&
          (!barrierAt(state, r, c) || has(p, "Trepadeira"))
        )
          targets.push({
            r,
            c,
            path: [],
            stay: true,
            vascular: true,
            capture: false,
          });
      }
  if (state.chain === p.id) {
    const options = state.chainOptions?.length
        ? state.chainOptions
        : state.chainTrait && state.chainTrait !== "Locomoção Especial"
          ? [state.chainTrait]
          : [],
      continuation = [];
    if (options.includes("Bipedalismo"))
      continuation.push(
        ...targets
          .filter(
            (target) =>
              !target.capture &&
              !target.eggCapture &&
              !target.seedCapture &&
              !target.stay &&
              !at(state, target.r, target.c),
          )
          .map((target) => ({
            ...target,
            continuationTrait:
              target.continuationTrait ?? "Bipedalismo",
          })),
      );
    if (options.includes("Tigmotaxia"))
      continuation.push(...tigmotaxisContinuationTargets());
    if (options.includes("Deslizamento"))
      continuation.push(...slidingContinuationTargets());
    if (options.includes("Recuo"))
      continuation.push(...recoilContinuationTargets());

    const unique = new Map();
    for (const target of continuation) {
      const key = `${target.r},${target.c}`;
      if (!unique.has(key) || target.recoil)
        unique.set(key, target);
    }
    return [...unique.values()];
  }
  return targets;
}
export function sexualReproductionResource(state, parent, mate) {
  const providers = [parent, mate].filter(Boolean);
  for (const provider of providers)
    if (
      canUseFertileResource(state, provider) &&
      terrain(state, provider.r, provider.c) === "fertile"
    )
      return {
        kind: "fertile",
        providerId: provider.id,
        cell: square(provider.r, provider.c),
      };
  for (const provider of providers)
    if (
      canUseFertileResource(state, provider) &&
      has(provider, "Coletor") &&
      (provider.seeds ?? 0) > 0 &&
      provider.seedUsedTurn !== state.turn
    )
      return { kind: "seed", providerId: provider.id };
  return null;
}

export function partnersFor(state, p, { requireResource = true } = {}) {
  if (
    !reproductionReady(state, p) ||
    !has(p, "Reprodução Sexuada") ||
    resting(state, p) ||
    dormant(state, p)
  )
    return [];
  const branch = energyBranch(p);
  if (!branch) return [];
  let pool;
  if (has(p, "Monogamia") && p.pairedWithId) {
    pool = state.pieces.filter((candidate) => candidate.id === p.pairedWithId);
  } else if (has(p, "Promiscuidade")) {
    pool = connectedAlliesWithin(state, p);
  } else {
    pool = state.pieces;
  }
  let candidates = pool.filter((x) => {
    if (
      x.id === p.id ||
      x.owner !== p.owner ||
      !has(x, "Reprodução Sexuada") ||
      !reproductionReady(state, x) ||
      resting(state, x) ||
      dormant(state, x) ||
      (!has(p, "Promiscuidade") && distance(p, x) !== 1) ||
      (requireResource && !sexualReproductionResource(state, p, x))
    )
      return false;
    const mateBranch = energyBranch(x);
    return (
      mateBranch === branch ||
      (mateBranch &&
        mateBranch !== branch &&
        has(p, "Mixotrofia") &&
        has(x, "Mixotrofia"))
    );
  });
  if (has(p, "Acasalamento Preferencial"))
    candidates = sortPreferredMates(candidates);
  return candidates;
}

export function nursingTargets(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
    !has(p, "Lactação") ||
    resting(state, p) ||
    dormant(state, p)
  )
    return [];
  return state.pieces.filter(
    (child) =>
      child.id !== p.id &&
      child.owner === p.owner &&
      child.parentId === p.id &&
      juvenile(state, child) &&
      distance(p, child) === 1,
  );
}

function emptyEggTarget(state, r, c, owner = null) {
  return (
    inside(r, c) &&
    !ecologicalDomainBlocked(state, owner, r, c) &&
    !at(state, r, c) &&
    !eggAt(state, r, c) &&
    !plantSeedAt(state, r, c) &&
    !barrierAt(state, r, c) &&
    !lethalHazardAt(state, r, c)
  );
}

export function domesticPlacementTargets(state) {
  const pending = state.domesticPlacement;
  if (state.phase !== "domestic-placement" || !pending) return [];
  const cells = [];
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      if (!dr && !dc) continue;
      const r = pending.origin.r + dr,
        c = pending.origin.c + dc;
      if (
        distance(pending.origin, { r, c }) <= 2 &&
        emptyEggTarget(state, r, c, pending.owner)
      )
        cells.push({ r, c });
    }
  return cells;
}

export function socialDefenseTargets(state) {
  if (state.phase !== "social-defense" || !state.socialDefense) return [];
  const ids = new Set(state.socialDefense.memberIds ?? []);
  return state.pieces.filter((piece) => ids.has(piece.id));
}

export function eggPlacementTargets(state) {
  const pending = state.eggPlacement;
  if (state.phase !== "egg-placement" || !pending) return [];
  const cells = [];
  for (let dr = -3; dr <= 3; dr++)
    for (let dc = -3; dc <= 3; dc++) {
      if (!dr && !dc) continue;
      const r = pending.origin.r + dr,
        c = pending.origin.c + dc;
      if (
        distance(pending.origin, { r, c }) <= 3 &&
        emptyEggTarget(state, r, c, pending.owner)
      )
        cells.push({ r, c });
    }
  return cells;
}

export function ovoviviparousPlacementTargets(state, p) {
  if (
    state.phase !== "move" ||
    state.chain ||
    !p ||
    p.owner !== state.current ||
    ecologicalDomainBlocked(state, p.owner, p.r, p.c) ||
    resting(state, p) ||
    dormant(state, p) ||
    !(p.pregnancies ?? []).some(
      (pregnancy) =>
        pregnancy.kind === "ovoviviparous" &&
        pregnancy.dueRound <= round(state),
    )
  )
    return [];
  const cells = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = p.r + dr,
        c = p.c + dc;
      if (emptyEggTarget(state, r, c, p.owner)) cells.push({ r, c });
    }
  return cells;
}

function parasitismReady(state, p) {
  return !!(
    state.phase === "move" &&
    !state.chain &&
    p &&
    p.owner === state.current &&
    !ecologicalDomainBlocked(state, p.owner, p.r, p.c) &&
    has(p, "Parasitismo") &&
    !resting(state, p) &&
    !dormant(state, p)
  );
}

export function canParasitizeSelf(state, p) {
  return !!(
    parasitismReady(state, p) &&
    !fertilityPaused(state) &&
    terrain(state, p.r, p.c) !== "fertile"
  );
}

export function parasitismTargets(state, p) {
  if (!parasitismReady(state, p)) return [];
  return state.pieces.filter(
    (otherPiece) =>
      otherPiece.owner !== p.owner &&
      distance(p, otherPiece) === 1 &&
      terrain(state, otherPiece.r, otherPiece.c) !== "hostile",
  );
}

export function canParasitize(state, p) {
  return (
    canParasitizeSelf(state, p) ||
    parasitismTargets(state, p).length > 0
  );
}

function pieceEvaluationState(state, piece) {
  if (
    state.phase === "move" &&
    state.current === piece.owner &&
    !state.chain
  )
    return state;
  return {
    ...state,
    current: piece.owner,
    phase: "move",
    chain: null,
    chainTrait: null,
    chainOptions: [],
    chainOrigin: null,
  };
}

export function actionsForPiece(
  state,
  piece,
  { ignoreTurn = false } = {},
) {
  if (
    !piece ||
    state.result ||
    !state.pieces.some((candidate) => candidate.id === piece.id)
  )
    return [];
  if (
    !ignoreTurn &&
    (state.phase !== "move" || piece.owner !== state.current)
  )
    return [];

  const source = ignoreTurn ? pieceEvaluationState(state, piece) : state;
  if (
    ecologicalDomainBlocked(source, piece.owner, piece.r, piece.c) ||
    (source.chain && source.chain !== piece.id)
  )
    return [];

  const mates =
    source.chain && source.chain !== piece.id
      ? []
      : has(piece, "Acasalamento Preferencial")
        ? partnersFor(source, piece).slice(0, 1)
        : partnersFor(source, piece);

  if (source.chain === piece.id)
    return movesFor(source, piece).map((target) => ({
      type: "MOVE",
      id: piece.id,
      r: target.r,
      c: target.c,
    }));

  return [
    ...movesFor(source, piece).map((target) => ({
      type: "MOVE",
      id: piece.id,
      r: target.r,
      c: target.c,
    })),
    ...mates.map((mate) => ({
      type: "PARTNER",
      parentId: piece.id,
      id: mate.id,
    })),
    ...nursingTargets(source, piece).map((child) => ({
      type: "NURSE",
      id: piece.id,
      childId: child.id,
    })),
    ...ovoviviparousPlacementTargets(source, piece).map((target) => ({
      type: "LAY_OVOVIVIPAROUS",
      id: piece.id,
      r: target.r,
      c: target.c,
    })),
    ...parasitismTargets(source, piece).map((target) => ({
      type: "PARASITIZE",
      id: piece.id,
      targetId: target.id,
    })),
    ...(canParasitizeSelf(source, piece)
      ? [{ type: "PARASITIZE", id: piece.id }]
      : []),
    ...(canBud(source, piece) ? [{ type: "BUD", id: piece.id }] : []),
    ...(canPupate(source, piece) ? [{ type: "PUPATE", id: piece.id }] : []),
  ];
}

function actionsAfterPieceChange(state, piece, changes) {
  const candidate = { ...piece, ...changes };
  return actionsForPiece(state, candidate, { ignoreTurn: true });
}

export function vivificationActionsForPiece(state, piece) {
  if (!piece) return [];
  return actionsForPiece(state, piece).filter(
    (action) =>
      (action.type === "MOVE" &&
        action.r === piece.r &&
        action.c === piece.c) ||
      action.type === "BUD" ||
      action.type === "PUPATE" ||
      (action.type === "PARASITIZE" &&
        !Number.isInteger(action.targetId)),
  );
}

export function pieceActionState(state, piece) {
  if (!piece || state.result || state.phase === "origin")
    return { waiting: false, reason: null, remainingRounds: null };
  const actions = actionsForPiece(state, piece, { ignoreTurn: true });
  if (actions.length)
    return { waiting: false, reason: null, remainingRounds: null };

  const currentRound = round(state);
  if (ecologicalDomainBlocked(state, piece.owner, piece.r, piece.c))
    return {
      waiting: true,
      reason: "Bloqueada por Domínio Ecológico",
      remainingRounds: null,
    };
  if (pupating(state, piece))
    return {
      waiting: true,
      reason: "Metamorfose",
      remainingRounds: Math.max(1, piece.pupaUntilRound - currentRound),
    };
  if (regenerationResting(state, piece))
    return {
      waiting: true,
      reason: "Recuperação por Regeneração",
      remainingRounds: Math.max(
        1,
        piece.regenerationRestThroughRound - currentRound + 1,
      ),
    };
  if (dysfunctionalResting(state, piece))
    return {
      waiting: true,
      reason: "Descanso por Mutação Disfuncional",
      remainingRounds: null,
    };
  if (dormant(state, piece))
    return {
      waiting: true,
      reason: "Dormência em terreno hostil",
      remainingRounds: null,
    };

  if (
    juvenile(state, piece) &&
    actionsAfterPieceChange(state, piece, {
      maturesRound: currentRound,
    }).length
  )
    return {
      waiting: true,
      reason: "Maturidade sexual",
      remainingRounds: Math.max(1, piece.maturesRound - currentRound),
    };

  if (
    (piece.nextReproductionRound ?? 0) > currentRound &&
    actionsAfterPieceChange(state, piece, {
      nextReproductionRound: currentRound,
    }).length
  )
    return {
      waiting: true,
      reason: "Recuperação metabólica",
      remainingRounds: piece.nextReproductionRound - currentRound,
    };

  return {
    waiting: true,
    reason: "Sem ação legal disponível",
    remainingRounds: null,
  };
}

export function legalActions(state) {
  if (state.result) return [];
  if (state.phase === "collapse") return [{ type: "DOMAIN_COLLAPSE" }];
  if (state.phase === "serotonin-reposition")
    return [
      ...serotoninRepositionTargets(state).map((target) => ({
        type: "SEROTONIN_REPOSITION",
        r: target.r,
        c: target.c,
      })),
      { type: "SKIP_SEROTONIN_REPOSITION" },
    ];
  if (state.phase === "manipulate")
    return [
      ...manipulationTargets(state).map((target) => ({
        type: "MANIPULATE",
        r: target.r,
        c: target.c,
      })),
      { type: "SKIP_MANIPULATION" },
    ];
  if (state.phase === "build")
    return [
      ...constructionTargets(state).map((target) => ({
        type: "BUILD",
        r: target.r,
        c: target.c,
      })),
      { type: "SKIP_BUILD" },
    ];
  if (state.phase === "partner") {
    const p = state.pieces.find((x) => x.id === state.partner.id),
      selected = new Set(state.partner.selectedIds ?? []);
    return partnersFor(state, p, { requireResource: selected.size === 0 })
      .filter((mate) => !selected.has(mate.id))
      .map((mate) => ({ type: "PARTNER", id: mate.id }));
  }
  if (state.phase === "egg-placement")
    return eggPlacementTargets(state).map((target) => ({
      type: "PLACE_EGG",
      r: target.r,
      c: target.c,
    }));
  if (state.phase === "domestic-placement")
    return domesticPlacementTargets(state).map((target) => ({
      type: "PLACE_DOMESTIC",
      r: target.r,
      c: target.c,
    }));
  if (state.phase === "social-defense")
    return socialDefenseTargets(state).map((piece) => ({
      type: "SOCIAL_SACRIFICE",
      id: piece.id,
    }));
  return state.pieces
    .filter((piece) => piece.owner === state.current)
    .flatMap((piece) => actionsForPiece(state, piece));
}
export function canWaitForRest(state, owner) {
  return state.pieces.some(
    (p) =>
      p.owner === owner &&
      !ecologicalDomainBlocked(state, p.owner, p.r, p.c) &&
      (resting(state, p) || dormant(state, p)),
  );
}
export function canWaitForBirth(state, owner) {
  return (
    state.eggs.some(
      (egg) =>
        egg.owner === owner &&
        !ecologicalDomainBlocked(state, owner, egg.r, egg.c),
    ) ||
    state.fragments.some(
      (fragment) =>
        fragment.owner === owner &&
        !ecologicalDomainBlocked(state, owner, fragment.r, fragment.c),
    ) ||
    state.pieces.some(
      (piece) =>
        piece.owner === owner &&
        (piece.marsupialPouch?.length ?? 0) > 0,
    ) ||
    state.plantSeeds.some(
      (seed) =>
        seed.owner === owner &&
        !ecologicalDomainBlocked(state, owner, seed.r, seed.c),
    ) ||
    state.pieces.some(
      (p) =>
        p.owner === owner &&
        !ecologicalDomainBlocked(state, p.owner, p.r, p.c) &&
        (p.pregnancies?.length ?? 0) > 0,
    )
  );
}
