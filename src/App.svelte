<script lang="ts">
  import { onMount } from "svelte";
  import NavBar from "./components/NavBar.svelte";

  let isDarkTheme: boolean = localStorage.getItem("theme") === "dark";
  let elapsedSeconds = 0;
  let bombsLeft = 10;

  let timerId: ReturnType<typeof setInterval> | null = null;

  // Keep a human-readable timer label for the navbar.
  $: timeLabel = new Date(elapsedSeconds * 1000).toISOString().slice(14, 19);

  // Persist theme choice and toggle the root class for Tailwind dark variants.
  $: {
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }

  onMount(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
    // Basic interval timer for the MVP; real game state will drive this later.
    timerId = setInterval(() => {
      elapsedSeconds += 1;
    }, 1000);

    return () => {
      if (timerId) {
        clearInterval(timerId);
      }
    };
  });
</script>

<main
  class="min-h-screen flex flex-col bg-amber-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100"
>
  <NavBar bind:isDarkTheme {timeLabel} {bombsLeft} />
  <div class="flex-1 bg-amber-100 dark:bg-slate-950"></div>
</main>
