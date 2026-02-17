<script lang="ts">
  import Fa from "svelte-fa";
  import { faBomb, faFlag } from "@fortawesome/free-solid-svg-icons";
  import type { Board, Cell } from "../lib/game";

  export let board: Board;
  export let onReveal: (row: number, col: number) => void;
  export let onToggleFlag: (row: number, col: number) => void;
  // Cell keys that should briefly show a bomb (penalty feedback).
  export let bombFlashKeys: string[] = [];
  // Cell keys that should briefly pulse when a hint reveals them.
  export let hintFlashKeys: string[] = [];
  // Cell keys that should show an incorrect-flag animation.
  export let wrongFlagKeys: string[] = [];
  export let longPressMs = 500;

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  const REVEAL_DELAY_MS = 35;
  let pressedCellKey: string | null = null;

  const numberColors: Record<number, string> = {
    1: "text-blue-500",
    2: "text-emerald-500",
    3: "text-red-500",
    4: "text-indigo-500",
    5: "text-amber-700",
    6: "text-teal-500",
    7: "text-slate-700",
    8: "text-slate-400",
  };

  // Long-press toggles flags; quick press reveals.
  function handlePointerDown(cell: Cell) {
    if (cell.revealed) {
      return;
    }

    longPressFired = false;
    pressedCellKey = `${cell.row}-${cell.col}`;
    pressTimer = setTimeout(() => {
      longPressFired = true;
      onToggleFlag(cell.row, cell.col);
    }, longPressMs);
  }

  function handlePointerUp(cell: Cell) {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }

    pressedCellKey = null;

    if (longPressFired) {
      return;
    }

    if (!cell.revealed && !cell.flagged) {
      onReveal(cell.row, cell.col);
    }
  }

  function handlePointerCancel() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
    pressedCellKey = null;
  }

  function numberClass(value: number) {
    return numberColors[value] ?? "text-slate-600";
  }

  function cellKey(cell: Cell) {
    return `${cell.row}-${cell.col}`;
  }
</script>

