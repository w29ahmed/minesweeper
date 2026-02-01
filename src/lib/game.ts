/**
 * GameManager owns all board state and core Minesweeper rules.
 * It provides a clean API for the UI and handles hint coordination internally.
 */
import { HintManager } from "./hint";
import { generateSolvableBoard } from "./generate_solveable_board";

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

export type Board = {
  rows: number;
  cols: number;
  cells: Cell[][];
};

export type Position = {
  row: number;
  col: number;
};

export type GameState = {
  board: Board;
  flagsPlaced: number;
  hasStarted: boolean;
  boardRows: number;
  boardCols: number;
  bombCount: number;
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
 * Guard for row/col bounds checks.
 */
export function inBounds(rows: number, cols: number, row: number, col: number) {
  return row >= 0 && row < rows && col >= 0 && col < cols;
}

export type RevealOutcome = {
  outcome: "bomb" | "revealed" | "ignored";
  revealed: Position[];
};

export type HintOutcome = {
  action: "flag" | "reveal" | "none";
  revealed: Position[];
};

/**
 * GameManager encapsulates board state and operations.
 * Public API: reset, getState, setState, getBoard, getFlagsPlaced, getHasStarted,
 * getRows, getCols, getBombCount, toggleFlag, reveal, getHintCandidate, applyHint.
 */
export class GameManager {
  private board: Board;
  private flagsPlaced = 0;
  private hasStarted = false;
  private hintManager: HintManager;

  constructor(private rows: number, private cols: number, private bombCount: number) {
    this.board = this.createEmptyBoard(rows, cols);
    this.hintManager = new HintManager();
  }

  /**
   * Reset the game to its initial state.
   */
  reset() {
    this.board = this.createEmptyBoard(this.rows, this.cols);
    this.flagsPlaced = 0;
    this.hasStarted = false;
    this.hintManager.reset();
  }

  /**
   * Snapshot current game state for persistence.
   */
  getState(): GameState {
    return {
      board: this.board,
      flagsPlaced: this.flagsPlaced,
      hasStarted: this.hasStarted,
      boardRows: this.rows,
      boardCols: this.cols,
      bombCount: this.bombCount,
    };
  }

  /**
   * Restore game state from persistence.
   */
  setState(state: GameState) {
    this.board = state.board;
    this.flagsPlaced = state.flagsPlaced;
    this.hasStarted = state.hasStarted;
    this.hintManager.rebuild(this.board);
  }

  /**
   * Read-only accessors for UI binding.
   */
  getBoard() {
    return this.board;
  }

  getFlagsPlaced() {
    return this.flagsPlaced;
  }

  getHasStarted() {
    return this.hasStarted;
  }

  getRows() {
    return this.rows;
  }

  getCols() {
    return this.cols;
  }

  getBombCount() {
    return this.bombCount;
  }

  /**
   * Toggle a flag on a cell, respecting the bomb count limit.
   */
  toggleFlag(row: number, col: number) {
    const cell = this.board.cells[row][col];
    if (cell.revealed) {
      return { delta: 0, blocked: false };
    }
    if (!cell.flagged && this.flagsPlaced >= this.bombCount) {
      return { delta: 0, blocked: true };
    }

    const result = this.toggleFlagCell(this.board, row, col);
    this.board = result.board;
    this.flagsPlaced = Math.max(0, this.flagsPlaced + result.delta);
    this.hintManager.updateForCell(this.board, row, col);
    return { delta: result.delta, blocked: false };
  }

  /**
   * Reveal a cell. Bombs return a bomb outcome without mutating the board.
   */
  reveal(row: number, col: number): RevealOutcome {
    if (!this.hasStarted) {
      this.generateFirstBoard({ row, col });
      this.hasStarted = true;
    }

    const cell = this.board.cells[row][col];
    if (cell.revealed || cell.flagged) {
      return { outcome: "ignored", revealed: [] };
    }

    if (cell.isBomb) {
      return { outcome: "bomb", revealed: [] };
    }

    const result = this.revealCellInternal(this.board, row, col);
    this.board = result.board;
    this.hintManager.updateFromReveal(this.board, result.revealed);
    return { outcome: "revealed", revealed: result.revealed };
  }

  /**
   * Get a hint candidate position or null if none exist.
   */
  getHintCandidate(): Position | null {
    return this.hintManager.selectHint(this.board);
  }

  /**
   * Apply a hint to a cell (flag bombs, reveal numbers).
   */
  applyHint(row: number, col: number): HintOutcome {
    if (!this.hasStarted) {
      return { action: "none", revealed: [] };
    }

    const cell = this.board.cells[row][col];
    if (cell.revealed || cell.flagged) {
      return { action: "none", revealed: [] };
    }

    if (cell.isBomb) {
      const result = this.toggleFlag(row, col);
      if (result.delta !== 0) {
        return { action: "flag", revealed: [] };
      }
      return { action: "none", revealed: [] };
    }

    const result = this.revealCellInternal(this.board, row, col);
    this.board = result.board;
    this.hintManager.updateFromReveal(this.board, result.revealed);
    return { action: "reveal", revealed: result.revealed };
  }

  /**
   * Check whether the board is fully covered (revealed or flagged) and correct.
   */
  getCompletionStatus() {
    let complete = true;
    let correct = true;

    for (const row of this.board.cells) {
      for (const cell of row) {
        if (!cell.revealed && !cell.flagged) {
          complete = false;
        }

        if (cell.isBomb) {
          if (!cell.flagged) {
            correct = false;
          }
        } else {
          if (cell.flagged || !cell.revealed) {
            correct = false;
          }
        }
      }
    }

    return { complete, correct };
  }

  /**
   * Copy any flags placed before the first reveal onto a newly generated board.
   */
  private applyExistingFlags(nextBoard: Board) {
    for (const row of this.board.cells) {
      for (const cell of row) {
        if (cell.flagged) {
          nextBoard.cells[cell.row][cell.col].flagged = true;
        }
      }
    }
  }

  /**
   * Generate a board on first reveal and ensure the clicked cell is empty.
   */
  private generateFirstBoard(safe: Position) {
    const generated = generateSolvableBoard(this.rows, this.cols, this.bombCount, safe, {
      debug: import.meta.env.DEV,
    });
    this.applyExistingFlags(generated);
    this.board = generated;
  }

  /**
   * Create a rows x cols board with no bombs and default cell state.
   */
  private createEmptyBoard(rows: number, cols: number): Board {
    const cells = Array.from({ length: rows }, (_, row) =>
      Array.from({ length: cols }, (_, col) => ({
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

    return { rows, cols, cells };
  }

  /**
   * Deep-clone a board so mutations don't affect the original.
   */
  private cloneBoard(board: Board): Board {
    return {
      rows: board.rows,
      cols: board.cols,
      cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
    };
  }

  /**
   * Toggle a flag on a cell and return the new board plus delta for flag count.
   */
  private toggleFlagCell(board: Board, row: number, col: number) {
    const next = this.cloneBoard(board);
    const cell = next.cells[row][col];

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
  private revealCellInternal(board: Board, row: number, col: number) {
    const next = this.cloneBoard(board);
    const start = next.cells[row][col];
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
      const cell = next.cells[current.row][current.col];
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
        if (inBounds(next.rows, next.cols, nRow, nCol)) {
          const neighbor = next.cells[nRow][nCol];
          if (!neighbor.revealed && !neighbor.flagged && !neighbor.isBomb) {
            queue.push({ row: nRow, col: nCol, dist: current.dist + 1 });
          }
        }
      }
    }

    return { board: next, revealed };
  }
}
