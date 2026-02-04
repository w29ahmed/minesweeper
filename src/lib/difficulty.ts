/**
 * Difficulty sizing helpers.
 *
 * This module maps a difficulty level to a target cell-size percentage and
 * bomb density, then computes a board size based on the viewport (minus the
 * navbar height). The key idea is:
 * - Higher difficulty -> smaller cell percentage (more cells on screen).
 * - Higher difficulty -> higher bomb percentage (more dense board).
 * - On compact screens we use tighter percentages plus per-difficulty
 *   minimum cell sizes to keep tap targets usable while still scaling difficulty.
 * - Clamp cell size and board dimensions so mobile taps stay usable.
 *
 * The board size is computed once at startup and stays fixed for the session, until
 * a new game begins via restart.
 */
export type Difficulty = "easy" | "medium" | "hard";

export type DifficultySettings = {
  cellPct: number;
  bombPct: number;
  minCellPx: number;
  mobileCellPct: number;
  mobileMinCellPx: number;
};

export type BoardConfig = {
  rows: number;
  cols: number;
  bombs: number;
  cellPx: number;
  boardWidth: number;
  boardHeight: number;
};

export type BoardConfigOptions = {
  difficulty: Difficulty;
  viewportWidth: number;
  viewportHeight: number;
  navHeight: number;
  maxCellPx?: number;
  minRows?: number;
  maxRows?: number;
};

const DIFFICULTY_SETTINGS: Record<Difficulty, DifficultySettings> = {
  easy: {
    cellPct: 0.075,
    bombPct: 0.15,
    minCellPx: 34,
    mobileCellPct: 0.085,
    mobileMinCellPx: 36,
  },
  medium: {
    cellPct: 0.06,
    bombPct: 0.2,
    minCellPx: 30,
    mobileCellPct: 0.06,
    mobileMinCellPx: 30,
  },
  hard: {
    cellPct: 0.05,
    bombPct: 0.28,
    minCellPx: 28,
    mobileCellPct: 0.045,
    mobileMinCellPx: 26,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute board dimensions and bomb count based on the viewport and difficulty.
 * The board size is derived once at startup (no resize tracking).
 */
export function computeBoardConfig(options: BoardConfigOptions): BoardConfig {
  const {
    difficulty,
    viewportWidth,
    viewportHeight,
    navHeight,
    maxCellPx = 56,
    minRows = 8,
    maxRows = 40,
  } = options;

  const settings = DIFFICULTY_SETTINGS[difficulty];
  const isCompact = Math.min(viewportWidth, viewportHeight) < 500;
  const boardWidth = Math.max(0, viewportWidth);
  const boardHeight = Math.max(0, viewportHeight - navHeight);
  const cellPct = isCompact ? settings.mobileCellPct : settings.cellPct;
  const minCellPx = isCompact ? settings.mobileMinCellPx : settings.minCellPx;
  const targetCellPx = Math.min(boardWidth, boardHeight) * cellPct;
  const cellPx = clamp(targetCellPx, minCellPx, maxCellPx);

  const cols = clamp(Math.floor(boardWidth / cellPx), minRows, maxRows);
  const rows = clamp(Math.floor(boardHeight / cellPx), minRows, maxRows);
  const bombs = Math.round(rows * cols * settings.bombPct);

  return {
    rows,
    cols,
    bombs,
    cellPx,
    boardWidth,
    boardHeight,
  };
}
