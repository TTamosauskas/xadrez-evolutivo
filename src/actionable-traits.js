import { has, distance, square, functionalSizeClass } from "./constants.js";
import {
  energyCapacity,
  energyValue,
  movementEnergyCost,
  reproductionEnergyShortfall,
} from "./energy.js";
import {
  at,
  eggAt,
  plantSeedAt,
  barrierAt,
  naturalBarrierAt,
  eventBarrierAt,
  terrain,
  reproductionReady,
  juvenile,
  photosynthesisAvailable,
  organicResidueAt,
  carcassAt,
  round,
  pieceAge,
  naturalAgeProfile,
  naturalInfertilityAge,
  lethalHazardAt,
} from "./state.js";
import {
  movesFor,
  actionsForPiece,
  nicheConstructionTargets,
  adjacentAlliesCount,
  neurodivergenceResting,
  dormant,
  pieceActionState,
} from "./moves.js";
import {
  paedogenesisReady,
  buddingCanProgress,
  monogamySurvivalBonus,
  parentalCareProtects,
  predatoryReproductionAvailable,
  mutualismPartner,
  biofilmResource,
  bioluminescentPartner,
} from "./reproduction-traits.js";
import { dopaminePressureReductionAvailable } from "./reproduction.js";

const firstExplicitTrait = (piece, traits) =>
  traits.find((trait) => (piece?.traits ?? []).includes(trait)) ?? null;

function photosynthesisStationaryContext(state, piece) {
  const context = {
    extra: false,
    alliedExtra: false,
    barrierSupport: barrierAt(state, piece.r, piece.c),
  };
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = piece.r + dr,
        c = piece.c + dc;
      if (
        r < 0 ||
        r >= 8 ||
        c < 0 ||
        c >= 8 ||
        terrain(state, r, c) !== "neutral"
      )
        continue;
      const occupant = at(state, r, c);
      if (
        (piece.traits ?? []).includes("Angiospermas") &&
        occupant?.owner === piece.owner
      ) {
        context.extra = true;
        context.alliedExtra = true;
        continue;
      }
      if (
        !occupant &&
        !eggAt(state, r, c) &&
        !plantSeedAt(state, r, c) &&
        (!barrierAt(state, r, c) ||
          (piece.traits ?? []).includes("Trepadeira"))
      ) {
        context.extra = true;
        if (barrierAt(state, r, c)) context.barrierSupport = true;
      }
    }
  return context;
}

function addStationaryActionableTraits(state, piece, actionable) {
  if (photosynthesisAvailable(state, piece)) {
    const photosyntheticTrait = firstExplicitTrait(piece, [
      "Fotossíntese",
      "Mixotrofia",
    ]);
    if (photosyntheticTrait) actionable.add(photosyntheticTrait);

    const context = photosynthesisStationaryContext(state, piece);
    if (
      context.extra &&
      (piece.traits ?? []).includes("Embriófitas")
    )
      actionable.add("Embriófitas");
    if (
      context.alliedExtra &&
      (piece.traits ?? []).includes("Angiospermas")
    )
      actionable.add("Angiospermas");
    if (
      context.barrierSupport &&
      (piece.traits ?? []).includes("Trepadeira")
    )
      actionable.add("Trepadeira");
  }

  const cell = square(piece.r, piece.c);
  if (
    (piece.traits ?? []).includes("Extremófitas") &&
    terrain(state, piece.r, piece.c) === "hostile" &&
    !state.event?.hazards?.includes(cell) &&
    !(state.extremophyteFertility ?? []).some(
      (entry) => entry.cell === cell,
    )
  )
    actionable.add("Extremófitas");

  if (
    (piece.traits ?? []).includes("Dormência") &&
    dormant(state, piece)
  )
    actionable.add("Dormência");

  if (buddingCanProgress(state, piece))
    actionable.add("Brotamento");
  if (biofilmResource(state, piece))
    actionable.add("Biofilme");
}