<div class="flex-1 min-h-0 w-full">
  <div
    class="board-grid grid h-full w-full bg-slate-100/60 shadow-inner dark:bg-slate-800/70"
    style={`grid-template-columns: repeat(${board.cols}, minmax(0, 1fr)); grid-template-rows: repeat(${board.rows}, minmax(0, 1fr));`}
  >
    {#each board.cells as row}
      {#each row as cell (cell.row + "-" + cell.col)}
        {@const key = cellKey(cell)}
        {@const isBombFlash = bombFlashKeys.includes(key)}
        {@const isHintFlash = hintFlashKeys.includes(key)}
        {@const isWrongFlag = wrongFlagKeys.includes(key)}
        <button
          type="button"
          style={`--reveal-delay: ${(cell.revealStep ?? 0) * REVEAL_DELAY_MS}ms;`}
          class={`cell group relative flex h-full w-full items-center justify-center text-sm font-semibold border border-slate-300 bg-white dark:border-slate-500 dark:bg-slate-700 ${
            pressedCellKey === `${cell.row}-${cell.col}` && !cell.revealed
              ? "cell-hold"
              : ""
          } ${isHintFlash ? "cell-hint" : ""}`}
          on:pointerdown={() => handlePointerDown(cell)}
          on:pointerup={() => handlePointerUp(cell)}
          on:pointerleave={handlePointerCancel}
          on:pointercancel={handlePointerCancel}
          on:contextmenu|preventDefault
        >
          <span
            class={`cell-content ${
              cell.revealed || isBombFlash ? "cell-content--shown" : ""
            }`}
          >
            {#if cell.isBomb}
              <span class={isBombFlash ? "bomb-shake" : ""}>
                <Fa icon={faBomb} class="text-rose-500 dark:text-rose-300" />
              </span>
            {:else if cell.adjacentBombCount > 0}
              <span class={numberClass(cell.adjacentBombCount)}
                >{cell.adjacentBombCount}</span
              >
            {/if}
          </span>

          <span
            class={`cell-flag ${
              (cell.flagged && !cell.revealed) || isWrongFlag
                ? "cell-flag--shown"
                : ""
            } ${isWrongFlag ? "cell-flag--wrong" : ""}`}
          >
            <Fa icon={faFlag} class="text-rose-500" />
          </span>

          <span
            class={`cell-cover ${cell.revealed || isBombFlash ? "cell-cover--hidden" : ""}`}
          />
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  .cell {
    --reveal-delay: 0ms;
    /* Prevent iOS double-tap zoom and long-press selection/callout. */
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
  }

  .board-grid {
    /* Avoid browser zoom gestures while tapping the grid. */
    touch-action: manipulation;
  }

  .cell-hold .cell-cover {
    filter: brightness(0.9);
  }

  :global(.dark) .cell-hold .cell-cover {
    filter: brightness(0.7);
  }

  .cell-hint .cell-cover {
    animation: hint-blink 0.3s steps(2, start) infinite;
  }

  :global(.dark) .cell-hint .cell-cover {
    animation: hint-blink-dark 0.3s steps(2, start) infinite;
  }

  @keyframes hint-blink {
    0%,
    50% {
      background-color: rgb(203 213 225 / 1);
    }
    51%,
    100% {
      background-color: rgb(226 232 240 / 1);
    }
  }

  @keyframes hint-blink-dark {
    0%,
    50% {
      background-color: rgb(100 116 139 / 1);
    }
    51%,
    100% {
      background-color: rgb(71 85 105 / 1);
    }
  }

  .cell-cover {
    position: absolute;
    inset: 0;
    z-index: 10;
    background-color: rgb(226 232 240 / 1);
    transform: scale(1);
    transform-origin: center;
    transition:
      transform var(--transition-duration),
      background-color var(--transition-duration);
    transition-delay: var(--reveal-delay);
  }

  :global(.dark) .cell-cover {
    background-color: rgb(71 85 105 / 1);
  }

  .cell:hover .cell-cover {
    background-color: rgb(203 213 225 / 1);
  }

  :global(.dark) .cell:hover .cell-cover {
    background-color: rgb(100 116 139 / 1);
  }

  .cell-cover--hidden {
    transform: scale(0);
  }

  .cell-content {
    position: relative;
    z-index: 1;
    opacity: 0;
    transform: scale(0.92);
    transition:
      opacity var(--transition-duration),
      transform var(--transition-duration);
    transition-delay: var(--reveal-delay);
  }

  .cell-content--shown {
    opacity: 1;
    transform: scale(1);
  }

  .cell-flag {
    position: absolute;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transform: scale(0.6);
    transition:
      transform var(--transition-duration),
      opacity var(--transition-duration);
  }

  .cell-flag--shown {
    opacity: 1;
    transform: scale(1);
  }

  .cell-flag--wrong {
    animation: flag-wrong 0.7s ease-out forwards;
  }

  @keyframes flag-wrong {
    0% {
      opacity: 1;
      transform: translateX(0) rotate(0deg) scale(1);
    }
    25% {
      transform: translateX(-2px) rotate(-6deg) scale(1);
    }
    50% {
      transform: translateX(2px) rotate(6deg) scale(1);
    }
    75% {
      transform: translateX(-2px) rotate(-4deg) scale(0.95);
    }
    100% {
      opacity: 0;
      transform: translateX(0) rotate(0deg) scale(0.7);
    }
  }

  .bomb-shake {
    display: inline-block;
    animation: bomb-shake 0.6s ease-in-out;
  }

  @keyframes bomb-shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-4px) rotate(-3deg);
    }
    50% {
      transform: translateX(4px) rotate(3deg);
    }
    75% {
      transform: translateX(-3px) rotate(-2deg);
    }
    100% {
      transform: translateX(0);
    }
  }
</style>
