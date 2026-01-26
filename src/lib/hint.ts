/**
 * Hint utilities and edge-candidate tracking for the Minesweeper board.
 * We maintain a set of edge candidates (unrevealed non-empty neighbors of revealed cells)
 * and update it incrementally after each move, so hints are O(1) to pick without rescanning.
 */
import { DIRECTIONS, inBounds, type Board, type Position } from "./game";

export type EdgeCandidates = Set<string>;

/**
 * Convert row/col to a stable string key for Set membership.
 */
export function keyFor(row: number, col: number) {
  return `${row}-${col}`;
}

/**
 * Convert a key back into a position.
 */
export function parseKey(key: string): Position {
  const [row, col] = key.split("-").map(Number);
  return { row, col };
}

/**
 * Determine whether an unrevealed cell has any revealed neighbor.
 */
export function hasRevealedNeighbor(board: Board, size: number, row: number, col: number) {
  for (const [dRow, dCol] of DIRECTIONS) {
    const nRow = row + dRow;
    const nCol = col + dCol;
    if (inBounds(size, nRow, nCol) && board[nRow][nCol].revealed) {
      return true;
    }
  }
  return false;
}

/**
 * Build a fresh set of edge candidates by scanning revealed cells.
 * Used on load to reconstruct the candidate set from saved state.
 */
export function buildEdgeCandidates(board: Board, size: number): EdgeCandidates {
  const next = new Set<string>();
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = board[row][col];
      if (!cell.revealed) {
        continue;
      }
      for (const [dRow, dCol] of DIRECTIONS) {
        const nRow = row + dRow;
        const nCol = col + dCol;
        if (!inBounds(size, nRow, nCol)) {
          continue;
        }
        const neighbor = board[nRow][nCol];
        if (
          !neighbor.revealed &&
          !neighbor.flagged &&
          (neighbor.isBomb || neighbor.adjacentBombCount > 0)
        ) {
          next.add(keyFor(nRow, nCol));
        }
      }
    }
  }
  return next;
}

/**
 * Update edge candidates based on newly revealed cells.
 */
export function updateEdgeCandidatesFromReveal(
  edgeCandidates: EdgeCandidates,
  board: Board,
  size: number,
  revealed: Position[]
) {
  if (!revealed.length) {
    return edgeCandidates;
  }
  const next = new Set(edgeCandidates);
  for (const pos of revealed) {
    next.delete(keyFor(pos.row, pos.col));
    for (const [dRow, dCol] of DIRECTIONS) {
      const nRow = pos.row + dRow;
      const nCol = pos.col + dCol;
      if (!inBounds(size, nRow, nCol)) {
        continue;
      }
      const neighbor = board[nRow][nCol];
      if (
        !neighbor.revealed &&
        !neighbor.flagged &&
        (neighbor.isBomb || neighbor.adjacentBombCount > 0)
      ) {
        next.add(keyFor(nRow, nCol));
      }
    }
  }
  return next;
}

/**
 * Update a single cell's candidate status after flagging/unflagging.
 */
export function updateEdgeCandidateForCell(
  edgeCandidates: EdgeCandidates,
  board: Board,
  size: number,
  row: number,
  col: number
) {
  const key = keyFor(row, col);
  const cell = board[row][col];
  const isCandidate =
    !cell.revealed &&
    !cell.flagged &&
    (cell.isBomb || cell.adjacentBombCount > 0) &&
    hasRevealedNeighbor(board, size, row, col);

  const next = new Set(edgeCandidates);
  if (isCandidate) {
    next.add(key);
  } else {
    next.delete(key);
  }
  return next;
}

/**
 * Pick a random hint candidate from the edge set.
 */
export function selectHintCandidate(edgeCandidates: EdgeCandidates, board: Board) {
  const candidates = Array.from(edgeCandidates).filter((key) => {
    const { row, col } = parseKey(key);
    const cell = board[row][col];
    return (
      !cell.revealed &&
      !cell.flagged &&
      (cell.isBomb || cell.adjacentBombCount > 0)
    );
  });

  if (!candidates.length) {
    return null;
  }

  const choice = candidates[Math.floor(Math.random() * candidates.length)];
  return parseKey(choice);
}
