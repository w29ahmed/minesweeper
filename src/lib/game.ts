/**
 * Core Minesweeper game logic and data structures.
 * Functions here are UI-agnostic and operate on plain board state.
 */

export type Cell = {
  row: number;
  col: number;
  isBomb: boolean;
  adjacentBombCount: number;
  revealed: boolean;
  flagged: boolean;
  // Used to stagger reveal animations in a flood-fill
  revealStep: number | null;
};

export type Board = Cell[][];

export type Position = {
  row: number;
  col: number;
};

export const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

/**
 * Create a size x size board with no bombs and default cell state.
 */
export function createEmptyBoard(size: number): Board {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      isBomb: false,
      adjacentBombCount: 0,
      revealed: false,
      flagged: false,
      // Used to stagger reveal animations in a flood-fill.
      revealStep: null,
    }))
  );
}

/**
 * Deep-clone a board so mutations don't affect the original.
 */
function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

/**
 * Guard for row/col bounds checks.
 */
function inBounds(size: number, row: number, col: number) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

/**
 * Generate a board with bombs placed randomly, excluding the safe position.
 */
export function generateBoard(size: number, bombs: number, safe: Position): Board {
  const board = createEmptyBoard(size);
  const candidates: Position[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
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
    board[row][col].isBomb = true;
  }

  // Compute adjacent bomb counts for non-bomb tiles.
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (board[row][col].isBomb) {
        continue;
      }
      let count = 0;
      for (const [dRow, dCol] of DIRECTIONS) {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (inBounds(size, nRow, nCol) && board[nRow][nCol].isBomb) {
          count += 1;
        }
      }
      board[row][col].adjacentBombCount = count;
    }
  }

  return board;
}

/**
 * Toggle a flag on a cell and return the new board plus delta for flag count.
 */
export function toggleFlag(board: Board, row: number, col: number) {
  const next = cloneBoard(board);
  const cell = next[row][col];

  if (cell.revealed) {
    return { board: next, delta: 0 };
  }

  cell.flagged = !cell.flagged;
  return { board: next, delta: cell.flagged ? 1 : -1 };
}

/**
 * Reveal a cell and flood-fill empty neighbors.
 * Returns the updated board and the list of positions revealed.
 */
export function revealCell(board: Board, row: number, col: number) {
  const next = cloneBoard(board);
  const size = next.length;
  const start = next[row][col];
  const revealed: Position[] = [];

  if (start.revealed || start.flagged) {
    return { board: next, revealed };
  }

  if (start.isBomb) {
    start.revealed = true;
    start.revealStep = 0;
    revealed.push({ row, col });
    return { board: next, revealed };
  }

  if (start.adjacentBombCount > 0) {
    start.revealed = true;
    start.revealStep = 0;
    revealed.push({ row, col });
    return { board: next, revealed };
  }

  // Flood-fill to reveal empty neighbors.
  const queue: Array<Position & { dist: number }> = [{ row, col, dist: 0 }];

  while (queue.length) {
    const current = queue.shift();
    if (!current) {
      continue;
    }
    const cell = next[current.row][current.col];
    if (cell.revealed || cell.flagged) {
      continue;
    }

    cell.revealed = true;
    cell.revealStep = current.dist;
    revealed.push({ row: current.row, col: current.col });

    if (cell.adjacentBombCount !== 0) {
      continue;
    }

    for (const [dRow, dCol] of DIRECTIONS) {
      const nRow = current.row + dRow;
      const nCol = current.col + dCol;
      if (inBounds(size, nRow, nCol)) {
        const neighbor = next[nRow][nCol];
        if (!neighbor.revealed && !neighbor.flagged && !neighbor.isBomb) {
          queue.push({ row: nRow, col: nCol, dist: current.dist + 1 });
        }
      }
    }
  }

  return { board: next, revealed };
}
