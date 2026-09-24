import { assertState } from "./state.js";
import { STATE_VERSION } from "./constants.js";
import { normalizeGenome } from "./genetics.js";

export const SAVE_KEY = `xadrez-evolutivo-save-v${STATE_VERSION}`;
const LEGACY_SAVE_VERSION = 17;
const LEGACY_SAVE_KEY = `xadrez-evolutivo-save-v${LEGACY_SAVE_VERSION}`;

function normalizeStoredGenomes(value) {
  if (!value || typeof value !== "object") return;
  if (Object.hasOwn(value, "genome"))
    value.genome = normalizeGenome(value.genome, value);
  for (const child of Object.values(value)) {
    if (child === value.genome) continue;
    if (Array.isArray(child))
      for (const item of child) normalizeStoredGenomes(item);
    else if (child && typeof child === "object")
      normalizeStoredGenomes(child);
  }
}

function restoreLegacyResidueTerrain(state) {
  const residues = [
    ...(state.deathSites ?? []),
    ...(state.fertileTraces ?? []),
  ];
  for (const residue of residues) {
    if (!Number.isInteger(residue?.cell)) continue;
    const base = ["neutral", "fertile", "hostile"].includes(residue.base)
      ? residue.base
      : "neutral";
    if (state.event?.hazards?.includes(residue.cell))
      state.event.snapshots[residue.cell] = base;
    else if (Array.isArray(state.board) && residue.cell < state.board.length)
      state.board[residue.cell] = base;
  }
}

function migrateV17(data) {
  const state = structuredClone(data);
  restoreLegacyResidueTerrain(state);
  state.version = STATE_VERSION;
  state.deathSites = [];
  state.fertileTraces = [];
  state.carcasses = [];
  state.captureDisturbances = [];
  if (state.event) state.event.lethalHazards ??= [];
  for (const piece of state.pieces ?? []) delete piece.decompositionImmunity;
  normalizeStoredGenomes(state);
  return state;
}

export function deserialize(raw) {
  if (typeof raw !== "string" || raw.length > 2_000_000)
    throw Error("Arquivo de partida inválido.");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw Error("Arquivo de partida inválido.");
  }
  if (data?.version === LEGACY_SAVE_VERSION)
    return assertState(migrateV17(data));
  if (data?.version !== STATE_VERSION)
    throw Error(
      `Save incompatível com esta versão de desenvolvimento. Inicie uma nova partida na versão ${STATE_VERSION}.`,
    );
  return assertState(data);
}

export function save(storage, state) {
  assertState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function load(storage) {
  const current = storage.getItem(SAVE_KEY);
  if (current) return deserialize(current);
  const legacy = storage.getItem(LEGACY_SAVE_KEY);
  if (!legacy) throw Error("Nenhuma partida salva nesta versão.");
  const migrated = deserialize(legacy);
  storage.setItem(SAVE_KEY, JSON.stringify(migrated));
  return migrated;
}