export function actionableTraitsForPiece(state, piece) {
  const actionable = new Set();
  if (
    !piece ||
    state.result ||
    state.phase !== "move" ||
    piece.owner !== state.current
  )
    return actionable;

  addStationaryActionableTraits(state, piece, actionable);

  const actions = actionsForPiece(state, piece);
  if (!actions.length) return actionable;

  for (const action of actions) {
    if (action.type === "BIO_PROJECTILE") actionable.add("Projétil Biológico");
    if (action.type === "ELECTRODISCHARGE") actionable.add("Eletrodescarga");
    if (action.type === "HEMATOPHAGY") actionable.add("Hematofagia");
    if (action.type === "DETOXIFY")
      actionable.add("Biotransformação Hepática");
    if (action.type === "BROOD_PARASITIZE")
      actionable.add("Parasitismo de Ninhada");
    if (action.type === "REJECT_BROOD_PARASITE") actionable.add("Incubação");
    if (action.type === "RHIZOME") actionable.add("Rizoma");
    if (action.type === "CHEMOSYNTHESIS") actionable.add("Quimiossíntese");
    if (action.type === "FIX_NITROGEN")
      actionable.add("Fixação de Nitrogênio");
    if (action.type === "PHEROMONE_SIGNAL") actionable.add("Feromônios");
    if (action.type === "BIOLUMINESCENT_LURE")
      actionable.add("Bioluminescência Predatória");
    if (
      ["FEEDING_REACH", "EXTENDED_CAPTURE"].includes(action.type) &&
      action.trait
    )
      actionable.add(action.trait);
  }

  const targets = movesFor(state, piece),
    reproductiveReady =
      reproductionReady(state, piece) || paedogenesisReady(state, piece),
    locomotionTrait = firstExplicitTrait(piece, [
      "Locomoção Terrestre",
      "Locomoção Articulada",
      "Locomoção Primitiva",
    ]),
    respiratoryTrait = firstExplicitTrait(piece, [
      "Respiração aeróbia",
      "Respiração anaeróbia",
    ]),
    hasDetritusAt = (r, c) =>
      !!organicResidueAt(state, r, c) || !!carcassAt(state, r, c);

  if (
    has(piece, "Endorfinas") &&
    energyValue(piece) <= movementEnergyCost(piece) &&
    targets.some((target) => !target.stay)
  )
    actionable.add("Endorfinas");

  if (
    has(piece, "Ciclo de Sono") &&
    (piece.restorativeSleepCharge ||
      piece.sleepingThroughTurn === state.turn)
  )
    actionable.add("Ciclo de Sono");

  if (
    has(piece, "Hibernação") &&
    Number.isInteger(piece.hibernationUntilTurn) &&
    state.turn < piece.hibernationUntilTurn
  )
    actionable.add("Hibernação");

  if (
    has(piece, "Sistema Adipocinético") &&
    energyValue(piece) < energyCapacity(piece) &&
    targets.some(
      (target) =>
        !target.stay &&
        terrain(state, target.r, target.c) === "fertile",
    )
  )
    actionable.add("Sistema Adipocinético");

  if (
    has(piece, "Parasitoidismo") &&
    !piece.parasitoidism &&
    !state.pieces.some(
      (candidate) => candidate.parasitoidism?.sourceId === piece.id,
    ) &&
    targets.some((target) => {
      if (!target.capture) return false;
      const victim = at(state, target.r, target.c);
      return (
        victim?.owner !== piece.owner &&
        distance(piece, victim) === 1 &&
        !has(victim, "Fotossíntese")
      );
    })
  )
    actionable.add("Parasitoidismo");

  const gastricRiskAvailable =
    has(piece, "Estômago Ácido") &&
    targets.some((target) => {
      const victim = at(state, target.r, target.c),
        residue = organicResidueAt(state, target.r, target.c);
      return (
        (!!target.capture && victim?.infection) ||
        (has(piece, "Coprofagia") &&
          (residue?.pathogenDiseaseIds?.length ?? 0) > 0)
      );
    });
  if (gastricRiskAvailable) actionable.add("Estômago Ácido");

  if (piece.rumination) actionable.add("Ruminante");
  if (
    has(piece, "Eucarionte") &&
    (piece.eukaryoteBufferUses ?? 0) < 2
  )
    actionable.add("Eucarionte");
  if (
    has(piece, "Endossimbiose") &&
    reproductionEnergyShortfall(piece) === 1
  )
    actionable.add("Endossimbiose");
  if ((piece.adaptiveImmuneMemory ?? []).length)
    actionable.add("Imunidade Adaptativa");
  if (has(piece, "Estômatos")) actionable.add("Estômatos");
  if (
    has(piece, "Endotermia") &&
    terrain(state, piece.r, piece.c) === "hostile"
  ) {
    actionable.add("Endotermia");
    if (
      has(piece, "Coração Compartimentado") &&
      round(state) >= (piece.heartSupportReadyRound ?? 0)
    )
      actionable.add("Coração Compartimentado");
  }

  if (
    has(piece, "Autotomia") &&
    (piece.autotomyRecovery || piece.rank > 0)
  )
    actionable.add("Autotomia");

  if (
    has(piece, "Tinta") &&
    round(state) >= (piece.inkReadyRound ?? 0)
  )
    actionable.add("Tinta");

  if (
    has(piece, "Alelopatia") &&
    round(state) -
      (piece.stationarySinceRound ?? piece.bornRound ?? round(state)) >
      0
  )
    actionable.add("Alelopatia");

  if (
    has(piece, "Teia") &&
    (
      (state.webs ?? []).some((web) => web.sourceId === piece.id) ||
      round(state) > (piece.stationarySinceRound ?? round(state))
    )
  )
    actionable.add("Teia");

  if (
    has(piece, "Peçonha") &&
    targets.some((target) => {
      if (!target.capture) return false;
      const victim = at(state, target.r, target.c);
      return victim?.owner !== piece.owner && distance(piece, victim) === 1;
    })
  )
    actionable.add("Peçonha");

  if (
    has(piece, "Predação em Massa") &&
    functionalSizeClass(piece) === "large" &&
    targets.some((target) => {
      if (!target.capture) return false;
      const victim = at(state, target.r, target.c);
      if (
        !victim ||
        victim.owner === piece.owner ||
        functionalSizeClass(victim) === "large"
      )
        return false;
      return state.pieces.some(
        (candidate) =>
          candidate.owner !== piece.owner &&
          candidate.id !== victim.id &&
          distance(candidate, victim) === 1 &&
          functionalSizeClass(candidate) !== "large",
      );
    })
  )
    actionable.add("Predação em Massa");

  if (
    has(piece, "Córtex Pré-Frontal") &&
    targets.some((target) => !target.stay)
  )
    actionable.add("Córtex Pré-Frontal");
  if (
    has(piece, "Superorganismo") &&
    state.pieces.some(
      (ally) =>
        ally.id !== piece.id &&
        ally.owner === piece.owner &&
        has(ally, "Superorganismo"),
    )
  )
    actionable.add("Superorganismo");
  if (
    has(piece, "Ataxia") &&
    targets.filter((target) => !target.stay).length > 1
  )
    actionable.add("Ataxia");

  if (
    has(piece, "Bipedalismo") &&
    (state.chain === piece.id ||
      targets.some(
        (target) =>
          !target.capture &&
          !target.eggCapture &&
          !target.stay &&
          !at(state, target.r, target.c),
      ))
  )
    actionable.add("Bipedalismo");
  if (targets.some((target) => target.jump)) actionable.add("Pulo");
  if (targets.some((target) => target.jet)) actionable.add("Jatopropulsão");
  if (targets.some((target) => target.echolocation))
    actionable.add("Ecolocalização");
  if (targets.some((target) => target.crawler))
    actionable.add("Rastejante");
  if (targets.some((target) => target.lateral))
    actionable.add("Movimento Lateral");
  if (targets.some((target) => target.escalation))
    actionable.add("Escansão");
  if (targets.some((target) => target.bioadhesion))
    actionable.add("Bioadesão");
  if (targets.some((target) => target.arboreal))
    actionable.add("Arborícola");
  if (targets.some((target) => target.phoresy))
    actionable.add("Forésia");
  if (targets.some((target) => target.serpentine))
    actionable.add("Serpenteamento");
  if (targets.some((target) => target.trail))
    actionable.add("Trilhas");
  if (targets.some((target) => target.tigmotaxis))
    actionable.add("Tigmotaxia");
  if (targets.some((target) => target.recoil))
    actionable.add("Recuo");
  if (targets.some((target) => target.sliding))
    actionable.add("Deslizamento");
  if (targets.some((target) => target.hypermetamorphosis))
    actionable.add("Hipermetamorfose");
  if (targets.some((target) => target.massRecruitment))
    actionable.add("Recrutamento em Massa");
  if (
    has(piece, "Manada") &&
    state.pieces.some(
      (ally) =>
        ally.id !== piece.id &&
        ally.owner === piece.owner &&
        has(ally, "Manada") &&
        distance(ally, piece) === 1,
    ) &&
    targets.some(
      (target) =>
        !target.capture &&
        !target.eggCapture &&
        !target.stay &&
        !at(state, target.r, target.c),
    )
  )
    actionable.add("Manada");

  if (
    has(piece, "Serotonina") &&
    targets.some((target) => {
      if (!target.capture) return false;
      const victim = at(state, target.r, target.c);
      if (!victim || victim.owner === piece.owner) return false;
      return (
        ["Notívago", "Velocidade", "Pele grossa", "Madeira"].some((trait) =>
          has(victim, trait),
        ) ||
        parentalCareProtects(state, victim) ||
        monogamySurvivalBonus(state, victim) > 0 ||
        (juvenile(state, victim) &&
          (victim.biparentalGuardCharges ?? 0) > 0)
      );
    })
  )
    actionable.add("Serotonina");

  if (
    locomotionTrait &&
    targets.some(
      (target) =>
        !target.capture &&
        !target.eggCapture &&
        !target.stay &&
        !at(state, target.r, target.c),
    )
  )
    actionable.add(locomotionTrait);

  for (const target of targets) {
    const victim = at(state, target.r, target.c);

    if (target.botanicalPredation)
      actionable.add(target.botanicalPredation);
    if (target.cannibal) actionable.add("Canibalismo");

    if (target.seedCapture) {
      actionable.add("Granívoro");
      if (
        reproductiveReady &&
        has(piece, "Dopamina") &&
        dopaminePressureReductionAvailable(state, piece)
      )
        actionable.add("Dopamina");
    }

    if (target.eggCapture) {
      if (
        reproductiveReady &&
        has(piece, "Dopamina") &&
        dopaminePressureReductionAvailable(state, piece)
      )
        actionable.add("Dopamina");
      const eggTrait = firstExplicitTrait(piece, [
        "Ovífagia",
        "Onívoro Oportunista",
      ]);
      if (eggTrait) actionable.add(eggTrait);
    }

    if (
      target.capture &&
      victim &&
      victim.owner !== piece.owner &&
      !target.botanicalPredation
    ) {
      const captureTrait = firstExplicitTrait(piece, [
        "Predação",
        "Mixotrofia",
      ]);
      if (captureTrait) actionable.add(captureTrait);

      if (
        !target.crawler &&
        distance(piece, victim) > 1 &&
        (piece.traits ?? []).includes("Percepção Espacial")
      )
        actionable.add("Percepção Espacial");
      if (
        !target.crawler &&
        distance(piece, victim) > 1 &&
        has(victim, "Camuflagem") &&
        (piece.traits ?? []).includes("Visão Binocular")
      )
        actionable.add("Visão Binocular");
      if (
        has(victim, "Notívago") &&
        (round(state) + 1) % 2 === 0 &&
        (piece.traits ?? []).includes("Visão Noturna")
      )
        actionable.add("Visão Noturna");
      if (
        has(victim, "Velocidade") &&
        (piece.traits ?? []).includes("Velocidade")
      )
        actionable.add("Velocidade");
      if (
        has(victim, "Movimento proteano") &&
        has(piece, "Interceptação preditiva")
      )
        actionable.add("Interceptação preditiva");
      if (
        ["Contorcionismo", "Corpo Gelatinoso", "Esclerotização"].some(
          (trait) => has(victim, trait),
        ) &&
        has(piece, "Mandíbula")
      )
        actionable.add("Mandíbula");
      if (has(victim, "Escamas") && has(piece, "Dentes"))
        actionable.add("Dentes");
      if (
        has(victim, "Pele grossa") &&
        (piece.traits ?? []).includes("Presas")
      )
        actionable.add("Presas");
      if (
        has(victim, "Chifre") &&
        (piece.traits ?? []).includes("Carapaça")
      )
        actionable.add("Carapaça");

      if (
        reproductiveReady &&
        has(piece, "Dopamina") &&
        predatoryReproductionAvailable(piece, victim) &&
        dopaminePressureReductionAvailable(state, piece)
      )
        actionable.add("Dopamina");

      if (reproductiveReady) {
        const photosyntheticPrey = has(victim, "Fotossíntese");
        if ((piece.traits ?? []).includes("Onívoro"))
          actionable.add("Onívoro");
        else if (
          !photosyntheticPrey &&
          (piece.traits ?? []).includes("Carnívoro")
        )
          actionable.add("Carnívoro");
        else if (
          photosyntheticPrey &&
          (piece.traits ?? []).includes("Herbívoro")
        )
          actionable.add("Herbívoro");
      }
    }

    if (target.filialCannibal) actionable.add("Canibalismo Filial");
    if (target.matriphagy) actionable.add("Matrifagia");
    if (target.cutaneous) actionable.add("Respiração Cutânea");
    if (target.vascular) actionable.add("Traqueófitas");

    if (
      target.stay &&
      !target.capture &&
      !target.cutaneous &&
      !target.vascular
    ) {
      if (respiratoryTrait) actionable.add(respiratoryTrait);
      if (
        (piece.traits ?? []).includes("Respiração Pulmonar") &&
        (piece.traits ?? []).includes("Locomoção Terrestre")
      )
        actionable.add("Respiração Pulmonar");
      if (
        (piece.traits ?? []).includes("Coletor") &&
        (piece.seeds ?? 0) > 0 &&
        terrain(state, piece.r, piece.c) !== "fertile"
      )
        actionable.add("Coletor");
    }

    if (reproductiveReady && carcassAt(state, target.r, target.c)) {
      if (
        has(piece, "Dopamina") &&
        dopaminePressureReductionAvailable(state, piece)
      )
        actionable.add("Dopamina");
      const scavengerTrait = firstExplicitTrait(piece, [
        "Necrófago",
        "Onívoro Oportunista",
      ]);
      if (scavengerTrait) actionable.add(scavengerTrait);
    }
    if (
      reproductiveReady &&
      organicResidueAt(state, target.r, target.c) &&
      (piece.traits ?? []).includes("Coprofagia")
    ) {
      actionable.add("Coprofagia");
      if (
        has(piece, "Dopamina") &&
        dopaminePressureReductionAvailable(state, piece)
      )
        actionable.add("Dopamina");
    }

    if (
      (piece.traits ?? []).includes("Locomoção Terrestre") &&
      !target.stay &&
      terrain(state, target.r, target.c) !== "fertile"
    )
      actionable.add("Locomoção Terrestre");

    if ((piece.traits ?? []).includes("Escavador")) {
      const crossesBarrier = (target.path ?? []).some(([r, c]) =>
        barrierAt(state, r, c),
      );
      if (crossesBarrier) actionable.add("Escavador");
    }

    if ((piece.traits ?? []).includes("Escalador")) {
      const crossesNaturalBarrier = (target.path ?? []).some(
        ([r, c]) =>
          naturalBarrierAt(state, r, c) || eventBarrierAt(state, r, c),
      );
      if (crossesNaturalBarrier) actionable.add("Escalador");
    }

    if ((piece.traits ?? []).includes("Voo")) {
      const crossesObstacle = (target.path ?? []).some(
        ([r, c]) =>
          terrain(state, r, c) === "hostile" || barrierAt(state, r, c),
      );
      if (crossesObstacle) actionable.add("Voo");
    }
  }

  for (const action of actions) {
    if (action.type === "PARTNER") {
      actionable.add("Reprodução Sexuada");
      if (has(piece, "Canibalismo Sexual"))
        actionable.add("Canibalismo Sexual");
    } else if (action.type === "AGGRESSIVE_MATE")
      actionable.add("Cópula Agressiva");
    else if (action.type === "PARTHENOGENESIS")
      actionable.add("Partenogênese");
    else if (action.type === "NURSE") actionable.add("Lactação");
    else if (action.type === "LAY_OVOVIVIPAROUS")
      actionable.add("Ovovivíparo");
    else if (action.type === "PARASITIZE") {
      const parasiteTrait = firstExplicitTrait(piece, [
        "Vetor Patógeno",
        "Parasitismo",
      ]);
      if (parasiteTrait) actionable.add(parasiteTrait);
    } else if (action.type === "BUD") actionable.add("Brotamento");
    else if (action.type === "PUPATE") actionable.add("Metamorfose");
  }

  if (
    paedogenesisReady(state, piece) &&
    targets.some(
      (target) =>
        target.stay ||
        target.capture ||
        target.eggCapture ||
        hasDetritusAt(target.r, target.c),
    )
  )
    actionable.add("Pedogênese");

  const reproductiveOpportunity =
    reproductiveReady &&
    (targets.some(
      (target) =>
        target.stay ||
        target.capture ||
        target.eggCapture ||
        hasDetritusAt(target.r, target.c),
    ) ||
      actions.some((action) =>
        ["PARTNER", "AGGRESSIVE_MATE", "PARTHENOGENESIS"].includes(
          action.type,
        ),
      ));
  if (
    reproductiveOpportunity &&
    has(piece, "Diferenciação Celular")
  )
    actionable.add("Diferenciação Celular");
  if (reproductiveOpportunity)
    for (const trait of [
      "Testosterona",
      "Corticosteroides",
      "Forrageamento",
      "Tropismo",
      "Ocitocina",
    ])
      if (has(piece, trait)) actionable.add(trait);
  if (
    reproductiveOpportunity &&
    has(piece, "Mutualismo") &&
    mutualismPartner(state, piece)
  )
    actionable.add("Mutualismo");
  if (
    reproductiveOpportunity &&
    has(piece, "Anemia Falciforme") &&
    has(piece, "Respiração aeróbia")
  )
    actionable.add("Anemia Falciforme");

  const age = pieceAge(state, piece);
  if (
    has(piece, "Longevidade") &&
    age >= naturalAgeProfile(piece).senescence
  )
    actionable.add("Longevidade");
  if (
    has(piece, "Imortalidade Biológica") &&
    age >= naturalAgeProfile(piece).senescence
  )
    actionable.add("Imortalidade Biológica");
  if (
    has(piece, "Fertilidade Longeva") &&
    age >= naturalInfertilityAge(piece)
  )
    actionable.add("Fertilidade Longeva");

  return actionable;
}


