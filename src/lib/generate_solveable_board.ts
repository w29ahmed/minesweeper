/**
 * Solver-based board generation for "solvable up front" boards.
 *
 * Goal:
 * - Create a board after the first click that is solvable without guessing.
 * - Keep the board static after generation so it feels fair and consistent.
 *
 * Pipeline overview:
 * 1) Generate a candidate board after the first click. The safe cell and its
 *    8 neighbors are bomb-free so the first click opens space.
 * 2) Run a deterministic solver with two phases:
 *    - Basic rules (always applied):
 *      * If a revealed number already has all its bombs flagged, the remaining
 *        neighbors are safe.
 *      * If the number equals flagged + unknown neighbors, those unknowns are bombs.
 *    - Subset rule (only if the basic rules stall):
 *      * If one revealed number's unknown neighbors are completely contained
 *        inside another revealed number's unknown neighbors, the "extra" cells
 *        in the larger group can be deduced as all safe or all bombs.
 * 3) If the solver can reveal all safe cells, accept the board immediately.
 * 4) Otherwise keep the best-scoring candidate (reveals + flags).
 *
 * Mutation search (genetic-style improvement):
 * - Once a best board exists, generate children by swapping bombs with safe
 *   cells (bomb count fixed). This explores nearby layouts while keeping good structure.
 * - If no improvement occurs for `mutationPatience` mutations, restart from a
 *   fully random board to avoid local minima.
 *
 * Tuning parameters:
 * - `mutationSwapPercent`: percentage of bombs swapped per mutation (default 5%).
 * - `mutationPatience`: number of non-improving mutations before restart (default 100).
 *
 * Safeguards:
 * - Time-budgeted search (no hard attempt cap) to keep first-click latency low.
 * - Optional debug logging prints search outcomes and percent solved.
 */
import { DIRECTIONS, inBounds, type Board, type Cell, type Position } from "./game";

