<script lang="ts">
  import { onMount } from "svelte";
  import NavBar from "./components/NavBar.svelte";
  import Board from "./components/Board.svelte";
  import {
    createEmptyBoard,
    generateBoard,
    revealCell,
    toggleFlag,
    type Board as GameBoard,
    type Position,
    DIRECTIONS,
  } from "./lib/game";
  import { loadGameState, saveGameState } from "./stores/gameStore";

  let isDarkTheme: boolean =
    (localStorage.getItem("theme") ?? "dark") === "dark";
  let elapsedSeconds = 0;
  // Tunable constants for MVP; later we can swap based on difficulty.
  const BOARD_SIZE = 10;
  const BOMB_COUNT = 25;

  let flagsPlaced = 0;
  let hasStarted = false;
  let board: GameBoard = createEmptyBoard(BOARD_SIZE);
  let hasRestoredState = false;
  // Tracks temporary bomb reveals so we can animate without permanently revealing.
  // A key is added on bomb click and removed after the flash duration.
  let bombFlashKeys: string[] = [];
  // Tracks temporary hint highlights so the suggested square pulses.
  let hintFlashKeys: string[] = [];
  // Bumps to retrigger the +10 animation in the navbar.
  let penaltyAnimationKey = 0;
  // Keeps a quick lookup of "edge" candidates for hints.
  let edgeCandidates = new Set<string>();

  let timerId: ReturnType<typeof setInterval> | null = null;

  // Keep a human-readable timer label for the navbar.
  $: timeLabel = new Date(elapsedSeconds * 1000).toISOString().slice(14, 19);
  $: bombsLeft = Math.max(0, BOMB_COUNT - flagsPlaced);

  // Persist theme choice and toggle the root class for Tailwind dark variants.
  $: {
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }

  // Persist game state so users can resume where they left off.
  $: if (hasRestoredState) {
    saveGameState({
      board,
      flagsPlaced,
      elapsedSeconds,
      hasStarted,
      boardSize: BOARD_SIZE,
      bombCount: BOMB_COUNT,
    });
  }

  // Timer starts on the first reveal to mimic classic Minesweeper.
  function startTimer() {
    if (timerId) {
      return;
    }
    timerId = setInterval(() => {
      elapsedSeconds += 1;
    }, 1000);
  }

  function resetTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
    elapsedSeconds = 0;
  }

  // Full reset used by the navbar restart action.
  function resetGame() {
    resetTimer();
    hasStarted = false;
    flagsPlaced = 0;
    board = createEmptyBoard(BOARD_SIZE);
    bombFlashKeys = [];
    hintFlashKeys = [];
    edgeCandidates = new Set<string>();
    penaltyAnimationKey = 0;
  }

  function applyPenalty() {
    elapsedSeconds += 10;
    penaltyAnimationKey += 1;
  }

  function keyFor(row: number, col: number) {
    return `${row}-${col}`;
  }

  function inBounds(row: number, col: number) {
    return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
  }

  function hasRevealedNeighbor(row: number, col: number) {
    for (const [dRow, dCol] of DIRECTIONS) {
      const nRow = row + dRow;
      const nCol = col + dCol;
      if (inBounds(nRow, nCol) && board[nRow][nCol].revealed) {
        return true;
      }
    }
    return false;
  }

  function rebuildEdgeCandidates() {
    const next = new Set<string>();
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        const cell = board[row][col];
        if (!cell.revealed) {
          continue;
        }
        for (const [dRow, dCol] of DIRECTIONS) {
          const nRow = row + dRow;
          const nCol = col + dCol;
          if (!inBounds(nRow, nCol)) {
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
    edgeCandidates = next;
  }

  function updateEdgeCandidatesFromReveal(revealed: Position[]) {
    if (!revealed.length) {
      return;
    }
    const next = new Set(edgeCandidates);
    for (const pos of revealed) {
      next.delete(keyFor(pos.row, pos.col));
      for (const [dRow, dCol] of DIRECTIONS) {
        const nRow = pos.row + dRow;
        const nCol = pos.col + dCol;
        if (!inBounds(nRow, nCol)) {
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
    edgeCandidates = next;
  }

  function updateEdgeCandidateForCell(row: number, col: number) {
    const key = keyFor(row, col);
    const cell = board[row][col];
    const isCandidate =
      !cell.revealed &&
      !cell.flagged &&
      (cell.isBomb || cell.adjacentBombCount > 0) &&
      hasRevealedNeighbor(row, col);

    const next = new Set(edgeCandidates);
    if (isCandidate) {
      next.add(key);
    } else {
      next.delete(key);
    }
    edgeCandidates = next;
  }

  // Preserve any flags placed before the first reveal.
  function applyExistingFlags(nextBoard: GameBoard) {
    for (const row of board) {
      for (const cell of row) {
        if (cell.flagged) {
          nextBoard[cell.row][cell.col].flagged = true;
        }
      }
    }
  }

  function handleReveal(row: number, col: number) {
    if (!hasStarted) {
      // Ensure the first revealed tile is never a bomb.
      let generated = generateBoard(BOARD_SIZE, BOMB_COUNT, { row, col });
      let attempts = 0;

      // Ensure the first reveal is an empty cell (no adjacent bombs).
      while (generated[row][col].adjacentBombCount !== 0 && attempts < 200) {
        generated = generateBoard(BOARD_SIZE, BOMB_COUNT, { row, col });
        attempts += 1;
      }

      applyExistingFlags(generated);
      board = generated;
      hasStarted = true;
      startTimer();
    }

    const cell = board[row][col];
    if (cell.isBomb) {
      applyPenalty();
      const key = `${row}-${col}`;
      if (!bombFlashKeys.includes(key)) {
        bombFlashKeys = [...bombFlashKeys, key];
      }
      setTimeout(() => {
        bombFlashKeys = bombFlashKeys.filter((item) => item !== key);
      }, 1000);
      return;
    }

    const result = revealCell(board, row, col);
    board = result.board;
    updateEdgeCandidatesFromReveal(result.revealed);
  }

  function handleToggleFlag(row: number, col: number) {
    // Don't allow placing more flags than bombs.
    if (!board[row][col].flagged && flagsPlaced >= BOMB_COUNT) {
      return;
    }
    const result = toggleFlag(board, row, col);
    board = result.board;
    flagsPlaced = Math.max(0, flagsPlaced + result.delta);
    updateEdgeCandidateForCell(row, col);
  }

  function handleHint() {
    if (!hasStarted || edgeCandidates.size === 0) {
      return;
    }

    const candidates = Array.from(edgeCandidates).filter((key) => {
      const [row, col] = key.split("-").map(Number);
      const cell = board[row][col];
      return (
        !cell.revealed &&
        !cell.flagged &&
        (cell.isBomb || cell.adjacentBombCount > 0)
      );
    });

    if (!candidates.length) {
      return;
    }

    const choice = candidates[Math.floor(Math.random() * candidates.length)];
    const [row, col] = choice.split("-").map(Number);

    applyPenalty();
    hintFlashKeys = [...hintFlashKeys, choice];

    setTimeout(() => {
      const cell = board[row][col];
      if (cell.revealed || cell.flagged) {
        hintFlashKeys = hintFlashKeys.filter((item) => item !== choice);
        return;
      }

      if (cell.isBomb) {
        handleToggleFlag(row, col);
        hintFlashKeys = hintFlashKeys.filter((item) => item !== choice);
        return;
      }

      const result = revealCell(board, row, col);
      board = result.board;
      updateEdgeCandidatesFromReveal(result.revealed);
      hintFlashKeys = hintFlashKeys.filter((item) => item !== choice);
    }, 1000);
  }

  onMount(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
    const saved = loadGameState();
    if (
      saved &&
      saved.boardSize === BOARD_SIZE &&
      saved.bombCount === BOMB_COUNT
    ) {
      board = saved.board;
      flagsPlaced = saved.flagsPlaced;
      elapsedSeconds = saved.elapsedSeconds;
      hasStarted = saved.hasStarted;
      rebuildEdgeCandidates();
    }
    hasRestoredState = true;

    // Resume the timer if a game was already in progress.
    if (hasStarted) {
      startTimer();
    }

    return resetTimer;
  });
</script>

<main
  class="min-h-screen flex flex-col bg-amber-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
>
  <NavBar
    bind:isDarkTheme
    {timeLabel}
    {bombsLeft}
    {penaltyAnimationKey}
    on:restart={resetGame}
    on:hint={handleHint}
  />
  <section class="flex flex-1 min-h-0 bg-amber-100 dark:bg-slate-950">
    <Board
      {board}
      size={BOARD_SIZE}
      longPressMs={350}
      {bombFlashKeys}
      {hintFlashKeys}
      onReveal={handleReveal}
      onToggleFlag={handleToggleFlag}
    />
  </section>
</main>