const ACTIVE_WAIT_TRAITS = Object.freeze({
  "Dormência em terreno hostil": "Dormência",
  Metamorfose: "Metamorfose",
  "Descanso por Mutação Disfuncional": "Mutação Disfuncional",
});

function sociableGroup(state, victim) {
  if (!victim || !has(victim, "Sociabilidade")) return [];
  const eligible = state.pieces.filter(
      (piece) =>
        piece.owner === victim.owner && has(piece, "Sociabilidade"),
    ),
    seen = new Set([victim.id]),
    queue = [victim];
  while (queue.length) {
    const current = queue.shift(),
      luminous = bioluminescentPartner(state, current);
    for (const piece of eligible)
      if (
        !seen.has(piece.id) &&
        (distance(current, piece) === 1 || luminous?.id === piece.id)
      ) {
        seen.add(piece.id);
        queue.push(piece);
      }
  }
  return eligible.filter((piece) => seen.has(piece.id));
}

function addActiveStateTraits(state, piece, traits) {
  if (
    state.phase === "social-defense" &&
    (state.socialDefense?.memberIds ?? []).includes(piece.id) &&
    has(piece, "Hierarquia")
  )
    traits.add("Hierarquia");

  if (has(piece, "Mutualismo") && mutualismPartner(state, piece))
    traits.add("Mutualismo");

  const luminousPartner = bioluminescentPartner(state, piece);
  if (
    luminousPartner &&
    (has(piece, "Sociabilidade") ||
      (has(piece, "Monogamia") && piece.pairedWithId === luminousPartner.id))
  )
    traits.add(
      (piece.traits ?? []).includes("Bioluminescência Predatória")
        ? "Bioluminescência Predatória"
        : "Bioluminescência",
    );

  if (
    state.phase === "serotonin-reposition" &&
    state.serotoninReposition?.id === piece.id &&
    has(piece, "Serotonina")
  )
    traits.add("Serotonina");

  const actionState = pieceActionState(state, piece),
    waitingTrait = ACTIVE_WAIT_TRAITS[actionState.reason];
  if (waitingTrait && has(piece, waitingTrait))
    traits.add(waitingTrait);

  const cell = square(piece.r, piece.c);
  if (
    (piece.traits ?? []).includes("Extremófitas") &&
    terrain(state, piece.r, piece.c) === "hostile" &&
    !state.event?.hazards?.includes(cell) &&
    !(state.extremophyteFertility ?? []).some(
      (entry) => entry.cell === cell,
    )
  )
    traits.add("Extremófitas");

  if (buddingCanProgress(state, piece)) traits.add("Brotamento");

  if (piece.xerophyteWaterReserve && has(piece, "Xerofitismo"))
    traits.add("Xerofitismo");
  if (piece.renalWaterReserve && has(piece, "Rim Concentrador"))
    traits.add("Rim Concentrador");
  if (
    (piece.intestinalAbsorptionCount ?? 0) === 1 &&
    has(piece, "Intestino")
  )
    traits.add("Intestino");

  const retainedPregnancy = (piece.pregnancies ?? []).some(
    (pregnancy) => pregnancy.kind === "retained-viviparous",
  );
  if (retainedPregnancy) {
    if (has(piece, "Placenta")) traits.add("Placenta");
    else if (has(piece, "Estrogênio")) traits.add("Estrogênio");
  }

  if (
    has(piece, "Neurodivergência") &&
    (
      state.neurofocus === piece.id ||
      neurodivergenceResting(state, piece) ||
      (
        state.phase === "move" &&
        piece.owner === state.current &&
        adjacentAlliesCount(state, piece) !== 1
      )
    )
  )
    traits.add("Neurodivergência");

  if (
    state.phase === "move" &&
    piece.owner === state.current &&
    has(piece, "Construtor de Nicho") &&
    nicheConstructionTargets(state, piece).length
  )
    traits.add("Construtor de Nicho");

  if (
    has(piece, "Zoorremediação") &&
    piece.owner === state.current &&
    movesFor(state, piece).some(
      (target) =>
        !target.capture &&
        !target.stay &&
        terrain(state, target.r, target.c) === "hostile",
    )
  )
    traits.add("Zoorremediação");

  if (terrain(state, piece.r, piece.c) === "hostile") {
    if (has(piece, "Penas")) traits.add("Penas");
    if (has(piece, "Pelos")) traits.add("Pelos");
    if (has(piece, "Extremotolerância")) traits.add("Extremotolerância");
  }

  if (
    state.phase === "social-defense" &&
    state.socialDefense?.memberIds?.includes(piece.id) &&
    has(piece, "Sociabilidade")
  )
    traits.add("Sociabilidade");
}

