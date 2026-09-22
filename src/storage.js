import { assertState } from "./state.js";
import { STATE_VERSION } from "./constants.js";

export const SAVE_KEY = `xadrez-evolutivo-save-v${STATE_VERSION}`;

export function deserialize(raw) {
  if (typeof raw !== "string" || raw.length > 2_000_000)
    throw Error("Arquivo de partida inválido.");
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw Error("Arquivo de partida inválido.");
  }
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
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) throw Error("Nenhuma partida salva nesta versão.");
  return deserialize(raw);
}
