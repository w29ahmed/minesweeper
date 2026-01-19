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
          class={`relative flex h-full w-full items-center justify-center text-sm font-semibold border border-amber-200 dark:border-slate-700 ${
            cell.revealed
              ? "bg-amber-50 dark:bg-slate-700"
              : "bg-amber-100 hover:bg-amber-200 dark:bg-slate-600 dark:hover:bg-slate-500"
          }`}
          on:pointerdown={() => handlePointerDown(cell)}
          on:pointerup={() => handlePointerUp(cell)}
          on:pointerleave={handlePointerCancel}
          on:pointercancel={handlePointerCancel}
          on:contextmenu|preventDefault
        >
          {#if cell.revealed}
            {#if cell.isBomb}
              <Fa icon={faBomb} class="text-slate-700 dark:text-rose-300" />
            {:else if cell.adjacent > 0}
              <span class={numberClass(cell.adjacent)}>{cell.adjacent}</span>
            {/if}
          {:else if cell.flagged}
            <Fa icon={faFlag} class="text-rose-500" />
          {/if}
        </button>
      {/each}
    {/each}
  </div>
</div>