function stateWithoutCamouflage(state, victim) {
  const replacement = {
    ...victim,
    traits: (victim.traits ?? []).filter((trait) => trait !== "Camuflagem"),
    somaticMutations: (victim.somaticMutations ?? []).filter(
      (trait) => trait !== "Camuflagem",
    ),
  };
  return {
    ...state,
    pieces: state.pieces.map((piece) =>
      piece.id === victim.id ? replacement : piece,
    ),
  };
}

function camouflageBlocksCurrentAttack(state, victim, attackers) {
  if (
    !has(victim, "Camuflagem") ||
    victim.owner === state.current
  )
    return false;
  const unmasked = stateWithoutCamouflage(state, victim);
  return attackers.some((attacker) => {
    if (has(attacker, "Visão Binocular")) return false;
    const d = distance(attacker, victim),
      diagonalTegument =
        d === 1 &&
        Math.abs(attacker.r - victim.r) === 1 &&
        Math.abs(attacker.c - victim.c) === 1 &&
        (has(victim, "Pelos") || has(victim, "Penas"));
    if (d <= 1 && !diagonalTegument) return false;
    return movesFor(unmasked, attacker).some(
      (target) =>
        target.capture &&
        target.r === victim.r &&
        target.c === victim.c,
    );
  });
}

