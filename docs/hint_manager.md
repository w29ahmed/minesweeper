# Hint Manager

This document explains how hints are selected quickly and consistently during gameplay.

The implementation lives in [`src/lib/hint.ts`](../src/lib/hint.ts) and is used by the `GameManager` to provide an instant hint without rescanning the entire board each time.

---

## High‑Level Idea

Hints are chosen from a **maintained edge set**:

**Edge candidates** are unrevealed, unflagged cells that are **adjacent to at least one revealed cell** and **not empty** (i.e., they are a bomb or have a non‑zero adjacent count).

Because this edge set is updated incrementally after each move, hint selection stays fast:

- **O(1)** to pick a random candidate
- **O(k)** to update after a reveal, where _k_ is the number of cells revealed in that move

---

## Lifecycle

### 1) Rebuild on Load

When a saved game is loaded, the edge set is **rebuilt once** by scanning the board:

- Find every revealed cell
- Add any adjacent unrevealed non‑empty neighbors to the candidate set

This ensures hints are consistent after reloads.

### 2) Update After Reveal

When one or more cells are revealed:

- Remove those cells from the candidate set
- Add any adjacent unrevealed non‑empty neighbors

This is done incrementally so we never have to rescan the full board.

### 3) Update After Flag / Unflag

When a flag is toggled:

- Re‑evaluate just that cell
- Add or remove it from the candidate set based on whether it still qualifies

---

## Selecting a Hint

When the user asks for a hint:

1. Choose a random cell from the edge set.
2. Validate it is still unrevealed / unflagged.
3. Return that cell as the hint target.

If the edge set is empty, no hint is returned.

---

## Why This Works

Most of the “interesting” cells are right next to revealed tiles, so the edge set captures **useful, actionable hints** without scanning the full grid. It keeps hints fast even on large boards and makes the hint system predictable after reloads.
