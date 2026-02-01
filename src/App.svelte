<script lang="ts">
  import { onMount } from "svelte";
  import NavBar from "./components/NavBar.svelte";
  import Board from "./components/Board.svelte";
  import { GameManager, type Board as GameBoard, type GameState } from "./lib/game";
  import { loadGameState, saveGameState } from "./stores/gameStore";

  // Theme toggle state; defaults to dark if nothing stored yet.
  let isDarkTheme: boolean = (localStorage.getItem("theme") ?? "dark") === "dark";
  // Elapsed timer value in seconds.
  let elapsedSeconds = 0;
  // Tunable constants for MVP; later we can swap based on difficulty.
  const BOARD_ROWS = 10;
  const BOARD_COLS = 10;
  const BOMB_COUNT = 25;

  const game = new GameManager(BOARD_ROWS, BOARD_COLS, BOMB_COUNT);

  let board: GameBoard = game.getBoard();
  let flagsPlaced = game.getFlagsPlaced();
  let hasStarted = game.getHasStarted();
  let hasRestoredState = false; // Prevents saving before restore completes.
  // Tracks temporary bomb reveals so we can animate without permanently revealing.
  // A key is added on bomb click and removed after the flash duration.
  let bombFlashKeys: string[] = [];
  // Tracks temporary hint highlights so the suggested square pulses.
  let hintFlashKeys: string[] = [];
  // Bumps to retrigger the +10 animation in the navbar.
  let penaltyAnimationKey = 0;
  let showRestartConfirm = false;

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
      game: game.getState(),
      elapsedSeconds,
    });
  }

  function syncFromGame() {
    board = game.getBoard();
    flagsPlaced = game.getFlagsPlaced();
    hasStarted = game.getHasStarted();
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
    game.reset();
    syncFromGame();
    bombFlashKeys = [];
    hintFlashKeys = [];
    penaltyAnimationKey = 0;
  }

  function handleRestartRequest() {
    if (!game.getHasStarted()) {
      return;
    }
    showRestartConfirm = true;
  }

  function confirmRestart() {
    showRestartConfirm = false;
    resetGame();
  }

  function cancelRestart() {
    showRestartConfirm = false;
  }

  function applyPenalty() {
    elapsedSeconds += 10;
    penaltyAnimationKey += 1;
  }

  function handleReveal(row: number, col: number) {
    const result = game.reveal(row, col);

    if (!hasStarted && game.getHasStarted()) {
      startTimer();
    }

    if (result.outcome === "bomb") {
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

    if (result.outcome === "revealed") {
      syncFromGame();
    }
  }

  function handleToggleFlag(row: number, col: number) {
    const result = game.toggleFlag(row, col);
    if (result.blocked) {
      return;
    }
    syncFromGame();
  }

  function handleHint() {
    if (!game.getHasStarted()) {
      return;
    }

    const candidate = game.getHintCandidate();
    if (!candidate) {
      return;
    }

    const choice = `${candidate.row}-${candidate.col}`;
    applyPenalty();
    hintFlashKeys = [...hintFlashKeys, choice];

    setTimeout(() => {
      const outcome = game.applyHint(candidate.row, candidate.col);
      if (outcome.action !== "none") {
        syncFromGame();
      }
      hintFlashKeys = hintFlashKeys.filter((item) => item !== choice);
    }, 1000);
  }

  onMount(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
    const saved = loadGameState();

    if (saved) {
      const gameState = saved.game;
      if (
        gameState.boardRows === BOARD_ROWS &&
        gameState.boardCols === BOARD_COLS &&
        gameState.bombCount === BOMB_COUNT
      ) {
        game.setState(gameState);
        syncFromGame();
        elapsedSeconds = saved.elapsedSeconds;
      }
    }

    hasRestoredState = true;

    // Resume the timer if a game was already in progress.
    if (game.getHasStarted()) {
      startTimer();
    }

    return resetTimer;
  });
</script>

<main
  class="relative min-h-screen flex flex-col bg-amber-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
>
  <NavBar
    bind:isDarkTheme
    {timeLabel}
    {bombsLeft}
    {penaltyAnimationKey}
    on:restart={handleRestartRequest}
    on:hint={handleHint}
  />
  <section class="flex flex-1 min-h-0 bg-amber-100 dark:bg-slate-950">
    <Board
      {board}
      longPressMs={350}
      {bombFlashKeys}
      {hintFlashKeys}
      onReveal={handleReveal}
      onToggleFlag={handleToggleFlag}
    />
  </section>

  {#if showRestartConfirm}
    <div
      class="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-label="Restart confirmation"
    >
      <div
        class="w-[min(90vw,420px)] rounded-xl bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-800 dark:text-slate-100"
      >
        <p class="text-lg font-semibold">
          Are you sure you want to restart the game?
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button
            type="button"
            class="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            on:click={cancelRestart}
          >
            No
          </button>
          <button
            type="button"
            class="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
            on:click={confirmRestart}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>