const CAUSAL_ACTION_TRAITS = Object.freeze([
  "Escalador",
  "Voo",
  "Locomoção Terrestre",
  "Percepção Espacial",
  "Visão Binocular",
]);

function stateWithPiece(state, piece) {
  return {
    ...state,
    pieces: state.pieces.map((candidate) =>
      candidate.id === piece.id ? piece : candidate,
    ),
  };
}

function withoutActiveTrait(piece, trait) {
  return {
    ...piece,
    traits: (piece.traits ?? []).filter((candidate) => candidate !== trait),
    somaticMutations: (piece.somaticMutations ?? []).filter(
      (candidate) => candidate !== trait,
    ),
  };
}

function moveFingerprint(target) {
  return JSON.stringify({
    r: target.r,
    c: target.c,
    path: target.path ?? [],
    capture: !!target.capture,
    cannibal: !!target.cannibal,
    eggCapture: target.eggCapture ?? null,
    botanicalPredation: target.botanicalPredation ?? null,
    stay: !!target.stay,
    cutaneous: !!target.cutaneous,
    vascular: !!target.vascular,
  });
}

function legalPossibilityFingerprint(state, piece) {
  return JSON.stringify(
    movesFor(state, piece).map(moveFingerprint).sort(),
  );
}

function flightHasIndependentEnvironmentalEffect(state, piece) {
  if (!has(piece, "Voo")) return false;
  return movesFor(state, piece).some((target) =>
    (target.path ?? []).some(([r, c]) => {
      const landing = r === target.r && c === target.c;
      return (
        !landing &&
        (terrain(state, r, c) === "hostile" ||
          lethalHazardAt(state, r, c))
      );
    }),
  );
}

