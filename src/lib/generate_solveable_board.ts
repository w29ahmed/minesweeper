/**
 * Solver-based board generation for "solvable up front" boards.
 *
 * High-level goal:
 * - Create a board after the first click that can be solved (ideally) without guessing.
 * - Keep the board static after generation so it feels fair and consistent.
 *
 * Approach summary:
 * 1) Generate a candidate board after the first click, excluding the safe cell.
 * 2) Enforce the safe cell is empty (adjacentBombCount == 0) so the player
 *    gets an initial clear region.
 * 3) Run a deterministic solver that only applies basic Minesweeper rules:
 *    - Let N = number on a revealed cell
 *    - Let F = flagged neighbors
 *    - Let U = unrevealed and unflagged neighbors
 *    - If N == F -> all U are safe (reveal them)
 *    - If N == F + U -> all U are bombs (flag them)
 *    Repeat until no progress can be made.
 * 4) If the solver reveals all non-bomb cells, the board is considered solvable
 *    and is accepted immediately.
 * 5) If no solvable board is found within the time budget, return the "best"
 *    candidate (highest score = reveals + flags) as a heuristic fallback.
 *
 * Practical safeguards:
 * - Time budget only (no attempt cap): generation runs until the budget expires,
 *   with at least one attempt guaranteed. This ensures the user doesn't feel any
 *   noticeable delay after the first click.
 * - Optional debug logging (JSON) captures: time spent, attempts, selection
 *   path (solved/best/safe/last), solver score, and safe cell adjacency.
 */
import { DIRECTIONS, inBounds, type Board, type Cell, type Position } from "./game";

export type GenerateOptions = {
  timeBudgetMs?: number;
  // When true, emit a JSON log describing the generation outcome.
  debug?: boolean;
};

type SolverResult = {
  solved: boolean;
  score: number;
};

/**
 * Generate a solvable board for the given dimensions and bomb count.
 */
export function generateSolvableBoard(
  rows: number,
  cols: number,
  bombs: number,
  safe: Position,
  options: GenerateOptions = {}
): Board {
  // 250ms is enough for the user to not feel any delay on the first reveal
  const timeBudgetMs = options.timeBudgetMs ?? 250;
  const debug = options.debug ?? false;
  const start = Date.now();
  let attempts = 0;

  let bestBoard: Board | null = null;
  let bestScore = -1;
  let bestScoreAttempt = 0;
  let lastBoard: Board | null = null;
  let lastSafeBoard: Board | null = null;
  let solvedBoard: Board | null = null;
  let solvedScore = 0;
  let solvedAttempt = 0;

  // Keep sampling boards until the time budget is exhausted.
  while (attempts === 0 || Date.now() - start < timeBudgetMs) {
    attempts += 1;

    const board = generateRandomBoard(rows, cols, bombs, safe);
    lastBoard = board;

    // Require the first click to be empty so the player gets a guaranteed region.
    if (board.cells[safe.row][safe.col].adjacentBombCount !== 0) {
      continue;
    }

    lastSafeBoard = board;

    const result = runSolver(board, safe);
    if (result.solved) {
      solvedBoard = board;
      solvedScore = result.score;
      solvedAttempt = attempts;
      break;
    }

    if (result.score > bestScore) {
      bestScore = result.score;
      bestScoreAttempt = attempts;
      bestBoard = board;
    }
  }

  const elapsedMs = Date.now() - start;
  // Prefer solved boards, otherwise fall back to the best-scoring candidate.
  let selectedBoard = solvedBoard ?? bestBoard ?? lastSafeBoard ?? lastBoard;
  let selection: "solved" | "best" | "safe" | "last" = "last";
  let selectionScore: number | null = null;

  if (solvedBoard) {
    selection = "solved";
    selectionScore = solvedScore;
  } else if (bestBoard) {
    selection = "best";
    selectionScore = bestScore;
  } else if (lastSafeBoard) {
    selection = "safe";
  }

  // Print results of the search in debug mode for inspection
  if (debug) {
    const bombTotal = selectedBoard ? countBombs(selectedBoard) : 0;
    const safeAdj =
      selectedBoard?.cells[safe.row]?.[safe.col]?.adjacentBombCount ?? null;
    const attemptsNote =
      selection === "solved"
        ? solvedAttempt
        : selection === "best"
          ? bestScoreAttempt
          : attempts;
    const payload = {
      rows,
      cols,
      bombs: bombTotal,
      safe,
      safeAdj,
      selection,
      score: selectionScore,
      attempts,
      attemptsForSelection: attemptsNote,
      timeBudgetMs,
      elapsedMs,
    };
    console.info(`[minesweeper] generateSolvableBoard ${JSON.stringify(payload)}`);
  }

  if (selectedBoard) {
    return selectedBoard;
  }

  return generateRandomBoard(rows, cols, bombs, safe);
}

/**
 * Build a random board with bombs placed, excluding the safe cell.
 */
function generateRandomBoard(
  rows: number,
  cols: number,
  bombs: number,
  safe: Position
): Board {
  const board = createEmptyBoard(rows, cols);
  const candidates: Position[] = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (row === safe.row && col === safe.col) {
        continue;
      }
      candidates.push({ row, col });
    }
  }

  // Shuffle candidates and pick the first N for bomb placement.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  for (let i = 0; i < bombs && i < candidates.length; i += 1) {
    const { row, col } = candidates[i];
    board.cells[row][col].isBomb = true;
  }

  computeAdjacency(board);
  return board;
}

