<script lang="ts">
  import Fa from "svelte-fa";
  import { faMoon, faSun } from "@fortawesome/free-solid-svg-icons";

  export let isDarkTheme: boolean;

  function toggleTheme() {
    isDarkTheme = !isDarkTheme;
  }
</script>

<button
  type="button"
  class={`relative inline-flex h-8 w-14 items-center rounded-full border transition-colors ${
    isDarkTheme ? "bg-slate-700 border-slate-600" : "bg-slate-200 border-slate-300"
  }`}
  aria-pressed={isDarkTheme}
  aria-label="Toggle theme"
  on:click={toggleTheme}
>
  <span
    class={`absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-white shadow transition-transform ${
      isDarkTheme ? "translate-x-6" : "translate-x-0"
    }`}
  >
    {#if isDarkTheme}
      <span class="flex h-full w-full items-center justify-center">
        <Fa icon={faMoon} class="text-slate-700 text-xs" />
      </span>
    {:else}
      <span class="flex h-full w-full items-center justify-center">
        <Fa icon={faSun} class="text-amber-500 text-xs" />
      </span>
    {/if}
  </span>
</button>