function pruneRedundantActionTraits(state, piece, contextual) {
  if (!piece || !contextual?.size) return contextual;

  let workingPiece = piece,
    workingState = state;
  for (const trait of CAUSAL_ACTION_TRAITS) {
    if (!contextual.has(trait) || !has(workingPiece, trait)) continue;

    // Voo também altera o risco ambiental de trajetórias hostis/letais,
    // mesmo quando outra mutação já oferece o mesmo destino legal.
    if (
      trait === "Voo" &&
      flightHasIndependentEnvironmentalEffect(workingState, workingPiece)
    )
      continue;

    const baseline = legalPossibilityFingerprint(workingState, workingPiece),
      candidatePiece = withoutActiveTrait(workingPiece, trait),
      candidateState = stateWithPiece(workingState, candidatePiece),
      candidate = legalPossibilityFingerprint(candidateState, candidatePiece);

    if (candidate !== baseline) continue;
    contextual.delete(trait);
    workingPiece = candidatePiece;
    workingState = candidateState;
  }
  return contextual;
}

function markCaptureContext(state, attacker, victim, byId) {
  const attackerTraits = byId.get(attacker.id),
    victimTraits = byId.get(victim.id);
  if (!attackerTraits || !victimTraits) return;

  const cooperativeHunters = state.pieces.filter(
      (piece) =>
        piece.owner === attacker.owner &&
        has(piece, "Caça Cooperativa") &&
        distance(piece, victim) === 1,
    ),
    cooperativeHunt =
      has(attacker, "Caça Cooperativa") &&
      cooperativeHunters.length >= 2 &&
      (has(victim, "Espinhos") || has(victim, "Chifre"));
  if (cooperativeHunt)
    for (const hunter of cooperativeHunters)
      byId.get(hunter.id)?.add("Caça Cooperativa");

  if (has(victim, "Espinhos")) {
    victimTraits.add("Espinhos");
    if (!cooperativeHunt && has(attacker, "Osteodermos"))
      attackerTraits.add("Osteodermos");
  }

  if (has(victim, "Chifre")) {
    victimTraits.add("Chifre");
    if (!cooperativeHunt && has(attacker, "Carapaça"))
      attackerTraits.add("Carapaça");
    else if (!cooperativeHunt && has(attacker, "Osteodermos"))
      attackerTraits.add("Osteodermos");
  }

  if (
    has(victim, "Mimetismo") &&
    state.pieces.some(
      (piece) =>
        piece.id !== attacker.id &&
        piece.id !== victim.id &&
        piece.owner === attacker.owner &&
        distance(piece, victim) === 1,
    )
  )
    victimTraits.add("Mimetismo");

  if (
    has(attacker, "Mimetismo Agressivo") &&
    [
      "Mimetismo",
      "Notívago",
      "Exibição deimática",
      "Tanatose",
      "Ofuscamento por movimento",
      "Movimento proteano",
      "Adrenalina",
      "Velocidade",
    ].some((trait) => has(victim, trait))
  )
    attackerTraits.add("Mimetismo Agressivo");

  if (victim.owner !== attacker.owner) {
    const social = sociableGroup(state, victim);
    if (social.length >= 4)
      for (const member of social)
        byId.get(member.id)?.add("Sociabilidade");

    const nocturnal =
      has(victim, "Notívago") && (round(state) + 1) % 2 === 0;
    if (nocturnal) {
      victimTraits.add("Notívago");
      if (has(attacker, "Visão Noturna"))
        attackerTraits.add("Visão Noturna");
    }

    const nocturnalEvasion =
      nocturnal && !has(attacker, "Visão Noturna");
    if (!nocturnalEvasion && has(victim, "Exibição deimática"))
      victimTraits.add("Exibição deimática");
    if (!nocturnalEvasion && has(victim, "Tanatose")) {
      victimTraits.add("Tanatose");
      if (has(attacker, "Necrófago")) attackerTraits.add("Necrófago");
    }
    if (!nocturnalEvasion && has(victim, "Ofuscamento por movimento")) {
      const support = state.pieces.filter(
        (piece) =>
          piece.id !== victim.id &&
          piece.owner === victim.owner &&
          has(piece, "Ofuscamento por movimento") &&
          distance(piece, victim) === 1,
      );
      if (support.length >= 2) {
        victimTraits.add("Ofuscamento por movimento");
        for (const ally of support)
          byId.get(ally.id)?.add("Ofuscamento por movimento");
      }
    }
    if (!nocturnalEvasion && has(victim, "Movimento proteano")) {
      victimTraits.add("Movimento proteano");
      if (has(attacker, "Interceptação preditiva"))
        attackerTraits.add("Interceptação preditiva");
    }

    if (!nocturnalEvasion && has(victim, "Adrenalina"))
      victimTraits.add("Adrenalina");

    if (!nocturnalEvasion && has(victim, "Velocidade")) {
      victimTraits.add("Velocidade");
      if (has(attacker, "Velocidade"))
        attackerTraits.add("Velocidade");
    }

    if (has(victim, "Pele grossa")) {
      victimTraits.add("Pele grossa");
      if (has(attacker, "Presas")) attackerTraits.add("Presas");
    }

    if (distance(attacker, victim) === 1)
      for (const trait of [
        "Contorcionismo",
        "Corpo Gelatinoso",
        "Esclerotização",
        "Escamas",
      ])
        if (has(victim, trait)) victimTraits.add(trait);
    if (has(victim, "Madeira")) {
      victimTraits.add("Madeira");
      if (has(attacker, "Roedor")) attackerTraits.add("Roedor");
    }
    if (monogamySurvivalBonus(state, victim) > 0)
      victimTraits.add("Monogamia");
  }

  if (has(victim, "Veneno")) victimTraits.add("Veneno");
  else if (has(victim, "Toxicidade")) victimTraits.add("Toxicidade");
  if (has(victim, "Fragmentação")) victimTraits.add("Fragmentação");
  if (has(victim, "Ooteca") && victim.oothecaPrimed)
    victimTraits.add("Ooteca");

  if (has(victim, "Camuflagem")) {
    const d = distance(attacker, victim),
      diagonalTegument =
        d === 1 &&
        Math.abs(attacker.r - victim.r) === 1 &&
        Math.abs(attacker.c - victim.c) === 1 &&
        (has(victim, "Pelos") || has(victim, "Penas"));
    if (d > 1 || diagonalTegument) {
      victimTraits.add("Camuflagem");
      if (diagonalTegument) {
        if (has(victim, "Pelos")) victimTraits.add("Pelos");
        if (has(victim, "Penas")) victimTraits.add("Penas");
      }
      if (has(attacker, "Visão Binocular"))
        attackerTraits.add("Visão Binocular");
    }
  }
}

