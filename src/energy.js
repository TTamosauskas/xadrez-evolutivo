import {
  ENERGY_CAPACITIES,
  MOVEMENT_ENERGY_COSTS,
  REPRODUCTION_ENERGY_COSTS,
} from "./constants.js";

const hasTrait = (piece, trait) => piece?.traits?.includes(trait) ?? false;

export function movementEnergyCost(piece) {
  return MOVEMENT_ENERGY_COSTS[piece?.rank] ?? MOVEMENT_ENERGY_COSTS[0];
}

export function reproductionEnergyCost(piece) {
  return (
    REPRODUCTION_ENERGY_COSTS[piece?.rank] ??
    REPRODUCTION_ENERGY_COSTS[0]
  );
}

export function energyCapacity(piece) {
  const base = ENERGY_CAPACITIES[piece?.rank] ?? ENERGY_CAPACITIES[0];
  return base + (hasTrait(piece, "Endorfinas") ? movementEnergyCost(piece) : 0);
}

export function energyValue(piece) {
  if (!piece) return 0;
  if (!Number.isFinite(piece.energy)) return energyCapacity(piece);
  return Math.min(energyCapacity(piece), piece.energy);
}

export function normalizeEnergy(piece) {
  if (!piece) return 0;
  piece.energy = Math.min(energyCapacity(piece), energyValue(piece));
  return piece.energy;
}

export function energyDebt(piece) {
  return Math.max(0, -energyValue(piece));
}

export function canSpendEnergy(piece, cost) {
  return energyValue(piece) >= Math.max(0, cost ?? 0);
}

export function spendEnergy(piece, cost, turn = null) {
  const amount = Math.max(0, cost ?? 0);
  if (!canSpendEnergy(piece, amount)) return false;
  piece.energy = energyValue(piece) - amount;
  if (Number.isInteger(turn)) piece.lastEnergySpendTurn = turn;
  return true;
}

export function applyEnergyDelta(piece, delta, turn = null) {
  if (!piece || !Number.isFinite(delta) || delta === 0) return energyValue(piece);
  piece.energy = Math.min(energyCapacity(piece), energyValue(piece) + delta);
  if (delta < 0 && Number.isInteger(turn)) piece.lastEnergySpendTurn = turn;
  return piece.energy;
}

export function restoreEnergy(piece, amount = 1) {
  return applyEnergyDelta(piece, Math.max(0, amount));
}

export function reproductionEnergyShortfall(piece) {
  return Math.max(0, reproductionEnergyCost(piece) - energyValue(piece));
}

export function canAffordReproduction(piece) {
  return reproductionEnergyShortfall(piece) === 0;
}

export function canAdvanceReproductionWithEndosymbiosis(piece) {
  return (
    hasTrait(piece, "Endossimbiose") &&
    reproductionEnergyShortfall(piece) === 1 &&
    !piece.endosymbiosisEnergyDebt
  );
}

export function energyReadyForReproduction(piece) {
  return (
    canAffordReproduction(piece) ||
    canAdvanceReproductionWithEndosymbiosis(piece)
  );
}
