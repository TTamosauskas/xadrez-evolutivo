import { createArenaState, assertState } from "../src/state.js";
import { transition } from "../src/engine.js";
import { chooseAction } from "../src/ai.js";
import { completeArenaBranchGenome } from "../src/arena.js";

const TURN_LIMIT = 200;
const COMMAND_LIMIT = 4000;

const animalGenome = (bodyPlan) =>
  completeArenaBranchGenome(
    [
      "Predação",
      "Multicelularismo",
      "Ingestão",
      "Respiração aeróbia",
      "Locomoção Primitiva",
      "Simetria Bilateral",
      bodyPlan,
      "Locomoção Articulada",
      "Percepção Espacial",
      "Carnívoro",
    ],
    "animal",
  );

const plantGenome = completeArenaBranchGenome(
  [
    "Fotossíntese",
    "Multicelularismo",
    "Embriófitas",
    "Traqueófitas",
    "Estômatos",
  ],
  "plant",
);

const lineagePopulation = (state, plan) =>
  state.pieces.filter((piece) => (piece.ancestry ?? []).includes(plan)).length;

const lineageMaxRank = (state, plan) =>
  Math.max(
    -1,
    ...state.pieces
      .filter((piece) => (piece.ancestry ?? []).includes(plan))
      .map((piece) => piece.rank),
  );

export function runBodyPlanCohort(start, end) {
  const summary = {
    start,
    end,
    games: 0,
    vertebrateWins: 0,
    arthropodWins: 0,
    draws: 0,
    over200: 0,
    technicalCaps: 0,
    decisiveTurns: [],
    vertebrateWinTurns: [],
    arthropodWinTurns: [],
    byColor: {
      vertebrateBlueWins: 0,
      vertebrateAmberWins: 0,
      arthropodBlueWins: 0,
      arthropodAmberWins: 0,
    },
    finalPopulationTotals: { Vertebrado: 0, "Artrópode": 0 },
    maxPopulationTotals: { Vertebrado: 0, "Artrópode": 0 },
    maxRankSeen: { Vertebrado: 0, "Artrópode": 0 },
  };

  for (let seed = start; seed <= end; seed++) {
    for (const orientation of [0, 1]) {
      const ownerPlan =
          orientation === 0
            ? { blue: "Vertebrado", amber: "Artrópode" }
            : { blue: "Artrópode", amber: "Vertebrado" },
        stateSeed = seed,
        ownerGenomes = {
          blue: [animalGenome(ownerPlan.blue), plantGenome],
          amber: [animalGenome(ownerPlan.amber), plantGenome],
        },
        ownerRanks = {
          blue: [2, 4],
          amber: [2, 4],
        };

      let state = createArenaState(ownerGenomes, stateSeed, null, ownerRanks),
        commands = 0,
        maxPop = {
          Vertebrado: lineagePopulation(state, "Vertebrado"),
          "Artrópode": lineagePopulation(state, "Artrópode"),
        },
        maxRank = {
          Vertebrado: lineageMaxRank(state, "Vertebrado"),
          "Artrópode": lineageMaxRank(state, "Artrópode"),
        };

      summary.games++;

      while (
        !state.result &&
        state.turn < TURN_LIMIT &&
        commands < COMMAND_LIMIT
      ) {
        const action = state.notices.length
          ? { type: "ACK_NOTICE", id: state.notices[0].id }
          : chooseAction(state, "hard", { budget: 5, maxNodes: 30 });
        state = transition(state, action);
        assertState(state);
        commands++;
        for (const plan of ["Vertebrado", "Artrópode"]) {
          maxPop[plan] = Math.max(maxPop[plan], lineagePopulation(state, plan));
          maxRank[plan] = Math.max(maxRank[plan], lineageMaxRank(state, plan));
        }
      }

      for (const plan of ["Vertebrado", "Artrópode"]) {
        summary.finalPopulationTotals[plan] += lineagePopulation(state, plan);
        summary.maxPopulationTotals[plan] += maxPop[plan];
        summary.maxRankSeen[plan] = Math.max(summary.maxRankSeen[plan], maxRank[plan]);
      }

      if (
        commands >= COMMAND_LIMIT &&
        !state.result &&
        state.turn < TURN_LIMIT
      ) {
        summary.technicalCaps++;
        continue;
      }
      if (!state.result) {
        summary.over200++;
        continue;
      }
      if (!state.result.winner) {
        summary.draws++;
        continue;
      }

      const winningPlan = ownerPlan[state.result.winner];
      summary.decisiveTurns.push(state.turn);
      if (winningPlan === "Vertebrado") {
        summary.vertebrateWins++;
        summary.vertebrateWinTurns.push(state.turn);
        if (state.result.winner === "blue")
          summary.byColor.vertebrateBlueWins++;
        else summary.byColor.vertebrateAmberWins++;
      } else {
        summary.arthropodWins++;
        summary.arthropodWinTurns.push(state.turn);
        if (state.result.winner === "blue")
          summary.byColor.arthropodBlueWins++;
        else summary.byColor.arthropodAmberWins++;
      }
    }
  }

  return summary;
}