export function contextualTraitsForBoard(state) {
  const byId = new Map(
    (state?.pieces ?? []).map((piece) => [piece.id, new Set()]),
  );
  if (!state) return byId;

  for (const piece of state.pieces ?? []) {
    const traits = byId.get(piece.id);
    addActiveStateTraits(state, piece, traits);
    if (
      !state.result &&
      state.phase === "move" &&
      piece.owner === state.current
    )
      for (const trait of actionableTraitsForPiece(state, piece))
        traits.add(trait);
    pruneRedundantActionTraits(state, piece, traits);
  }

  if (state.result || state.phase !== "move") return byId;

  const attackers = (state.pieces ?? []).filter(
    (piece) => piece.owner === state.current,
  );
  for (const attacker of attackers)
    for (const target of movesFor(state, attacker)) {
      if (!target.capture) continue;
      const victim = at(state, target.r, target.c);
      if (victim && victim.id !== attacker.id)
        markCaptureContext(state, attacker, victim, byId);
    }

  for (const victim of state.pieces ?? [])
    if (camouflageBlocksCurrentAttack(state, victim, attackers)) {
      const traits = byId.get(victim.id);
      traits?.add("Camuflagem");
      const diagonalThreat = attackers.some(
        (attacker) =>
          !has(attacker, "Visão Binocular") &&
          distance(attacker, victim) === 1 &&
          Math.abs(attacker.r - victim.r) === 1 &&
          Math.abs(attacker.c - victim.c) === 1,
      );
      if (diagonalThreat) {
        if (has(victim, "Pelos")) traits?.add("Pelos");
        if (has(victim, "Penas")) traits?.add("Penas");
      }
    }

  return byId;
}
