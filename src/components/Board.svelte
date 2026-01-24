<script lang="ts">
  import Fa from "svelte-fa";
  import { faBomb, faFlag } from "@fortawesome/free-solid-svg-icons";
  import type { Board, Cell } from "../lib/game";

  export let board: Board;
  export let size: number;
  export let onReveal: (row: number, col: number) => void;
  export let onToggleFlag: (row: number, col: number) => void;
  export let longPressMs = 500;

  let pressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressFired = false;
  const REVEAL_DELAY_MS = 35;

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
  }

  function numberClass(value: number) {
    return numberColors[value] ?? "text-slate-600";
  }
</script>

<div class="flex-1 min-h-0 w-full">
  <div
    class="grid h-full w-full bg-amber-200/60 shadow-inner dark:bg-slate-800/70"
    style={`grid-template-columns: repeat(${size}, minmax(0, 1fr)); grid-template-rows: repeat(${size}, minmax(0, 1fr));`}
  >
    {#each board as row}
      {#each row as cell (cell.row + "-" + cell.col)}
        <button
          type="button"
          style={`--reveal-delay: ${(cell.revealStep ?? 0) * REVEAL_DELAY_MS}ms;`}
          class="cell group relative flex h-full w-full items-center justify-center text-sm font-semibold border border-amber-200 bg-amber-50 dark:border-slate-500 dark:bg-slate-700"
          on:pointerdown={() => handlePointerDown(cell)}
          on:pointerup={() => handlePointerUp(cell)}
          on:pointerleave={handlePointerCancel}
          on:pointercancel={handlePointerCancel}
          on:contextmenu|preventDefault
        >
          <span
            class={`cell-content ${cell.revealed ? "cell-content--shown" : ""}`}
          >
            {#if cell.isBomb}
              <Fa icon={faBomb} class="text-slate-700 dark:text-rose-300" />
            {:else if cell.adjacent > 0}
              <span class={numberClass(cell.adjacent)}>{cell.adjacent}</span>
            {/if}
          </span>

          <span
            class={`cell-flag ${cell.flagged && !cell.revealed ? "cell-flag--shown" : ""}`}
          >
            <Fa icon={faFlag} class="text-rose-500" />
          </span>

          <span
            class={`cell-cover ${cell.revealed ? "cell-cover--hidden" : ""}`}
          />
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  .cell {
    --reveal-delay: 0ms;
  }

  .cell-cover {
    position: absolute;
    inset: 0;
    z-index: 10;
    background-color: rgb(254 243 199 / 1);
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
    background-color: rgb(253 230 138 / 1);
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
</style>
