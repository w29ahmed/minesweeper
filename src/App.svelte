<script lang="ts">
  import { onMount } from "svelte";
  import NavBar from "./components/NavBar.svelte";

  let isDarkTheme: boolean = localStorage.getItem("theme") === "dark";
  let elapsedSeconds = 0;
  let bombsLeft = 10;

  let timerId: ReturnType<typeof setInterval> | null = null;

  $: timeLabel = new Date(elapsedSeconds * 1000).toISOString().slice(14, 19);

  $: {
    localStorage.setItem("theme", isDarkTheme ? "dark" : "light");
    document.documentElement.classList.toggle("dark", isDarkTheme);
  }

  onMount(() => {
    document.documentElement.classList.toggle("dark", isDarkTheme);
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
  class={`min-h-screen flex flex-col ${
    isDarkTheme ? "bg-slate-900 text-slate-100" : "bg-amber-50 text-slate-900"
  }`}
>
  <NavBar bind:isDarkTheme {timeLabel} {bombsLeft} />
  <div class="flex-1"></div>
</main>
