<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Fa from "svelte-fa";
  import { faClock, faFlag, faRotateRight } from "@fortawesome/free-solid-svg-icons";
  import ThemeToggleSwitch from "./ThemeToggleSwitch.svelte";

  export let isDarkTheme: boolean;
  export let timeLabel: string = "00:00";
  export let bombsLeft: number = 10;

  const dispatch = createEventDispatcher();

  // Hook for future game logic to reset the board/timer.
  function handleRestart() {
    dispatch("restart");
  }
</script>

<nav
  class="w-full grid grid-cols-3 items-center px-6 py-3 border-b border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/70"
>
  <div class="flex items-center gap-3">
    <button
      type="button"
      class="h-9 w-9 inline-flex items-center justify-center rounded-md border border-transparent hover:border-slate-300 dark:hover:border-slate-600"
      aria-label="Restart game"
      on:click={handleRestart}
    >
      <Fa icon={faRotateRight} class="text-slate-800 dark:text-slate-100" />
    </button>
  </div>

  <div class="flex items-center justify-center gap-2 text-sm uppercase tracking-wide">
    <Fa icon={faClock} class="text-slate-500 dark:text-slate-300" />
    <span class="text-slate-500 dark:text-slate-300">Time</span>
    <span class="font-mono text-slate-800 dark:text-slate-100">{timeLabel}</span>
  </div>

  <div class="flex items-center justify-end gap-4">
    <div class="flex items-center gap-2 text-sm uppercase tracking-wide">
      <Fa icon={faFlag} class="text-rose-500" />
      <span class="font-mono text-slate-800 dark:text-slate-100">{bombsLeft}</span>
    </div>
    <ThemeToggleSwitch bind:isDarkTheme />
  </div>
</nav>
