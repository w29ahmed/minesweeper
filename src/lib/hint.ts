/**
 * Hint utilities and edge-candidate tracking for the Minesweeper board.
 * We maintain a set of edge candidates (unrevealed non-empty neighbors of revealed cells)
 * and update it incrementally after each move, so hints are O(1) to pick without rescanning.
 */
import { DIRECTIONS, inBounds, type Board, type Position } from "./game";

export type EdgeCandidates = Set<string>;

/**
 * Manages hint candidate tracking and selection for a single board.
 * Public API: reset, rebuild, updateFromReveal, updateForCell, selectHint.
 */
export class HintManager {
  private edgeCandidates: EdgeCandidates = new Set<string>();

  /**
   * Reset all hint state.
   */
  reset() {
    this.edgeCandidates = new Set<string>();
  }

  /**
   * Build a fresh set of edge candidates by scanning revealed cells.
   * Used on load to reconstruct the candidate set from saved state.
   */
  rebuild(board: Board) {
    const next = new Set<string>();
    for (let row = 0; row < board.rows; row += 1) {
      for (let col = 0; col < board.cols; col += 1) {
        const cell = board.cells[row][col];
        if (!cell.revealed) {
          continue;
        }
        for (const [dRow, dCol] of DIRECTIONS) {
          const nRow = row + dRow;
          const nCol = col + dCol;
          if (!inBounds(board.rows, board.cols, nRow, nCol)) {
            continue;
          }
          const neighbor = board.cells[nRow][nCol];
          if (
            !neighbor.revealed &&
            !neighbor.flagged &&
            (neighbor.isBomb || neighbor.adjacentBombCount > 0)
          ) {
            next.add(this.keyFor(nRow, nCol));
          }
        }
      }
    }
    this.edgeCandidates = next;
  }

  /**
   * Update edge candidates based on newly revealed cells.
   */
  updateFromReveal(board: Board, revealed: Position[]) {
    if (!revealed.length) {
      return;
    }
    const next = new Set(this.edgeCandidates);
    for (const pos of revealed) {
      next.delete(this.keyFor(pos.row, pos.col));
      for (const [dRow, dCol] of DIRECTIONS) {
        const nRow = pos.row + dRow;
        const nCol = pos.col + dCol;
        if (!inBounds(board.rows, board.cols, nRow, nCol)) {
          continue;
        }
        const neighbor = board.cells[nRow][nCol];
        if (
          !neighbor.revealed &&
          !neighbor.flagged &&
          (neighbor.isBomb || neighbor.adjacentBombCount > 0)
        ) {
          next.add(this.keyFor(nRow, nCol));
        }
      }
    }
    this.edgeCandidates = next;
  }

  /**
   * Update a single cell's candidate status after flagging/unflagging.
   */
  updateForCell(board: Board, row: number, col: number) {
    const key = this.keyFor(row, col);
    const cell = board.cells[row][col];
    const isCandidate =
      !cell.revealed &&
      !cell.flagged &&
      (cell.isBomb || cell.adjacentBombCount > 0) &&
      this.hasRevealedNeighbor(board, row, col);

    const next = new Set(this.edgeCandidates);
    if (isCandidate) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.edgeCandidates = next;
  }

  /**
   * Pick a random hint candidate from the edge set.
   */
  selectHint(board: Board): Position | null {
    const candidates = Array.from(this.edgeCandidates).filter((key) => {
      const { row, col } = this.parseKey(key);
      const cell = board.cells[row][col];
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
    return this.parseKey(choice);
  }

  /**
   * Convert row/col to a stable string key for Set membership.
   */
  private keyFor(row: number, col: number) {
    return `${row}-${col}`;
  }

  /**
   * Convert a key back into a position.
   */
  private parseKey(key: string): Position {
    const [row, col] = key.split("-").map(Number);
    return { row, col };
  }

  /**
   * Determine whether an unrevealed cell has any revealed neighbor.
   */
  private hasRevealedNeighbor(board: Board, row: number, col: number) {
    for (const [dRow, dCol] of DIRECTIONS) {
      const nRow = row + dRow;
      const nCol = col + dCol;
      if (inBounds(board.rows, board.cols, nRow, nCol) && board.cells[nRow][nCol].revealed) {
        return true;
      }
    }
    return false;
  }
}
