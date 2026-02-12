<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import Fa from "svelte-fa";
  import {
    faClock,
    faFlag,
    faRotateRight,
    faQuestion,
  } from "@fortawesome/free-solid-svg-icons";
  import ThemeToggleSwitch from "./ThemeToggleSwitch.svelte";

  export let isDarkTheme: boolean;
  export let timeLabel: string = "0:00";
  export let bombsLeft: number = 10;
  export let penaltyAnimationKey: number = 0;

  const dispatch = createEventDispatcher();

  // Hook for future game logic to reset the board/timer.
  function handleRestart() {
    dispatch("restart");
  }

  function handleHint() {
    dispatch("hint");
  }
</script>

<nav
  class="w-full grid grid-cols-3 items-center px-3 py-2 border-b border-slate-200 bg-white/70 dark:border-slate-700 dark:bg-slate-800/70 sm:px-6 sm:py-3"
>
  <div class="flex items-center gap-2 relative sm:gap-3">
    <button
      type="button"
      class="group relative h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent hover:border-slate-300 dark:hover:border-slate-600 sm:h-9 sm:w-9"
      aria-label="Restart game"
      on:click={handleRestart}
    >
      <Fa icon={faRotateRight} class="text-slate-800 dark:text-slate-100" />
      <span class="tooltip">Restart</span>
    </button>
    <button
      type="button"
      class="group relative h-8 w-8 inline-flex items-center justify-center rounded-md border border-transparent hover:border-slate-300 dark:hover:border-slate-600 sm:h-9 sm:w-9"
      aria-label="Show hint"
      on:click={handleHint}
    >
      <Fa icon={faQuestion} class="text-slate-700 dark:text-slate-100" />
      <span class="tooltip">Hint</span>
    </button>
  </div>

  <div
    class="flex items-center justify-center gap-1 text-xs uppercase tracking-wide sm:gap-2 sm:text-sm leading-none"
  >
    <Fa icon={faClock} class="text-slate-500 dark:text-slate-300" />
    <span
      class="relative inline-flex items-center font-mono text-slate-800 dark:text-slate-100"
    >
      {timeLabel}
      {#if penaltyAnimationKey}
        {#key penaltyAnimationKey}
          <!-- Forces the +10 to re-mount so the animation replays each penalty. -->
          <span class="time-penalty">+10</span>
        {/key}
      {/if}
    </span>
  </div>

  <div class="flex items-center justify-end gap-3 sm:gap-4">
    <div
      class="flex items-center gap-1 text-xs uppercase tracking-wide sm:gap-2 sm:text-sm"
    >
      <Fa icon={faFlag} class="text-rose-500" />
      <span class="font-mono text-slate-800 dark:text-slate-100"
        >{bombsLeft}</span
      >
    </div>
    <ThemeToggleSwitch bind:isDarkTheme />
  </div>
</nav>

<style>
  .time-penalty {
    position: absolute;
    left: calc(100% + 6px);
    top: 50%;
    color: #ef4444;
    font-weight: 700;
    animation: penalty-pop 1s ease-out forwards;
    pointer-events: none;
  }

  @keyframes penalty-pop {
    0% {
      opacity: 0;
      transform: translateY(calc(-50% + 6px));
    }
    20% {
      opacity: 1;
      transform: translateY(-50%);
    }
    100% {
      opacity: 0;
      transform: translateY(calc(-50% - 10px));
    }
  }

  .tooltip {
    position: absolute;
    top: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.9);
    color: #f8fafc;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    opacity: 0;
    pointer-events: none;
    transition:
      opacity 150ms ease,
      transform 150ms ease;
    white-space: nowrap;
    z-index: 20;
  }

  .group:hover .tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
</style>
