import type { GameState } from "../lib/game";

export type PersistedState = {
  game: GameState;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed: number;
};

// Single localStorage entry to restore the board, timer, and stats on reload.
const STORAGE_KEY = "minesweeper:state:v1";

export function loadGameState(): PersistedState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export function saveGameState(state: PersistedState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
