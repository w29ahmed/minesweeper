# Minesweeper

A cozy, modern take on a classic. Built to feel fast and satisfying on both desktop and mobile, with a board generator that leans toward solvable games. I first learned how to play Minesweeper during a job interview when I was asked to implement its backend logic. I passed, got addicted, and eventually decided to make a clean version of my own. Try it [here](https://w29ahmed.github.io/minesweeper)!

<div align="center">
  <img src="./assets/demo.gif" alt="demo" width="100%">
</div>

### What Makes It Special

- **Solvable board generation**: A time‑budgeted solver + mutation search that aims for boards you can reason through without guesses.
- **Responsive UI**: The board size adapts to your screen and difficulty choice.
- **Delightful feedback**: Subtle animations and penalties for mistakes.
- **Hints on demand**: A quick hint system when you’re stuck.
- **Resume where you left off**: Game state is saved so returning to the tab picks up right where you stopped.

### Technical Deep Dives

Curious how things work under the hood?

- **[solvable_board_algorithm.md](./docs/solvable_board_algorithm.md)**: How boards are generated with a time‑budgeted solver + mutation search.
- **[hint_manager.md](./docs/hint_manager.md)**: How hints are picked quickly without rescanning the board.

### Built With

- [Svelte](https://svelte.dev): A modern JavaScript framework for building fast, reactive web interfaces
- [Tailwind CSS](https://tailwindcss.com): Utility-first CSS framework for rapid UI development
- Icons from [Font Awesome](https://fontawesome.com)
- Hosted with [GitHub Pages](https://pages.github.com)

### Development

You’ll need [Node.js](https://nodejs.org/en) installed (npm comes with it).
For best results, use the version in [.nvmrc](.nvmrc). (`24.12.0`)

```
npm install
npm run dev
```

### Deploy

```
npm run build
npm run deploy
```
