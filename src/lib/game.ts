export type Cell = {
  row: number;
  col: number;
  isBomb: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
  revealStep: number | null;
};

export type Board = Cell[][];

export type Position = {
  row: number;
  col: number;
};

const DIRECTIONS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function createEmptyBoard(size: number): Board {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => ({
      row,
      col,
      isBomb: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
      // Used to stagger reveal animations in a flood-fill.
      revealStep: null,
    }))
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function inBounds(size: number, row: number, col: number) {
  return row >= 0 && row < size && col >= 0 && col < size;
}

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
      board[row][col].adjacent = count;
    }
  }

  return board;
}

export function toggleFlag(board: Board, row: number, col: number) {
  const next = cloneBoard(board);
  const cell = next[row][col];

  if (cell.revealed) {
    return { board: next, delta: 0 };
  }

  cell.flagged = !cell.flagged;
  return { board: next, delta: cell.flagged ? 1 : -1 };
}

export function revealCell(board: Board, row: number, col: number) {
  const next = cloneBoard(board);
  const size = next.length;
  const start = next[row][col];

  if (start.revealed || start.flagged) {
    return next;
  }

  if (start.isBomb) {
    start.revealed = true;
    start.revealStep = 0;
    return next;
  }

  if (start.adjacent > 0) {
    start.revealed = true;
    start.revealStep = 0;
    return next;
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

    if (cell.adjacent !== 0) {
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

  return next;
}
