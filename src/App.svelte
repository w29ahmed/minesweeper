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

    board = revealCell(board, row, col);
  }

  function handleToggleFlag(row: number, col: number) {
    // Don't allow placing more flags than bombs.
    if (!board[row][col].flagged && flagsPlaced >= BOMB_COUNT) {
      return;
    }
    const result = toggleFlag(board, row, col);
    board = result.board;
    flagsPlaced = Math.max(0, flagsPlaced + result.delta);
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
  <NavBar bind:isDarkTheme {timeLabel} {bombsLeft} on:restart={resetGame} />
  <section class="flex flex-1 min-h-0 bg-amber-100 dark:bg-slate-950">
    <Board
      {board}
      size={BOARD_SIZE}
      longPressMs={350}
      onReveal={handleReveal}
      onToggleFlag={handleToggleFlag}
    />
  </section>
</main>