/**
 * Compute adjacent bomb counts for all non-bomb cells.
 */
function computeAdjacency(board: Board) {
  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      const cell = board.cells[row][col];
      if (cell.isBomb) {
        continue;
      }
      let count = 0;
      for (const [dRow, dCol] of DIRECTIONS) {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (inBounds(board.rows, board.cols, nRow, nCol) && board.cells[nRow][nCol].isBomb) {
          count += 1;
        }
      }
      cell.adjacentBombCount = count;
    }
  }
}

/**
 * Run a deterministic solver and return whether the board is solvable
 * and how many forced moves were possible (score = reveals + flags).
 */
function runSolver(board: Board, safe: Position): SolverResult {
  // Working state for the solver: we track what it has revealed/flagged so the
  // algorithm doesn't mutate the real board or depend on UI state.
  const revealed = Array.from({ length: board.rows }, () =>
    Array.from({ length: board.cols }, () => false)
  );
  const flagged = Array.from({ length: board.rows }, () =>
    Array.from({ length: board.cols }, () => false)
  );

  // Counters used to compute the heuristic score and solvability condition.
  let revealedCount = 0;
  let flaggedCount = 0;
  const totalSafe = board.rows * board.cols - countBombs(board);

  // Seed the solver with the first safe reveal.
  revealedCount += revealAt(board, revealed, flagged, safe.row, safe.col);

  // Keep applying deterministic rules until no new reveals/flags are found.
  let progress = true;
  while (progress) {
    progress = false;
    const toReveal: Position[] = [];
    const toFlag: Position[] = [];

    // Scan revealed numbers and collect forced actions.
    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.cols; col += 1) {
        if (!revealed[row][col]) {
          continue;
        }
        const cell = board.cells[row][col];
        let flags = 0;
        const unknowns: Position[] = [];

        // Count flagged neighbors and collect unknown neighbors.
        for (const [dRow, dCol] of DIRECTIONS) {
          const nRow = row + dRow;
          const nCol = col + dCol;
          if (!inBounds(board.rows, board.cols, nRow, nCol)) {
            continue;
          }
          if (flagged[nRow][nCol]) {
            flags += 1;
          } else if (!revealed[nRow][nCol]) {
            unknowns.push({ row: nRow, col: nCol });
          }
        }

        if (!unknowns.length) {
          continue;
        }

        // Apply the two classic Minesweeper deduction rules.
        // If the number is satisfied, remaining neighbors are safe.
        if (cell.adjacentBombCount === flags) {
          toReveal.push(...unknowns);
          // If all unknowns must be bombs, flag them.
        } else if (cell.adjacentBombCount === flags + unknowns.length) {
          toFlag.push(...unknowns);
        }
      }
    }

    // Apply flags first so reveals can use the updated constraints.
    for (const pos of toFlag) {
      if (flagged[pos.row][pos.col] || revealed[pos.row][pos.col]) {
        continue;
      }
      flagged[pos.row][pos.col] = true;
      flaggedCount += 1;
      progress = true;
    }

    // Reveal any cells proven safe by the rules.
    for (const pos of toReveal) {
      const added = revealAt(board, revealed, flagged, pos.row, pos.col);
      if (added > 0) {
        revealedCount += added;
        progress = true;
      }
    }
  }

  return {
    solved: revealedCount >= totalSafe,
    score: revealedCount + flaggedCount,
  };
}

/**
 * Reveal a cell using standard Minesweeper flood rules.
 * Returns the number of newly revealed cells.
 */
function revealAt(
  board: Board,
  revealed: boolean[][],
  flagged: boolean[][],
  row: number,
  col: number
) {
  if (revealed[row][col] || flagged[row][col]) {
    return 0;
  }
  const cell = board.cells[row][col];
  if (cell.isBomb) {
    return 0;
  }

  let revealedCount = 0;
  const queue: Position[] = [{ row, col }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const { row: r, col: c } = current;
    if (revealed[r][c] || flagged[r][c]) {
      continue;
    }
    const currentCell = board.cells[r][c];
    if (currentCell.isBomb) {
      continue;
    }

    revealed[r][c] = true;
    revealedCount += 1;

    if (currentCell.adjacentBombCount !== 0) {
      continue;
    }

    for (const [dRow, dCol] of DIRECTIONS) {
      const nRow = r + dRow;
      const nCol = c + dCol;
      if (inBounds(board.rows, board.cols, nRow, nCol) && !revealed[nRow][nCol]) {
        queue.push({ row: nRow, col: nCol });
      }
    }
  }

  return revealedCount;
}

/**
 * Count total bombs in the board.
 */
function countBombs(board: Board) {
  let count = 0;
  for (const row of board.cells) {
    for (const cell of row) {
      if (cell.isBomb) {
        count += 1;
      }
    }
  }
  return count;
}

/**
 * Create a new empty board with default cell state.
 */
function createEmptyBoard(rows: number, cols: number): Board {
  const cells: Cell[][] = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      isBomb: false,
      adjacentBombCount: 0,
      revealed: false,
      flagged: false,
      revealStep: null,
    }))
  );

  return { rows, cols, cells };
}
