import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Everything we need to remember between runs so we only post NEW things.
export type State = {
  started: boolean; // posted the one-time "online" confirmation yet
  steamSeen: Record<string, string[]>; // appid -> recent news gids (capped)
  steamSeeded: Record<string, boolean>; // appid -> first run done
  epicPosted: string[]; // Epic offer ids already announced
};

const EMPTY: State = { started: false, steamSeen: {}, steamSeeded: {}, epicPosted: [] };

export function loadState(file: string): State {
  try {
    return { ...EMPTY, ...(JSON.parse(readFileSync(file, "utf8")) as Partial<State>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

export function saveState(file: string, state: State): void {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state, null, 2));
}