export type GenerateOptions = {
  timeBudgetMs?: number;
  // Percentage of bombs to swap when mutating a parent board (0-100).
  mutationSwapPercent?: number;
  // Number of non-improving mutations to allow before restarting from scratch.
  mutationPatience?: number;
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
  const mutationSwapPercent = options.mutationSwapPercent ?? 3;
  const mutationPatience = options.mutationPatience ?? 100;
  const debug = options.debug ?? false;
  const start = Date.now();
  let attempts = 0;
  let noImproveCount = 0;
  let parentBoard: Board | null = null;

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

    if (parentBoard && noImproveCount >= mutationPatience) {
      parentBoard = null;
      noImproveCount = 0;
    }

    const normalizedPercent = Math.max(0, mutationSwapPercent);
    const swapCount = Math.max(1, Math.ceil((bombs * normalizedPercent) / 100));
    const board =
      parentBoard
        ? mutateBoard(parentBoard, safe, swapCount) ??
          generateRandomBoard(rows, cols, bombs, safe)
        : generateRandomBoard(rows, cols, bombs, safe);

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
      parentBoard = board;
      noImproveCount = 0;
    } else {
      noImproveCount += 1;
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
    const selectionAttempt =
      selection === "solved"
        ? solvedAttempt
        : selection === "best"
          ? bestScoreAttempt
          : attempts;
    const percentSolved =
      selectionScore === null
        ? null
        : Math.round((selectionScore / (rows * cols)) * 1000) / 10;
    const payload = {
      rows,
      cols,
      bombs: bombTotal,
      selection,
      score: selectionScore,
      percentSolved,
      attempts,
      selectionAttempt,
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
 * Returns true if a cell is inside the safe zone (first click + 8 neighbors).
 */
function isInSafeZone(row: number, col: number, safe: Position) {
  return Math.abs(row - safe.row) <= 1 && Math.abs(col - safe.col) <= 1;
}

/**
 * Copy only the bomb layout from a parent board into a fresh board.
 */
function cloneBombLayout(parent: Board): Board {
  const board = createEmptyBoard(parent.rows, parent.cols);
  for (let row = 0; row < parent.rows; row += 1) {
    for (let col = 0; col < parent.cols; col += 1) {
      if (parent.cells[row][col].isBomb) {
        board.cells[row][col].isBomb = true;
      }
    }
  }
  return board;
}

/**
 * Create a mutated child board by swapping bombs with safe cells.
 */
function mutateBoard(parent: Board, safe: Position, swapCount: number): Board | null {
  if (swapCount <= 0) {
    return null;
  }

  const board = cloneBombLayout(parent);
  const bombPositions: Position[] = [];
  const safePositions: Position[] = [];

  for (let row = 0; row < board.rows; row += 1) {
    for (let col = 0; col < board.cols; col += 1) {
      if (isInSafeZone(row, col, safe)) {
        continue;
      }
      if (board.cells[row][col].isBomb) {
        bombPositions.push({ row, col });
      } else {
        safePositions.push({ row, col });
      }
    }
  }

  if (bombPositions.length < swapCount || safePositions.length < swapCount) {
    return null;
  }

  for (let i = 0; i < swapCount; i += 1) {
    const bombIndex = Math.floor(Math.random() * bombPositions.length);
    const bombPos = bombPositions[bombIndex];
    bombPositions[bombIndex] = bombPositions[bombPositions.length - 1];
    bombPositions.pop();

    const safeIndex = Math.floor(Math.random() * safePositions.length);
    const safePos = safePositions[safeIndex];
    safePositions[safeIndex] = safePositions[safePositions.length - 1];
    safePositions.pop();

    board.cells[bombPos.row][bombPos.col].isBomb = false;
    board.cells[safePos.row][safePos.col].isBomb = true;
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
 * Includes the subset rule to model stronger human deductions.
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
    const constraints: Constraint[] = [];

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

        // Track constraints for subset-based deductions.
        const remaining = cell.adjacentBombCount - flags;
        if (remaining >= 0) {
          constraints.push({ unknowns, remaining });
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

    // If basic rules stalled, apply subset rule on frontier constraints
    // (frontier = revealed number cells that still touch unknown neighbors).
    if (!toReveal.length && !toFlag.length && constraints.length > 1) {
      const subset = applySubsetRule(constraints);
      if (subset.safe.length || subset.bombs.length) {
        toReveal.push(...subset.safe);
        toFlag.push(...subset.bombs);
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

type Constraint = {
  unknowns: Position[];
  remaining: number;
};

/**
 * Subset rule:
 * If constraint A's unknowns are a strict subset of constraint B's unknowns,
 * the difference set can be deduced as all safe or all bombs.
 */
function applySubsetRule(constraints: Constraint[]) {
  const safe = new Map<string, Position>();
  const bombs = new Map<string, Position>();

  // Convert unknown neighbor lists into sets of string keys for fast inclusion checks.
  const toKey = (pos: Position) => `${pos.row}-${pos.col}`;
  const sets = constraints.map((constraint) => ({
    remaining: constraint.remaining,
    positions: constraint.unknowns,
    keys: new Set(constraint.unknowns.map(toKey)),
  }));

  // Compare every pair to find cases where one unknown set is fully contained in another.
  for (let i = 0; i < sets.length; i += 1) {
    const a = sets[i];
    if (!a.keys.size) {
      continue;
    }
    for (let j = 0; j < sets.length; j += 1) {
      if (i === j) {
        continue;
      }
      const b = sets[j];
      if (a.keys.size >= b.keys.size) {
        continue;
      }

      // If every unknown in A also appears in B, then A is a strict subset of B.
      let isSubset = true;
      for (const key of a.keys) {
        if (!b.keys.has(key)) {
          isSubset = false;
          break;
        }
      }
      if (!isSubset) {
        continue;
      }

      // The cells that are in B but not in A are the ones we can deduce about.
      const diff: Position[] = [];
      for (const pos of b.positions) {
        if (!a.keys.has(toKey(pos))) {
          diff.push(pos);
        }
      }

      if (!diff.length) {
        continue;
      }

      // If B needs the same number of bombs as A, the extra cells are safe.
      // If B needs exactly "diff length" more bombs than A, the extra cells are all bombs.
      const remainingDiff = b.remaining - a.remaining;
      if (remainingDiff < 0) {
        continue;
      }

      if (remainingDiff === 0) {
        for (const pos of diff) {
          safe.set(toKey(pos), pos);
        }
      } else if (remainingDiff === diff.length) {
        for (const pos of diff) {
          bombs.set(toKey(pos), pos);
        }
      }
    }
  }

  return {
    safe: Array.from(safe.values()),
    bombs: Array.from(bombs.values()),
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
