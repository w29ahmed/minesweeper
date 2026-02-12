<script lang="ts">
  import { onMount, tick } from "svelte";
  import { fade, scale } from "svelte/transition";
  import NavBar from "./components/NavBar.svelte";
  import Board from "./components/Board.svelte";
  import {
    GameManager,
    type Board as GameBoard,
    type GameState,
  } from "./lib/game";
  import {
    loadGameState,
    saveGameState,
    type PersistedState,
  } from "./stores/gameStore";
  import { computeBoardConfig, type Difficulty } from "./lib/difficulty";

  // Theme toggle state; defaults to dark if nothing stored yet.
  let isDarkTheme: boolean =
    (localStorage.getItem("theme") ?? "dark") === "dark";
  // Elapsed timer value in seconds.
  let elapsedSeconds = 0;
  // Difficulty is chosen via the start modal.
  let difficulty: Difficulty | null = null;

  // Initialized on mount via viewport sizing; keep null until then.
  let boardRows: number | null = null;
  let boardCols: number | null = null;
  let bombCount: number | null = null;
  let game: GameManager | null = null;

  let board: GameBoard | null = null;
  let flagsPlaced = 0;
  let hasStarted = false;
  let hasRestoredState = false; // Prevents saving before restore completes.
  let hasFinished = false;
  let showGameOverModal = false;
  let gameOverCorrect = true;
  let mistakes = 0;
  let hintsUsed = 0;
  // Tracks temporary bomb reveals so we can animate without permanently revealing.
  // A key is added on bomb click and removed after the flash duration.
  let bombFlashKeys: string[] = [];
  // Tracks temporary hint highlights so the suggested square pulses.
  let hintFlashKeys: string[] = [];
  // Tracks incorrect flag attempts so we can animate the flag feedback.
  let wrongFlagKeys: string[] = [];
  // Bumps to retrigger the +10 animation in the navbar.
  let penaltyAnimationKey = 0;
  let showRestartConfirm = false;
  let navContainer: HTMLDivElement | null = null;
  let showDifficultyModal = true;

  let timerId: ReturnType<typeof setInterval> | null = null;

  function formatElapsed(secondsTotal: number) {
    const hours = Math.floor(secondsTotal / 3600);
    const minutes = Math.floor((secondsTotal % 3600) / 60);
    const seconds = secondsTotal % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  // Keep a human-readable timer label for the navbar.
  $: timeLabel = formatElapsed(elapsedSeconds);
  $: bombsLeft = Math.max(0, (bombCount ?? 0) - flagsPlaced);

  // Persist theme choice and toggle the root class for Tailwind dark variants.
  $: {
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }

  // Persist game state so users can resume where they left off.
  $: if (hasRestoredState && game && board) {
    saveGameState({
      game: game.getState(),
      elapsedSeconds,
      mistakes,
      hintsUsed,
    });
  }

  function syncFromGame() {
    if (!game) {
      return;
    }
    board = game.getBoard();
    flagsPlaced = game.getFlagsPlaced();
    hasStarted = game.getHasStarted();
    checkForCompletion();
  }

  async function startGameForDifficulty(level: Difficulty) {
    await tick();
    const navHeight = navContainer?.offsetHeight ?? 0;
    const config = computeBoardConfig({
      difficulty: level,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      navHeight,
    });

    const { rows, cols, bombs } = config;
    difficulty = level;
    boardRows = rows;
    boardCols = cols;
    bombCount = bombs;
    game = new GameManager(rows, cols, bombs);
    resetTimer();
    hasFinished = false;
    showGameOverModal = false;
    gameOverCorrect = true;
    mistakes = 0;
    hintsUsed = 0;
    bombFlashKeys = [];
    hintFlashKeys = [];
    wrongFlagKeys = [];
    penaltyAnimationKey = 0;
    syncFromGame();

    hasRestoredState = true;

    if (game?.getHasStarted() && !hasFinished) {
      startTimer();
    }
  }

  function handleDifficultySelect(level: Difficulty) {
    showDifficultyModal = false;
    startGameForDifficulty(level);
  }

  function startGameFromSaved(saved: PersistedState) {
    const { game: gameState, elapsedSeconds: savedSeconds } = saved;
    boardRows = gameState.boardRows;
    boardCols = gameState.boardCols;
    bombCount = gameState.bombCount;
    game = new GameManager(
      gameState.boardRows,
      gameState.boardCols,
      gameState.bombCount
    );
    game.setState(gameState);
    syncFromGame();
    elapsedSeconds = savedSeconds;
    mistakes = saved.mistakes ?? 0;
    hintsUsed = saved.hintsUsed ?? 0;
    hasRestoredState = true;
    if (game.getHasStarted() && !hasFinished) {
      startTimer();
    }
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

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function resetTimer() {
    stopTimer();
    elapsedSeconds = 0;
  }

  // Full reset used by the navbar restart action.
  function resetGame() {
    resetTimer();
    game = null;
    board = null;
    flagsPlaced = 0;
    hasStarted = false;
    difficulty = null;
    boardRows = null;
    boardCols = null;
    bombCount = null;
    hasFinished = false;
    showGameOverModal = false;
    gameOverCorrect = true;
    mistakes = 0;
    hintsUsed = 0;
    bombFlashKeys = [];
    hintFlashKeys = [];
    wrongFlagKeys = [];
    penaltyAnimationKey = 0;
    showDifficultyModal = true;
  }

  function handleRestartRequest() {
    if (!game || !game.getHasStarted()) {
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

  function dismissGameOver() {
    showGameOverModal = false;
  }

  function checkForCompletion() {
    if (hasFinished || !game) {
      return;
    }
    const status = game.getCompletionStatus();
    if (!status.complete) {
      return;
    }
    hasFinished = true;
    gameOverCorrect = status.correct;
    showGameOverModal = true;
    stopTimer();
  }

  function applyPenalty() {
    elapsedSeconds += 10;
    penaltyAnimationKey += 1;
  }

  function handleReveal(row: number, col: number) {
    if (hasFinished || !game) {
      return;
    }
    const activeGame = game;
    const result = activeGame.reveal(row, col);

    if (!hasStarted && game.getHasStarted()) {
      startTimer();
    }

    if (result.outcome === "bomb") {
      mistakes += 1;
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
    if (hasFinished || !game) {
      return;
    }
    const activeGame = game;
    if (!activeGame.getHasStarted()) {
      return;
    }
    const currentBoard = activeGame.getBoard();
    const cell = currentBoard.cells[row][col];

    // Handle if incorrect flag is placed
    if (!cell.flagged && !cell.isBomb) {
      mistakes += 1;
      applyPenalty();
      const key = `${row}-${col}`;
      if (!wrongFlagKeys.includes(key)) {
        wrongFlagKeys = [...wrongFlagKeys, key];
      }
      setTimeout(() => {
        wrongFlagKeys = wrongFlagKeys.filter((item) => item !== key);
      }, 700);
      return;
    }

    const result = activeGame.toggleFlag(row, col);
    if (result.blocked) {
      return;
    }
    syncFromGame();
  }

  function handleHint() {
    if (hasFinished || !game) {
      return;
    }
    if (!game.getHasStarted()) {
      return;
    }

    const activeGame = game;
    const candidate = activeGame.getHintCandidate();
    if (!candidate) {
      return;
    }

    hintsUsed += 1;
    const choice = `${candidate.row}-${candidate.col}`;
    applyPenalty();
    hintFlashKeys = [...hintFlashKeys, choice];

    setTimeout(() => {
      const outcome = activeGame.applyHint(candidate.row, candidate.col);
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
      showDifficultyModal = false;
      startGameFromSaved(saved);
    } else {
      showDifficultyModal = true;
    }

    return resetTimer;
  });
</script>

<main
  class="relative min-h-screen flex flex-col bg-amber-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
>
  <div bind:this={navContainer}>
    <NavBar
      bind:isDarkTheme
      {timeLabel}
      {bombsLeft}
      {penaltyAnimationKey}
      on:restart={handleRestartRequest}
      on:hint={handleHint}
    />
  </div>
  {#if board}
    <section
      class="flex flex-1 min-h-0 bg-amber-100 dark:bg-slate-950"
      in:scale={{ duration: 200, start: 0.98 }}
    >
      <Board
        {board}
        longPressMs={350}
        {bombFlashKeys}
        {hintFlashKeys}
        {wrongFlagKeys}
        onReveal={handleReveal}
        onToggleFlag={handleToggleFlag}
      />
    </section>
  {/if}

  {#if showDifficultyModal}
    <div
      class="fixed left-0 top-0 z-50 flex h-[100svh] w-[100svw] items-center justify-center bg-slate-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Select difficulty"
      transition:fade={{ duration: 150 }}
    >
      <div
        class="w-[min(90vw,420px)] rounded-xl bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-800 dark:text-slate-100"
        transition:scale={{ duration: 180, start: 0.96 }}
      >
        <p class="text-lg font-semibold text-center">
          Please select a difficulty
        </p>
        <div class="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            class="w-40 rounded-md bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 shadow hover:bg-emerald-500 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            on:click={() => handleDifficultySelect("easy")}
          >
            Easy
          </button>
          <button
            type="button"
            class="w-40 rounded-md bg-amber-300 px-4 py-2 text-sm font-semibold text-amber-950 shadow hover:bg-amber-400 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
            on:click={() => handleDifficultySelect("medium")}
          >
            Medium
          </button>
          <button
            type="button"
            class="w-40 rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-rose-950 shadow hover:bg-rose-500 dark:bg-rose-500 dark:text-rose-950 dark:hover:bg-rose-400"
            on:click={() => handleDifficultySelect("hard")}
          >
            Hard
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if showRestartConfirm}
    <div
      class="fixed left-0 top-0 z-30 flex h-[100svh] w-[100svw] items-center justify-center bg-slate-900/50"
      role="dialog"
      aria-modal="true"
      aria-label="Restart confirmation"
      transition:fade={{ duration: 150 }}
    >
      <div
        class="w-[min(90vw,420px)] rounded-xl bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-800 dark:text-slate-100"
        transition:scale={{ duration: 180, start: 0.96 }}
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

  {#if showGameOverModal}
    <div
      class="fixed left-0 top-0 z-40 flex h-[100svh] w-[100svw] items-center justify-center bg-slate-900/60"
      role="dialog"
      aria-modal="true"
      aria-label="Game completed"
      transition:fade={{ duration: 150 }}
    >
      <div
        class="relative w-[min(90vw,440px)] rounded-xl bg-white p-6 text-slate-900 shadow-xl dark:bg-slate-800 dark:text-slate-100"
        transition:scale={{ duration: 180, start: 0.96 }}
      >
        <button
          type="button"
          class="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          aria-label="Close game summary"
          on:click={dismissGameOver}
        >
          ×
        </button>
        <p class="text-lg font-semibold text-center">Game complete!</p>
        <p class="mt-2 text-center text-sm text-slate-600 dark:text-slate-300">
          Final time: {timeLabel}
        </p>

        {#if gameOverCorrect}
          {#if mistakes === 0 && hintsUsed === 0}
            <p
              class="mt-4 text-center text-base font-semibold text-emerald-600 dark:text-emerald-400"
            >
              Perfect game!
            </p>
          {:else}
            <p
              class="mt-4 text-center text-sm text-slate-600 dark:text-slate-300"
            >
              <span>Mistakes: {mistakes}</span>
              <span class="mx-2">Hints: {hintsUsed}</span>
            </p>
          {/if}
        {:else}
          <p class="mt-4 text-center text-sm text-rose-600 dark:text-rose-300">
            There is a mistake somewhere.
          </p>
        {/if}
      </div>
    </div>
  {/if}
</main>
