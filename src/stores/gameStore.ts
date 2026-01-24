import type { Board } from "../lib/game";

export type GameState = {
  board: Board;
  flagsPlaced: number;
  elapsedSeconds: number;
  hasStarted: boolean;
  boardSize: number;
  bombCount: number;
};

// Single localStorage entry to restore the board, timer, and flags on reload.
const STORAGE_KEY = "minesweeper:state:v1";

export function loadGameState(): GameState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function saveGameState(state: GameState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
